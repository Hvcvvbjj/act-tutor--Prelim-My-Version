# AI ACT Tutor

An adaptive, Duolingo-style ACT study product that turns a student's score history and every practice answer into the next best learning action.

> Product promise: **Every answer changes what you study next.**

## Repository status

This fork now contains the first working local vertical slice plus the product specification, technical architecture, prioritized backlog, and an undated milestone roadmap.

Working in the current slice:

- a responsive three-step onboarding flow for goal score, prior scores, and test date;
- prior-score branches for full section scores or a low-confidence Composite-only starting point, plus a never-tested path;
- versioned local draft persistence across refreshes;
- deterministic English/Math/Reading Composite calculation, goal-aligned section targets, and runway-based plan intensity in `packages/core`;
- a generated Today/Plan/Progress dashboard and an authored lesson preview;
- a no-score path with 12 original reviewed questions, per-answer autosave/resume, review, deterministic server-side scoring, skill signals, and baseline-to-plan handoff;
- a server response boundary that withholds answer keys and rationales until the completed diagnostic is submitted.

Still placeholders or future milestones:

- the complete 66-question half-length bank, a 24-question rapid form, stronger calibration, database-backed atomic submission, and broader skill coverage;
- practice answers, mastery updates, spaced repetition, and visible plan regeneration;
- Supabase authentication/persistence, AI providers, CI, deployment, and production monitoring.

The current diagnostic is intentionally labeled a starter slice with a wide estimated practice range; it does not claim official ACT precision or pretend that the full half-length bank is finished.

## Quick start

Requirements: Node.js `>=20.9.0` and pnpm `11.7.0`. Node.js `22.12` is the recommended team version and is pinned in `.nvmrc`.

```bash
nvm use
corepack enable
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The current local-only slice does not require environment variables.

Run all checks currently wired into the workspace with:

```bash
pnpm check
```

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

- Implemented now: Next.js App Router and Route Handlers, TypeScript, Tailwind CSS, shadcn components built on Base UI, a pure TypeScript core package, and Vitest.
- Planned next: Zod-backed shared validation, Playwright journeys, Supabase Postgres with anonymous auth and Row Level Security, and Vercel previews.
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
6. Return to the dashboard and see mastery and the next review update.

For presentation speed, the current demo can use the working 12-question starter diagnostic. The intended no-score product path remains the full half-length diagnostic; its content bank and calibration are not complete yet.

## Content and score disclaimer

All questions and passages must be original or separately licensed. Do not copy official ACT questions, explanations, branding, or paid prep materials. ACT's website content is copyrighted under its [Terms of Use](https://www.act.org/content/act/en/terms-of-use.html).

Any result from an original, shortened diagnostic must be labeled an **estimated practice score range**, not an official ACT score or guaranteed outcome.
