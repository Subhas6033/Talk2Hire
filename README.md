# Talk2Hire — AI-Powered Interview Platform

> **[talk2hire.com](https://talk2hire.com)** — Intelligent, secure, and automated video interviews that connect job seekers with companies and accelerate hiring decisions.

---

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Features](#features)
- [Security & Integrity](#security--integrity)
- [AI Capabilities](#ai-capabilities)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)

---

## Overview

Talk2Hire is a full-stack AI-powered hiring platform that lets candidates apply for jobs by completing an **online AI interview** on a secure, proctored platform — anytime, anywhere. Companies receive recorded interview responses automatically analyzed and scored by AI, enabling faster, data-driven hiring decisions without scheduling live interviews.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TALK2HIRE PLATFORM FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

  CANDIDATE                        PLATFORM                          COMPANY
  ─────────                        ────────                          ───────

  [Sign Up]                            │                          [Sign Up]
      │                                │                              │
      ▼                                │                              ▼
  [Browse Job Openings] ◄──────────────┼────────────── [Post Job Opening]
      │                                │
      ▼                                │
  [Apply for Job] ─────────────────────►
                                       │
                              ┌────────▼────────┐
                              │  AI Interview   │
                              │    Session      │
                              └────────┬────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                   │
                    ▼                  ▼                   ▼
             [TTS reads          [STT captures      [Multi-Stream
              questions]          responses]          Recording]
                                                          │
                                                 ┌────────┴────────┐
                                                 │  • Webcam Feed  │
                                                 │  • Mobile Cam   │
                                                 │  • Screen Share │
                                                 └────────┬────────┘
                                                          │
                                       ┌──────────────────┘
                                       │
                              ┌────────▼─────────────────┐
                              │  Cheat Detection Engine  │
                              │  (Real-time monitoring)  │
                              └────────┬─────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                      │
                    ▼                                      ▼
             [Clean Session]                   [Cheating Detected]
                    │                                      │
                    │                                      ▼
                    │                          [Cheat Clip Extracted
                    │                           & Flagged Separately]
                    │                                      │
                    └──────────────┬───────────────────────┘
                                   │
                          ┌────────▼────────┐
                          │   AI Scoring &  │
                          │    Analysis     │
                          └────────┬────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
            [Candidate receives         [Company Dashboard
             score & feedback]           receives results]
                                                 │
                                    ┌────────────┴────────────┐
                                    │  • AI Score & Analysis  │
                                    │  • Recorded Videos      │
                                    │  • Cheat Flag (if any)  │
                                    └────────────┬────────────┘
                                                 │
                                                 ▼
                                      [Make Hiring Decision]
```

---

## Features

### For Candidates

| Feature                     | Description                                                           |
| --------------------------- | --------------------------------------------------------------------- |
| **Sign Up & Apply**         | Create an account, browse open positions, and apply in minutes        |
| **AI Interview Session**    | Structured interview guided by TTS questions and STT response capture |
| **Multi-Stream Recording**  | Webcam, mobile camera, and screen are recorded simultaneously         |
| **AI Scoring**              | Receive an automated performance score and feedback after submission  |
| **Mock Interview Practice** | Unlimited practice sessions to prepare before applying                |
| **Cheat Detection**         | Suspicious activity is automatically detected and clipped             |

### For Companies

| Feature                      | Description                                                        |
| ---------------------------- | ------------------------------------------------------------------ |
| **Post Job Openings**        | Publish listings and receive applications directly on the platform |
| **View Interview Responses** | Access all candidate video answers in your company dashboard       |
| **AI-Analyzed Results**      | Every candidate includes an AI score to accelerate shortlisting    |
| **Cheat Reports**            | Flagged candidates come with a dedicated cheat clip for review     |
| **Hiring Decisions**         | Review, compare, and decide on candidates — all in one place       |

---

## Security & Integrity

Talk2Hire uses a multi-layered proctoring system to ensure every interview is authentic.

| Layer                         | Method                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------- |
| **Multi-Camera Recording**    | Webcam + mobile camera + screen capture run simultaneously                   |
| **Real-Time Cheat Detection** | AI monitors for tab-switching, off-screen glances, and unauthorized audio    |
| **Cheat Clip Generation**     | Suspicious moments are extracted into a dedicated flagged clip               |
| **Secure Session Isolation**  | Interview environment is sandboxed to prevent external access                |
| **Encrypted Video Storage**   | All recordings are stored securely and accessible only to authorized parties |

---

## AI Capabilities

- **Text-to-Speech (TTS)** — Interview questions are delivered to candidates as natural voice prompts
- **Speech-to-Text (STT)** — Candidate spoken answers are transcribed in real time
- **Response Analysis** — AI evaluates answers for relevance, depth, clarity, and communication quality
- **Automated Scoring** — A performance score is generated before results reach the company
- **Cheat Detection Engine** — Flags behavioral anomalies during the session and generates clip evidence

---

## Tech Stack

### Frontend

| Technology          | Purpose                              |
| ------------------- | ------------------------------------ |
| **ReactJS**         | Component-based UI framework         |
| **React Router v6** | Client-side routing & navigation     |
| **Tailwind CSS**    | Utility-first styling                |
| **react-hook-form** | Form state management and validation |
| **lucide-react**    | Icon library                         |

### AI & Media

| Technology                 | Purpose                                      |
| -------------------------- | -------------------------------------------- |
| **Web Speech API / STT**   | Real-time speech-to-text transcription       |
| **TTS Engine**             | Question delivery via text-to-speech         |
| **MediaRecorder API**      | Multi-stream video and audio capture         |
| **AI Scoring Engine**      | Post-interview analysis and scoring pipeline |
| **Cheat Detection Module** | Behavioral monitoring and clip extraction    |

### Backend (Integration-Ready)

| Technology             | Purpose                                                |
| ---------------------- | ------------------------------------------------------ |
| **REST / GraphQL API** | Candidate, company, and interview data management      |
| **Video Storage**      | Encrypted upload and retrieval of interview recordings |
| **Auth System**        | Secure signup, login, and session management           |

---

## Getting Started

### Prerequisites

- Node.js `>= 18.x`
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/talk2hire.git
cd talk2hire

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

---

## License

This project is proprietary and confidential. Unauthorized use, reproduction, or distribution is strictly prohibited.

© 2025 Talk2Hire. All rights reserved.
