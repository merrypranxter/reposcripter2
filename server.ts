import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy GitHub API
  app.all("/api/github/*", async (req, res) => {
    // Prefer client-provided token if available, fallback to server secret
    const clientToken = req.headers['x-github-token'];
    const githubToken = clientToken || process.env.GITHUB_TOKEN;

    if (!githubToken) {
      return res.status(500).json({ error: "GITHUB_TOKEN not configured on server and no token provided by client" });
    }

    const path = req.params[0];
    const url = `https://api.github.com/${path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;

    try {
      const response = await fetch(url, {
        method: req.method,
        headers: {
          "Authorization": `Bearer ${githubToken}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "RepoScripter-App"
        },
        body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body)
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error("GitHub Proxy Error:", error);
      res.status(500).json({ error: "Failed to proxy request to GitHub" });
    }
  });

  // Proxy LLM generation (OpenRouter / any OpenAI-compatible API)
  app.post("/api/generate", async (req, res) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OPENROUTER_API_KEY not configured on server" });
    }

    const { model, systemPrompt, userMessage, temperature } = req.body as {
      model?: string;
      systemPrompt?: string;
      userMessage: string;
      temperature?: number;
    };

    if (!userMessage) {
      return res.status(400).json({ error: "userMessage is required" });
    }

    const resolvedModel = model || process.env.LLM_MODEL || "qwen/qwen-2.5-coder-32b-instruct";

    const client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.APP_URL || "https://reposcripter.app",
        "X-Title": "RepoScripter",
      },
    });

    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: userMessage });

      const completion = await client.chat.completions.create({
        model: resolvedModel,
        messages,
        temperature: temperature ?? 0.8,
      });

      const text = completion.choices[0]?.message?.content ?? "";
      res.json({ text });
    } catch (error: any) {
      console.error("LLM Proxy Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate content" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
