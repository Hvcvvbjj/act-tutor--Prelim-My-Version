# Scout ACT web app

This is the Next.js frontend for Scout ACT. It contains the three-gate onboarding flow, deterministic plan reveal, a 66-question half-length baseline, AI-assisted four-stage lessons, the interactive Scout tutor, and a durable adaptive learning loop.

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

## Current boundary

The prior-score path produces a deterministic local plan. The no-score path loads a validated 66-question half-length form from a Route Handler, autosaves progress to a cookie-bound anonymous server session, withholds keys until submission, finalizes idempotently, scores an estimated range on the server, and feeds the result into the same planner.

The dashboard starts a separate cookie-bound learning session. It creates and persists an individualized four-stage lesson through an optional OpenAI-compatible model, with a reviewed fallback when AI is unavailable. It gates the five-question focus set until teaching is complete, withholds answer keys until each answer is submitted, updates mastery deterministically, schedules review, and shows whether future practice changed. Today's task stays stable during the session.

Independent content/psychometric calibration, production Supabase persistence, CI, and deployment are later milestones.

Shared UI primitives live in `components/ui`, tutor surfaces live in `components/tutor`, trusted score/planning logic lives in `packages/core`, validated authored questions live in `packages/content`, and the file-backed session repository lives in `packages/server`. See the root [README](../../README.md), [milestone roadmap](../../docs/PROJECT_ROADMAP.md), and [technical architecture](../../docs/TECHNICAL_ARCHITECTURE.md) for the product plan.

To add another shadcn component, run from `apps/web`:

```bash
pnpm dlx shadcn@latest add <component>
```
