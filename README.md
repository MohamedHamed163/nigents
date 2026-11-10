<div align="center">

# 🌙 Nigents — Night Agents for GitLab

**Send a task on Telegram before you sleep. Wake up to a finished Merge Request.**

A self-hosted AI development team: 7 specialized agents plan, code, test, review and ship features to GitLab while you sleep. It also includes a live dashboard, Workflow Studio, a voice meeting room and **21 Crazy macOS apps**.

![Node](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-live-010101?logo=socket.io)
![Telegram](https://img.shields.io/badge/Telegram-Bot-26A5E4?logo=telegram&logoColor=white)
![GitLab](https://img.shields.io/badge/GitLab-MRs-FC6D26?logo=gitlab&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-38%20tools-ff5a1f)
![License](https://img.shields.io/badge/license-MIT-blue)

<img src="docs/screenshots/home.png" alt="Nigents landing page" width="100%"/>

</div>

---

## 📑 Table of Contents

1. [What is Nigents?](#-what-is-nigents)
2. [Feature Overview](#-feature-overview)
3. [The 7-Agent Team](#-the-7-agent-team)
4. [How It Works](#-how-it-works)
5. [Dashboard](#-dashboard)
6. [Public Site Pages](#-public-site-pages)
7. [🤪 Crazy Apps (21 macOS experiments)](#-crazy-apps--21-macos-experiments)
8. [Nigents Apps (sister workspaces)](#-nigents-apps-sister-workspaces)
9. [Telegram & Voice](#-telegram--voice)
10. [MCP Servers](#-mcp-servers)
11. [Tech Stack](#-tech-stack)
12. [Project Structure](#-project-structure)
13. [Run Locally](#-run-locally)
14. [Deployment](#-deployment)
15. [Further Docs](#-further-docs)

---

## 🌙 What is Nigents?

Nigents (Night Agents) is a self-hosted AI agent team that runs 24/7 on your own server (AWS EC2 + PM2). You describe a task in **Arabic or English**, by text or voice note, on Telegram. The agents analyze your GitLab repo, write a plan, implement it on a task branch and open a **Merge Request**. You watch everything stream live in the dashboard.

## ✨ Feature Overview

| Feature | Description |
|---|---|
| 🤖 **7 AI Agents** | Orchestrator, Planner, Backend Dev, Frontend Dev, QA Tester, Code Reviewer, Reporter, plus Architect, DevOps and Security helpers |
| 🔀 **GitLab Integration** | Clone the selected repo, edit on a task branch, push, and open an MR (task branch → default branch) |
| 🎙️ **Voice Commands** | Arabic/English voice notes on Telegram (Whisper transcription + gTTS replies) |
| 📊 **Live Dashboard** | Real-time agent activity, code streaming over Socket.io, charts, costs |
| 🧩 **Workflow Studio** | Drag agents onto a canvas, connect handoffs, AI-draft a flow from a repo, watch a live run |
| 🗣️ **Voice Meeting Room** | A shareable Jitsi room with an AI roundtable where agents answer in turn |
| 🛠️ **38 MCP Tools** | 35 standard plus 3 custom MCP servers (Arabic RTL Auditor, Task Splitter, Smart Code Search) |
| 🧠 **Multi-provider AI** | Anthropic Claude, OpenAI, Zhipu GLM, Moonshot Kimi, DeepSeek, or a custom provider, configurable per agent |
| 👥 **Multi-user & Admin** | Dashboard accounts, onboarding, per-user Telegram + GitLab keys, admin panel |
| 🐳 **Code Sandbox** | OpenHands when available, otherwise repo-clone-push or GitLab API fallback |
| 📚 **Free Materials** | PDF roadmaps (backend, frontend, fullstack, QA) with email subscribe flow |
| 🤪 **Crazy Apps** | 21 native macOS menu-bar experiments, each with its own landing page + DMG |
| 🗂️ **Nigents Apps** | Shared sheets/issues/builds workspaces for multiple products |

---

## 🤖 The 7-Agent Team

| Agent | Role | Responsibilities |
|---|---|---|
| **Orchestrator** | Team Lead & Router | Receives tasks, detects intent (AR/EN), delegates, tracks progress |
| **Planner** | Architecture & Planning | Reads the codebase via GitLab, lists files to change, estimates S/M/L |
| **Backend Dev** | Backend Developer | Implements backend/fullstack plans via OpenHands or repo-clone-push |
| **Frontend Dev** | Frontend Developer | React/TSX/CSS changes with RTL & UI/UX care |
| **QA Tester** | Quality Assurance | Writes and runs tests, validates behaviour |
| **Code Reviewer** | Reviewer | Security audit, quality checks, RTL compliance |
| **Reporter** | Communicator | Telegram updates, daily standups, cost tracking |

Agents are defined in [`src/agents/`](src/agents) and configured in [`config/agents.json`](config/agents.json). Group chat orchestration lives in [`src/autogen/`](src/autogen).

## 🔄 How It Works

```mermaid
flowchart LR
  U[You on Telegram<br/>text or voice] --> O[Orchestrator]
  O --> P[Planner<br/>reads GitLab repo]
  P -->|/approve| B[Backend Dev]
  P -->|/approve| F[Frontend Dev]
  B --> Q[QA Tester]
  F --> Q
  Q --> R[Code Reviewer]
  R --> G[(GitLab<br/>task branch + MR)]
  R --> Rep[Reporter]
  Rep --> U
  O -. Socket.io .-> D[Live Dashboard]
```

1. **Plan:** `/plan Add phone login`. The Planner analyzes the repo and returns a plan.
2. **Approve & run:** `/approve` or `/run` queues the task.
3. **Implement:** the agents fetch the repo, edit only the plan-listed files and push to the task branch.
4. **Merge Request:** an MR is opened on GitLab and the Reporter pings you.
5. **Watch:** follow every step live in the dashboard.

---

## 📊 Dashboard

Log in at `http://localhost:4000/login.html` (local default is `admin` / `admin`; change it with `DASHBOARD_ADMIN_USERNAME` / `DASHBOARD_ADMIN_PASSWORD`).

| Overview | Workflow Studio |
|---|---|
| <img src="docs/screenshots/dashboard.png" width="100%"/> | <img src="docs/screenshots/dashboard-workflow-studio.png" width="100%"/> |
| **Live Monitor** | **AI Providers** |
| <img src="docs/screenshots/dashboard-live-monitor.png" width="100%"/> | <img src="docs/screenshots/dashboard-ai-providers.png" width="100%"/> |
| **Model Stats** | **Admin** |
| <img src="docs/screenshots/dashboard-model-stats.png" width="100%"/> | <img src="docs/screenshots/dashboard-admin.png" width="100%"/> |
| **Logs** | **Login** |
| <img src="docs/screenshots/logs.png" width="100%"/> | <img src="docs/screenshots/login.png" width="100%"/> |

Sidebar sections: Dashboard · Live Monitor · Tasks · Agents · Activity · GitLab Repos · Workflow Studio · Model Stats · AI Providers · MCP Tools · Settings · Admin · Subscribers · Logs.

## 🌐 Public Site Pages

| Home | How it works |
|---|---|
| <img src="docs/screenshots/home.png" width="100%"/> | <img src="docs/screenshots/how-it-works.png" width="100%"/> |
| **AI Skills** | **Free Materials** |
| <img src="docs/screenshots/skills.png" width="100%"/> | <img src="docs/screenshots/materials.png" width="100%"/> |
| **Crazy Apps** | **OpenCode Kits (soon)** |
| <img src="docs/screenshots/crazy-apps.png" width="100%"/> | <img src="docs/screenshots/opencode-kits.png" width="100%"/> |

---

## 🤪 Crazy Apps — 21 macOS experiments

These are native macOS menu-bar toys and utilities, mostly written in Swift. Each one has its own landing page under `src/dashboard/public/<app>.html` and a DMG in `src/dashboard/public/downloads/`. Open them at `http://localhost:4000/crazy-apps.html`.

| Icon | App | What it does | Landing |
|:---:|---|---|---|
| <img src="docs/icons/airsound.png" width="48"/> | **AirSound** | Tilt your MacBook and stereo pans with the motion sensor. Bounce loop with a silent center dead zone; best on headphones. | [`/airsound.html`](src/dashboard/public/airsound.html) |
| <img src="docs/icons/appjealousy.png" width="48"/> | **AppJealousy** | Dock apps react when you ignore them, with a jealousy timer, moods and notifications. | [`/appjealousy.html`](src/dashboard/public/appjealousy.html) |
| <img src="docs/icons/batterydna.png" width="48"/> | **Battery DNA** | Shows charge state, cycles and battery health in the menu bar. | [`/batterydna.html`](src/dashboard/public/batterydna.html) |
| <img src="docs/icons/breathbar.png" width="48"/> | **BreathBar** | Guided breathing (box, 4-7-8) with session rings, streaks, a focus overlay and break reminders. | [`/breathbar.html`](src/dashboard/public/breathbar.html) |
| <img src="docs/icons/langflip.png" width="48"/> | **LangFlip** | Typed in the wrong layout? Triple-tap ⌘ to flip the text between Arabic and English in place. | [`/langflip.html`](src/dashboard/public/langflip.html) |
| <img src="docs/icons/breakalarm.png" width="48"/> | **Break Alarm** | Dims every screen and plays a chime when it's time to stand up. | [`/breakalarm.html`](src/dashboard/public/breakalarm.html) |
| <img src="docs/icons/moodboard.png" width="48"/> | **MoodBoard** | Five mood modes. Each one changes the wallpaper on every screen, streams a phrase, then plays media with a live wave animation. | [`/moodboard.html`](src/dashboard/public/moodboard.html) |
| <img src="docs/icons/tiltdj.png" width="48"/> | **TiltDJ** | Desktop groove box with 8 synth pads, a 16-step grid, audio import remix, hot cues and voice drops. | [`/tiltdj.html`](src/dashboard/public/tiltdj.html) |
| <img src="docs/icons/thermalmap.png" width="48"/> | **ThermalMap** | Shows the thermal state of CPU, GPU, Neural Engine, storage, battery and chassis zones, with an animated fan indicator. | [`/thermalmap.html`](src/dashboard/public/thermalmap.html) |
| <img src="docs/icons/focusflow.png" width="48"/> | **FocusFlow** | Pomodoro timer with ambient soundscapes (rain, cafe, fire, birds, waves) and circular progress. Source is in [`FocusFlow/`](FocusFlow). | [`/focusflow.html`](src/dashboard/public/focusflow.html) |
| <img src="docs/icons/escape.png" width="48"/> | **Escape** | One hotkey switches every window to VS Code and Terminal in under 100 ms. | [`/escape.html`](src/dashboard/public/escape.html) |
| <img src="docs/icons/mousetrailmap.png" width="48"/> | **MouseTrailMap** | Draws rainbow trails as your mouse moves, with live stats for points, speed, distance and clicks. | [`/mousetrailmap.html`](src/dashboard/public/mousetrailmap.html) |
| <img src="docs/icons/riseopen.png" width="48"/> | **Rise&Open** | Raise a finger at the FaceTime camera to launch an app. Uses the Vision framework, with each finger mapped to an app. | [`/riseopen.html`](src/dashboard/public/riseopen.html) |
| <img src="docs/icons/gravitydock.png" width="48"/> | **GravityDock** | Turns Dock icons into physics objects with four modes: Bounce, Float, Gravity and Chaos. Click a flying icon to launch it. | [`/gravitydock.html`](src/dashboard/public/gravitydock.html) |
| <img src="docs/icons/ghosttouch.png" width="48"/> | **GhostTouch** | Keeps your Mac awake with invisible micro mouse movements and key presses. Four modes, near-zero CPU. | [`/ghosttouch.html`](src/dashboard/public/ghosttouch.html) |
| <img src="docs/icons/notchhq.png" width="48"/> | **NotchHQ** | Hover at the notch for 7 tools: Now Playing, Notes, Timer, Calculator, Clipboard, AI Chat and System Stats. | [`/notchhq.html`](src/dashboard/public/notchhq.html) |
| <img src="docs/icons/cursorage.png" width="48"/> | **CursorAge** | An idle cursor grows old (wrinkles, cracks, a walking cane) and snaps back to young when you move it. | [`/cursorage.html`](src/dashboard/public/cursorage.html) |
| <img src="docs/icons/dontforget.png" width="48"/> | **DontForget** | Notch reminders for up to 5 apps. A frosted-glass card drops down when an app has been idle too long. | [`/dontforget.html`](src/dashboard/public/dontforget.html) |
| <img src="docs/icons/desktopload.png" width="48"/> | **Desktop Load** | Treats your desktop as a pressure gauge: a live count of clutter files with one-click clean. | [`/desktopload.html`](src/dashboard/public/desktopload.html) |
| <img src="docs/icons/nightowldiary.png" width="48"/> | **NightOwlDiary** | Five-minute end-of-day reflection with three prompts. Fully offline SQLite with a 7-day streak. | [`/nightowldiary.html`](src/dashboard/public/nightowldiary.html) |
| <img src="docs/icons/whispertype.png" width="48"/> | **WhisperType** | Speak a plan in English or Arabic. Whisper and GPT-4o-mini turn it into prioritized steps with time estimates. | [`/whispertype.html`](src/dashboard/public/whispertype.html) |

### Crazy Apps gallery

| | |
|---|---|
| <img src="docs/screenshots/crazy-apps/airsound.png"/><br/>**AirSound** | <img src="docs/screenshots/crazy-apps/appjealousy.png"/><br/>**AppJealousy** |
| <img src="docs/screenshots/crazy-apps/batterydna.png"/><br/>**Battery DNA** | <img src="docs/screenshots/crazy-apps/breathbar.png"/><br/>**BreathBar** |
| <img src="docs/screenshots/crazy-apps/langflip.png"/><br/>**LangFlip** | <img src="docs/screenshots/crazy-apps/breakalarm.png"/><br/>**Break Alarm** |
| <img src="docs/screenshots/crazy-apps/moodboard.png"/><br/>**MoodBoard** | <img src="docs/screenshots/crazy-apps/tiltdj.png"/><br/>**TiltDJ** |
| <img src="docs/screenshots/crazy-apps/thermalmap.png"/><br/>**ThermalMap** | <img src="docs/screenshots/crazy-apps/focusflow.png"/><br/>**FocusFlow** |
| <img src="docs/screenshots/crazy-apps/escape.png"/><br/>**Escape** | <img src="docs/screenshots/crazy-apps/mousetrailmap.png"/><br/>**MouseTrailMap** |
| <img src="docs/screenshots/crazy-apps/riseopen.png"/><br/>**Rise&Open** | <img src="docs/screenshots/crazy-apps/gravitydock.png"/><br/>**GravityDock** |
| <img src="docs/screenshots/crazy-apps/ghosttouch.png"/><br/>**GhostTouch** | <img src="docs/screenshots/crazy-apps/notchhq.png"/><br/>**NotchHQ** |
| <img src="docs/screenshots/crazy-apps/cursorage.png"/><br/>**CursorAge** | <img src="docs/screenshots/crazy-apps/dontforget.png"/><br/>**DontForget** |
| <img src="docs/screenshots/crazy-apps/desktopload.png"/><br/>**Desktop Load** | <img src="docs/screenshots/crazy-apps/nightowldiary.png"/><br/>**NightOwlDiary** |
| <img src="docs/screenshots/crazy-apps/whispertype.png"/><br/>**WhisperType** | |

### 🖥️ Running natively on macOS

Window captures from the apps running on an Apple Silicon Mac. Most live in the menu bar; these are their control panels.

| | | | |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/running/airsound.png" width="200"/><br/>**AirSound** | <img src="docs/screenshots/running/appjealousy.png" width="200"/><br/>**AppJealousy** | <img src="docs/screenshots/running/batterydna.png" width="200"/><br/>**Battery DNA** | <img src="docs/screenshots/running/breakalarm.png" width="200"/><br/>**Break Alarm** |
| <img src="docs/screenshots/running/breathbar.png" width="200"/><br/>**BreathBar** | <img src="docs/screenshots/running/cursorage.png" width="200"/><br/>**CursorAge** | <img src="docs/screenshots/running/escape.png" width="200"/><br/>**Escape** | <img src="docs/screenshots/running/focusflow.png" width="200"/><br/>**FocusFlow** |
| <img src="docs/screenshots/running/ghosttouch.png" width="200"/><br/>**GhostTouch** | <img src="docs/screenshots/running/gravitydock.png" width="200"/><br/>**GravityDock** | <img src="docs/screenshots/running/langflip.png" width="200"/><br/>**LangFlip** | <img src="docs/screenshots/running/moodboard.png" width="200"/><br/>**MoodBoard** |
| <img src="docs/screenshots/running/mousetrailmap.png" width="200"/><br/>**MouseTrailMap** | <img src="docs/screenshots/running/nightowldiary.png" width="200"/><br/>**NightOwlDiary** | <img src="docs/screenshots/running/tiltdj.png" width="200"/><br/>**TiltDJ** | <img src="docs/screenshots/running/whispertype.png" width="200"/><br/>**WhisperType** |

NotchHQ, DontForget and Rise&Open run without a standard window: they appear from the notch on hover or from a camera gesture.

> The DMGs are unsigned experiments. On first launch, right-click the app and choose **Open** to get past Gatekeeper. Some apps ask for Accessibility, Camera or Microphone permission.

---

## 🗂️ Nigents Apps (sister workspaces)

<img src="docs/screenshots/apps.png" width="100%"/>

`/apps/` hosts workspaces that share one sheets-and-issues model: **Workspace** (the full workspace with Web, iOS, Android, Backend, Designs, Builds, Canvas, AI Roadmap and Admin), **Tawazon**, **Droop** and **QuickIn**. You can upload bugs with screenshots, track priority and status, and manage builds. Admins can grant per-user edit keys.

Other showcase projects served by the dashboard include `algioshy/`, `AlGioshy-school-project/`, `rawa2/` (loyalty wallet demo), `problem-x/`, `food-project-quotation/` and `quickin-demo/`.

## 💬 Telegram & Voice

| Command | Description |
|---|---|
| `/start` | Welcome message + command list |
| `/plan <task>` | Create an implementation plan |
| `/approve` · `/run` | Approve / execute the plan |
| `/ask <question>` | Ask about the code or project |
| `/status` · `/queue` | Queue status / list queued tasks |
| `/standup` | Daily standup report |
| `/meet <agent>` | Chat with a specific agent |
| `/repos` | List connected GitLab repos |
| `/costs` | API usage costs |
| `/cancel <id>` · `/logs <agent>` | Cancel a task / view agent logs |

Voice notes in **Arabic or English** are transcribed with OpenAI Whisper, handled as text commands, and answered in the same language (gTTS voice reply). See [TELEGRAM_GUIDE.md](TELEGRAM_GUIDE.md) and [VOICE_GUIDE.md](VOICE_GUIDE.md).

## 🛠️ MCP Servers

**35+ standard servers:** filesystem, git, gitlab, postgres, sqlite, redis, fetch, puppeteer, docker, terraform, aws, kubernetes, cloudflare, mongodb, kafka, elasticsearch, brave-search, slack, notion, jira, memory, sequential-thinking, prometheus, grafana, sentry, vercel, and more.

**3 custom servers built here** ([`mcp-servers/`](mcp-servers)):

| Server | Purpose |
|---|---|
| `arabic-rtl-auditor` | Audits UI code for Arabic/RTL correctness |
| `task-splitter` | Breaks big tasks into agent-sized subtasks |
| `smart-code-search` | Semantic search across the repository |

See [MCP_SERVERS.md](MCP_SERVERS.md) and [MCP_SETUP.md](MCP_SETUP.md).

## 🧱 Tech Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js 20+, Express 4, Socket.io |
| AI | Anthropic SDK, OpenAI SDK, Zhipu GLM, Moonshot Kimi, DeepSeek, MCP SDK |
| Data | MySQL 8 (`mysql2`), migrations in `src/database/migrations` |
| Integrations | GitLab API, `simple-git`, Telegram Bot API, Nodemailer, Jitsi |
| Ops | PM2, Docker / docker-compose, GitLab CI, AWS EC2 |
| macOS apps | Swift / SwiftUI (e.g. [`FocusFlow/`](FocusFlow)) |

## 📁 Project Structure

```
nigents/
├── src/
│   ├── bot.js                # Telegram bot entry
│   ├── orchestrator.js       # Task orchestration
│   ├── agents/               # Orchestrator, Planner, Backend, Frontend, QA, Reviewer, Reporter…
│   ├── autogen/              # Multi-agent group chat
│   ├── mcp/                  # MCP client + agent wrapper
│   ├── tools/                # gitlab, openhands, repo-clone-push, voice…
│   ├── database/             # MySQL schema, migrations, storage
│   ├── utils/                # AI client, intent router, meeting room, task queue…
│   └── dashboard/
│       ├── server.js         # Express + Socket.io dashboard (port 4000)
│       └── public/           # Dashboard, landing pages, Crazy Apps, Nigents Apps
├── mcp-servers/              # 3 custom MCP servers
├── config/                   # agents.json, mcp-servers.json, projects.json
├── FocusFlow/                # Swift source for the FocusFlow macOS app
├── scripts/                  # setup, health-check, DB init, deploy helpers
├── docs/
│   ├── FULL_GUIDE.md         # Original full technical guide
│   ├── screenshots/          # README screenshots
│   └── icons/                # Crazy Apps icons
├── Dockerfile · docker-compose.yml · ecosystem.config.js · .gitlab-ci.yml
└── .env.example
```

## 🚀 Run Locally

**Requirements:** Node.js 20+ and MySQL 8.

```bash
# 1. Install dependencies
npm install

# 2. MySQL (macOS example)
brew install mysql && brew services start mysql
mysql -uroot -e "CREATE DATABASE nigents; CREATE USER 'nigents'@'localhost' IDENTIFIED BY 'nigents_password'; GRANT ALL ON nigents.* TO 'nigents'@'localhost';"
mysql -uroot nigents < src/database/schema.sql
for f in src/database/migrations/*.sql; do mysql -uroot nigents < "$f"; done

# 3. Environment
cp .env.example .env   # set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (+ AI/GitLab/Telegram keys)

# 4. Start the dashboard → http://localhost:4000
npm run dashboard

# 5. (optional) Start the Telegram bot too
npm run local
```

| URL | Page |
|---|---|
| `http://localhost:4000/` | Landing page |
| `http://localhost:4000/login.html` | Dashboard login |
| `http://localhost:4000/dashboard.html` | Dashboard |
| `http://localhost:4000/crazy-apps.html` | Crazy Apps |
| `http://localhost:4000/apps/` | Nigents Apps |
| `http://localhost:4000/materials.html` | Free Materials |

## ☁️ Deployment

- **AWS EC2 + PM2:** [EC2_DEPLOYMENT.md](EC2_DEPLOYMENT.md), [EC2_ENV_GUIDE.md](EC2_ENV_GUIDE.md)
- **Docker:** `docker-compose up -d`
- **GitLab CI/CD:** [GITLAB_SETUP.md](GITLAB_SETUP.md), [.gitlab-ci.yml](.gitlab-ci.yml)
- **Operations runbook:** [OPERATIONS.md](OPERATIONS.md)

## 📚 Further Docs

[QUICKSTART](QUICKSTART.md) · [Full technical guide](docs/FULL_GUIDE.md) · [Deployment](DEPLOYMENT.md) · [GitLab integration](GITLAB_INTEGRATION.md) · [Email setup](EMAIL_SETUP.md) · [Workflow Studio](docs/WORKFLOW_STUDIO.md) · [Pipeline test](PIPELINE_TEST.md)

---

<div align="center">

Built by **Mohamed Hamed** · MIT License

</div>
