<div align="center">
<img width="1200" height="475" alt="RepoScripter Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# 🌀 RepoScripter 2

**Feed it your GitHub repos. Tell it to make art. Watch chaos bloom.**

*A Gemini-powered generative art engine that reads your code and transmutes it into living shader art.*

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?style=flat-square&logo=three.js)](https://threejs.org)
[![Gemini](https://img.shields.io/badge/Gemini-AI-4285F4?style=flat-square&logo=google)](https://ai.google.dev)
[![Firebase](https://img.shields.io/badge/Firebase-Auth+DB-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com)

</div>

---

## What Is This Thing

RepoScripter is a **creative coding tool** that uses your GitHub repos as *source material* for generative art. You pick one or more repos, describe a vibe, and Gemini reads the actual code + README + file structure and generates a live-running shader sketch inspired by it.

Think of it as: **your repos become the input layer for a visual synthesizer.**

It's built for people who write weird code and want to see it rendered as something that moves.

---

## How It Works

```
Your GitHub Repos
      ↓
  Repo Context Builder
  (reads README, file tree, source code)
      ↓
  Gemini AI
  (interprets the code's "vibe" + your prompt)
      ↓
  Generated JS5 Sketch
  (Canvas 2D or Three.js/WebGL)
      ↓
  Live Preview → Export as Image/Video/Push to GitHub
```

The AI doesn't just look at your repo name — it reads the actual source files, topics, description, and README, then generates art that's *semantically connected* to what you built. Fractals repo → fractal art. Fluid dynamics repo → fluid simulations. Strange attractors → something that feels like chaos.

---

## Features

### 🔗 GitHub Integration
- Connect with a Personal Access Token
- Browse all your repos, pick any combination as context
- Export generated sketches directly back to a GitHub repo

### 🧠 AI-Powered Code Generation
- Powered by Google Gemini
- Reads up to 40 files per repo with smart filtering
- Supports `context.manifest.json` — drop one in any repo to tell the AI exactly what to read
- Generates Canvas 2D sketches **and** Three.js WebGL shader programs

### 🎨 Live Canvas Engine ("JS5")
- Auto-detects whether generated code uses Three.js or plain Canvas
- Interactive: mouse position is passed as a uniform to all sketches
- Resizable split-panel layout (code view + canvas preview)
- Zen Mode — fullscreen canvas, no distractions

### 📹 Export Everything
- Screenshot → PNG (multiple aspect ratios: 16:9, 9:16, 1:1, 4:3, 21:9)
- Screen record → WebM video download
- Push sketch code directly to a GitHub repo

### 🕰️ History
- Google sign-in via Firebase Auth
- Every generated sketch saved to Firestore
- Browse, reload, and re-render past generations

---

## Quick Start

### Prerequisites
- Node.js 18+
- A [Google Gemini API key](https://aistudio.google.com/apikey)
- A [GitHub Personal Access Token](https://github.com/settings/tokens) (needs `repo` scope)

### Run Locally

```bash
git clone https://github.com/merrypranxter/reposcripter2.git
cd reposcripter2
npm install
```

Create a `.env.local` file:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

```bash
npm run dev
```

App runs at `http://localhost:5173`

### Firebase Setup (optional — for history/auth)
The app works without Firebase but you won't get render history or Google sign-in. To enable it, update `firebase-applet-config.json` with your own Firebase project credentials.

---

## Using `context.manifest.json`

Drop this file in any repo root to control exactly what files RepoScripter reads when that repo is selected as context:

```json
{
  "files": [
    "shaders/main.frag",
    "src/core.ts",
    "prompts/vibes.md",
    "README.md"
  ]
}
```

Without a manifest, it auto-selects up to 40 files based on extension (`.glsl`, `.frag`, `.ts`, `.md`, etc.) and directory (`shaders/`, `src/`, `docs/`).

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite |
| AI | Google Gemini via `@google/genai` |
| 3D / Shaders | Three.js |
| Animation | Framer Motion |
| Layout | react-resizable-panels |
| Auth | Firebase Auth (Google) |
| Database | Firestore (render history) |
| Styling | Custom CSS variables (dark, neon-accent theme) |

---

## The "JS5" Sketch Format

Generated code runs in a sandboxed canvas environment. The sketch has access to:

```js
canvas        // the HTMLCanvasElement
ctx           // CanvasRenderingContext2D (or null for WebGL)
width         // canvas width in px
height        // canvas height in px
mouse         // { x, y, isPressed } — live mouse state
time          // elapsed time in ms
repoContexts  // array of repo data used to generate this
userInput     // the original prompt string
THREE         // full Three.js library (for WebGL sketches)
```

WebGL sketches are auto-detected when the code references `THREE.WebGLRenderer` or similar Three.js globals.

---

## Repo Structure

```
reposcripter2/
├── src/
│   ├── App.tsx          # Entire app — one big beautiful component
│   ├── firebase.ts      # Auth + Firestore helpers
│   ├── main.tsx         # Entry point
│   └── index.css        # CSS custom properties + global styles
├── AGENTS.md            # Conceptual library of generative art patterns (AI context)
├── server.ts            # Dev proxy for GitHub API calls
├── vite.config.ts
├── firebase-blueprint.json
└── firestore.rules
```

---

## The `AGENTS.md` File

This repo contains an `AGENTS.md` — a conceptual library of generative art math used as AI context. It covers:

- Hyperbolic tiling + Poincaré disk geometry
- Quasicrystals via wave interference
- Reaction-diffusion (Gray-Scott, CPU + GPU variants)
- 4D spatial mechanics + simplex noise
- Ray marching + Signed Distance Functions
- Strange attractors, domain warping, particle-life
- Fluid dynamics (Navier-Stokes), Lenia, MNCA
- GLSL patterns from The Book of Shaders
- L-systems, differential growth, non-Euclidean spaces

---

## Made By

[merrypranxter](https://github.com/merrypranxter) — vibecodin' shader art tools for the weird code people.

Part of a larger ecosystem of [generative art repos](https://github.com/merrypranxter?tab=repositories) used as creative source material.

---

<div align="center">
<sub>built with chaos, Gemini, and too many math functions</sub>
</div>
