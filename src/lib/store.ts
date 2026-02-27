import { create } from 'zustand';

interface PortfolioState {
  step: 'input' | 'templates' | 'confirm' | 'preview';
  githubData: any;
  linkedinData: any;
  resumeText: string;
  insights: any;
  selectedTemplate: string | null;
  confirmedSections: any;
  sessionId: string | null;
  theme: 'light' | 'dark';
  setStep: (step: 'input' | 'templates' | 'confirm' | 'preview') => void;
  setGithubData: (data: any) => void;
  setLinkedinData: (data: any) => void;
  setResumeText: (text: string) => void;
  setInsights: (insights: any) => void;
  setSelectedTemplate: (template: string) => void;
  setConfirmedSections: (sections: any) => void;
  setSessionId: (id: string) => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useStore = create<PortfolioState>((set) => ({
  step: 'input',
  githubData: null,
  linkedinData: null,
  resumeText: '',
  insights: null,
  selectedTemplate: null,
  confirmedSections: null,
  sessionId: null,
  theme: 'light',
  setStep: (step) => set({ step }),
  setGithubData: (githubData) => set({ githubData }),
  setLinkedinData: (linkedinData) => set({ linkedinData }),
  setResumeText: (resumeText) => set({ resumeText }),
  setInsights: (insights) => set({ insights }),
  setSelectedTemplate: (selectedTemplate) => set({ selectedTemplate }),
  setConfirmedSections: (confirmedSections) => set({ confirmedSections }),
  setSessionId: (sessionId) => set({ sessionId }),
  setTheme: (theme) => set({ theme }),
}));
