# Scout ACT web app

This is the Next.js frontend for Scout ACT. It contains the three-gate onboarding flow, a required 66-question Round 0 diagnostic, an optional later 8–12 question Quick Check, AI-assisted teaching loops, the product-wide Mr. Kim layer, Timed Practice, evidence/data controls, and a durable adaptive learning loop.

Run it from the repository root so the local `@act-tutor/core` workspace package resolves correctly.

```bash
nvm use
corepack enable
pnpm install
pnpm dev
```

Node.js `>=20.9.0` and pnpm `11.7.0` are required. Node.js `22.12` is the recommended team version pinned in the root `.nvmrc`. Open [http://localhost:3000](http://localhost:3000).

No environment variables are required for the local slice. These optional variables override ignored local JSON stores:

```bash
DIAGNOSTIC_SESSION_STORE_PATH=/absolute/path/diagnostic-sessions.json
LEARNING_SESSION_STORE_PATH=/absolute/path/learning-sessions.json
```

Use the root verification command before handing off changes:

```bash
pnpm check
```

For the browser release journeys, install Chromium once and run:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

## Current boundary

The reported-score and no-score paths both continue into the same required, resumable 66-question Round 0 diagnostic. Its server-scored result builds the first skill map and unlocks Lessons. Answer keys remain withheld until submission, and no path claims official ACT score precision.

The dashboard starts a separate cookie-bound learning session. Round 1 contains 12 segmented foundation lessons. Each lesson ends with a five-question check; a learner below the goal-based threshold must review and correct every miss with Mr. Kim before the next lesson unlocks. Later 12-lesson rounds use persisted diagnostic evidence to order the weakest question types first. Generated explanations are optional and scoring remains deterministic.

Independent content/psychometric calibration, production Supabase persistence, CI, and deployment are later milestones.

Shared UI primitives live in `components/ui`, tutor surfaces live in `components/tutor`, trusted score/planning logic lives in `packages/core`, schema-checked original questions live in `packages/content`, and the file-backed session repository lives in `packages/server`. See the root [README](../../README.md), [milestone roadmap](../../docs/PROJECT_ROADMAP.md), and [technical architecture](../../docs/TECHNICAL_ARCHITECTURE.md) for the product plan.

To add another shadcn component, run from `apps/web`:

```bash
pnpm dlx shadcn@latest add <component>
```
