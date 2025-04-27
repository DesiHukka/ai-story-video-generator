<!-- Badges -->
<p align="center">
  <a href="https://github.com/DesiHukka/ai-story-video-generator/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/DesiHukka/ai-video-creator/ci.yml" alt="CI Status" />
  </a>
  
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" />
  </a>
</p>

# AI Video Creator

> Turn any story into a polished video with AI-generated scenes, narration, ambient audio, and smooth transitions.

<p align="center">
  <img src="docs/overview.gif" alt="Demo GIF" width="700" />
</p>

---

## 📖 Table of Contents

- [Features](#-features)  
- [Architecture](#-architecture)  
- [Getting Started](#-getting-started)  
  - [Prerequisites](#prerequisites)  
  - [Backend Setup](#backend-setup)  
  - [Frontend Setup](#frontend-setup)  
- [Configuration](#-configuration)  
- [Development](#-development)  
- [API Reference](#-api-reference)  
- [Troubleshooting](#-troubleshooting)  
- [Contributing](#-contributing)  
- [License](#-license)  

---

## 🌟 Features

- **Scene Generation**: GPT-4O splits stories into JSON-structured scenes.  
- **Image Creation**: DALL·E & Bing Image Creator (with two-step retry + Puppeteer fallback).  
- **TTS Narration**: Google Cloud Text-to-Speech SSML-driven voice-over.  
- **Ambient Mixing**: Auto-detect “rain,” “forest,” etc., and blend background loops.  
- **Video Stitching**: FFmpeg crossfades multi-image scenes & loops single images.  
- **Caching**: File-based SHA1 cache avoids redundant TTS/images calls.  
- **React Frontend**: Vite + Tailwind + React Router for story input → preview → final.  

---

## 🏗 Architecture



- **backend/**  
  - `server.js` — Express API  
  - `storyToScenes.js` — orchestration  
  - `cache.js` — JSON/binary cache  
  - `fallbackImageGenChatGPT.js` — Puppeteer fallback  
  - `/audio`, `/images`, `/public/videos` — generated assets  

- **frontend/**  
  - Vite-powered React app  
  - Tailwind CSS for styling  
  - Components: `Spinner`, `SceneCard`, `VideoPlayer`  
  - Hooks: `useGenerateScenes`, `useStitchVideo`  

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18  
- **npm** or **yarn**  
- **FFmpeg** (in your PATH)  
- **Google Cloud TTS** service account JSON  
- **OpenAI API key**  
- *(Optional)* Chrome & ChatGPT cookies for fallback  

### Backend Setup

```bash
cd backend
npm install

⚙️ Backend Setup

cd backend
npm install

Edit .env:

OPENAI_API_KEY=sk-...
GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcloud-key.json
PORT=3000
(Optional) Add cookies1.json, cookies2.json, etc. in backend/ for Puppeteer fallback.

Start the server:


npm run dev
🎨 Frontend Setup

cd frontend
npm install

Edit .env:

VITE_API_BASE_URL=http://localhost:3000
Start the dev server:


npm run dev
⚙️ Environment Variables

Variable	Description	Default
OPENAI_API_KEY	OpenAI API Key	—
GOOGLE_APPLICATION_CREDENTIALS	Path to Google TTS JSON key	—
PORT	Backend server port	3000
VITE_API_BASE_URL	Frontend → Backend API base URL	http://localhost:3000
🛠 Development Commands
Lint Code

npm run lint

Clear Backend Cache
rm -rf backend/cache/*

Debug FFmpeg
Copy the logged xfade command and manually run it in your terminal for debugging.

📡 API Reference
POST /generate
Request:


{
  "story": "Once upon a time…",
  "type": "kids" // or "general"
}
Response:

{
  "scenes": [
    {
      "scene_number": 1,
      "narration": "...",
      "description": "...",
      "audioUrl": "/audio/scene_1.mp3",
      "imageUrls": ["/images/img1.jpg", "/images/img2.jpg"]
    }
  ],
  "videoUrl": "/videos/video_123456789.mp4"
}
❓ Troubleshooting

Issue	Solution
Missing assets	Ensure /audio, /images, and /public/videos directories are writable
Puppeteer errors	Install Chrome, export ChatGPT cookies, and increase timeouts in fallbackImageGenChatGPT.js
Tailwind CSS not working	Verify tailwind.config.js paths match your src/ folder
🤝 Contributing
We welcome contributions!

🍴 Fork this repository

🛠️ Create a feature branch

📥 Commit your changes

🚀 Push to your branch

🔥 Open a Pull Request


