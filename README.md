# A2A Healthcare Demo

An Agent2Agent (A2A) demo for healthcare research and presentation generation using **OpenAI (triage + review)**, **Gemini (research)**, and **Gamma (presentation)** APIs. The system routes requests through multiple specialized agents, streams progress updates, and produces patient-friendly presentations with a polished UI.

## Status

✅ **Completed:**
- FastAPI service scaffolding (triage, research, review, presentation)
- Agent Cards (`.well-known/agent-card.json` for each service)
- React frontend shell with Tailwind CSS
- Orchestrator client
- Run scripts for Windows and Linux/Mac

🚧 **In Progress:**
- Real-time SSE streaming integration
- API integrations (OpenAI, Gemini, Gamma)
- UI animations and task monitoring

---

## Quick Start

**Single command to run everything (backend + frontend):**

**Windows:**
```powershell
.\run_all.bat
```

**Linux/Mac:**
```bash
./run_all.sh
```

See [Local Run](#local-run) section below for detailed setup instructions.

---

This plan describes a concrete, implementation-ready path to build an Agent2Agent (A2A) demo for healthcare research and presentation generation. The **analysis agent is removed**. The focus is on a highly visible demo with **animations, real-time task updates, and UI polish**.

## 1) Scope & Success Criteria

**Primary user story**: A user requests a patient-friendly presentation on a healthcare topic (e.g., diabetes management). The system routes the request, streams research progress, and produces a Gamma presentation link with a polished UI that visualizes agent handoffs.

**Success criteria**
- ✅ Triage routes to research and presentation agents correctly.
- ✅ Research agent streams progress and can request clarifying info (input-required state).
- ✅ Review agent verifies medical summaries for tone, clarity, and compliance notes.
- ✅ Presentation agent returns a Gamma URL and the UI embeds or links it.
- ✅ UI shows animated handoffs, task status updates, and artifacts in real time.

---

## 2) Architecture Overview (No Analysis Agent)

**Agents**
1. **Triage/Classification Agent (OpenAI)**
   - Skill: `classify_and_route`
   - Routes to Research or Presentation directly.

2. **Medical Research Agent (Gemini 3 Pro)**
   - Skills: `summarize_medical_research`, `extract_key_points`
   - Streaming SSE support.

3. **Review Agent (OpenAI)**
   - Skill: `review_medical_summary`
   - Checks clarity, audience friendliness, and compliance notes.

4. **Presentation Agent (Gamma API)**
   - Skill: `create_presentation`
   - Generates slides and returns `gammaUrl`.

**Client Agent (A2A Orchestrator)**
- Discovers Agent Cards.
- Sends user request to triage agent.
- Routes results to Research → Review → Presentation pipeline.
- Maintains `contextId` and `taskId`.

---

## 3) Detailed Build Steps (Actionable)

### Step 1 — Bootstrap A2A Services (Day 1)
1. Create a shared **A2A service template** (FastAPI recommended).
2. Implement baseline endpoints:
   - `POST /message`
   - `GET /message/stream` (SSE for streaming agents)
   - `POST /tasks/resubscribe`
3. Implement a **common schemas module**:
   - `TaskStatusUpdateEvent`, `TaskArtifactUpdateEvent`
   - `Message`, `TaskState`

**Acceptance**: A mock agent returns a completed message and streams updates.

---

### Step 2 — Agent Cards (Day 1)
For each agent service, add `/.well-known/agent-card.json` with:
- `name`, `description`, `url`
- `authentication` (Bearer)
- `capabilities` (streaming or not)
- `skills` list with concrete examples

**Acceptance**: Client can discover all agents and list skills.

---

### Step 3 — Triage Agent (OpenAI) (Day 2)
1. Implement `classify_and_route` using a small function-based classifier.
2. Register handoff tools:
   - `transfer_to_medical_research_agent`
   - `transfer_to_presentation_agent`
3. Route based on intent:
   - Research requests → Research agent
   - Slide requests with outline already provided → Presentation agent

**Acceptance**: 5 test prompts route correctly.

---

### Step 4 — Research Agent (Gemini 3 Pro) (Day 3)
1. Implement research prompts using Google GenAI SDK.
2. Return **structured JSON output**:
   - `summary`, `keyPoints`, `riskFactors`, `citations`, `audienceTone`
3. Add **streaming progress updates**:
   - Send `TaskStatusUpdateEvent` every few seconds.
   - Emit partial summaries as they are produced.
4. Add **input-required flow**:
   - If missing patient type or region, send `input-required` status.

**Acceptance**: Streams updates + valid JSON output.

---

### Step 5 — Review Agent (OpenAI) (Day 4)
1. Review the Research JSON for clarity and compliance.
2. Output:
   - `revisedSummary`
   - `warnings` (e.g., missing citations)
   - `patientFriendlyScore` (1-5)

**Acceptance**: Validates and improves research output.

---

### Step 6 — Presentation Agent (Gamma API) (Day 4–5)
1. Accept outline and summary from review agent.
2. Call Gamma Generate API:
   - `POST /generations` with theme, tone, slide count
   - Poll `GET /generations/{id}` until `completed`
3. Return `gammaUrl` in artifact.

**Acceptance**: Presentation link works in UI.

---

## 4) UI / Demo Focus (Animations & Real-Time)

### UI Layout (Core)
- **Left pane**: conversation and prompts.
- **Right pane**: Task Monitor with agent cards.
- **Footer**: progress log & artifact links.

### Required Animations
1. **Agent Handoff Animation**
   - Visual “pulse” moving from triage → research → review → presentation.
2. **Task Status Badge Animations**
   - `queued` (gray shimmer), `working` (animated spinner), `input-required` (yellow pulse), `completed` (green check), `failed` (red shake).
3. **Streaming Output Animation**
   - Research text appears with typing effect or incremental fade-in.
4. **Artifacts Reveal**
   - Charts or Gamma link slides in from the right with a smooth easing.

### UI Technology Recommendations
- **React** + **Framer Motion** for animations.
- **SSE client** for real-time updates.
- **Tailwind CSS** for rapid styling.

### UI Implementation Steps
1. Build **Task Monitor component** (status list + progress bar).
2. Add **Agent Pipeline visualization** (timeline or node graph).
3. Implement **SSE hook** to update tasks and stream artifacts.
4. Embed Gamma presentation using iframe or link card.

**Acceptance**: Animations and streaming updates visible in demo recording.

---

## 5) Orchestration Flow (Client Agent)

1. Receive user prompt.
2. Send to **Triage** agent.
3. If routed to Research:
   - Start Research task (stream updates to UI).
   - If `input-required`, pause and ask user.
4. Send Research output to Review agent.
5. Send reviewed summary + outline to Presentation agent.
6. Return Gamma URL and embed in UI.

---

## 6) Demo Scenario Script (Include in README)
1. User: “Create a patient-friendly presentation on diabetes management.”
2. Research agent asks: “Which population? (e.g., adults, adolescents, seniors)”.
3. User: “Adults in the US.”
4. Research agent streams summary and key points.
5. Review agent refines summary + adds warnings.
6. Presentation agent returns Gamma URL.
7. UI embeds deck; task monitor shows completed pipeline.

---

## 7) Deliverables Checklist
- [x] Client agent + 4 services
- [x] Agent Cards for each agent
- [x] UI shell (React + Tailwind CSS)
- [x] README with local run steps
- [ ] UI animations + streaming updates (in progress)
- [ ] Demo GIF/Video

---

## 8) Risks & Mitigations
- **Streaming failures** → fall back to polling
- **Slow Gamma generation** → show “Generating slides…” animation + progress bar
- **Missing citations** → review agent inserts warning banner

---

## 9) Next Actions (Immediate)
1. ✅ Scaffold FastAPI services.
2. ✅ Implement Agent Cards.
3. ✅ Build UI shell with Task Monitor + animation placeholders.
4. Wire SSE to show real-time updates.
5. Integrate API calls (OpenAI, Gemini, Gamma).
6. Add streaming animations and real-time task updates.

---

## 10) Notes on Compliance (Healthcare Demo)
- Do not store PHI.
- Use de-identified sample text.
- Display banner: "For educational purposes only."

---

## Development Notes

### Git Configuration

A `.gitignore` file is included to prevent committing:
- Python bytecode (`__pycache__/`, `*.pyc`)
- Virtual environments (`.venv/`, `venv/`)
- Node modules (`node_modules/`)
- IDE files (`.vscode/`, `.idea/`)
- Environment files (`.env`)
- OS files (`.DS_Store`, `Thumbs.db`)

If files were already tracked, remove them from Git:
```bash
git rm -r --cached .
git add .
git commit -m "Update .gitignore"
```

---

## Local Run

This repo includes scaffolded FastAPI services for triage, research, review, and presentation, plus a React frontend.

### Quick Start (Single Command)

**Windows (PowerShell):**
```powershell
.\run_all.bat
```
or
```powershell
& .\run_all_with_frontend.ps1
```

**Linux/Mac (Bash):**
```bash
./run_all.sh
```

This will start all backend services (ports 8001-8004) and the frontend (port 5173).

### Manual Setup

#### 1) Install Python dependencies
```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux/Mac
source .venv/bin/activate

pip install -r requirements.txt
```

#### 2) Install frontend dependencies
```bash
cd web
npm install
cd ..
```

#### 3) Run all services + frontend

**Windows (PowerShell):**
```powershell
& .\run_all_with_frontend.ps1
```

**Linux/Mac (Bash):**
```bash
./run_all.sh
```

#### 4) Run services individually (if needed)

**Backend services:**
```bash
uvicorn services.triage.app:app --port 8001 --reload
uvicorn services.research.app:app --port 8002 --reload
uvicorn services.review.app:app --port 8003 --reload
uvicorn services.presentation.app:app --port 8004 --reload
```

**Frontend:**
```bash
cd web
npm run dev
```

**Orchestrator (standalone):**
```bash
python client/orchestrator.py
```

### Access Points

- **Frontend UI**: http://localhost:5173
- **Triage Service**: http://localhost:8001
- **Research Service**: http://localhost:8002
- **Review Service**: http://localhost:8003
- **Presentation Service**: http://localhost:8004

### Troubleshooting

**Port already in use:**
- Stop any existing services on ports 8001-8004 or 5173
- On Windows: `netstat -ano | findstr :8001` to find processes
- Kill process: `taskkill /PID <pid> /F`

**PowerShell script execution error:**
- Use the batch file: `run_all.bat`
- Or run: `powershell -ExecutionPolicy Bypass -File .\run_all_with_frontend.ps1`

**Frontend not starting:**
- Ensure Node.js is installed: `node --version`
- Install dependencies: `cd web && npm install`

**Python dependencies:**
- Ensure Python 3.10+ is installed
- Activate virtual environment before running services

### Project Structure

```
a2a_agent/
├── client/
│   └── orchestrator.py          # Client orchestrator
├── services/
│   ├── common/                   # Shared schemas and utilities
│   ├── triage/                   # Triage agent service
│   ├── research/                  # Research agent service
│   ├── review/                    # Review agent service
│   └── presentation/              # Presentation agent service
├── web/                           # React frontend
│   ├── src/
│   │   ├── App.jsx
│   │   └── components/
│   └── package.json
├── run_all.sh                     # Bash script (Linux/Mac)
├── run_all.ps1                     # PowerShell script (Windows)
├── run_all_with_frontend.ps1      # PowerShell script with frontend
├── run_all.bat                     # Batch file wrapper
├── requirements.txt                # Python dependencies
└── README.md
```
