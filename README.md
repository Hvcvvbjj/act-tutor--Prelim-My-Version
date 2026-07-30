# AlexACT — AI ACT Tutor

An adaptive, Duolingo-style ACT study product that turns a student's score history and every practice answer into the next best learning action.

> Product promise: **Every answer becomes evidence. AlexACT changes the plan only when that evidence is strong enough.**

## Repository status

This fork now contains a working local vertical slice plus the product specification, technical architecture, prioritized backlog, and an undated milestone roadmap.

Working in the current slice:

- a responsive three-step onboarding flow for goal score, prior scores, and test date;
- prior-score branches for full section scores or a Composite-only starting point, plus a never-tested path;
- versioned local draft persistence across refreshes;
- deterministic English/Math/Reading Composite calculation, goal-aligned section targets, and runway-based plan intensity in `packages/core`;
- a generated Today/Plan/Progress dashboard with a durable adaptive learner profile;
- an Adaptive Plan Studio that turns availability into dated lesson, focus, review, mixed timed practice, checkpoint, and rehearsal assignments through test day;
- editable per-day study minutes, week navigation, milestone tracking, task completion, catch-up, capacity estimates, and future-only rebalancing that freezes today and completed history;
- a required, resumable 66-question Round 0 diagnostic for every learner before the Lessons tab opens, whether or not a prior score was entered;
- an optional 8–12 question information-gain Quick Check for refreshing skill evidence after the required starting diagnostic;
- a server response boundary that withholds answer keys and rationales until the completed diagnostic is submitted.
- anonymous, cookie-bound diagnostic sessions with atomic local-file writes and idempotent final submission.
- a versioned 12-skill learning taxonomy, 12 reviewed lesson foundations, AI-generated personalized four-stage teaching sequences, and 60 focused practice questions;
- a segmented 12-lesson foundation round, five-question lesson checks, and required Mr. Kim correction of every missed check question before the next lesson unlocks;
- server-earned XP, levels, daily/longest streaks, twelve-skill mastery map, due-review queue, and a persistent mistake notebook;
- lesson completion, immediate trusted feedback, mastery updates, spaced review scheduling, direct skill selection, and visible next-session regeneration.
- a persistent 12-skill Bayesian learning model that updates each skill estimate, predicted next-answer accuracy, uncertainty, and the next recommendation after every server-scored response;
- an 8–12 item adaptive **Quick Check** using a Bayesian 2PL IRT ability estimate, Fisher-information item selection, explicit coverage constraints, and a precision-based stop rule;
- a visible IRT → BKT → adaptive-plan handoff: the calibration model decides which evidence is most useful, then the skill model decides what to teach;
- an interpretable model inspector with feature contributions, public evidence history, and counterfactual planning projections;
- a server-verified developer demo for reviewing the complete learning cycle without weakening the real learner gate;
- keyboard answer shortcuts for Quick Check and an adjustable weekly schedule that spreads work across the learner's available days;
- complete Timed Practice with 12-skill sprints, full-section simulations, and a 131-question full-length core test;
- timed section clocks, passage-aware navigation, flags, autosave/resume, omission review, and server-owned scoring;
- score-range, section, skill, and pacing reports plus an aggregate-only AI debrief with a reviewed fallback.
- an interactive AlexACT tutor mascot with teaching, thinking, repair, and celebration states.
- a product-wide Ask Mr. Kim layer with screen context, conversation history, highlighted-text explanation, assistance permissions, timed-test guardrails, grounded response receipts, and saved explanation preferences;
- exact two-question retention checks, fresh-item mistake replay, three-minute study, mastery challenges, recovery sessions, alternate teaching styles, and question-exposure protection;
- a Learning data workspace for bounded learner-model corrections, ACT pacing advice and manual score scenarios, model-choice explanations, an honest imported group-metric viewer, single-learner question history, read-only Coach Briefs, truthful data deletion, and versioned weak-connection answer sync.

Still future milestones:

- empirical score calibration, independent psychometric/content review, database-backed multi-instance submission, and broader skill coverage;
- multi-instance database persistence, CI, and production monitoring.

The full 66-question diagnostic is original and proportioned across the enhanced ACT core sections. It reports an estimated practice range rather than claiming official ACT precision.

## Run locally

AlexACT runs completely locally. The base app does **not** require a database, an API key, or Ollama. Without a live model, it uses its reviewed personalized lesson fallback. Local diagnostic, calibration, learning, exam, and study-plan state is stored in ignored JSON files under `apps/web/.data/`.

The repository uses:

- Git;
- Node.js `22.13.1` from [.nvmrc](.nvmrc) on macOS, or a current Node.js LTS release on Windows;
- pnpm `11.7.0`, pinned in `package.json`.

Use the runbook for your computer. Every command is meant to be copied into **Terminal** on macOS or **PowerShell** on Windows.

### macOS: complete setup from scratch

#### 1. Install Git

Open Terminal (`Command + Space`, type `Terminal`, press Return), then run:

```bash
xcode-select --install
```

Finish the Apple Command Line Tools installer if it opens, then confirm Git works:

```bash
git --version
```

If the command says the tools are already installed, continue. You can also install Git with Homebrew using `brew install git`. See the [official Git macOS instructions](https://git-scm.com/install/mac).

#### 2. Install nvm and Node.js

[nvm](https://github.com/nvm-sh/nvm) lets the repository select its pinned Node.js version instead of relying on whichever version happens to be installed globally.

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.5/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm --version
```

If `nvm` is still not found, close Terminal, open it again, and run `nvm --version`.

#### 3. Clone this fork

```bash
mkdir -p "$HOME/Documents"
cd "$HOME/Documents"
git clone https://github.com/Hvcvvbjj/act-tutor--Prelim-My-Version.git
cd act-tutor--Prelim-My-Version
```

If the repository is already cloned, run only the final `cd` command with the path to your existing copy.

#### 4. Install the pinned Node.js and pnpm versions

Run these commands from the repository root:

```bash
nvm install
nvm use
npm install --global pnpm@11.7.0
hash -r
node --version
pnpm --version
```

Expected results are Node.js `v22.13.1` and pnpm `11.7.0`. pnpm 11 requires Node.js `22.13` or newer. Install pnpm **after** `nvm use`, because each nvm-managed Node.js version has its own global packages.

#### 5. Install dependencies and start AlexACT

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Leave that Terminal window running. Open a second Terminal window and run:

```bash
open http://localhost:3000
```

AlexACT should open in your browser. Press `Control + C` in the first Terminal window to stop it.

#### 6. Add free local AI lesson generation on macOS (optional)

AlexACT already works without this step. To generate lessons with Qwen locally, install [Ollama for macOS](https://ollama.com/download/mac). Ollama currently requires macOS Sonoma 14 or newer. Open the downloaded app once and allow it to add its command-line tool when prompted.

Then run:

```bash
open -a Ollama
ollama --version
ollama pull qwen3:4b
curl http://127.0.0.1:11434/api/tags
cd "$HOME/Documents/act-tutor--Prelim-My-Version"
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

If the API check cannot connect, keep this command running in a separate Terminal window, then retry:

```bash
ollama serve
```

#### 7. Verify the complete macOS setup

Stop the development server first, then run:

```bash
pnpm --filter web exec playwright install chromium
pnpm check:release
```

The final command is the full release gate: lint, type checking, unit tests, a production build, and the browser journeys.

#### 8. Update an existing macOS clone

```bash
cd "$HOME/Documents/act-tutor--Prelim-My-Version"
git pull --ff-only
nvm use
pnpm install --frozen-lockfile
pnpm dev
```

### Windows: complete PowerShell setup from scratch

These steps target Windows 10 22H2 or Windows 11. Open **PowerShell** from the Start menu. Administrator mode is normally not required.

#### 1. Install Git and Node.js LTS

Windows Package Manager (`winget`) is included with current Windows through App Installer. Run:

```powershell
winget install --id Git.Git -e --source winget
winget install --id OpenJS.NodeJS.LTS -e --source winget
```

Close PowerShell completely and open a new PowerShell window so Windows reloads `PATH`. Then confirm the tools work:

```powershell
git --version
node --version
npm --version
```

If `winget` is missing, install or update **App Installer** from the Microsoft Store, or follow the [official WinGet installation instructions](https://learn.microsoft.com/windows/package-manager/winget/install). Git and Node can also be installed from the [official Git Windows page](https://git-scm.com/install/windows) and [official Node.js download page](https://nodejs.org/en/download).

#### 2. Install the exact pnpm version

```powershell
npm install --global pnpm@11.7.0
pnpm.cmd --version
```

The rest of this Windows guide intentionally uses `pnpm.cmd`. It bypasses the common PowerShell error that says `pnpm.ps1` cannot be loaded because script execution is disabled. You do not need to weaken PowerShell's execution policy.

#### 3. Clone this fork

```powershell
Set-Location ([Environment]::GetFolderPath('MyDocuments'))
git clone https://github.com/Hvcvvbjj/act-tutor--Prelim-My-Version.git
Set-Location .\act-tutor--Prelim-My-Version
```

If the repository is already cloned, use `Set-Location` with the full path to your existing copy instead.

#### 4. Install dependencies and start AlexACT

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev
```

Leave that PowerShell window running. Open a second PowerShell window and run:

```powershell
Start-Process "http://localhost:3000"
```

AlexACT should open in your browser. Press `Ctrl + C` in the first PowerShell window to stop it.

#### 5. Add free local AI lesson generation on Windows (optional)

AlexACT already works without this step. For live local generation, open the [Ollama Windows download](https://ollama.com/download/windows), run the installer, and then open a new PowerShell window. Ollama currently requires Windows 10 22H2 or newer and normally starts its local API in the background.

```powershell
ollama --version
ollama pull qwen3:4b
Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags"
Set-Location (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'act-tutor--Prelim-My-Version')
Copy-Item apps\web\.env.example apps\web\.env.local -Force
pnpm.cmd dev
```

If the API check cannot connect, keep the following command running in a separate PowerShell window, then retry:

```powershell
ollama serve
```

#### 6. Verify the complete Windows setup

Stop the development server first, then run these commands from the repository root:

```powershell
pnpm.cmd --filter web exec playwright install chromium
pnpm.cmd check:release
```

#### 7. Update an existing Windows clone

```powershell
Set-Location (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'act-tutor--Prelim-My-Version')
git pull --ff-only
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev
```

### How to tell whether live AI is working

For the hosted app, configure one server-side OpenAI key. The same settings
power Mr. Kim chat, generated lessons, and result debriefs:

```dotenv
OPENAI_API_KEY=your-server-side-key
OPENAI_MODEL=gpt-5.6
```

Never prefix the key with `NEXT_PUBLIC_` or commit it to the repository. Restart
the local development server, or redeploy the hosted site, after changing these
values.

For local-only development, AlexACT can instead use Ollama's OpenAI-compatible
endpoint for Mr. Kim chat, generated lessons, and debriefs. This path does not
need a paid API key:

```dotenv
AI_TUTOR_BASE_URL=http://127.0.0.1:11434/v1
AI_TUTOR_MODEL=qwen3:4b
AI_TUTOR_API_KEY=
```

On supported desktop Chrome installations, Mr. Kim can also use Chrome's
built-in on-device language model without a server key. The chat header says
which AI path answered. A successful generated lesson is labeled
**AI-personalized lesson**. If every model path is unavailable or returns
invalid output, AlexACT safely uses reviewed guidance instead. No model can
change scoring or the learner's saved results.

### Optional session-storage locations

The default `apps/web/.data/` storage is enough for local development. To place the five JSON stores elsewhere for one Terminal session, set the variables before `pnpm dev`.

macOS:

```bash
export DIAGNOSTIC_SESSION_STORE_PATH="$HOME/scout-data/diagnostic-sessions.json"
export CALIBRATION_SESSION_STORE_PATH="$HOME/scout-data/calibration-sessions.json"
export LEARNING_SESSION_STORE_PATH="$HOME/scout-data/learning-sessions.json"
export EXAM_LAB_STORE_PATH="$HOME/scout-data/exam-lab-sessions.json"
export STUDY_PLAN_STORE_PATH="$HOME/scout-data/study-plan-sessions.json"
pnpm dev
```

Windows PowerShell:

```powershell
$env:DIAGNOSTIC_SESSION_STORE_PATH = "$HOME\scout-data\diagnostic-sessions.json"
$env:CALIBRATION_SESSION_STORE_PATH = "$HOME\scout-data\calibration-sessions.json"
$env:LEARNING_SESSION_STORE_PATH = "$HOME\scout-data\learning-sessions.json"
$env:EXAM_LAB_STORE_PATH = "$HOME\scout-data\exam-lab-sessions.json"
$env:STUDY_PLAN_STORE_PATH = "$HOME\scout-data\study-plan-sessions.json"
pnpm.cmd dev
```

### Reset all local demo progress

Stop AlexACT before deleting the local files.

macOS:

```bash
[ -d apps/web/.data ] && find apps/web/.data -maxdepth 1 -name '*.json' -delete
```

Windows PowerShell:

```powershell
Remove-Item apps\web\.data\*.json -ErrorAction SilentlyContinue
```

Clear cookies for `localhost:3000` as well if you want a completely new anonymous learner session.

### Run the production build locally

macOS:

```bash
pnpm build
pnpm --filter web start
```

Windows PowerShell:

```powershell
pnpm.cmd build
pnpm.cmd --filter web start
```

### Troubleshooting

- **Windows says `pnpm.ps1` cannot be loaded:** run the same command with `pnpm.cmd`, as shown throughout this guide. No execution-policy change is required.
- **Windows says pnpm is not recognized:** close and reopen PowerShell, run `where.exe pnpm.*`, then rerun `npm install --global pnpm@11.7.0`. Confirm with `pnpm.cmd --version`.
- **macOS says `nvm: command not found`:** open a new Terminal window. If needed, run `export NVM_DIR="$HOME/.nvm"` followed by `[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"`.
- **macOS says pnpm is not found:** run `npm install --global pnpm@11.7.0`, then `hash -r` and `pnpm --version`.
- **pnpm says Node.js 22.13 or newer is required:** pull the latest repository changes, run `nvm install`, `nvm use`, and then `npm install --global pnpm@11.7.0`. The previous `.nvmrc` incorrectly selected Node.js 22.12.
- **pnpm disappeared after changing Node.js versions with nvm:** this is expected because nvm keeps global npm packages separate for each Node.js version. With the new version active, run `npm install --global pnpm@11.7.0`, then `hash -r`.
- **The Node.js version is wrong:** on macOS, run `nvm install` and `nvm use` from the repository root. On Windows, run `winget upgrade --id OpenJS.NodeJS.LTS -e --source winget`, reopen PowerShell, and check `node --version`.
- **Port 3000 is busy:** use `pnpm --filter web exec next dev -p 3001` on macOS or `pnpm.cmd --filter web exec next dev -p 3001` in PowerShell, then open [http://localhost:3001](http://localhost:3001).
- **Ollama cannot connect:** make sure the Ollama app is open, run `ollama serve` in its own terminal if necessary, and retry the API health command from the appropriate setup section.
- **The browser shows old learner progress:** reset the JSON files, clear cookies for `localhost:3000`, and restart AlexACT.

## Core experience

The website opens directly into a three-part placement flow:

1. Goal Composite score.
2. Current Composite and section scores, Composite only, or “I have never taken the ACT.”
3. Next planned ACT date.

The complete starting experience accepts a reported score when one is available, then requires the same full 66-question Round 0 diagnostic for every learner before lessons unlock. That diagnostic produces:

- an estimated baseline and confidence range;
- strengths and weaknesses at the skill level;
- a dated study plan leading to the test date;
- editable study days/minutes with future assignments rebalanced around real mastery evidence;
- daily micro-lessons, focused questions, mixed review, and timed checkpoints;
- automatic plan updates as new evidence arrives.

The current enhanced ACT uses English, Math, and Reading for the Composite. Science and Writing are optional, so this product must not use the legacy four-section Composite model. See the [official ACT structure](https://www.act.org/content/act/en/products-and-services/the-act/test-preparation/act-exam-sections-and-structure.html) and [score explanation](https://www.act.org/content/act/en/products-and-services/the-act/scores/understanding-your-scores.html).

## MVP stack

- Implemented now: Next.js App Router and Route Handlers, TypeScript, Tailwind CSS, shadcn components built on Base UI, pure TypeScript core/content/server packages, Zod content validation, durable anonymous local sessions, and Vitest.
- Implemented verification: Vitest unit/route contracts plus Playwright release journeys for Quick Check rebasing and mobile AlexACT behavior.
- Planned next: Supabase Postgres with anonymous auth and Row Level Security, Vercel previews, and broader browser coverage.
- Implemented AI boundary: OpenAI-compatible live lesson/debrief composition, including local Qwen through Ollama, with schema and grounding checks plus reviewed fallbacks.
- Implemented evidence-acquisition model: a Bayesian 2PL IRT Quick Check selects the unanswered item with the highest Fisher information plus section/skill coverage bonuses, estimates ability and uncertainty, and stops after 8–12 items.
- Implemented learning model: twelve persistent Bayesian Knowledge Tracing models drive next-skill selection from diagnostic, calibration, and practice evidence. Progress uses plain-language estimates by default; exact parameters and recommendation rules remain available in technical details and Learning data.
- Required throughout: static authored explanations as the guaranteed fallback.

The three layers have deliberately different jobs: **IRT chooses what to ask, BKT chooses what to teach, and the LLM chooses how to explain it.** Code owns answer keys, scoring, dates, evidence validation, and spaced repetition. The product remains fully usable when the generative provider is disabled because both probabilistic models and reviewed lessons run locally.

For the fastest product tour, use the server-verified judge account. The regular learner path intentionally keeps the complete Round 0 diagnostic gate intact.

## Planning documents

- [Product specification](docs/PRODUCT_SPEC.md)
- [Technical architecture](docs/TECHNICAL_ARCHITECTURE.md)
- [Enhanced ACT blueprint](docs/ACT_BLUEPRINT.md)
- [Milestone roadmap](docs/PROJECT_ROADMAP.md)
- [Prioritized implementation backlog](docs/BACKLOG.md)
- [Hackathon submission kit](docs/submission/README.md)
- [Exhaustive implemented feature ledger](docs/FEATURE_LEDGER.md)

## Hackathon demo target

The competition-facing two-minute path uses the server-verified judge account:

1. Show the required Round 0 result and the four diagnostic-based skill polygons.
2. Run the dashboard spotlight tour over the real navigation and lesson action.
3. Open the 12-lesson timeline and a segmented foundation lesson.
4. Show Mr. Kim's missed-question correction loop and the next-round diagnostic choice.

Use the rehearsed [two-minute demo script](docs/submission/DEMO_SCRIPT.md). The broader Plan Studio, Timed Practice, mistake-repair, and no-score diagnostic flows remain available for judge questions after the video.

## Content and score disclaimer

All questions and passages must be original or separately licensed. Do not copy official ACT questions, explanations, branding, or paid prep materials. ACT's website content is copyrighted under its [Terms of Use](https://www.act.org/content/act/en/terms-of-use.html).

Any result from an original, shortened diagnostic must be labeled an **estimated practice score range**, not an official ACT score or guaranteed outcome.
