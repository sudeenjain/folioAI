import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";
import ejs from "ejs";
import 'dotenv/config';

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

// Gemini Helper (Dynamic Import)
const getGemini = async () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment variables");
  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({ apiKey });
};

async function analyzeGithub(username: string) {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Portfolio-AI-App'
  };
  // Reverting to 'token ' prefix as it's more universal for classic/fine-grained
  if (token) headers['Authorization'] = `token ${token}`;

  console.log(`Analyzing GitHub user: ${username} (Token present: ${!!token})`);

  try {
    const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(username.trim())}`, { headers });
    if (!userRes.ok) {
      const errorData = await userRes.json().catch(() => ({}));
      throw new Error(`GitHub User API failed (${userRes.status}): ${errorData.message || userRes.statusText}`);
    }
    const userData = await userRes.json() as any;

    const reposRes = await fetch(`https://api.github.com/users/${encodeURIComponent(username.trim())}/repos?sort=updated&per_page=100`, { headers });
    if (!reposRes.ok) {
      throw new Error(`GitHub Repos API failed with status ${reposRes.status}`);
    }
    const reposData = await reposRes.json() as any[];

    console.log(`Successfully fetched data for ${username}. Repos: ${reposData.length}`);

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
    console.error("GitHub API Error:", error.message);
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
    res.status(500).json({
      error: error.message,
      env: { hasToken: !!process.env.GITHUB_TOKEN }
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

    const ai = await getGemini();
    const { Type } = await import("@google/genai");

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
          type: Type.OBJECT,
          properties: {
            hero: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                title: { type: Type.STRING },
                tagline: { type: Type.STRING },
                photo_url: { type: Type.STRING },
                location: { type: Type.STRING },
                objective: { type: Type.STRING }
              },
              required: ["name", "title", "tagline"]
            },
            about: {
              type: Type.OBJECT,
              properties: { bio: { type: Type.STRING } },
              required: ["bio"]
            },
            projects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  tech_stack: { type: Type.ARRAY, items: { type: Type.STRING } },
                  github_url: { type: Type.STRING },
                  live_url: { type: Type.STRING }
                },
                required: ["name", "description"]
              }
            },
            skills: {
              type: Type.OBJECT,
              properties: {
                technical_skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                languages: { type: Type.ARRAY, items: { type: Type.STRING } },
                frameworks: { type: Type.ARRAY, items: { type: Type.STRING } },
                tools: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            },
            experience: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  company: { type: Type.STRING },
                  role: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  responsibilities: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            },
            education: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  institution: { type: Type.STRING },
                  degree: { type: Type.STRING },
                  year: { type: Type.STRING }
                }
              }
            },
            contact: {
              type: Type.OBJECT,
              properties: {
                email: { type: Type.STRING },
                github: { type: Type.STRING },
                linkedin: { type: Type.STRING }
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

    const ai = await getGemini();
    const { Type } = await import("@google/genai");

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
          type: Type.OBJECT,
          properties: {
            recommended: { type: Type.ARRAY, items: { type: Type.INTEGER } },
            reasons: { type: Type.ARRAY, items: { type: Type.STRING } }
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

app.post("/api/ai/recommend-templates", async (req, res) => {
  const { githubData, linkedinData } = req.body;
  try {
    const simplifiedData = {
      github: githubData ? { profile: githubData.profile, repo_count: githubData.repos?.length } : null,
      linkedin: linkedinData
    };

    const ai = getGemini();
    const prompt = `Based on the following professional profile, recommend exactly 3 template IDs (from 1 to 12) that would best showcase this person's work. 
Profile Data: ${JSON.stringify(simplifiedData)}
Templates 1-4: Creative/Bold, 5-8: Minimal/Professional, 9-12: Technical/Data-driven.
Provide JSON with "recommended" (array of 3 IDs) and "reasons" (array of 3 strings).`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommended: { type: Type.ARRAY, items: { type: Type.INTEGER } },
            reasons: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["recommended", "reasons"]
        }
      }
    });
    if (!response.text) throw new Error("Empty response from AI");
    res.json(JSON.parse(response.text));
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
