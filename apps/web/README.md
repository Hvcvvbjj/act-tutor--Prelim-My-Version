# AI ACT Tutor web app

This is the Next.js frontend for the AI ACT Tutor workspace. It currently contains the three-gate onboarding flow, the deterministic plan reveal, the dashboard shell, and a working starter diagnostic.

Run it from the repository root so the local `@act-tutor/core` workspace package resolves correctly.

```bash
nvm use
corepack enable
pnpm install
pnpm dev
```

Node.js `>=20.9.0` and pnpm `11.7.0` are required. Node.js `22.12` is the recommended team version pinned in the root `.nvmrc`. Open [http://localhost:3000](http://localhost:3000). No environment variables are required for the current local-only slice.

Use the root verification command before handing off changes:

```bash
pnpm check
```

## Current boundary

The prior-score path produces a deterministic local plan. The no-score path loads 12 original reviewed questions from a Route Handler, autosaves and resumes answers locally, withholds keys until submission, scores a wide estimated range on the server, and feeds the result into the same planner. The full half-length bank, Supabase persistence, practice/adaptation, AI, and deployment are later milestones.

Shared UI primitives live in `components/ui`, tutor surfaces live in `components/tutor`, and trusted score/planning logic lives in the root `packages/core` workspace package. See the root [README](../../README.md), [milestone roadmap](../../docs/PROJECT_ROADMAP.md), and [technical architecture](../../docs/TECHNICAL_ARCHITECTURE.md) for the product plan.

To add another shadcn component, run from `apps/web`:

```bash
pnpm dlx shadcn@latest add <component>
```
