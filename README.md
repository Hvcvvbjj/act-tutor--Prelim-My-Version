# AI ACT Tutor

An adaptive, Duolingo-style ACT study product that turns a student's score history and every practice answer into the next best learning action.

> Product promise: **Every answer changes what you study next.**

## Repository status

This fork now contains a working local vertical slice plus the product specification, technical architecture, prioritized backlog, and an undated milestone roadmap.

Working in the current slice:

- a responsive three-step onboarding flow for goal score, prior scores, and test date;
- prior-score branches for full section scores or a low-confidence Composite-only starting point, plus a never-tested path;
- versioned local draft persistence across refreshes;
- deterministic English/Math/Reading Composite calculation, goal-aligned section targets, and runway-based plan intensity in `packages/core`;
- a generated Today/Plan/Progress dashboard with a durable adaptive learning session;
- a no-score path with a validated 24-question rapid diagnostic covering 12 skills, per-answer server autosave/resume, deterministic scoring, skill signals, and baseline-to-plan handoff;
- a server response boundary that withholds answer keys and rationales until the completed diagnostic is submitted.
- anonymous, cookie-bound diagnostic sessions with atomic local-file writes and idempotent final submission.
- a versioned 12-skill learning taxonomy, 12 authored micro-lessons, and 60 focused practice questions;
- lesson completion, five-question focused practice, immediate trusted feedback, mastery updates, spaced review scheduling, and visible next-session regeneration.

Still placeholders or future milestones:

- the complete 66-question half-length bank, stronger empirical calibration, database-backed multi-instance submission, and broader skill coverage;
- Supabase authentication/persistence, AI providers, CI, deployment, and production monitoring.

The current rapid diagnostic is intentionally labeled with a wide estimated practice range; it does not claim official ACT precision or pretend that the full half-length bank is finished.

## Run locally

### Requirements

- Git
- Node.js `>=20.9.0`
- pnpm `11.7.0`

Node.js `22.12.0` is recommended and pinned in [.nvmrc](.nvmrc). If you use [nvm](https://github.com/nvm-sh/nvm), it can install and select that version automatically.

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

No environment variables, database, or external AI key are required for the current local MVP. Diagnostic and learning progress are stored as ignored JSON files under `apps/web/.data/`.

### Optional local configuration

To store session data somewhere else, set either or both variables before starting the app:

```bash
export DIAGNOSTIC_SESSION_STORE_PATH=/absolute/path/diagnostic-sessions.json
export LEARNING_SESSION_STORE_PATH=/absolute/path/learning-sessions.json
pnpm dev
```

To erase local demo progress and start onboarding again:

```bash
rm -f apps/web/.data/diagnostic-sessions.json apps/web/.data/learning-sessions.json
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
- Stale local progress: delete the two files in `apps/web/.data/` and clear the localhost cookie as described above.

## Core experience

The website opens directly into a three-part placement flow:

1. Goal Composite score.
2. Current Composite and section scores, Composite only, or “I have never taken the ACT.”
3. Next planned ACT date.

The intended complete experience gives students with prior scores a provisional study plan immediately, followed by short skill probes in their first sessions. Students without prior scores take a truncated, half-length diagnostic. Both completed paths will produce:

- an estimated baseline and confidence range;
- strengths and weaknesses at the skill level;
- a dated study plan leading to the test date;
- daily micro-lessons, focused questions, mixed review, and timed checkpoints;
- automatic plan updates as new evidence arrives.

The current enhanced ACT uses English, Math, and Reading for the Composite. Science and Writing are optional, so this product must not use the legacy four-section Composite model. See the [official ACT structure](https://www.act.org/content/act/en/products-and-services/the-act/test-preparation/act-exam-sections-and-structure.html) and [score explanation](https://www.act.org/content/act/en/products-and-services/the-act/scores/understanding-your-scores.html).

## MVP stack

- Implemented now: Next.js App Router and Route Handlers, TypeScript, Tailwind CSS, shadcn components built on Base UI, pure TypeScript core/content/server packages, Zod content validation, durable anonymous local sessions, and Vitest.
- Planned next: Playwright journeys, Supabase Postgres with anonymous auth and Row Level Security, and Vercel previews.
- Planned after the trusted loop: a provider-agnostic tutor interface with Cloudflare Workers AI/Qwen as an optional first live adapter.
- Required throughout: static authored explanations as the guaranteed fallback.

The LLM is a presentation layer, not the source of truth. Code owns answer keys, scoring, mastery, dates, question selection, and spaced repetition. The product must remain fully usable with AI disabled.

## Planning documents

- [Product specification](docs/PRODUCT_SPEC.md)
- [Technical architecture](docs/TECHNICAL_ARCHITECTURE.md)
- [Milestone roadmap](docs/PROJECT_ROADMAP.md)
- [Prioritized implementation backlog](docs/BACKLOG.md)

## Hackathon demo target

A judge should be able to watch this complete loop in under four minutes:

1. Enter a student's goal, current scores, and test date.
2. See the generated baseline and study plan.
3. Open today's assigned lesson.
4. Answer one practice question incorrectly.
5. See a trusted explanation and the exact skill involved.
6. Return to the dashboard and see mastery, review spacing, and the next-session update.

For presentation speed, the current demo can use the working 24-question rapid diagnostic. It contains eight questions per core section and two items for each of 12 skills. The intended no-score product path remains the full half-length diagnostic; its content bank and calibration are not complete yet.

## Content and score disclaimer

All questions and passages must be original or separately licensed. Do not copy official ACT questions, explanations, branding, or paid prep materials. ACT's website content is copyrighted under its [Terms of Use](https://www.act.org/content/act/en/terms-of-use.html).

Any result from an original, shortened diagnostic must be labeled an **estimated practice score range**, not an official ACT score or guaranteed outcome.
