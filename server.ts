import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import archiver from "archiver";
import ejs from "ejs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = 3000;

const sessions: Record<string, any> = {};

async function analyzeGithub(username: string) {
  const token = process.env.GITHUB_TOKEN;
  const headers = token ? { Authorization: `token ${token}` } : {};
  try {
    const userRes = await axios.get(`https://api.github.com/users/${encodeURIComponent(username.trim())}`, { headers });
    const reposRes = await axios.get(`https://api.github.com/users/${encodeURIComponent(username.trim())}/repos?sort=updated&per_page=100`, { headers });
    const repos = reposRes.data.map((repo: any) => ({
      name: repo.name,
      description: repo.description,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      topics: repo.topics || [],
      updated_at: repo.updated_at,
      html_url: repo.html_url,
      homepage: repo.homepage
    }));
    return {
      profile: {
        name: userRes.data.name || userRes.data.login,
        bio: userRes.data.bio,
        avatar_url: userRes.data.avatar_url,
        location: userRes.data.location,
        blog: userRes.data.blog,
        company: userRes.data.company,
        public_repos: userRes.data.public_repos,
        followers: userRes.data.followers
      },
      repos
    };
  } catch (error: any) {
    console.error("GitHub API Error:", error.response?.data || error.message);
    if (error.response?.status === 403 && error.response.headers['x-ratelimit-remaining'] === '0') {
      throw new Error("GitHub API rate limit exceeded. Please try again later or provide a GITHUB_TOKEN.");
    }
    if (error.response?.status === 404) {
      throw new Error(`GitHub user "${username}" not found.`);
    }
    throw new Error("Failed to fetch GitHub data: " + (error.response?.data?.message || error.message));
  }
}

app.post("/api/github/analyze", async (req, res) => {
  const { username } = req.body;
  try {
    const data = await analyzeGithub(username);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/portfolio/render", async (req, res) => {
  const { templateId, data } = req.body;
  const templatePath = path.join(__dirname, "server", "templates", `${String(templateId).padStart(2, '0')}.ejs`);
  try {
    const html = await ejs.renderFile(templatePath, data) as string;
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error: any) {
    console.error("Render Error:", error);
    res.status(500).send("Failed to render template");
  }
});

app.post("/api/portfolio/generate", async (req, res) => {
  const { templateId, confirmedSections } = req.body;
  const sessionId = Math.random().toString(36).substring(7);
  sessions[sessionId] = { templateId, sectionData: confirmedSections };
  res.json({ sessionId, previewUrl: `/api/portfolio/preview/${sessionId}` });
});

app.get("/api/portfolio/preview/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const session = sessions[sessionId];
  if (!session) return res.status(404).send("Session not found");
  const templatePath = path.join(__dirname, "server", "templates", `${String(session.templateId).padStart(2, '0')}.ejs`);
  try {
    const html = await ejs.renderFile(templatePath, session.sectionData) as string;
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error: any) {
    res.status(500).send("Failed to render template");
  }
});

app.get("/api/portfolio/download/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const session = sessions[sessionId];
  if (!session) return res.status(404).send("Session not found");
  const templatePath = path.join(__dirname, "server", "templates", `${String(session.templateId).padStart(2, '0')}.ejs`);
  try {
    const html = await ejs.renderFile(templatePath, session.sectionData) as string;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="portfolio.zip"`);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);
    archive.append(html, { name: "index.html" });
    await archive.finalize();
  } catch (error: any) {
    res.status(500).send("Failed to generate ZIP");
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    // In production, express serves static files from dist
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      // For Vercel, we might need a different path or just let Vercel handle static files
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Only listen on a port if not running as a Vercel function
  if (process.env.VERCEL === undefined) {
    app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
  }
}

startServer();

export default app;
