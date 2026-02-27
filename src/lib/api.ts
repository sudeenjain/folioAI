export async function analyzeGithub(username: string) {
  try {
    const response = await fetch('/api/github/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('GitHub analysis API error:', errorData);
      throw new Error(errorData.error || `GitHub analysis failed with status ${response.status}`);
    }
    return response.json();
  } catch (error: any) {
    console.error('Fetch error in analyzeGithub:', error);
    throw error;
  }
}

export async function generatePortfolioContent(githubData: any, linkedinData: any, resumeText?: string) {
  try {
    const response = await fetch('/api/ai/generate-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ githubData, linkedinData, resumeText }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Content generation failed');
    }
    return response.json();
  } catch (error: any) {
    console.error('Error in generatePortfolioContent:', error);
    throw error;
  }
}

export async function recommendPortfolioTemplates(githubData: any, linkedinData: any) {
  try {
    const response = await fetch('/api/ai/recommend-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ githubData, linkedinData }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Template recommendation failed');
    }
    return response.json();
  } catch (error: any) {
    console.error('Error in recommendPortfolioTemplates:', error);
    throw error;
  }
}

export async function renderPortfolio(templateId: string, data: any) {
  const response = await fetch('/api/portfolio/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId, data }),
  });
  if (!response.ok) {
    throw new Error('Failed to render portfolio');
  }
  return response.text();
}

export async function generatePortfolio(confirmedSections: any, templateId: string) {
  const response = await fetch('/api/portfolio/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmedSections, templateId }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Portfolio generation failed');
  }
  return response.json();
}
