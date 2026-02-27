import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Github, Linkedin, ArrowRight, Layout, Download, Eye, X, Upload, FileText, Sun, Moon, Edit2, Check } from 'lucide-react';
import { useStore } from './lib/store';
import { analyzeGithub, generatePortfolio, renderPortfolio } from './lib/api';
import { generatePortfolioContent } from './lib/gemini';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const TEMPLATES = [
  { id: '01', name: 'Minimalist Mono', category: 'Technical', description: 'Clean, high-contrast, focus on code.', seed: 'tech' },
  { id: '02', name: 'Editorial Serif', category: 'Creative', description: 'Large typography, magazine feel.', seed: 'editorial' },
  { id: '03', name: 'Bento Grid', category: 'Modern', description: 'Structured, scannable, data-rich.', seed: 'grid' },
  { id: '04', name: 'Dark Luxury', category: 'Professional', description: 'Sleek, premium, high-impact.', seed: 'luxury' },
  { id: '05', name: 'Brutalist', category: 'Creative', description: 'Bold, unconventional, energetic.', seed: 'brutal' },
  { id: '06', name: 'Warm Organic', category: 'Cultural', description: 'Soft, approachable, human-centric.', seed: 'organic' },
  { id: '07', name: 'Glassmorphism', category: 'Modern', description: 'Layered, translucent, immersive.', seed: 'glass' },
  { id: '08', name: 'Clean Utility', category: 'Professional', description: 'Functional, trustworthy, precise.', seed: 'utility' },
  { id: '09', name: 'Oversized Type', category: 'Creative', description: 'Striking, organized, designer feel.', seed: 'type' },
  { id: '10', name: 'Vibrant List', category: 'Modern', description: 'Fun, aspirational, memorable.', seed: 'vibrant' },
  { id: '11', name: 'Split Layout', category: 'Professional', description: 'Balanced, confident, SaaS-style.', seed: 'split' },
  { id: '12', name: 'Prestige', category: 'Professional', description: 'Refined, established, high-end.', seed: 'prestige' },
];

function TemplateThumbnail({ templateId, data }: { templateId: string, data: any }) {
  const [html, setHtml] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;
    renderPortfolio(templateId, data).then(res => {
      if (isMounted) {
        setHtml(res);
        setLoading(false);
      }
    }).catch(err => {
      console.error("Thumbnail Error:", err);
      if (isMounted) setLoading(false);
    });
    return () => { isMounted = false; };
  }, [templateId, data]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-bg-secondary">
        <div className="w-6 h-6 border-2 border-border-base border-t-accent-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-white">
      <iframe
        srcDoc={html || ''}
        className="absolute top-0 left-0 w-[400%] h-[400%] origin-top-left scale-[0.25] pointer-events-none border-none"
        title={`Thumbnail ${templateId}`}
      />
    </div>
  );
}

function LivePreview({ templateId, data }: { templateId: string | null, data: any }) {
  const [html, setHtml] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!templateId || !data) return;

    let isMounted = true;
    setLoading(true);

    const timer = setTimeout(() => {
      renderPortfolio(templateId, data).then(res => {
        if (isMounted) {
          setHtml(res);
          setLoading(false);
        }
      }).catch(err => {
        console.error("Live Preview Error:", err);
        if (isMounted) setLoading(false);
      });
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [templateId, data]);

  if (!templateId) return null;

  return (
    <div className="w-full h-full bg-bg-primary rounded-3xl border border-border-base overflow-hidden shadow-2xl relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-primary/50 backdrop-blur-sm">
          <div className="w-8 h-8 border-4 border-border-base border-t-accent-primary rounded-full animate-spin" />
        </div>
      )}
      <iframe
        srcDoc={html || ''}
        className="w-full h-full border-none"
        title="Live Preview"
      />
    </div>
  );
}

export default function App() {
  const { step, setStep, githubData, setGithubData, linkedinData, setLinkedinData, resumeText, setResumeText, insights, setInsights, confirmedSections, setConfirmedSections, selectedTemplate, setSelectedTemplate, sessionId, setSessionId, theme, setTheme } = useStore();
  const [loading, setLoading] = useState(false);
  const [githubUsername, setGithubUsername] = useState('');
  const [linkedinInput, setLinkedinInput] = useState('');
  const [resumeInput, setResumeInput] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [quickPreviewId, setQuickPreviewId] = useState<string | null>(null);
  const [quickPreviewLoading, setQuickPreviewLoading] = useState(false);
  const [quickPreviewUrl, setQuickPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  React.useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    return fullText;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const text = await extractTextFromPDF(file);
      setResumeInput(text);
    } catch (error) {
      console.error("PDF Extraction Error:", error);
      alert("Failed to extract text from PDF. Please try pasting the text manually.");
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      let githubData = null;
      if (githubUsername.trim()) {
        try {
          githubData = await analyzeGithub(githubUsername.trim());
          setGithubData(githubData);
        } catch (e: any) {
          console.error("GitHub Analysis Error:", e);
          throw new Error(e.message || `GitHub user "${githubUsername.trim()}" not found.`);
        }
      }

      let linkedin = null;
      if (linkedinInput) {
        try {
          linkedin = JSON.parse(linkedinInput);
          setLinkedinData(linkedin);
        } catch (e) {
          console.error("Invalid LinkedIn JSON");
        }
      }

      setResumeText(resumeInput);

      if (!githubData && !linkedin && !resumeInput) {
        throw new Error("Please provide at least one source of data (GitHub, LinkedIn, or Resume).");
      }

      const generatedInsights = await generatePortfolioContent(githubData, linkedin, resumeInput);
      setInsights(generatedInsights);
      setConfirmedSections(generatedInsights);

      setStep('templates');
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Analysis failed. Please check your inputs.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    setStep('confirm');
  };

  const handleQuickPreview = async (templateId: string) => {
    setQuickPreviewId(templateId);
    setQuickPreviewLoading(true);
    try {
      const { sessionId } = await generatePortfolio(confirmedSections, templateId);
      setQuickPreviewUrl(`/api/portfolio/preview/${sessionId}`);
    } catch (error) {
      console.error(error);
    } finally {
      setQuickPreviewLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { sessionId } = await generatePortfolio(confirmedSections, selectedTemplate!);
      setSessionId(sessionId);
      setPreviewUrl(`/api/portfolio/preview/${sessionId}`);
      setStep('preview');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!sessionId) return;
    window.location.href = `/api/portfolio/download/${sessionId}`;
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <nav className="border-b border-border-base bg-bg-primary/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="w-8 h-8 bg-text-primary rounded-lg flex items-center justify-center text-bg-primary">P</div>
            <span className="text-text-primary">Portfolio AI</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-4 text-sm font-medium text-text-secondary">
              <div className={`flex items-center gap-1 ${step === 'input' ? 'text-text-primary' : ''}`}>
                <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">1</span>
                Input
              </div>
              <div className="w-4 h-px bg-border-base" />
              <div className={`flex items-center gap-1 ${step === 'templates' ? 'text-text-primary' : ''}`}>
                <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">2</span>
                Templates
              </div>
              <div className="w-4 h-px bg-border-base" />
              <div className={`flex items-center gap-1 ${step === 'confirm' ? 'text-text-primary' : ''}`}>
                <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">3</span>
                Confirm
              </div>
              <div className="w-4 h-px bg-border-base" />
              <div className={`flex items-center gap-1 ${step === 'preview' ? 'text-text-primary' : ''}`}>
                <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">4</span>
                Preview
              </div>
            </div>
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 hover:bg-bg-secondary rounded-full transition-all text-text-secondary"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-12">
        <AnimatePresence mode="wait">
          {step === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto"
            >
              <div className="text-center mb-12">
                <h1 className="text-4xl font-bold tracking-tight mb-4 text-text-primary">Build your portfolio in seconds.</h1>
                <p className="text-text-secondary text-lg">Connect your GitHub and LinkedIn to generate a professional portfolio powered by AI.</p>
              </div>

              <div className="space-y-6 bg-card-bg p-8 rounded-2xl border border-border-base shadow-sm">
                <div>
                  <label className="block text-sm font-bold uppercase tracking-wider text-text-secondary opacity-60 mb-2">GitHub Username</label>
                  <div className="relative">
                    <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary opacity-40" />
                    <input
                      type="text"
                      className="w-full pl-12 pr-4 py-3 bg-bg-secondary border border-border-base rounded-xl focus:ring-2 focus:ring-accent-primary outline-none transition-all text-text-primary"
                      placeholder="e.g. octocat"
                      value={githubUsername}
                      onChange={(e) => setGithubUsername(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold uppercase tracking-wider text-text-secondary opacity-60 mb-2">LinkedIn Resume (PDF or Text)</label>
                  <div className="space-y-4">
                    <div className="relative">
                      <Layout className="absolute left-4 top-4 w-5 h-5 text-text-secondary opacity-40" />
                      <textarea
                        className="w-full pl-12 pr-4 py-3 bg-bg-secondary border border-border-base rounded-xl focus:ring-2 focus:ring-accent-primary outline-none transition-all h-32 text-text-primary"
                        placeholder="Paste your LinkedIn resume text here..."
                        value={resumeInput}
                        onChange={(e) => setResumeInput(e.target.value)}
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-px bg-border-base" />
                      <span className="text-xs font-bold text-text-secondary opacity-40 uppercase tracking-widest">OR</span>
                      <div className="flex-1 h-px bg-border-base" />
                    </div>

                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border-base rounded-2xl cursor-pointer hover:bg-bg-secondary hover:border-text-secondary transition-all">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {uploading ? (
                          <div className="w-8 h-8 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin mb-3" />
                        ) : (
                          <Upload className="w-8 h-8 text-text-secondary opacity-40 mb-3" />
                        )}
                        <p className="text-sm text-text-secondary font-medium">
                          {uploading ? 'Extracting text...' : 'Upload LinkedIn PDF Export'}
                        </p>
                        <p className="text-xs text-text-secondary opacity-40 mt-1">PDF files only</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf"
                        onChange={handleFileUpload}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-text-secondary opacity-60 italic">We'll extract your experience and skills directly from the PDF.</p>
                </div>

                <div>
                  <label className="block text-sm font-bold uppercase tracking-wider text-text-secondary opacity-60 mb-2">LinkedIn Data (via Extension)</label>
                  <div className="relative">
                    <Linkedin className="absolute left-4 top-4 w-5 h-5 text-text-secondary opacity-40" />
                    <textarea
                      className="w-full pl-12 pr-4 py-3 bg-bg-secondary border border-border-base rounded-xl focus:ring-2 focus:ring-accent-primary outline-none transition-all h-32 text-text-primary"
                      placeholder="Paste data from Portfolio AI extension here..."
                      value={linkedinInput}
                      onChange={(e) => setLinkedinInput(e.target.value)}
                    />
                  </div>
                  <p className="mt-2 text-xs text-text-secondary opacity-60 italic">Install our Chrome extension to extract LinkedIn data with one click.</p>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={(!githubUsername.trim() && !linkedinInput && !resumeInput) || loading}
                  className="w-full py-4 bg-accent-primary text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing Profile...
                    </>
                  ) : (
                    <>
                      Analyze My Profile
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {step === 'templates' && (
            <motion.div
              key="templates"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex justify-between items-end mb-12">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight mb-2 text-text-primary">Choose a Template</h2>
                  <p className="text-text-secondary">AI recommends these styles based on your profile.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {TEMPLATES.map((template) => (
                  <div
                    key={template.id}
                    className="group"
                  >
                    <div className="aspect-[4/3] bg-bg-secondary rounded-2xl mb-4 overflow-hidden border border-border-base group-hover:border-accent-primary transition-all relative">
                      <TemplateThumbnail templateId={template.id} data={confirmedSections} />
                      <div className="absolute inset-0 bg-bg-primary/40 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-3 p-6 text-center">
                        <button
                          onClick={() => handleSelectTemplate(template.id)}
                          className="w-full bg-accent-primary text-white py-3 rounded-xl font-bold shadow-xl hover:opacity-90 transition-colors"
                        >
                          Select Template
                        </button>
                        <button
                          onClick={() => handleQuickPreview(template.id)}
                          className="w-full bg-bg-primary/20 backdrop-blur-md text-text-primary py-3 rounded-xl font-bold border border-border-base hover:bg-bg-primary/30 transition-colors"
                        >
                          Quick Look
                        </button>
                      </div>
                      <div className="absolute top-4 left-4">
                        <span className="px-3 py-1 bg-bg-primary/90 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-wider text-text-primary">
                          {template.category}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-text-primary">{template.name}</h3>
                      <p className="text-sm text-text-secondary">{template.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Preview Modal */}
              <AnimatePresence>
                {quickPreviewId && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-stone-900/80 backdrop-blur-sm"
                  >
                    <div className="bg-bg-primary w-full max-w-6xl h-full rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-border-base">
                      <div className="p-4 border-b border-border-base flex items-center justify-between bg-bg-primary">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-text-primary rounded-lg flex items-center justify-center text-bg-primary text-xs font-bold">
                            {quickPreviewId}
                          </div>
                          <div>
                            <h4 className="font-bold text-text-primary">Preview: {TEMPLATES.find(t => t.id === quickPreviewId)?.name}</h4>
                            <p className="text-xs text-text-secondary opacity-60">Showing how your content looks in this style</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              handleSelectTemplate(quickPreviewId);
                              setQuickPreviewId(null);
                            }}
                            className="px-6 py-2 bg-accent-primary text-white rounded-full text-sm font-bold hover:opacity-90 transition-all"
                          >
                            Select This Style
                          </button>
                          <button
                            onClick={() => {
                              setQuickPreviewId(null);
                              setQuickPreviewUrl(null);
                            }}
                            className="p-2 hover:bg-bg-secondary rounded-full transition-all text-text-secondary"
                          >
                            <X className="w-6 h-6" />
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 bg-bg-secondary relative">
                        {quickPreviewLoading ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                            <div className="w-12 h-12 border-4 border-border-base border-t-accent-primary rounded-full animate-spin" />
                            <p className="text-text-secondary font-medium animate-pulse">Rendering your portfolio...</p>
                          </div>
                        ) : quickPreviewUrl ? (
                          <iframe
                            src={quickPreviewUrl}
                            className="w-full h-full border-none"
                            title="Quick Preview"
                          />
                        ) : null}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {step === 'confirm' && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12"
            >
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight mb-2 text-text-primary">Confirm Details</h2>
                  <p className="text-text-secondary">Review and edit the AI-generated content.</p>
                </div>

                <div className="space-y-6">
                  {confirmedSections && Object.entries(confirmedSections).map(([key, value]) => (
                    <div key={key} className="bg-card-bg p-6 rounded-2xl border border-border-base shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary opacity-60">{key}</h3>
                        {editingKey === key ? (
                          <button
                            onClick={() => {
                              try {
                                const parsed = JSON.parse(editValue);
                                setConfirmedSections({ ...confirmedSections, [key]: parsed });
                                setEditingKey(null);
                              } catch (e) {
                                alert("Invalid JSON format");
                              }
                            }}
                            className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingKey(key);
                              setEditValue(JSON.stringify(value, null, 2));
                            }}
                            className="p-2 hover:bg-bg-secondary rounded-lg transition-all text-text-secondary hover:text-text-primary"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {editingKey === key ? (
                        <textarea
                          className="w-full text-xs font-mono bg-bg-secondary p-4 rounded-lg border border-border-base outline-none focus:ring-2 focus:ring-accent-primary h-64 text-text-primary"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                        />
                      ) : (
                        <pre className="text-xs bg-bg-secondary p-4 rounded-lg overflow-auto max-h-48 text-text-secondary">
                          {JSON.stringify(value, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="w-full py-4 bg-accent-primary text-white rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? 'Generating...' : 'Generate Portfolio'}
                </button>
              </div>

              <div className="hidden lg:block sticky top-28 h-[calc(100vh-10rem)]">
                <LivePreview templateId={selectedTemplate} data={confirmedSections} />
              </div>
            </motion.div>
          )}

          {step === 'preview' && (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-[calc(100vh-12rem)] flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight mb-2 text-text-primary">Your Portfolio is Ready!</h2>
                  <p className="text-text-secondary">Preview your site and download the source code.</p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setStep('templates')}
                    className="px-6 py-3 border border-border-base rounded-xl font-bold hover:bg-bg-secondary transition-all flex items-center gap-2 text-text-primary"
                  >
                    <Layout className="w-5 h-5" />
                    Change Template
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-6 py-3 bg-accent-primary text-white rounded-xl font-bold hover:opacity-90 transition-all flex items-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Download ZIP
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-card-bg rounded-3xl border border-border-base shadow-2xl overflow-hidden relative">
                {previewUrl && (
                  <iframe
                    src={previewUrl}
                    className="w-full h-full border-none"
                    title="Portfolio Preview"
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
