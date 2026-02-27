import { GoogleGenAI, Type } from "@google/genai";

const getGemini = () => {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
};

export async function generatePortfolioContent(githubData: any, linkedinData: any, resumeText?: string) {
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
Resume Text: ${resumeText || 'Not provided'}

Please provide a structured response including a hero section, about bio, key projects, skills categorization, experience highlights, education, and contact details.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      systemInstruction,
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
            properties: { 
              bio: { type: Type.STRING } 
            },
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
          certifications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                issuer: { type: Type.STRING },
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

  if (!response.text) {
    throw new Error("Failed to generate content");
  }

  return JSON.parse(response.text);
}

export async function recommendPortfolioTemplates(githubData: any, linkedinData: any) {
  const simplifiedData = {
    github: githubData ? { profile: githubData.profile, repo_count: githubData.repos?.length } : null,
    linkedin: linkedinData
  };

  const ai = getGemini();
  const prompt = `Based on the following professional profile, recommend exactly 3 template IDs (from 1 to 12) that would best showcase this person's work. 
Profile Data: ${JSON.stringify(simplifiedData)}

Templates 1-4: Creative/Bold
Templates 5-8: Minimal/Professional
Templates 9-12: Technical/Data-driven

Provide the recommended IDs and a brief reason for each.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          recommended: { 
            type: Type.ARRAY, 
            items: { type: Type.INTEGER },
            description: "List of 3 recommended template IDs (1-12)"
          },
          reasons: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Reasons for each recommendation"
          }
        },
        required: ["recommended", "reasons"]
      }
    }
  });

  if (!response.text) {
    throw new Error("Failed to recommend templates");
  }

  return JSON.parse(response.text);
}
