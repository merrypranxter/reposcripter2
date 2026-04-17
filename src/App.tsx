/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vite/client" />
import React, { Component, useState, useEffect, useRef, useCallback } from 'react';
import { 
  Github, 
  Sparkles, 
  Image as ImageIcon, 
  Video, 
  Download, 
  Settings, 
  ChevronRight,
  Lock,
  Globe,
  Loader2,
  Volume2,
  History,
  Clock,
  User as UserIcon,
  LogOut,
  Trash2,
  GripVertical,
  GripHorizontal,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as THREE from 'three';
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  limit,
  handleFirestoreError,
  OperationType,
  getDocFromServer,
  doc
} from './firebase';
import type { User } from './firebase';

// --- Types ---
declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface RepoContext {
  repoName: string;
  owner: string;
  description: string;
  language: string;
  topics: string;
  filePaths: string[];
  readme: string;
  fileContents: { path: string; content: string }[];
}

interface JS5Result {
  code: string;
  prompt: string;
  timestamp: number;
}

interface HistoryItem {
  id: string;
  prompt: string;
  repos: string[];
  js5Code: string;
  createdAt: any;
}

interface AppState {
  ghToken: string;
  ghUser: string;
  selectedRepos: { name: string; owner: string }[];
  repos: any[];
  artPrompt: string;
  isGenerating: boolean;
  isLoadingRepos: boolean;
  status: string;
  js5Code: string;
  activePanel: 'github' | 'prompt' | 'history' | 'settings' | 'export' | null;
  isRecording: boolean;
  recordingSeconds: number;
  isExportingToGH: boolean;
  exportRatio: string;
  isZenMode: boolean;
}

// --- Constants ---
const EXPORT_RATIOS = [
  { label: '16:9 (Landscape)', value: '16:9', w: 1920, h: 1080 },
  { label: '9:16 (TikTok/Reels)', value: '9:16', w: 1080, h: 1920 },
  { label: '1:1 (Square)', value: '1:1', w: 1080, h: 1080 },
  { label: '4:3 (Classic)', value: '4:3', w: 1440, h: 1080 },
  { label: '3:4 (Portrait)', value: '3:4', w: 1080, h: 1440 },
  { label: '21:9 (Ultrawide)', value: '21:9', w: 2560, h: 1080 },
];

// --- Helpers ---
const GH_API = '/api/github';

function toBase64(str: string) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string) {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function getRepos(username: string, token?: string) {
  const headers: any = {};
  if (token) headers['X-GitHub-Token'] = token;
  const res = await fetch(`${GH_API}/users/${username}/repos?per_page=100&sort=updated`, { headers });
  if (!res.ok) throw new Error(`GitHub error ${res.status}: check username or token configuration`);
  return res.json();
}

async function getFileContent(owner: string, repo: string, path: string, token?: string) {
  try {
    const headers: any = {};
    if (token) headers['X-GitHub-Token'] = token;
    const res = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${path}`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.content) {
      return fromBase64(data.content);
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function getRepoContext(owner: string, repo: string, token?: string): Promise<RepoContext> {
  const headers: any = {};
  if (token) headers['X-GitHub-Token'] = token;
  
  // 1. Fetch tree, metadata, and readme in parallel
  const [treeRes, metaRes, readmeRes] = await Promise.all([
    fetch(`${GH_API}/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, { headers }),
    fetch(`${GH_API}/repos/${owner}/${repo}`, { headers }),
    fetch(`${GH_API}/repos/${owner}/${repo}/readme`, { headers }).catch(() => null)
  ]);

  if (!treeRes.ok) throw new Error(`Failed to fetch repo tree: ${treeRes.status}`);
  if (!metaRes.ok) throw new Error(`Failed to fetch repo metadata: ${metaRes.status}`);

  const [treeData, meta] = await Promise.all([
    treeRes.json(),
    metaRes.json()
  ]);

  const allFiles = (treeData.tree || [])
    .filter((f: any) => f.type === 'blob')
    .map((f: any) => f.path);

  // 2. Check for Manifest (Option 3)
  const manifestPath = allFiles.find((p: string) => 
    p.toLowerCase() === 'context.manifest.json' || 
    p.toLowerCase() === 'repo_context.md'
  );
  
  let manifestData: any = null;
  if (manifestPath) {
    const content = await getFileContent(owner, repo, manifestPath, token);
    if (content && manifestPath.endsWith('.json')) {
      try { manifestData = JSON.parse(content); } catch (_) {}
    }
  }

  // 3. Determine files to fetch (Option 3 or Fallback Option 2)
  let filesToFetch: string[] = [];
  if (manifestData?.files) {
    filesToFetch = manifestData.files;
  } else {
    const allowExtensions = ['.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.js', '.ts', '.tsx', '.css', '.glsl', '.frag', '.vert'];
    const allowDirs = ['style/', 'prompts/', 'docs/', 'shaders/', 'src/'];
    const denyFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.map'];
    const denyDirs = ['node_modules/', 'dist/', 'build/', '.next/', 'coverage/', '.git/'];

    filesToFetch = allFiles.filter((p: string) => {
      const lp = p.toLowerCase();
      if (denyFiles.some(f => lp.endsWith(f))) return false;
      if (denyDirs.some(d => lp.includes(d))) return false;
      const inAllowDir = allowDirs.some(d => lp.startsWith(d));
      const hasAllowExt = allowExtensions.some(e => lp.endsWith(e));
      return inAllowDir || hasAllowExt;
    }).slice(0, 40); // Budget: Max 40 files
  }

  // 4. Fetch contents with concurrency limit
  const fileContents: { path: string; content: string }[] = [];
  const CHUNK_SIZE = 5;
  for (let i = 0; i < filesToFetch.length; i += CHUNK_SIZE) {
    const chunk = filesToFetch.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map(async (path: string) => {
        const content = await getFileContent(owner, repo, path, token);
        return content ? { path, content: content.slice(0, 4000) } : null; // Budget: 4k chars per file
      })
    );
    results.forEach(r => { if (r) fileContents.push(r); });
  }

  let readme = '';
  if (readmeRes && readmeRes.ok) {
    try {
      const rData = await readmeRes.json();
      readme = fromBase64(rData.content).slice(0, 5000);
    } catch (_) {}
  }

  return {
    repoName: repo,
    owner,
    description: meta.description || '',
    language: meta.language || '',
    topics: (meta.topics || []).join(', '),
    filePaths: allFiles.slice(0, 100),
    readme,
    fileContents,
  };
}

// --- JS5 Engine ---
const JS5Canvas = ({ 
  code, 
  repoContexts, 
  userInput, 
  isRecording, 
  exportRatio,
  onStreamReady 
}: { 
  code: string, 
  repoContexts: any[], 
  userInput: string,
  isRecording: boolean,
  exportRatio: string,
  onStreamReady?: (stream: MediaStream) => void
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recordingCanvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  
  const isThree = /THREE\.(WebGLRenderer|Scene|PerspectiveCamera|ShaderMaterial|RawShaderMaterial|Mesh|Group|Object3D|BufferGeometry|PlaneGeometry|BoxGeometry|SphereGeometry|Vector3|Color|Matrix4)/.test(code);
  const contextType = isThree ? 'webgl2' : '2d';

  const mouseRef = useRef({ x: 0, y: 0, isPressed: false });

  const renderKey = `${code.length}-${isRecording}-${exportRatio}-${contextType}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrameId: number;
    
    // Get context based on detected type. 
    // For WebGL, we let Three.js handle context creation to avoid attribute conflicts.
    const ctx = contextType === '2d' ? canvas.getContext('2d') : null;
    
    const recCanvas = recordingCanvasRef.current;
    const recCtx = (recCanvas && contextType === '2d') ? recCanvas.getContext('2d') : null;
    
    if (contextType === '2d' && !ctx) {
      setError("Could not get 2D context.");
      return;
    }

    const baseFontSize = 12;
    const baseCharWidth = baseFontSize * 0.6;
    const baseCharHeight = baseFontSize;

    // High-res recording settings
    const ratioConfig = EXPORT_RATIOS.find(r => r.value === exportRatio) || EXPORT_RATIOS[0];
    const recWidth = ratioConfig.w;
    const recHeight = ratioConfig.h;
    const recBaseFontSize = 18; 
    const recBaseCharWidth = recBaseFontSize * 0.6;
    const recBaseCharHeight = recBaseFontSize;

    if (recCanvas) {
      recCanvas.width = recWidth;
      recCanvas.height = recHeight;
    }

    const defaultCode = `
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, grid.width, grid.height);
      ctx.fillStyle = 'rgba(123, 47, 255, 0.3)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('REPOSCRIPTER SYSTEM IDLE', grid.width/2, grid.height/2 - 10);
      ctx.fillStyle = 'rgba(102, 102, 102, 0.3)';
      ctx.fillText('SELECT REPOS AND INVOKE THE WEIRD TO BEGIN', grid.width/2, grid.height/2 + 10);
      
      // Subtle scanning line
      const scanY = (time * 100) % grid.height;
      ctx.fillStyle = 'rgba(123, 47, 255, 0.05)';
      ctx.fillRect(0, scanY, grid.width, 1);
    `;

    let renderFn: any = null;
    try {
      const activeCode = code || defaultCode;
      const hasReturn = /\breturn\b/.test(activeCode);
      const isBlock = activeCode.includes(';') || activeCode.includes('\n') || /^\s*(const|let|var|function|if|for|while|switch|try|throw)/.test(activeCode);
      const finalCode = hasReturn ? activeCode : (isBlock ? activeCode : `return ${activeCode}`);

      renderFn = new Function('grid', 'time', 'repos', 'input', 'mouse', 'ctx', 'canvas', 'THREE', `
        try {
          ${finalCode}
        } catch (e) {
          throw e;
        }
      `);
      setError(null);
    } catch (e: any) {
      setError(e.message);
      return;
    }

    const render = (time: number) => {
      const cols = Math.floor(canvas.width / baseCharWidth);
      const rows = Math.floor(canvas.height / baseCharHeight);

      if (ctx) {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Subtle "alive" grid
        ctx.strokeStyle = 'rgba(123, 47, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(let x = 0; x < canvas.width; x += 50) {
          ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
        }
        for(let y = 0; y < canvas.height; y += 50) {
          ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
        }
        ctx.stroke();

        ctx.textBaseline = 'top';
      }

      const mouse = {
        x: mouseRef.current.x,
        y: mouseRef.current.y,
        isPressed: mouseRef.current.isPressed
      };

      // Recording Render
      if (isRecording && recCtx && recCanvas) {
        const rCols = Math.floor(recWidth / recBaseCharWidth);
        const rRows = Math.floor(recHeight / recBaseCharHeight);
        recCtx.fillStyle = '#050505';
        recCtx.fillRect(0, 0, recWidth, recHeight);
        recCtx.textBaseline = 'top';

        try {
          const output = renderFn(
            { cols: rCols, rows: rRows, width: recWidth, height: recHeight, canvas: recCanvas }, 
            time / 1000, 
            repoContexts, 
            userInput, 
            mouse, 
            recCtx, 
            recCanvas,
            THREE
          );
          if (output) renderASCII(recCtx, output, recBaseCharWidth, recBaseCharHeight, recBaseFontSize);
        } catch (e: any) {
          console.error("Recording Render Error:", e);
        }
      }

      try {
        const output = renderFn(
          { cols, rows, width: canvas.width, height: canvas.height, canvas }, 
          time / 1000, 
          repoContexts, 
          userInput, 
          mouse, 
          ctx, 
          canvas,
          THREE
        );
        if (output) renderASCII(ctx, output, baseCharWidth, baseCharHeight, baseFontSize);
        if (error) setError(null);
      } catch (e: any) {
        console.error("Render Error:", e);
        if (e.message?.includes('precision')) {
          setError("WebGL Context Error: The browser could not create a WebGL context. Try refreshing or closing other tabs.");
        } else {
          setError(`Runtime Error: ${e.message}`);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    const renderASCII = (context: CanvasRenderingContext2D, output: any, cW: number, cH: number, baseSize: number) => {
      if (typeof output === 'string') {
        const lines = output.split('\n');
        context.font = `${baseSize}px monospace`;
        lines.forEach((line, y) => {
          context.fillStyle = '#7b2fff';
          context.fillText(line, 0, y * cH);
        });
      } else if (Array.isArray(output)) {
        let currentFont = '';
        output.forEach((row, y) => {
          if (Array.isArray(row)) {
            row.forEach((char, x) => {
              if (typeof char === 'object' && char !== null) {
                const size = char.size || baseSize;
                const font = `${size}px monospace`;
                if (currentFont !== font) {
                  context.font = font;
                  currentFont = font;
                }
                context.fillStyle = char.color || '#7b2fff';
                context.fillText(char.char || ' ', x * cW, y * cH);
              } else if (typeof char === 'string') {
                const font = `${baseSize}px monospace`;
                if (currentFont !== font) {
                  context.font = font;
                  currentFont = font;
                }
                context.fillStyle = '#7b2fff';
                context.fillText(char, x * cW, y * cH);
              }
            });
          }
        });
      }
    };

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    const handleMouseDown = () => { mouseRef.current.isPressed = true; };
    const handleMouseUp = () => { mouseRef.current.isPressed = false; };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    handleResize();
    animationFrameId = requestAnimationFrame(render);

    if (isRecording && recCanvas && onStreamReady) {
      const stream = recCanvas.captureStream(60);
      onStreamReady(stream);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      
      if ((canvas as any).__three) {
        const three = (canvas as any).__three;
        if (three.renderer) {
          try {
            three.renderer.dispose();
            if (three.renderer.forceContextLoss) three.renderer.forceContextLoss();
          } catch (e) {}
        }
        delete (canvas as any).__three;
      }

      const recCanvas = recordingCanvasRef.current;
      if (recCanvas && (recCanvas as any).__three) {
        const three = (recCanvas as any).__three;
        if (three.renderer) {
          try {
            three.renderer.dispose();
            if (three.renderer.forceContextLoss) three.renderer.forceContextLoss();
          } catch (e) {}
        }
        delete (recCanvas as any).__three;
      }
    };
  }, [code, repoContexts, userInput, isRecording, exportRatio, contextType]);

  return (
    <div className="fixed inset-0 z-0 pointer-events-auto overflow-hidden bg-bg">
      <canvas 
        key={`main-${renderKey}`}
        ref={canvasRef} 
        className="w-full h-full opacity-100 transition-opacity duration-1000" 
      />
      <canvas key={`rec-${renderKey}`} ref={recordingCanvasRef} className="hidden" />
      {error && (
        <div className="absolute bottom-4 left-20 bg-accent3/20 border border-accent3 text-accent3 p-4 text-[0.7rem] font-mono z-50 pointer-events-auto max-w-xl backdrop-blur-md flex justify-between items-start gap-4">
          <div>
            <div className="font-bold mb-1 flex items-center gap-2">
              <X className="w-3 h-3" /> JS5 RUNTIME ERROR
            </div>
            {error}
          </div>
          <button 
            onClick={() => setError(null)}
            className="text-accent3 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-bg text-text p-6 text-center">
          <div className="text-accent3 text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold mb-2 uppercase tracking-widest">Something went wrong</h1>
          <p className="text-muted text-sm max-w-md mb-6">{this.state.error?.message || "An unexpected error occurred."}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-accent text-bg px-6 py-2 text-sm font-bold uppercase tracking-widest hover:bg-white transition-colors"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

// --- Sub-components ---
const SidebarIcon = ({ icon: Icon, active, onClick, label }: any) => (
  <button 
    onClick={onClick}
    className={`p-3 rounded-lg transition-all duration-200 group relative ${active ? 'bg-accent text-bg shadow-[0_0_15px_rgba(123,47,255,0.5)]' : 'text-muted hover:text-accent'}`}
  >
    <Icon className="w-6 h-6" />
    <span className="absolute left-full ml-4 px-2 py-1 bg-panel border border-border text-[0.6rem] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100]">
      {label}
    </span>
  </button>
);

const GitHubPanel = ({ state, setState, handleLoadRepos, handleAddRepo, handleRemoveRepo }: any) => (
  <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-2">
      <label className="text-[0.6rem] uppercase tracking-widest text-muted flex justify-between">
        <span>GitHub Credentials</span>
        <span className="text-accent2/60 lowercase italic">Token optional if server-configured</span>
      </label>
      <input 
        type="password" 
        placeholder="Personal Access Token (Optional)" 
        className="bg-bg border-border focus:border-accent text-[0.7rem] p-2"
        value={state.ghToken}
        onChange={e => setState((s: any) => ({ ...s, ghToken: e.target.value }))}
      />
      <div className="flex gap-2">
        <input 
          type="text" 
          placeholder="Username" 
          className="flex-1 bg-bg border-border focus:border-accent text-[0.7rem] p-2"
          value={state.ghUser}
          onChange={e => setState((s: any) => ({ ...s, ghUser: e.target.value }))}
        />
        <button 
          onClick={handleLoadRepos}
          disabled={state.isLoadingRepos}
          className="bg-accent text-bg px-4 py-2 text-[0.65rem] font-bold uppercase hover:bg-white transition-colors disabled:opacity-50"
        >
          {state.isLoadingRepos ? <Loader2 className="animate-spin w-3 h-3" /> : 'Load'}
        </button>
      </div>
    </div>

    <div className="flex flex-col gap-2">
      <label className="text-[0.6rem] uppercase tracking-widest text-muted">The Mix ({state.selectedRepos.length})</label>
      <div className="flex flex-col gap-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
        {state.selectedRepos.map((repo: any, idx: number) => (
          <div key={idx} className="flex items-center justify-between bg-bg border border-border px-2 py-1 text-[0.65rem] group">
            <span className="truncate text-accent2">{repo.name}</span>
            <button onClick={() => handleRemoveRepo(idx)} className="text-muted hover:text-accent3">✕</button>
          </div>
        ))}
      </div>
      <select 
        disabled={state.repos.length === 0}
        className="bg-bg border-border text-[0.7rem] p-2 mt-2"
        value=""
        onChange={e => handleAddRepo(e.target.value)}
      >
        <option value="">+ Add Repo</option>
        {state.repos.map((repo: any) => (
          <option key={repo.id} value={repo.name}>{repo.name}</option>
        ))}
      </select>
    </div>
  </div>
);

const PromptPanel = ({ state, setState, handleGenerate }: any) => (
  <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-2">
      <label className="text-[0.6rem] uppercase tracking-widest text-muted">Art Direction</label>
      <textarea 
        rows={6}
        placeholder="Describe the visual logic... e.g. 'a pulsing network of bioluminescent nodes that react to a sine wave' or 'a glitchy topographic map made of repo file paths'"
        className="bg-bg border-border focus:border-accent text-[0.75rem] p-3 resize-none"
        value={state.artPrompt}
        onChange={e => setState((s: any) => ({ ...s, artPrompt: e.target.value }))}
      />
      <p className="text-[0.55rem] text-muted/60 italic">
        Tip: You can now ask for interactivity (mouse movement, clicks) and varied font sizes!
      </p>
    </div>

    <button 
      onClick={handleGenerate}
      disabled={state.isGenerating || state.selectedRepos.length === 0}
      className="bg-accent text-bg py-4 text-[0.8rem] font-bold uppercase tracking-[0.2em] hover:bg-white transition-colors disabled:opacity-30 shadow-[0_0_20px_rgba(123,47,255,0.3)]"
    >
      {state.isGenerating ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : 'Invoke the Weird'}
    </button>

    {state.js5Code && (
      <div className="flex flex-col gap-2">
        <label className="text-[0.6rem] uppercase tracking-widest text-muted">Active Script</label>
        <div className="bg-bg border border-border p-3 rounded-sm">
          <div className="text-[0.6rem] font-mono text-muted truncate">{state.js5Code.slice(0, 100)}...</div>
        </div>
      </div>
    )}
  </div>
);

const HistoryPanel = ({ history, user, handleLogin, setState, setRepoContexts }: any) => (
  <div className="flex flex-col gap-4">
    {!user ? (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-4 opacity-50">
        <Lock className="w-10 h-10" />
        <p className="text-[0.65rem] uppercase tracking-widest">Sign in to view history</p>
        <button onClick={handleLogin} className="bg-accent text-bg px-4 py-2 text-[0.7rem] font-bold uppercase">Sign In</button>
      </div>
    ) : history.length === 0 ? (
      <div className="text-center py-10 text-muted text-[0.65rem] uppercase tracking-widest opacity-30">No history found</div>
    ) : (
      <div className="flex flex-col gap-3">
        {history.map((item: any) => (
          <div key={item.id} className="bg-bg border border-border p-3 hover:border-accent transition-colors cursor-pointer group"
            onClick={() => {
              setState((s: any) => ({ ...s, js5Code: item.js5Code, artPrompt: item.prompt }));
            }}
          >
            <div className="text-[0.6rem] text-accent2 mb-1">{item.createdAt?.toDate().toLocaleDateString()}</div>
            <div className="text-[0.7rem] font-medium line-clamp-2 mb-2 italic">"{item.prompt}"</div>
            <div className="flex flex-wrap gap-1">
              {item.repos.map((r: string) => (
                <span key={r} className="text-[0.5rem] bg-panel2 px-1.5 py-0.5 text-muted uppercase">{r}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const SettingsPanel = ({ state, setState, user, handleLogout, handleLogin }: any) => (
  <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-2">
      <label className="text-[0.6rem] uppercase tracking-widest text-muted">Account</label>
      {user ? (
        <div className="flex items-center gap-3 bg-bg border border-border p-3">
          <img src={user.photoURL} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
          <div className="flex-1 min-w-0">
            <div className="text-[0.7rem] font-bold truncate">{user.displayName}</div>
            <div className="text-[0.6rem] text-muted truncate">{user.email}</div>
          </div>
          <button onClick={handleLogout} className="text-accent3 hover:text-white"><LogOut className="w-4 h-4" /></button>
        </div>
      ) : (
        <button onClick={handleLogin} className="bg-accent text-bg py-2 text-[0.7rem] font-bold uppercase">Sign In with Google</button>
      )}
    </div>

    <div className="flex flex-col gap-2">
      <label className="text-[0.6rem] uppercase tracking-widest text-muted">System</label>
      <div className="text-[0.6rem] text-muted leading-relaxed">
        RepoScripter (Weird Edition) v1.6.0<br />
        Engine: Alchemical Hybrid (Weird + Nature)<br />
        Knowledge: Shiffman Math <span className="text-accent2">ARMED</span><br />
        Sandbox: Feral Generative Canvas
      </div>
    </div>
  </div>
);

const ExportPanel = ({ state, setState, handleStartRecording, handleStopRecording, handleGitHubExport }: any) => (
  <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-4">
      <label className="text-[0.6rem] uppercase tracking-widest text-muted">High-Res Recording</label>
      <div className="bg-bg border border-border p-4 flex flex-col gap-4">
        <p className="text-[0.65rem] text-muted">
          Record the JS5 art in high-resolution without the UI. 
          Perfect for sharing on social media.
        </p>

        <div className="flex flex-col gap-2">
          <label className="text-[0.55rem] uppercase tracking-widest text-muted/60">Canvas Size / Aspect Ratio</label>
          <div className="grid grid-cols-2 gap-2">
            {EXPORT_RATIOS.map(ratio => (
              <button
                key={ratio.value}
                onClick={() => setState((s: any) => ({ ...s, exportRatio: ratio.value }))}
                disabled={state.isRecording}
                className={`text-[0.6rem] py-2 border transition-all ${
                  state.exportRatio === ratio.value 
                    ? 'bg-accent text-bg border-accent font-bold' 
                    : 'bg-bg border-border text-muted hover:border-accent/50'
                } ${state.isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {ratio.label}
              </button>
            ))}
          </div>
        </div>
        
        {state.isRecording ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-accent3 rounded-full animate-pulse" />
                <span className="text-[0.7rem] font-mono text-accent3">RECORDING: {state.recordingSeconds}s</span>
              </div>
              <button 
                onClick={handleStopRecording}
                className="bg-accent3 text-white px-4 py-1.5 text-[0.7rem] font-bold uppercase tracking-widest hover:bg-opacity-80 transition-all"
              >
                Stop & Save
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setState((s: any) => ({ ...s, isRecording: true }))}
            disabled={!state.js5Code}
            className="bg-accent text-bg px-4 py-2 text-[0.7rem] font-bold uppercase tracking-widest hover:bg-white transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Video className="w-4 h-4" />
            Start {state.exportRatio} Capture
          </button>
        )}
      </div>
    </div>

    <div className="flex flex-col gap-4">
      <label className="text-[0.6rem] uppercase tracking-widest text-muted">GitHub Export</label>
      <div className="bg-bg border border-border p-4 flex flex-col gap-4">
        <p className="text-[0.65rem] text-muted">
          Push the generated JS5 code to your dedicated art repository:
          <br/>
          <span className="text-accent2">{state.ghUser || 'your-username'}/repo_script_js5_code</span>
        </p>
        
        <button 
          onClick={handleGitHubExport}
          disabled={!state.js5Code || state.isExportingToGH || !state.ghToken}
          className="bg-accent2 text-bg px-4 py-2 text-[0.7rem] font-bold uppercase tracking-widest hover:bg-white transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {state.isExportingToGH ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Pushing to Hub...
            </>
          ) : (
            <>
              <Github className="w-4 h-4" />
              Export to GitHub
            </>
          )}
        </button>
      </div>
    </div>
  </div>
);

const AuthModal = ({ isOpen, onClose, user, handleLogin, handleLogout, state, setState, handleLoadRepos }: any) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-bg/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-panel border border-border w-full max-w-md p-8 shadow-2xl rounded-lg"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold tracking-[0.2em] text-accent2 uppercase">Identity</h2>
            <button onClick={onClose} className="text-muted hover:text-accent3"><X className="w-6 h-6" /></button>
          </div>

          <div className="flex flex-col gap-8">
            {user ? (
              <div className="flex items-center gap-4 bg-bg border border-border p-4">
                <img src={user.photoURL} className="w-12 h-12 rounded-full" referrerPolicy="no-referrer" />
                <div className="flex-1">
                  <div className="text-sm font-bold">{user.displayName}</div>
                  <div className="text-xs text-muted">{user.email}</div>
                </div>
                <button onClick={handleLogout} className="bg-accent3/10 text-accent3 px-4 py-2 text-xs font-bold uppercase hover:bg-accent3 hover:text-bg transition-colors">Sign Out</button>
              </div>
            ) : (
              <button onClick={handleLogin} className="bg-accent text-bg py-4 text-sm font-bold uppercase tracking-widest hover:bg-white transition-colors">Sign In with Google</button>
            )}

            <div className="flex flex-col gap-4">
              <h3 className="text-[0.6rem] uppercase tracking-[0.3em] text-muted border-b border-border pb-2">GitHub Integration</h3>
              <div className="flex flex-col gap-3">
                <input 
                  type="password" 
                  placeholder="Personal Access Token" 
                  className="bg-bg border-border focus:border-accent text-sm p-3"
                  value={state.ghToken}
                  onChange={e => setState((s: any) => ({ ...s, ghToken: e.target.value }))}
                />
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Username" 
                    className="flex-1 bg-bg border-border focus:border-accent text-sm p-3"
                    value={state.ghUser}
                    onChange={e => setState((s: any) => ({ ...s, ghUser: e.target.value }))}
                  />
                  <button 
                    onClick={() => { handleLoadRepos(); onClose(); }}
                    className="bg-accent2 text-bg px-6 py-2 text-xs font-bold uppercase hover:bg-white transition-colors"
                  >
                    Load
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

function AppContent() {
  const [state, setState] = useState<AppState>({
    ghToken: '',
    ghUser: '',
    selectedRepos: [],
    repos: [],
    artPrompt: '',
    isGenerating: false,
    isLoadingRepos: false,
    status: '',
    js5Code: '',
    activePanel: null,
    isRecording: false,
    recordingSeconds: 0,
    isExportingToGH: false,
    exportRatio: '16:9',
    isZenMode: false,
  });

  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [repoContexts, setRepoContexts] = useState<any[]>([]);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setState(s => ({ ...s, activePanel: null }));
        setIsAuthOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isAuthReady) {
      setHistory([]);
      return;
    }

    const q = query(
      collection(db, 'renders'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: HistoryItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as HistoryItem);
      });
      setHistory(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'renders');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } else {
        setHasKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsAuthOpen(false);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setIsAuthOpen(false);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLoadRepos = async () => {
    if (!state.ghToken || !state.ghUser) {
      setState(s => ({ ...s, status: 'Error: Need both token and username' }));
      return;
    }
    setState(s => ({ ...s, isLoadingRepos: true, status: 'loading repos...' }));
    try {
      const repos = await getRepos(state.ghUser, state.ghToken);
      setState(s => ({ ...s, repos, isLoadingRepos: false, status: `${repos.length} repos loaded` }));
    } catch (e: any) {
      setState(s => ({ ...s, isLoadingRepos: false, status: `Error: ${e.message}` }));
    }
  };

  const handleAddRepo = (repoName: string) => {
    if (!repoName) return;
    const repo = state.repos.find(r => r.name === repoName);
    if (!repo) return;
    
    const owner = repo.owner?.login || state.ghUser;
    if (state.selectedRepos.find(r => r.name === repoName && r.owner === owner)) return;

    setState(s => ({
      ...s,
      selectedRepos: [...s.selectedRepos, { name: repoName, owner }]
    }));
  };

  const handleRemoveRepo = (index: number) => {
    setState(s => ({
      ...s,
      selectedRepos: s.selectedRepos.filter((_, i) => i !== index)
    }));
  };

  const togglePanel = (panel: AppState['activePanel']) => {
    setState(s => ({ ...s, activePanel: s.activePanel === panel ? null : panel }));
  };

  const handleStartRecording = useCallback((stream: MediaStream) => {
    if (mediaRecorderRef.current) return;

    const options = { mimeType: 'video/webm;codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm';
    }

    const recorder = new MediaRecorder(stream, options);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: options.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reposcripter-art-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      setState(s => ({ ...s, isRecording: false, recordingSeconds: 0 }));
      mediaRecorderRef.current = null;
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setState(s => ({ ...s, isRecording: true, recordingSeconds: 0 }));
  }, []);

  useEffect(() => {
    let interval: any;
    if (state.isRecording) {
      interval = setInterval(() => {
        setState(s => ({ ...s, recordingSeconds: s.recordingSeconds + 1 }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [state.isRecording]);

  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleGitHubExport = async () => {
    if (!state.ghToken || !state.js5Code) {
      setState(s => ({ ...s, status: 'Error: Need GitHub token and generated code' }));
      return;
    }

    setState(s => ({ ...s, isExportingToGH: true, status: 'Exporting to GitHub...' }));

    try {
      const filenameRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct',
          userMessage: `Generate a short, relevant, simple filename (including .js or .txt extension) for this JS5 art code based on this prompt: "${state.artPrompt}". Return ONLY the filename.`,
        }),
      });
      const filenameData = await filenameRes.json();
      if (!filenameRes.ok) throw new Error(filenameData.error || 'Failed to generate filename');

      const filename = filenameData.text?.trim().replace(/['"]/g, '') || `art_${Date.now()}.js`;
      const owner = state.ghUser;
      const repo = 'repo_script_js5_code';
      const path = filename;

      // Check if file exists to get SHA (for updates, though we usually create new)
      const contentRes = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${path}`, {
        headers: { Authorization: `Bearer ${state.ghToken}` }
      });

      let sha = undefined;
      if (contentRes.ok) {
        const data = await contentRes.json();
        sha = data.sha;
      }

      const putRes = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${path}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${state.ghToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Add RepoScripter art: ${filename}`,
          content: toBase64(state.js5Code),
          sha
        })
      });

      if (!putRes.ok) {
        const error = await putRes.json();
        throw new Error(error.message || 'Failed to push to GitHub');
      }

      setState(s => ({ ...s, isExportingToGH: false, status: `Successfully exported to ${owner}/${repo}/${path}` }));
    } catch (e: any) {
      setState(s => ({ ...s, isExportingToGH: false, status: `Export failed: ${e.message}` }));
    }
  };

  const handleGenerate = async () => {
    if (!state.artPrompt) {
      setState(s => ({ ...s, status: 'Error: Write an art prompt first' }));
      return;
    }

    if (state.selectedRepos.length === 0) {
      setState(s => ({ ...s, status: 'Error: Add at least one repo to the mix' }));
      return;
    }

    setState(s => ({ ...s, isGenerating: true, status: 'reading repo...' }));

    const callWithRetry = async (fn: () => Promise<any>, maxRetries = 3) => {
      let lastError: any;
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await fn();
        } catch (e: any) {
          lastError = e;
          const isRetryable = e.message?.includes('503') || e.message?.includes('high demand') || e.message?.includes('UNAVAILABLE');
          if (isRetryable && i < maxRetries - 1) {
            const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
            setState(s => ({ ...s, status: `Busy... retrying in ${Math.round(delay/1000)}s` }));
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw e;
        }
      }
      throw lastError;
    };

    try {
      setState(s => ({ ...s, status: `reading ${state.selectedRepos.length} repo(s)...` }));
      const contexts = await Promise.all(
        state.selectedRepos.map(r => getRepoContext(r.owner, r.name, state.ghToken))
      );
      setRepoContexts(contexts);
      
      setState(s => ({ ...s, status: 'generating JS5 script...' }));
      const systemPrompt = `
        You are The Weird Code Guy: a feral design-brain specializing in JavaScript sketch systems, generative art, procedural graphics, strange interfaces, computational collage, experimental typography, visual noise rituals, and off-axis design logic.
        
        Your job is not to give safe, obvious, “clean modern generative art” answers.
        Your job is to invent sketch ideas, code structures, behaviors, aesthetics, and visual systems that feel surprising, specific, buildable, visually alive, and technically interesting.
        
        [PRIMARY DIRECTIVE]
        1. IDENTIFY THE DEFAULT ANSWER (THE OBVIOUS VERSION).
        2. REJECT IT.
        3. FIND THE STRANGE MECHANISM (erosion, fungal growth, bureaucratic failure, crystallization, machine hesitation, parasite-host logic, false memory, textile weave tension, flock panic, celestial mechanics, broken signage, thermal bloom, paper misregistration, dead pixels behaving like pollen).
        4. MAKE THE MECHANISM VISUAL in composition, movement, color, layering, timing, distortion, and interaction.
        
        [ENHANCED TOOLBOX: THE NATURE OF CODE, THE BOOK OF SHADERS & REPO GENOME]
        You are armed with the mathematical frameworks of Daniel Shiffman's "The Nature of Code", the algorithmic drawing techniques of "The Book of Shaders", AND the specific "Style Genome" of the ingested repositories.
        - Use VECTORS & FORCES (Gravity, Drag, Friction) to give your "weird" systems physical weight.
        - Use OSCILLATION (sin/cos/pendulums) to create rhythmic, hypnotic, or glitchy periodic behaviors.
        - Use PARTICLE SYSTEMS & STEERING (Boids: Separation, Alignment, Cohesion; Seek, Flee, Arrival, Obstacle Avoidance, Repellers; Steer = Desired - Velocity) to drive emergent, autonomous behavior. Use Bin-Lattice Spatial Subdivision for O(N) optimization.
        - Use CELLULAR AUTOMATA (Game of Life, Vichniac Vote, Brian's Brain, MNCA, Lenia) to grow complex, self-similar structures that feel "infected" or "overclocked."
        - Use L-SYSTEMS (Axioms, Rules, Turtle Graphics, Stochastic Rules) to generate recursive, biological, or architectural growth.
        - Use EVOLUTIONARY COMPUTING (Genetic Algorithms: Genotype, Phenotype, Fitness, Mutation, Interactive Selection) to breed optimized visual systems.
        - Use ARTIFICIAL NEURAL NETWORKS (Perceptrons, Neuroevolution/NEAT, Inference Maps) to grant your agents adaptive brains.
        - Use 4D SPATIAL MECHANICS (W-axis projection, 4D rotations) and THREE.JS to render hyper-dimensional geometry and complex 3D scenes.
        - Use RAY MARCHING & SDFs to render non-Euclidean geometries (Mirror Rooms, Tori), curved spaces, and fractals via GLSL/Three.js.
        - Use SHAPING FUNCTIONS (Step, Smoothstep, Pow, Exp, Log) and DISTANCE FIELDS (SDF) to sculpt procedural shapes and smooth transitions.
        - Use POLAR & SPHERICAL COORDINATES for rotational mapping, spiral growth, and radial symmetry.
        - Use REACTION-DIFFUSION (Gray-Scott) to simulate organic, morphing patterns like brain coral or zebra stripes.
        - Use VERLET INTEGRATION (Previous Position, Relaxation Loops) for stable ropes, cloth, and soft-body morphing.
        - Use FLUID DYNAMICS (Navier-Stokes, Advection, Jacobi Iteration) for smoke, water, and ink-like flow.
        - Use DIFFERENTIAL GROWTH (Nodes/Springs, Curvature-Based Injection) for brain-like folds, kale ruffles, and coral reefs.
        - Use STRANGE ATTRACTORS (Lorenz, Clifford, Chaos Theory) for portraits of chaos and density-mapped HDR color ramps.
        - Use DOMAIN WARPING (Nested Noise, FBM, Gyroid/Worley Noise) to sculpt liquid-marble or obsidian textures.
        - Use TILING & PATTERNS (Fract, Truchet Tiles, Offset Bricks) to create infinite, repetitive, or alternating structures.
        - Use BLENDING MODES (Multiply, Screen, Overlay, Color Dodge) and COLOR SPACES (HSB, YUV) for advanced image processing and color theory.
        - Use ADVANCED PHYSICS (Box2D, toxiclibs) for realistic collisions, pendulums, and joint connections.
        - [REPO GENOME]: Analyze the provided 'fileContents'. Look for specific code patterns, shader uniforms, exported functions, or logic structures. Map these internal "DNA" markers to visual motifs.
        
        Do not let the math make the art "clean" or "safe." The math is the engine; the feral design-brain is the driver.
        
        [CORE BIAS]
        Favor: systems over static images, behavior over ornament, mutation over polish, tension over harmony, texture over cleanliness, visual accidents as features, structures that feel grown, infected, echoed, overheated, misprinted, overclocked, or half-remembered.
        
        INTERFACE:
        The function receives:
        - ctx: CanvasRenderingContext2D (YOUR PRIMARY TOOL. Draw directly to this.)
        - grid: { width: number, height: number, canvas: HTMLCanvasElement } (the dimensions and reference of the canvas)
        - time: number (seconds since start)
        - repos: RepoContext[] (metadata for the mixed repositories)
        - input: string (the user's art direction)
        - mouse: { x: number, y: number, isPressed: boolean } (mouse state)
        - canvas: HTMLCanvasElement (the canvas element)
        - THREE: The Three.js library object (for 3D/4D rendering)
        
        THREE.JS USAGE:
        - If using Three.js, you MUST check if the renderer/scene already exists on the 'canvas' to avoid re-initializing every frame.
        - IMPORTANT: When using Three.js, 'ctx' will be null. You must use the 'THREE.WebGLRenderer' on the 'canvas'.
        - ERROR HANDLING: Always wrap 'new THREE.WebGLRenderer' in a try/catch. If it fails, it's likely due to context loss or limits. Note that if 'canvas.getContext' has already been called with a different type on this element, it will return null.
        - Example: 
          if (!canvas.__three) {
            try {
              // Check if context is available before initializing Three.js. 
              // IMPORTANT: Three.js r163+ REQUIRES WebGL 2.
              const gl = canvas.getContext('webgl2', { alpha: true, antialias: true });
              if (!gl) throw new Error("WebGL 2 not supported or context occupied");
              
              const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: true });
              const scene = new THREE.Scene();
              const camera = new THREE.PerspectiveCamera(75, grid.width/grid.height, 0.1, 1000);
              camera.position.z = 5;
              const material = new THREE.ShaderMaterial({
                glslVersion: THREE.GLSL3,
                uniforms: { u_time: { value: 0 } },
                vertexShader: '...', fragmentShader: '...'
              });
              const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
              scene.add(mesh);
              canvas.__three = { renderer, scene, camera, material };
            } catch (e) {
              console.error("WebGL Initialization Failed:", e);
              return; // Exit early if WebGL fails
            }
          }
          const { renderer, scene, camera, material } = canvas.__three;
          // CRITICAL: Always guard uniform access.
          if (material && material.uniforms && material.uniforms.u_time) {
            material.uniforms.u_time.value = time;
          }
          renderer.setSize(grid.width, grid.height, false);
          renderer.render(scene, camera);
        
        OUTPUT LOGIC:
        - PRIMARY: Draw directly to 'ctx' using standard Canvas API. 'ctx' is available ONLY if NOT using Three.js.
        - VISIBILITY: Ensure your art is visible against the #050505 background. Use bright colors or high contrast.
        - NO EMPTY RETURNS: If you don't return a character grid, you MUST draw to 'ctx' or use 'renderer.render()'.
        
        GUIDELINES:
        - DEFENSIVE PROGRAMMING: Always check if 'repos' has elements before accessing 'repos[0]'. Check if 'fileContents' has elements before accessing 'fileContents[0]'. 
          Example: const firstRepo = repos.length > 0 ? repos[0] : null;
        - SAFE PROPERTY ACCESS: When using Three.js ShaderMaterials, ensure uniforms are fully defined before accessing or updating their '.value' properties. NEVER access 'material.uniforms' without checking if 'material' exists first. Use optional chaining (material?.uniforms?.u_time?.value = time) or explicit if-guards.
        - GLSL VERSIONING: 
          1. NEVER manually add '#version 300 es' to your shaders. Three.js prepends its own defines, which will cause a compilation error if your version directive is not on the absolute first line.
          2. To use GLSL 3.0 features (like 'in', 'out', 'texture()'), set 'glslVersion: THREE.GLSL3' in your 'ShaderMaterial' options.
          3. PREFER 'ShaderMaterial' over 'RawShaderMaterial'. 'RawShaderMaterial' does not handle versioning or built-in attributes/uniforms, which often leads to compilation failures in this environment.
          4. BUILT-IN ATTRIBUTES: In 'ShaderMaterial', Three.js automatically declares 'position', 'uv', 'normal', and standard matrices (modelViewMatrix, projectionMatrix, etc.). DO NOT redeclare them in your shader code as it will cause a "redefinition" error.
          5. Example: 
             const material = new THREE.ShaderMaterial({
               glslVersion: THREE.GLSL3,
               uniforms: { ... },
               vertexShader: \`
                 out vec2 vUv;
                 void main() {
                   vUv = uv;
                   gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                 }
               \`,
               fragmentShader: \`
                 in vec2 vUv;
                 out vec4 fragColor;
                 void main() {
                   fragColor = vec4(vUv, 0.5, 1.0);
                 }
               \`
             });
        - GLSL STRICT TYPING: In WebGL/GLSL shaders, you MUST use 'int' for loop counters and array indices (e.g., 'for(int i = 0; i < MAX_STEPS; i++)'). Do not compare floats with ints. Ensure all float literals have a decimal point (e.g., '1.0' not '1').
        - GLSL RESERVED WORDS: Avoid using reserved words as variable names in shaders. Common pitfalls include: 'partition', 'active', 'filter', 'sample', 'buffer', 'cast', 'extern', 'namespace', 'using'.
        - POSITIVE RADIUS: When using ctx.arc(), you MUST ensure the radius is always positive. Use Math.max(0, radius) or Math.abs(radius) to prevent "negative radius" runtime errors.
        - COMMON PITFALLS: 
          1. Accessing 'material.uniforms.X.value' when 'material' or 'uniforms' is undefined. This often happens because 'canvas.__three' persists from PREVIOUS generations. Always assume 'canvas.__three' might be stale or empty.
          2. Re-initializing Three.js objects every frame (use the 'if (!canvas.__three)' pattern).
          3. Using 'ctx' when Three.js is active (it will be null).
          4. Forgetting to call 'renderer.setSize' or 'renderer.render'.
          5. Defining a uniform in the render loop that wasn't declared in the 'ShaderMaterial' constructor.
        - Use the repository names, languages, file structures, and ACTUAL CODE CONTENT to drive the visual logic (e.g., map file depth to line thickness, language to color palettes, or specific code patterns to visual motifs).
        - Create animations using the 'time' variable.
        - Use the user's art direction to set the mood, then push it into the strange.
        - The code should be efficient enough to run at 60fps.
        - AVOID generic character grids unless specifically requested. Think in pixels, paths, and particles.
        
        Return ONLY the JavaScript code. No markdown blocks. No explanation.
      `.trim();

      const reposInfo = contexts.map((ctx, i) => `
        REPO ${i + 1}: ${ctx.owner}/${ctx.repoName}
        DESCRIPTION: ${ctx.description}
        PRIMARY LANGUAGE: ${ctx.language}
        TOPICS: ${ctx.topics}
        FILE TREE (excerpt): ${ctx.filePaths.slice(0, 20).join(', ')}
        README (excerpt): ${ctx.readme}
        
        CORE FILE CONTENTS:
        ${ctx.fileContents.map(f => `--- FILE: ${f.path} ---\n${f.content}`).join('\n\n')}
      `).join('\n---\n');

      const userMsg = `
        REPOS:
        ${reposInfo}
        
        DIRECTION:
        ${state.artPrompt}
        
        [NON-ASCII DIRECTIVE]
        Avoid returning character grids. Use the 'ctx' to draw fluid, strange, and complex generative systems. Think in terms of pixels, paths, noise, and procedural geometry.
        
        Generate the JS5 code now.
      `.trim();

      const response = await callWithRetry(async () => {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemPrompt,
            userMessage: userMsg,
            temperature: 0.8,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Generation failed');
        }
        return data;
      });

      const js5Code = response.text?.replace(/```javascript|```js|```/g, '').trim() || '';
      setState(s => ({ ...s, js5Code, isGenerating: false, status: '✓ JS5 Alchemized' }));

      if (user) {
        try {
          await addDoc(collection(db, 'renders'), {
            userId: user.uid,
            prompt: state.artPrompt,
            repos: state.selectedRepos.map(r => r.name),
            js5Code: js5Code,
            createdAt: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'renders');
        }
      }

    } catch (e: any) {
      setState(s => ({ ...s, isGenerating: false, status: `Error: ${e.message}` }));
      console.error(e);
    }
  };

  const handleExport = () => {
    const blob = new Blob([state.js5Code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reposcripter_${Date.now()}.js`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSpeak = () => {
    if (!state.fusedPrompt) return;
    const utter = new SpeechSynthesisUtterance(state.fusedPrompt);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setState(s => ({ ...s, userImage: base64String, userImageMimeType: file.type }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex h-screen bg-bg text-text font-sans overflow-hidden relative">
      {/* JS5 Background */}
      <JS5Canvas 
        code={state.js5Code} 
        repoContexts={repoContexts} 
        userInput={state.artPrompt}
        isRecording={state.isRecording}
        exportRatio={state.exportRatio}
        onStreamReady={handleStartRecording}
      />

      {/* Zen Mode Toggle */}
      <button 
        onClick={() => setState(s => ({ ...s, isZenMode: !s.isZenMode }))}
        className={`absolute top-6 right-6 z-[60] p-3 bg-panel/40 backdrop-blur-md border border-border text-muted hover:text-accent2 hover:border-accent2 transition-all duration-300 rounded-full group shadow-lg ${state.isZenMode ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}
        title={state.isZenMode ? "Exit Zen Mode" : "Enter Zen Mode"}
      >
        {state.isZenMode ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <AnimatePresence>
        {!state.isZenMode && (
          <motion.aside 
            initial={{ x: -80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -80, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="w-16 border-r border-border bg-panel/80 backdrop-blur-md flex flex-col items-center py-6 z-50 shrink-0"
          >
            <div className="text-accent2 font-bold text-xl mb-10 cursor-default" title="RepoScripter (Weird Edition)">⏀</div>
            
            <nav className="flex flex-col gap-6 flex-1">
              <SidebarIcon 
                icon={Github} 
                active={state.activePanel === 'github'} 
                onClick={() => togglePanel('github')} 
                label="GitHub"
              />
              <SidebarIcon 
                icon={Sparkles} 
                active={state.activePanel === 'prompt'} 
                onClick={() => togglePanel('prompt')} 
                label="Invoke the Weird"
              />
              <SidebarIcon 
                icon={History} 
                active={state.activePanel === 'history'} 
                onClick={() => togglePanel('history')} 
                label="History"
              />
              <SidebarIcon 
                icon={Download} 
                active={state.activePanel === 'export'} 
                onClick={() => togglePanel('export')} 
                label="Export"
              />
            </nav>

            <div className="flex flex-col gap-6">
              <SidebarIcon 
                icon={Settings} 
                active={state.activePanel === 'settings'} 
                onClick={() => togglePanel('settings')} 
                label="Settings"
              />
              <button 
                onClick={() => setIsAuthOpen(true)}
                className="p-3 text-muted hover:text-accent transition-colors"
              >
                {user ? (
                  <img src={user.photoURL || ''} className="w-6 h-6 rounded-full border border-border" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon className="w-6 h-6" />
                )}
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Floating Panels */}
      <AnimatePresence>
        {!state.isZenMode && state.activePanel && (
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            className="absolute left-20 top-6 bottom-6 w-96 bg-panel/90 backdrop-blur-xl border border-border shadow-2xl z-40 flex flex-col rounded-lg overflow-hidden"
          >
            <div className="p-4 border-b border-border flex items-center justify-between bg-panel2/50">
              <h2 className="text-[0.7rem] font-bold tracking-[0.2em] uppercase text-accent2">
                {state.activePanel}
              </h2>
              <button onClick={() => setState(s => ({ ...s, activePanel: null }))} className="text-muted hover:text-accent3">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {state.activePanel === 'github' && <GitHubPanel state={state} setState={setState} handleLoadRepos={handleLoadRepos} handleAddRepo={handleAddRepo} handleRemoveRepo={handleRemoveRepo} />}
              {state.activePanel === 'prompt' && <PromptPanel state={state} setState={setState} handleGenerate={handleGenerate} />}
              {state.activePanel === 'history' && <HistoryPanel history={history} user={user} handleLogin={handleLogin} setState={setState} setRepoContexts={setRepoContexts} />}
              {state.activePanel === 'settings' && <SettingsPanel state={state} setState={setState} user={user} handleLogout={handleLogout} handleLogin={handleLogin} />}
              {state.activePanel === 'export' && <ExportPanel state={state} setState={setState} handleStartRecording={handleStartRecording} handleStopRecording={handleStopRecording} handleGitHubExport={handleGitHubExport} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Bar */}
      <AnimatePresence>
        {!state.isZenMode && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-4 right-6 z-50 pointer-events-none"
          >
            <div className="text-[0.6rem] font-mono text-accent2/60 uppercase tracking-widest">
              {state.status || 'System Idle'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} user={user} handleLogin={handleLogin} handleLogout={handleLogout} state={state} setState={setState} handleLoadRepos={handleLoadRepos} />
    </div>
  );
}
