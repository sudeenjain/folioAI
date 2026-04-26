# 🧠 FolioAI — Free & Easy AI-Powered Portfolio Builder

> Generate a stunning professional portfolio in seconds — powered by AI, no design skills needed.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-portfolio--ai--eta--dusky.vercel.app-blue?style=for-the-badge)](https://portfolio-ai-eta-dusky.vercel.app/)
[![Built with React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/)

---

## ✨ What is FolioAI?

**FolioAI** is an AI-powered portfolio builder that lets anyone — developers, designers, freelancers — create a polished personal portfolio without writing a single line of HTML or CSS. Just provide your details, and the AI generates a beautiful, ready-to-deploy portfolio for you.

---

## 🚀 Features

- **AI-Powered Generation** — Uses Google's Gemini API to intelligently craft portfolio content
- **PDF Resume Parsing** — Upload your resume and let AI extract your experience, skills, and projects automatically
- **Live Preview** — See your portfolio rendered in real time as you make changes
- **One-Click Export** — Download your complete portfolio as a ZIP file, ready to host anywhere
- **Chrome Extension** — Capture and import data directly from your browser
- **Multiple Templates** — Choose from different portfolio styles via EJS server-side templates
- **Smooth Animations** — Powered by Framer Motion for fluid, professional transitions
- **Fully Responsive** — Looks great on desktop and mobile

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS v4 |
| Backend | Express.js, TypeScript (`tsx`) |
| AI | Google Gemini API (`@google/generative-ai`) |
| PDF Parsing | `pdfjs-dist` |
| Templating | EJS (server-side portfolio templates) |
| Export | `archiver` (ZIP generation) |
| Database | `better-sqlite3` |
| State Management | Zustand |
| Animations | Framer Motion (`motion`) |
| Build Tool | Vite 6 |
| Deployment | Vercel |

---

## 📦 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/sudeenjain/folioAI.git
cd folioAI

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# → Add your GEMINI_API_KEY to .env.local

# 4. Start the development server
npm run dev
```

The app will be running at `http://localhost:3000` (or whichever port is configured).

---

## ⚙️ Environment Variables

Create a `.env.local` file in the root directory:

```env
GEMINI_API_KEY=your_google_gemini_api_key_here
```

You can get a free Gemini API key at [Google AI Studio](https://aistudio.google.com/app/apikey).

---

## 📁 Project Structure

```
folioAI/
├── src/                  # React frontend source
├── server/
│   └── templates/        # EJS portfolio templates
├── chrome-extension/     # Browser extension source
├── public/               # Static assets
├── scratch/              # Experimental/draft files
├── server.ts             # Express backend entry point
├── vite.config.ts        # Vite configuration
├── vercel.json           # Vercel deployment config
└── .env.example          # Environment variable template
```

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server (frontend + backend via `tsx`) |
| `npm run build` | Build the frontend for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Type-check with TypeScript (`tsc --noEmit`) |
| `npm run clean` | Remove the `dist/` folder |

---

## 🌐 Deployment

FolioAI is configured for deployment on **Vercel** out of the box via `vercel.json`.

```bash
# Deploy with Vercel CLI
npx vercel
```

Make sure to set your `GEMINI_API_KEY` as an environment variable in your Vercel project settings.

---

## 🧩 Chrome Extension

The `chrome-extension/` directory contains a browser extension that allows you to capture profile data and information directly from the web and import it into FolioAI — making it even easier to populate your portfolio.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source. See the repository for license details.

---

## 🔗 Links

- **Live App:** [portfolio-ai-eta-dusky.vercel.app](https://portfolio-ai-eta-dusky.vercel.app/)
- **GitHub:** [github.com/sudeenjain/folioAI](https://github.com/sudeenjain/folioAI)
---

<p align="center">Made with ❤️ by <a href="https://github.com/sudeenjain">sudeenjain</a></p>
