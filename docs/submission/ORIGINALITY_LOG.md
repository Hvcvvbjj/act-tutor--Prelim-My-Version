# Originality and build evidence

The competition rules require original core application logic during the eligible build window. This file is a reproducible evidence checklist, not a legal conclusion.

## Repository

- Submission fork: `https://github.com/Hvcvvbjj/act-tutor--Prelim-My-Version.git`
- Working branch: `main`
- The original shared repository must not be used as the submission write target.

## Local commit evidence already present

The local history records the product build on July 12, 2026, including the initial vertical slice, resumable diagnostic, adaptive learning loop, setup documentation, and Scout experience restructure. Before submission, append the final pushed commit below.

```text
Final commit: PENDING
Final commit timestamp: PENDING
Final pushed branch: PENDING
```

## Major original application logic

- Score-evidence normalization and goal vector planning.
- Original half-length ACT-style diagnostic and calibration.
- Durable diagnostic, learning, plan, and exam-lab sessions.
- Server-only question keys and trusted scoring.
- Twelve-skill Bayesian Knowledge Tracing implementation.
- Interpretable next-skill feature contributions.
- Adaptive Daily Mission, mistake repair, spaced reviews, and mixed checkpoints.
- Adaptive Plan Studio with future-only rebalancing.
- Test Day Lab pacing, confidence, flag, and debrief analysis.
- Structured AI lesson and exam-debrief composition with reviewed fallbacks.
- Scout visual system, mascot, teaching workspace, and Learning Twin UI.

## Third-party and pretrained components

The product uses open-source frameworks and pretrained model APIs rather than training a foundation model from scratch. These are dependencies, not claimed as original work:

- Next.js, React, TypeScript, Tailwind CSS, Base UI, Lucide, Vitest, and pnpm.
- An optional OpenAI-compatible model endpoint for structured lesson and debrief generation.
- Bayesian Knowledge Tracing as a published modeling approach; this repository’s implementation, parameter policy, product integration, tests, and interface are original application work.

## Final verification evidence

Run from the repository root and paste the final output summary:

```powershell
pnpm check
git diff --check
git status --short --branch
git log -1 --format="%H%n%aI%n%s"
```

```text
Automated test count: PASS — 90 tests (56 core, 9 content, 25 server)
Production build: PASS — Next.js production build completed with all six routes
Desktop browser QA: PASS — onboarding, judge demo, lesson, practice, and live BKT update
Mobile browser QA: PASS — 390 px viewport with no horizontal overflow
Console errors: FIXED — a Fast Refresh stale-payload crash was found and guarded; final production browser reload was blocked by the browser URL policy, while the production build and HTTP smoke check passed
Final video duration: PENDING
```

## Sensitive-file check

Before pushing, confirm that no `.env.local`, API key, cookies, or `.data` session files are tracked:

```powershell
git ls-files | Select-String -Pattern "(^|/)(\.env\.local|\.data/)|api[_-]?key|secret" -CaseSensitive:$false
```
