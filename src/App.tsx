import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Github, Linkedin, ArrowRight, ArrowLeft, Layout, Download, Eye, X, Upload, FileText, Sun, Moon, Edit2, Check, Globe } from 'lucide-react';
import { useStore } from './lib/store';
import { analyzeGithub, generatePortfolio, renderPortfolio, generatePortfolioContent, recommendPortfolioTemplates } from './lib/api';
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

  const handleFillDemo = () => {
    setResumeInput("Hi, I'm Alex! I'm an aspiring Frontend Developer who just transitioned from graphic design. I love building beautiful, interactive web applications. I'm currently focused on mastering React, Tailwind CSS, and Framer Motion. In my free time, I've been building responsive landing pages for local coffee shops to practice my skills.");
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary relative overflow-x-hidden">
      {/* Background Orbs */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-accent-primary opacity-20 blur-[150px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-violet-500 opacity-10 blur-[150px] rounded-full pointer-events-none" />

      {/* Floating Header */}
      <div className="fixed top-6 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
        <nav className="pointer-events-auto flex items-center justify-between px-6 py-3 bg-bg-secondary/70 backdrop-blur-xl border border-border-base/50 rounded-full w-full max-w-5xl Premium-shadow">
          <div className="flex items-center gap-3 font-bold text-lg tracking-tight hover:scale-105 transition-transform cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-gradient-accent flex items-center justify-center text-white shadow-lg">
              P
            </div>
            <span className="text-text-primary">FolioAI</span>
          </div>

          <div className="hidden md:flex items-center space-x-2 text-sm font-bold text-text-secondary">
            {['input', 'templates', 'confirm', 'preview'].map((s, i) => (
              <React.Fragment key={s}>
                <div className={`px-4 py-1.5 rounded-full transition-all duration-300 ${step === s ? 'bg-text-primary text-bg-primary shadow-md scale-105' : 'opacity-60'}`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </div>
                {i < 3 && <ArrowRight className="w-3 h-3 opacity-30" />}
              </React.Fragment>
            ))}
          </div>

          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2.5 bg-bg-primary border border-border-base/50 hover:bg-border-base rounded-full transition-all text-text-primary shadow-sm hover:scale-110"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </nav>
      </div>

      <main className="max-w-7xl mx-auto px-4 pt-36 pb-12 relative z-10">
        <AnimatePresence mode="wait">
          {step === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12 items-center"
            >
              <div className="md:col-span-5 text-left md:pr-8">
                <h1 className="text-5xl sm:text-6xl font-bold tracking-tighter mb-6 text-text-primary leading-[1.1]">
                  A professional portfolio, <br className="hidden md:block" />
                  <span className="text-transparent bg-clip-text bg-gradient-accent">in seconds.</span>
                </h1>
                <p className="text-text-secondary text-lg mb-8 leading-relaxed">
                  We extract your professional identity from GitHub and LinkedIn to generate a high-converting, stunning web presence. No coding required.
                </p>
              </div>

              <div className="md:col-span-7 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* GitHub Bento */}
                  <div className="bg-card-bg p-6 rounded-3xl border border-border-base Premium-shadow hover:border-text-secondary/30 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-text-primary opacity-5 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                    <div className="flex items-center gap-3 mb-4 text-text-primary">
                      <div className="p-3 bg-bg-secondary rounded-2xl group-hover:bg-text-primary group-hover:text-bg-primary transition-colors">
                        <Github className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-lg">GitHub ID <span className="text-sm text-accent-primary opacity-80 font-normal ml-2">(Best)</span></h3>
                    </div>
                    <input
                      type="text"
                      className="w-full bg-transparent border-b-2 border-border-base focus:border-accent-primary py-2 text-lg outline-none text-text-primary transition-colors font-medium placeholder-text-secondary/40"
                      placeholder="e.g. octocat"
                      value={githubUsername}
                      onChange={(e) => setGithubUsername(e.target.value)}
                    />
                  </div>

                  {/* LinkedIn Data Bento */}
                  <div className="bg-card-bg p-6 rounded-3xl border border-border-base Premium-shadow hover:border-text-secondary/30 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent-primary opacity-5 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                    <div className="flex items-center gap-3 mb-4 text-text-primary">
                      <div className="p-3 bg-bg-secondary rounded-2xl group-hover:bg-accent-primary group-hover:text-white transition-colors">
                        <Linkedin className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-lg">LinkedIn Data <span className="text-sm text-text-secondary opacity-60 font-normal ml-2">(Optional)</span></h3>
                    </div>
                    <textarea
                      className="w-full bg-transparent border-b-2 border-border-base focus:border-accent-primary py-2 text-sm outline-none resize-none text-text-primary transition-colors font-medium placeholder-text-secondary/40 h-[40px] custom-scrollbar focus:h-[100px]"
                      placeholder="Paste extension data..."
                      value={linkedinInput}
                      onChange={(e) => setLinkedinInput(e.target.value)}
                    />
                  </div>
                </div>

                {/* PDF/Text Bento */}
                <div className="bg-card-bg p-6 sm:p-8 rounded-3xl border border-border-base Premium-shadow relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-bg-secondary/20 to-transparent group-hover:translate-x-[100%] transition-transform duration-1000" />
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-bg-secondary rounded-2xl">
                        <FileText className="w-6 h-6 text-text-primary" />
                      </div>
                      <h3 className="font-bold text-lg text-text-primary">Resume or Manual Bio <span className="text-sm text-accent-primary opacity-80 font-normal ml-2">(Best)</span></h3>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-6">
                    <div className="flex-1 flex flex-col pt-1">
                      <textarea
                        className="w-full flex-1 min-h-[140px] bg-bg-secondary/50 rounded-2xl border border-border-base/50 focus:border-accent-primary/50 p-4 outline-none resize-none text-text-primary transition-colors text-sm custom-scrollbar"
                        placeholder="Paste resume text, or just type a short bio about your skills and experience here..."
                        value={resumeInput}
                        onChange={(e) => setResumeInput(e.target.value)}
                      />
                      <p className="text-xs text-text-secondary opacity-80 mt-3 text-center sm:text-left">
                        Don't have anything ready?{' '}
                        <button 
                          onClick={handleFillDemo} 
                          className="text-accent-primary font-bold hover:underline transition-all"
                        >
                          Autofill with an example
                        </button>
                      </p>
                    </div>
                    <div className="hidden sm:flex flex-col items-center justify-center">
                      <div className="w-px h-12 bg-border-base" />
                      <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest my-2">OR</span>
                      <div className="w-px h-12 bg-border-base" />
                    </div>
                    <div className="flex-1">
                      <label className="flex flex-col items-center justify-center w-full h-[140px] border-2 border-dashed border-border-base rounded-2xl cursor-pointer hover:bg-bg-secondary/80 hover:border-accent-primary/50 transition-all group/upload">
                        <div className="p-4 bg-bg-primary rounded-full mb-3 group-hover/upload:scale-110 transition-transform shadow-md">
                          {uploading ? (
                            <div className="w-6 h-6 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
                          ) : (
                            <Upload className="w-5 h-5 text-text-primary" />
                          )}
                        </div>
                        <span className="text-sm font-bold text-text-primary">
                          {uploading ? 'Parsing PDF...' : 'Upload PDF'}
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf"
                          onChange={handleFileUpload}
                          disabled={uploading}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleAnalyze}
                    disabled={(!githubUsername.trim() && !linkedinInput && !resumeInput) || loading}
                    className="w-full py-5 bg-text-primary text-bg-primary rounded-2xl font-bold text-lg hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 shadow-xl"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-bg-primary/30 border-t-bg-primary rounded-full animate-spin" />
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
              </div>
            </motion.div>
          )}

          {step === 'templates' && (
            <motion.div
              key="templates"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-center mb-16 relative">
                <button
                  onClick={() => setStep('input')}
                  className="absolute left-0 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-2 text-sm font-bold text-text-secondary hover:text-text-primary transition-colors bg-card-bg border border-border-base px-4 py-2 rounded-full premium-shadow hover:scale-105"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Input
                </button>
                <div className="flex lg:hidden justify-center mb-6">
                  <button
                    onClick={() => setStep('input')}
                    className="flex items-center gap-2 text-sm font-bold text-text-secondary hover:text-text-primary transition-colors bg-card-bg border border-border-base px-4 py-2 rounded-full premium-shadow hover:scale-105"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to Input
                  </button>
                </div>
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tighter mb-4 text-text-primary">Select an Aesthetic</h2>
                <p className="text-text-secondary text-lg">AI parsed your data. Now, choose the structural skeleton.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                {TEMPLATES.map((template, idx) => (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={template.id}
                    className="group flex flex-col"
                  >
                    <div className="aspect-video bg-bg-secondary rounded-2xl mb-5 overflow-hidden border border-border-base Premium-shadow group-hover:border-accent-primary/50 group-hover:-translate-y-1 transition-all duration-300 relative">
                      <TemplateThumbnail templateId={template.id} data={confirmedSections} />
                      
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-bg-primary/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-4 p-6 z-10">
                        <button
                          onClick={() => handleSelectTemplate(template.id)}
                          className="w-full bg-text-primary text-bg-primary py-3.5 rounded-xl font-bold shadow-xl hover:scale-105 transition-transform"
                        >
                          Use this Template
                        </button>
                        <button
                          onClick={() => handleQuickPreview(template.id)}
                          className="flex items-center justify-center gap-2 text-text-primary font-semibold hover:text-accent-primary transition-colors"
                        >
                          <Eye className="w-4 h-4" /> Quick Look
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-lg text-text-primary tracking-tight">{template.name}</h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-accent-primary bg-accent-primary/10 px-2 py-0.5 rounded-md">
                          {template.category}
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary">{template.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Quick Preview Modal */}
              <AnimatePresence>
                {quickPreviewId && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-md"
                  >
                    <div className="bg-bg-primary w-full max-w-6xl h-full rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-border-base relative">
                      {/* Fake Browser Toolbar */}
                      <div className="h-12 border-b border-border-base bg-bg-secondary/50 flex items-center px-4 justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-400"></div>
                          <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                          <div className="w-3 h-3 rounded-full bg-green-400"></div>
                        </div>
                        <div className="flex-1 flex justify-center">
                          <div className="bg-bg-primary border border-border-base rounded-md px-32 py-1 text-xs text-text-secondary opacity-60">localhost:3000/preview</div>
                        </div>
                        <button onClick={() => setQuickPreviewId(null)} className="p-1.5 hover:bg-border-base rounded-full transition-colors text-text-secondary">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex-1 bg-white relative">
                        {quickPreviewLoading ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-bg-primary">
                            <div className="w-12 h-12 border-4 border-border-base border-t-accent-primary rounded-full animate-spin" />
                            <p className="text-text-secondary font-medium animate-pulse text-sm">Rendering preview...</p>
                          </div>
                        ) : quickPreviewUrl ? (
                          <iframe src={quickPreviewUrl} className="w-full h-full border-none" title="Quick Preview" />
                        ) : null}
                      </div>

                      <div className="absolute bottom-6 inset-x-0 flex justify-center z-10 pointer-events-none">
                        <button
                          onClick={() => {
                            handleSelectTemplate(quickPreviewId);
                            setQuickPreviewId(null);
                          }}
                          className="pointer-events-auto px-8 py-4 bg-text-primary text-bg-primary rounded-full font-bold shadow-2xl hover:scale-105 transition-all text-sm flex items-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Confirm this Template
                        </button>
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
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-14rem)]"
            >
              <div className="lg:col-span-12 flex items-center mb-[-1rem]">
                <button
                  onClick={() => setStep('templates')}
                  className="flex items-center gap-2 text-sm font-bold text-text-secondary hover:text-text-primary transition-colors bg-card-bg border border-border-base px-5 py-2.5 rounded-full premium-shadow hover:scale-105"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Templates
                </button>
              </div>
              <div className="lg:col-span-5 flex flex-col h-[calc(100%-1.5rem)] bg-card-bg border border-border-base rounded-2xl Premium-shadow overflow-hidden">
                <div className="p-6 border-b border-border-base bg-bg-secondary/30">
                  <h2 className="text-2xl font-bold tracking-tight mb-1 text-text-primary">Content Editor</h2>
                  <p className="text-sm text-text-secondary">Fine-tune the AI generated content before final build.</p>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                  {confirmedSections && Object.entries(confirmedSections).map(([key, value]) => (
                    <div key={key} className="group">
                      <div className="flex items-center justify-between mb-3 border-b border-border-base pb-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary">{key}</h3>
                        {editingKey === key ? (
                          <button
                            onClick={() => {
                              try {
                                const parsed = JSON.parse(editValue);
                                setConfirmedSections({ ...confirmedSections, [key]: parsed });
                                setEditingKey(null);
                              } catch (e) {
                                alert("Invalid JSON format. Please check for errors.");
                              }
                            }}
                            className="bg-accent-primary/10 text-accent-primary px-3 py-1 rounded-md text-xs font-bold hover:bg-accent-primary/20 transition-colors flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Save
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingKey(key);
                              setEditValue(JSON.stringify(value, null, 2));
                            }}
                            className="text-text-secondary opacity-0 group-hover:opacity-100 hover:text-accent-primary transition-all p-1"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      
                      <div className="bg-bg-secondary rounded-xl overflow-hidden border border-border-base/50 focus-within:border-accent-primary/50 transition-colors">
                        {editingKey === key ? (
                          <textarea
                            className="w-full text-[13px] font-mono bg-transparent p-4 outline-none resize-y min-h-[200px] text-text-primary custom-scrollbar"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            spellCheck={false}
                          />
                        ) : (
                          <div className="p-4 text-[13px] font-mono whitespace-pre-wrap text-text-secondary overflow-x-auto custom-scrollbar">
                            {JSON.stringify(value, null, 2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t border-border-base bg-bg-secondary/30">
                  <button
                    onClick={handleConfirm}
                    disabled={loading}
                    className="w-full py-4 bg-text-primary text-bg-primary rounded-xl font-bold hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    {loading ? 'Building Portfolio...' : 'Generate Final Build'}
                  </button>
                </div>
              </div>

              <div className="lg:col-span-7 h-[calc(100%-1.5rem)] rounded-2xl overflow-hidden border border-border-base Premium-shadow relative flex flex-col bg-bg-primary">
                {/* Safari/Mac Toolbar Style */}
                <div className="h-12 border-b border-border-base bg-bg-secondary/50 flex items-center px-4 select-none shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                  </div>
                  <div className="flex-1 flex justify-center ml-[-40px]">
                    <div className="bg-bg-primary border border-border-base rounded flex items-center gap-2 px-3 py-1 shadow-sm">
                      <Layout className="w-3 h-3 text-text-secondary opacity-50" />
                      <span className="text-[10px] font-medium text-text-secondary">Live Update</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 bg-white relative">
                  <LivePreview templateId={selectedTemplate} data={confirmedSections} />
                </div>
              </div>
            </motion.div>
          )}

          {step === 'preview' && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col h-[calc(100vh-10rem)] max-w-6xl mx-auto"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
                <div>
                  <h2 className="text-4xl font-bold tracking-tighter mb-2 text-text-primary">Your site is ready.</h2>
                  <p className="text-text-secondary text-lg">Preview your professional portfolio and download the source code.</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => setStep('confirm')}
                    className="flex-1 sm:flex-none px-6 py-3 border border-border-base rounded-xl font-bold hover:bg-bg-secondary transition-colors text-text-primary flex justify-center items-center gap-2 text-sm"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to Editor
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex-1 sm:flex-none px-6 py-3 bg-text-primary text-bg-primary rounded-xl font-bold hover:scale-105 transition-transform flex justify-center items-center gap-2 text-sm shadow-xl"
                  >
                    <Download className="w-4 h-4" /> Download ZIP
                  </button>
                </div>
              </div>

              <div className="flex-1 rounded-2xl border border-border-base Premium-shadow flex flex-col bg-bg-primary overflow-hidden relative">
                {/* Safari/Mac Toolbar Style */}
                <div className="h-12 border-b border-border-base bg-bg-secondary/50 flex items-center px-4 select-none shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                  </div>
                  <div className="flex-1 flex justify-center ml-[-40px]">
                    <div className="bg-bg-primary border border-border-base rounded flex items-center gap-2 px-32 py-1 shadow-sm">
                      <Globe className="w-3 h-3 text-text-secondary opacity-50" />
                      <span className="text-[10px] font-medium text-text-secondary">your-portfolio.com</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 relative bg-white">
                  {previewUrl && (
                    <iframe
                      src={previewUrl}
                      className="absolute inset-0 w-full h-full border-none"
                      title="Portfolio Preview"
                    />
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
