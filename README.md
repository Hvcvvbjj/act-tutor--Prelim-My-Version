# AI ACT Tutor

An adaptive, Duolingo-style ACT study product that turns a student's score history and every practice answer into the next best learning action.

> Product promise: **Every answer changes what you study next.**

## Repository status

This fork is currently in product-planning mode. The product specification, architecture, implementation backlog, and a 48-hour hackathon schedule are ready for the team to execute.

## Core experience

The website opens directly into a three-part placement flow:

1. Goal Composite score.
2. Current Composite and section scores, or “I have never taken the ACT.”
3. Next planned ACT date.

Students with prior scores receive a provisional study plan immediately, followed by short skill probes in their first sessions. Students without prior scores take a truncated diagnostic. Both paths produce:

- an estimated baseline and confidence range;
- strengths and weaknesses at the skill level;
- a dated study plan leading to the test date;
- daily micro-lessons, focused questions, mixed review, and timed checkpoints;
- automatic plan updates as new evidence arrives.

The current enhanced ACT uses English, Math, and Reading for the Composite. Science and Writing are optional, so this product must not use the legacy four-section Composite model. See the [official ACT structure](https://www.act.org/content/act/en/products-and-services/the-act/test-preparation/act-exam-sections-and-structure.html) and [score explanation](https://www.act.org/content/act/en/products-and-services/the-act/scores/understanding-your-scores.html).

## Recommended MVP stack

- Next.js App Router and TypeScript
- Tailwind CSS with shadcn/Radix components
- Supabase Postgres, anonymous auth, Row Level Security, and migrations
- Zod for shared validation
- Pure TypeScript scoring, mastery, planning, scheduling, and selection modules
- A provider-agnostic tutor interface with Cloudflare Workers AI/Qwen as the first live adapter
- Static authored explanations as the guaranteed fallback
- Vitest, Playwright, and Supabase database tests
- Vercel deployment with preview builds

The LLM is a presentation layer, not the source of truth. Code owns answer keys, scoring, mastery, dates, question selection, and spaced repetition. The product must remain fully usable with AI disabled.

## Planning documents

- [Product specification](docs/PRODUCT_SPEC.md)
- [Technical architecture](docs/TECHNICAL_ARCHITECTURE.md)
- [48-hour hackathon plan](docs/HACKATHON_PLAN.md)
- [Prioritized implementation backlog](docs/BACKLOG.md)

## Hackathon demo target

A judge should be able to watch this complete loop in under four minutes:

1. Enter a student's goal, current scores, and test date.
2. See the generated baseline and study plan.
3. Open today's assigned lesson.
4. Answer one practice question incorrectly.
5. See a trusted explanation and the exact skill involved.
6. Return to the dashboard and see mastery and the next review update.

For presentation speed, use a seeded student and a clearly labeled rapid diagnostic. The production design still supports the promised half-length diagnostic.

## Content and score disclaimer

All questions and passages must be original or separately licensed. Do not copy official ACT questions, explanations, branding, or paid prep materials. ACT's website content is copyrighted under its [Terms of Use](https://www.act.org/content/act/en/terms-of-use.html).

Any result from an original, shortened diagnostic must be labeled an **estimated practice score range**, not an official ACT score or guaranteed outcome.
