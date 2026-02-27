import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";
import ejs from "ejs";
import 'dotenv/config';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = 3000;

const sessions: Record<string, any> = {};

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: {
      hasGemini: !!process.env.GEMINI_API_KEY,
      hasGithub: !!process.env.GITHUB_TOKEN,
      nodeEnv: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL
    }
  });
});

// Gemini Helper
const getGemini = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment variables");
  return new GoogleGenerativeAI(apiKey);
};

async function analyzeGithub(username: string) {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Portfolio-AI-App'
  };

  // Use Bearer for fine-grained tokens or fallback to token prefix
  if (token) {
    if (token.startsWith('github_pat_')) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      headers['Authorization'] = `token ${token}`;
    }
  }

  console.log(`[GitHub] Analyzing user: ${username} (Token prefix: ${token ? (token.startsWith('github_pat_') ? 'Bearer' : 'token') : 'None'})`);

  try {
    const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(username.trim())}`, { headers });

    if (!userRes.ok) {
      const errorData = await userRes.json().catch(() => ({}));
      console.error(`[GitHub] User API Error (${userRes.status}):`, errorData);
      throw new Error(`GitHub User API failed (${userRes.status}): ${errorData.message || userRes.statusText}`);
    }
    const userData = await userRes.json() as any;

    const reposRes = await fetch(`https://api.github.com/users/${encodeURIComponent(username.trim())}/repos?sort=updated&per_page=100`, { headers });
    if (!reposRes.ok) {
      const errorData = await reposRes.json().catch(() => ({}));
      console.error(`[GitHub] Repos API Error (${reposRes.status}):`, errorData);
      throw new Error(`GitHub Repos API failed (${reposRes.status}): ${errorData.message || reposRes.statusText}`);
    }
    const reposData = await reposRes.json() as any[];

    console.log(`[GitHub] Successfully fetched data for ${username}. Repos: ${reposData.length}`);

    const repos = reposData.map((repo: any) => ({
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
        name: userData.name || userData.login,
        bio: userData.bio,
        avatar_url: userData.avatar_url,
        location: userData.location,
        blog: userData.blog,
        company: userData.company,
        public_repos: userData.public_repos,
        followers: userData.followers
      },
      repos
    };
  } catch (error: any) {
    console.error("[GitHub] Analysis Error:", error.message);
    throw error;
  }
}

app.post("/api/github/analyze", async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Username is required" });
  try {
    const data = await analyzeGithub(username);
    res.json(data);
  } catch (error: any) {
    console.error("[Endpoint] GitHub Analyze Error:", error.message);
    res.status(500).json({
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      env: {
        hasGithubToken: !!process.env.GITHUB_TOKEN,
        nodeVersion: process.version
      }
    });
  }
});

// AI Endpoints
app.post("/api/ai/generate-content", async (req, res) => {
  const { githubData, linkedinData, resumeText } = req.body;
  try {
    const simplifiedGithub = githubData ? {
      profile: githubData.profile,
      top_repos: githubData.repos?.slice(0, 10).map((r: any) => ({
        name: r.name,
        description: r.description,
        language: r.language,
        topics: r.topics
      }))
    } : null;

    const ai = getGemini();

    const systemInstruction = "You are an expert career coach and portfolio builder. Your task is to transform raw GitHub and LinkedIn data into compelling, professional portfolio content. Focus on achievements, skills, and impact. Ensure the tone is professional yet engaging.";
    const prompt = `Generate professional portfolio content based on the following data:
GitHub Data: ${JSON.stringify(simplifiedGithub)}
LinkedIn Data: ${JSON.stringify(linkedinData)}
Resume Text: ${resumeText || 'Not provided'}`;

    const model = ai.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction,
    });

    const response = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            hero: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                title: { type: SchemaType.STRING },
                tagline: { type: SchemaType.STRING },
                photo_url: { type: SchemaType.STRING },
                location: { type: SchemaType.STRING },
                objective: { type: SchemaType.STRING }
              },
              required: ["name", "title", "tagline"]
            },
            about: {
              type: SchemaType.OBJECT,
              properties: { bio: { type: SchemaType.STRING } },
              required: ["bio"]
            },
            projects: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  name: { type: SchemaType.STRING },
                  description: { type: SchemaType.STRING },
                  tech_stack: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                  github_url: { type: SchemaType.STRING },
                  live_url: { type: SchemaType.STRING }
                },
                required: ["name", "description"]
              }
            },
            skills: {
              type: SchemaType.OBJECT,
              properties: {
                technical_skills: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                languages: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                frameworks: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                tools: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
              }
            },
            experience: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  company: { type: SchemaType.STRING },
                  role: { type: SchemaType.STRING },
                  duration: { type: SchemaType.STRING },
                  responsibilities: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
                }
              }
            },
            education: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  institution: { type: SchemaType.STRING },
                  degree: { type: SchemaType.STRING },
                  year: { type: SchemaType.STRING }
                }
              }
            },
            contact: {
              type: SchemaType.OBJECT,
              properties: {
                email: { type: SchemaType.STRING },
                github: { type: SchemaType.STRING },
                linkedin: { type: SchemaType.STRING }
              }
            }
          },
          required: ["hero", "about", "projects", "skills", "contact"]
        }
      }
    });

    const result = response.response;
    res.json(JSON.parse(result.text()));
  } catch (error: any) {
    console.error("AI Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/recommend-templates", async (req, res) => {
  const { githubData, linkedinData } = req.body;
  try {
    const simplifiedData = {
      github: githubData ? { profile: githubData.profile, repo_count: githubData.repos?.length } : null,
      linkedin: linkedinData
    };

    const ai = getGemini();

    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Based on the following professional profile, recommend exactly 3 template IDs (from 1 to 12) that would best showcase this person's work.
Profile Data: ${JSON.stringify(simplifiedData)}
Templates 1-4: Creative/Bold, 5-8: Minimal/Professional, 9-12: Technical/Data-driven.
Provide JSON with "recommended" (array of 3 IDs) and "reasons" (array of 3 strings).`;

    const response = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            recommended: { type: SchemaType.ARRAY, items: { type: SchemaType.INTEGER } },
            reasons: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
          },
          required: ["recommended", "reasons"]
        }
      }
    });
    const result = response.response;
    res.json(JSON.parse(result.text()));
  } catch (error: any) {
    console.error("AI Recommend Error:", error.message);
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
    try {
      const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn("Vite failed to initialize, continuing as API only");
    }
  } else if (process.env.VERCEL === undefined) {
    // Only serve static files locally in production mode, NOT on Vercel
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (process.env.VERCEL === undefined) {
    app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
  }
}

startServer();

export default app;
