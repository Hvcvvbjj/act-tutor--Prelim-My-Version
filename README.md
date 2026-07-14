# Scout ACT — AI ACT Tutor

An adaptive, Duolingo-style ACT study product that turns a student's score history and every practice answer into the next best learning action.

> Product promise: **Every answer changes what you study next.**

## Repository status

This fork now contains a working local vertical slice plus the product specification, technical architecture, prioritized backlog, and an undated milestone roadmap.

Working in the current slice:

- a responsive three-step onboarding flow for goal score, prior scores, and test date;
- prior-score branches for full section scores or a low-confidence Composite-only starting point, plus a never-tested path;
- versioned local draft persistence across refreshes;
- deterministic English/Math/Reading Composite calculation, goal-aligned section targets, and runway-based plan intensity in `packages/core`;
- a generated Today/Plan/Progress dashboard with a durable adaptive learner profile;
- an Adaptive Plan Studio that turns availability into dated lesson, focus, review, timed-transfer, checkpoint, and rehearsal assignments through test day;
- editable per-day study minutes, week navigation, milestone tracking, task completion, catch-up, capacity/readiness estimates, and future-only rebalancing that freezes today and completed history;
- a no-score path that starts with an 8–12 question information-gain Quick Check, rebuilds the real plan from that baseline, and keeps a validated 66-question half-length diagnostic available for a narrower range;
- a server response boundary that withholds answer keys and rationales until the completed diagnostic is submitted.
- anonymous, cookie-bound diagnostic sessions with atomic local-file writes and idempotent final submission.
- a versioned 12-skill learning taxonomy, 12 reviewed lesson foundations, AI-generated personalized four-stage teaching sequences, and 60 focused practice questions;
- a four-stage Daily Mission loop: personalized lesson, five-question focused set, replayable mistake repair, and a three-skill mixed checkpoint;
- server-earned XP, levels, daily/longest streaks, twelve-skill mastery map, due-review queue, and a persistent mistake notebook;
- lesson completion, immediate trusted feedback, mastery updates, spaced review scheduling, direct skill selection, and visible next-session regeneration.
- a persistent 12-skill Bayesian Learning Twin that updates P(Learned), predicted next-answer accuracy, uncertainty, and the next-skill recommendation after every server-scored response;
- an 8–12 item adaptive **Precision Check** using a Bayesian 2PL IRT ability estimate, Fisher-information item selection, explicit coverage constraints, and a precision-based stop rule;
- a visible IRT → BKT → adaptive-plan handoff: the calibration model decides which evidence is most useful, then the skill model decides what to teach;
- an interpretable model inspector with feature contributions, public evidence history, and counterfactual readiness projections;
- a one-click judge demo that lands on the last Quick Check question and turns one answer into a plain-English proof replay: practice level, exact skill estimate, and next lesson before/after;
- a complete Test Day Lab with 12-skill sprints, half-length section simulations, and a 66-question core rehearsal;
- timed section clocks, passage-aware navigation, confidence labels, flags, autosave/resume, omission review, and server-owned scoring;
- score-range, section, skill, pacing, and confidence-calibration reports plus an aggregate-only AI debrief with a reviewed fallback.
- an interactive Scout tutor mascot with teaching, thinking, repair, and celebration states.
- a product-wide Ask Scout layer with screen context, conversation history, highlighted-text explanation, assistance permissions, timed-test guardrails, grounded response receipts, and saved explanation preferences;
- exact two-question retention checks, fresh-item mistake replay, three-minute study, mastery challenges, recovery sessions, teach-back scoring, alternate teaching styles, and question-exposure protection;
- a Scout Lab for learner-model correction, ACT pacing and score scenarios, coach workflows, imported cohort heatmaps, content approval, model/policy comparison, fairness abstention, item health, data export/delete, and weak-connection answer sync.

Still placeholders or future milestones:

- empirical score calibration, independent psychometric/content review, database-backed multi-instance submission, and broader skill coverage;
- Supabase authentication/persistence, CI, deployment, and production monitoring.

The half-length diagnostic is original and proportioned to the enhanced ACT core, but it still reports an estimated practice range rather than claiming official ACT precision.

## Run locally

### Requirements

- Git
- Node.js `>=20.9.0`
- pnpm `11.7.0`

Node.js `22.12.0` is recommended and pinned in [.nvmrc](.nvmrc). If you use [nvm](https://github.com/nvm-sh/nvm), it can install and select that version automatically.

### Windows PowerShell quick start

```powershell
git clone https://github.com/Hvcvvbjj/act-tutor--Prelim-My-Version.git
Set-Location act-tutor--Prelim-My-Version
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm install
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000). If PowerShell still says `pnpm` is not recognized, close and reopen PowerShell. If Corepack is unavailable or cannot write its shim, install the pinned package manager directly and retry:

```powershell
npm install --global pnpm@11.7.0
pnpm --version
pnpm install
pnpm dev
```

### 1. Clone the fork

```bash
git clone https://github.com/Hvcvvbjj/act-tutor--Prelim-My-Version.git
cd act-tutor--Prelim-My-Version
```

If you already cloned the repository, open a terminal in its root directory instead.

### 2. Select Node and install pnpm

With nvm:

```bash
nvm install
nvm use
corepack enable
corepack prepare pnpm@11.7.0 --activate
```

If Node.js is already installed without nvm, run only the two `corepack` commands. Confirm the versions with:

```bash
node --version
pnpm --version
```

### 3. Install dependencies

Run this from the repository root:

```bash
pnpm install
```

### 4. Start the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Stop the development server with `Ctrl+C`.

No environment variables, database, or external AI key are required for the current local MVP. Diagnostic, calibration, and learning progress are stored as ignored JSON files under `apps/web/.data/`.

### Optional local configuration

To store session data somewhere else, set either or both variables before starting the app:

```bash
export DIAGNOSTIC_SESSION_STORE_PATH=/absolute/path/diagnostic-sessions.json
export CALIBRATION_SESSION_STORE_PATH=/absolute/path/calibration-sessions.json
export LEARNING_SESSION_STORE_PATH=/absolute/path/learning-sessions.json
export EXAM_LAB_STORE_PATH=/absolute/path/exam-lab-sessions.json
export STUDY_PLAN_STORE_PATH=/absolute/path/study-plan-sessions.json
pnpm dev
```

### Optional live AI lesson generation

The app has a real provider-neutral lesson composer. It calls any OpenAI-compatible `/chat/completions` endpoint, validates the model's JSON against the lesson contract, persists the generated lesson, and falls back to reviewed authored teaching if the request fails. The generative model never receives practice answer keys and cannot change scoring or Bayesian learner-model calculations.

For a free local Qwen setup with [Ollama](https://ollama.com/):

```bash
ollama pull qwen3:4b
ollama serve
```

In another terminal, create the local Next.js environment file:

macOS/Linux:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Windows PowerShell:

```powershell
Copy-Item apps\web\.env.example apps\web\.env.local
```

The example file configures:

```dotenv
AI_TUTOR_BASE_URL=http://127.0.0.1:11434/v1
AI_TUTOR_MODEL=qwen3:4b
AI_TUTOR_API_KEY=
```

Restart `pnpm dev` after changing environment variables. A generated lesson is labeled **AI-personalized lesson** in the UI; fallback content is labeled **Reviewed personalized fallback**, so the demo never implies that AI ran when it did not.

To erase local demo progress and start onboarding again:

```bash
rm -f apps/web/.data/diagnostic-sessions.json apps/web/.data/calibration-sessions.json apps/web/.data/learning-sessions.json apps/web/.data/exam-lab-sessions.json apps/web/.data/study-plan-sessions.json
```

You may also need to clear cookies for `localhost:3000` if you want a completely new anonymous session.

## Verify the project

Run the full lint, typecheck, test, and production-build suite:

```bash
pnpm check
```

Individual commands are also available:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

To run the production build locally after `pnpm build`:

```bash
pnpm --filter web start
```

### Troubleshooting

- `pnpm: command not found`: rerun `corepack enable` and `corepack prepare pnpm@11.7.0 --activate`.
- Unsupported Node.js version: run `nvm install && nvm use`, or install Node.js `22.12.0` manually.
- Port `3000` is already in use: stop the other process or run `pnpm --filter web dev -- -p 3001`, then open [http://localhost:3001](http://localhost:3001).
- Stale local progress: delete the five session files in `apps/web/.data/` and clear the localhost cookies as described above.

## Core experience

The website opens directly into a three-part placement flow:

1. Goal Composite score.
2. Current Composite and section scores, Composite only, or “I have never taken the ACT.”
3. Next planned ACT date.

The intended complete experience gives students with prior scores a provisional study plan immediately, followed by short skill probes in their first sessions. Students without prior scores take a truncated, half-length diagnostic. Both completed paths will produce:

- an estimated baseline and confidence range;
- strengths and weaknesses at the skill level;
- a dated study plan leading to the test date;
- editable study days/minutes with future assignments rebalanced around real mastery evidence;
- daily micro-lessons, focused questions, mixed review, and timed checkpoints;
- automatic plan updates as new evidence arrives.

The current enhanced ACT uses English, Math, and Reading for the Composite. Science and Writing are optional, so this product must not use the legacy four-section Composite model. See the [official ACT structure](https://www.act.org/content/act/en/products-and-services/the-act/test-preparation/act-exam-sections-and-structure.html) and [score explanation](https://www.act.org/content/act/en/products-and-services/the-act/scores/understanding-your-scores.html).

## MVP stack

- Implemented now: Next.js App Router and Route Handlers, TypeScript, Tailwind CSS, shadcn components built on Base UI, pure TypeScript core/content/server packages, Zod content validation, durable anonymous local sessions, and Vitest.
- Planned next: automated Playwright journeys, Supabase Postgres with anonymous auth and Row Level Security, and Vercel previews.
- Implemented AI boundary: OpenAI-compatible live lesson/debrief composition, including local Qwen through Ollama, with validated output and reviewed fallbacks.
- Implemented evidence-acquisition model: a Bayesian 2PL IRT Precision Check selects the unanswered item with the highest Fisher information plus section/skill coverage bonuses, estimates ability and uncertainty, and stops after 8–12 items.
- Implemented learning model: twelve persistent Bayesian Knowledge Tracing models drive next-skill selection from diagnostic, calibration, and practice evidence and expose their probabilities, uncertainty, parameters, and recommendation features in the Learning Twin.
- Required throughout: static authored explanations as the guaranteed fallback.

The three layers have deliberately different jobs: **IRT chooses what to ask, BKT chooses what to teach, and the LLM chooses how to explain it.** Code owns answer keys, scoring, dates, evidence validation, and spaced repetition. The product remains fully usable when the generative provider is disabled because both probabilistic models and reviewed lessons run locally.

For the fastest product tour, click **See one answer change the plan** on the first screen. The demo opens directly on one final ACT-style Quick Check question. Submit it to see the level estimate, matching skill estimate, and next lesson decision update together. The seven preloaded answers are clearly labeled examples.

## Planning documents

- [Product specification](docs/PRODUCT_SPEC.md)
- [Technical architecture](docs/TECHNICAL_ARCHITECTURE.md)
- [Enhanced ACT blueprint](docs/ACT_BLUEPRINT.md)
- [Milestone roadmap](docs/PROJECT_ROADMAP.md)
- [Prioritized implementation backlog](docs/BACKLOG.md)
- [Hackathon submission kit](docs/submission/README.md)
- [Exhaustive implemented feature ledger](docs/FEATURE_LEDGER.md)

## Hackathon demo target

The first onboarding screen includes **Preview the adaptive demo**, which loads a clearly labeled representative diagnostic profile without an account or API key. The competition-facing two-minute path is:

1. Show the diagnostic-driven Daily Mission.
2. Open **Calibrate**, answer one ACT-shaped item, and show the ability estimate, uncertainty, and precision stop rule move live.
3. Open **Progress** and show that the same trusted response entered the Bayesian Learning Twin evidence ledger.
4. Inspect P(Learned), P(Correct next), uncertainty, and the exact next-skill feature contributions.
5. Open the personalized lesson and show the AI-personalized or reviewed-fallback generation stamp.

Use the rehearsed [two-minute demo script](docs/submission/DEMO_SCRIPT.md). The broader Plan Studio, Test Day Lab, mistake-repair, and no-score diagnostic flows remain available for judge questions after the video.

## Content and score disclaimer

All questions and passages must be original or separately licensed. Do not copy official ACT questions, explanations, branding, or paid prep materials. ACT's website content is copyrighted under its [Terms of Use](https://www.act.org/content/act/en/terms-of-use.html).

Any result from an original, shortened diagnostic must be labeled an **estimated practice score range**, not an official ACT score or guaranteed outcome.
