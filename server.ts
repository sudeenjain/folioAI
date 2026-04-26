import express from "express";
// Dynamic imports for heavy modules to improve serverless performance
// import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";
import ejs from "ejs";
import 'dotenv/config';
// import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// For Vercel, paths should be relative to process.cwd()
const projectRoot = process.cwd();

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = 3001;

const sessions: Record<string, any> = {};

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: {
      hasGemini: !!process.env.GEMINI_API_KEY,
      hasXAI: !!process.env.XAI_API_KEY,
      hasGroq: !!process.env.GROQ_API_KEY,
      hasGithub: !!process.env.GITHUB_TOKEN,
      nodeEnv: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL
    }
  });
});

// Groq Helper
async function callAI(prompt: string, systemInstruction: string) {
  // Prefer Groq, fallback to xAI if Groq isn't set
  const groqKey = process.env.GROQ_API_KEY;
  const xaiKey = process.env.XAI_API_KEY;
  
  if (groqKey) {
    console.log("[AI] Using Groq Provider");
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API Error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as any;
    return data.choices[0].message.content;
  } else if (xaiKey) {
    console.log("[AI] Using xAI Provider");
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${xaiKey}`
      },
      body: JSON.stringify({
        model: "grok-beta",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`xAI API Error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as any;
    return data.choices[0].message.content;
  }
  
  throw new Error("No AI API keys configured (GROQ_API_KEY or XAI_API_KEY required)");
}

// Gemini Helper (Optional Fallback)
// const getGemini = () => {

//   const apiKey = process.env.GEMINI_API_KEY;
//   if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
//   return new GoogleGenerativeAI(apiKey);
// };


// Helper for retrying AI calls on rate limits (429)
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2, delay = 2000): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error.message?.includes("429") || error.message?.includes("Too Many Requests") || error.status === 429;
      if (isRateLimit && i < maxRetries) {
        const waitTime = delay * Math.pow(2, i);
        console.warn(`[AI] Rate limit hit. Retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

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

    const systemInstruction = "You are an expert career coach and portfolio builder. Your task is to transform raw GitHub and LinkedIn data into compelling, professional portfolio content. Focus on achievements, skills, and impact. Return the response as a JSON object matching the requested structure.";
    const prompt = `Generate professional portfolio content based on the following data:
GitHub Data: ${JSON.stringify(simplifiedGithub)}
LinkedIn Data: ${JSON.stringify(linkedinData)}
Resume Text: ${resumeText || 'Not provided'}.
    
REQUIRED JSON STRUCTURE:
{
  "hero": { "name": "string", "title": "string", "tagline": "string", "photo_url": "string", "location": "string", "objective": "string" },
  "about": { "bio": "string" },
  "projects": [{ "name": "string", "description": "string", "tech_stack": ["string"], "github_url": "string", "live_url": "string" }],
  "skills": { "technical_skills": ["string"], "languages": ["string"], "frameworks": ["string"], "tools": ["string"] },
  "experience": [{ "company": "string", "role": "string", "duration": "string", "responsibilities": ["string"] }],
  "education": [{ "institution": "string", "degree": "string", "year": "string" }],
  "certifications": [{ "name": "string", "issuer": "string", "year": "string" }],
  "contact": { "email": "string", "github": "string", "linkedin": "string" }
} `;

    const textResult = await withRetry(() => callAI(prompt, systemInstruction));
    res.json(JSON.parse(textResult));

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

    const systemInstruction = "You are a design recommendation engine. Recommend templates based on user profile data.";
    const prompt = `Based on the following professional profile, recommend exactly 3 template IDs (from 1 to 12) that would best showcase this person's work.
Profile Data: ${JSON.stringify(simplifiedData)}
Templates 1-4: Creative/Bold, 5-8: Minimal/Professional, 9-12: Technical/Data-driven.
Provide JSON with:
{
  "recommended": [1, 2, 3],
  "reasons": ["reason1", "reason2", "reason3"]
}`;

    const textResult = await withRetry(() => callAI(prompt, systemInstruction));
    res.json(JSON.parse(textResult));

  } catch (error: any) {
    console.error("AI Recommend Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/portfolio/render", async (req, res) => {
  const { templateId, data } = req.body;
  const templatePath = path.join(projectRoot, "server", "templates", `${String(templateId).padStart(2, '0')}.ejs`);
  
  // Safe defaults to prevent EJS "variable not defined" errors
  const safeData = {
    hero: { name: "", title: "", tagline: "", location: "", objective: "", photo_url: "", ...data?.hero },
    about: { bio: "", ...data?.about },
    projects: Array.isArray(data?.projects) ? data.projects : [],
    skills: { technical_skills: [], languages: [], frameworks: [], tools: [], ...data?.skills },
    experience: Array.isArray(data?.experience) ? data.experience : [],
    education: Array.isArray(data?.education) ? data.education : [],
    certifications: Array.isArray(data?.certifications) ? data.certifications : [],
    contact: { email: "", github: "", linkedin: "", ...data?.contact }
  };

  try {
    const html = await ejs.renderFile(templatePath, safeData) as string;
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error: any) {
    console.error(`Render Error [Template ${templateId}]:`, error.message);
    res.status(500).send(`Failed to render template: ${error.message}`);
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
  const templatePath = path.join(projectRoot, "server", "templates", `${String(session.templateId).padStart(2, '0')}.ejs`);
  
  const safeData = {
    hero: { name: "", title: "", tagline: "", location: "", objective: "", photo_url: "", ...session.sectionData?.hero },
    about: { bio: "", ...session.sectionData?.about },
    projects: Array.isArray(session.sectionData?.projects) ? session.sectionData.projects : [],
    skills: { technical_skills: [], languages: [], frameworks: [], tools: [], ...session.sectionData?.skills },
    experience: Array.isArray(session.sectionData?.experience) ? session.sectionData.experience : [],
    education: Array.isArray(session.sectionData?.education) ? session.sectionData.education : [],
    certifications: Array.isArray(session.sectionData?.certifications) ? session.sectionData.certifications : [],
    contact: { email: "", github: "", linkedin: "", ...session.sectionData?.contact }
  };

  try {
    const html = await ejs.renderFile(templatePath, safeData) as string;
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error: any) {
    res.status(500).send(`Failed to render preview: ${error.message}`);
  }
});

app.get("/api/portfolio/download/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const session = sessions[sessionId];
  if (!session) return res.status(404).send("Session not found");
  const templatePath = path.join(projectRoot, "server", "templates", `${String(session.templateId).padStart(2, '0')}.ejs`);
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
  if (process.env.VERCEL) {
    console.log("Running in Vercel environment - Skipping local server listener");
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    try {
      console.log("Starting Vite dev server...");
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn("Vite failed to initialize, continuing as API only", e);
    }
  } else {
    // Only serve static files locally in production mode, NOT on Vercel
    const distPath = path.join(projectRoot, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Only call startServer if not being bundled by Vercel
if (!process.env.VERCEL) {
  startServer().catch(err => {
    console.error("Failed to start local server:", err);
  });
}

export default app;
