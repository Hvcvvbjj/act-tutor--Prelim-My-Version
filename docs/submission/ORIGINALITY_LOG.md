# Originality and build evidence

The competition rules require original core application logic during the eligible build window. This file is a reproducible evidence checklist, not a legal conclusion.

## Repository

- Submission fork: `https://github.com/Hvcvvbjj/act-tutor--Prelim-My-Version.git`
- Working branch: `main`
- The original shared repository must not be used as the submission write target.

## Local commit evidence already present

The local history records the product build on July 12–13, 2026, including the initial vertical slice, resumable diagnostic, adaptive learning loop, setup documentation, Scout experience restructure, competition-ready Learning Twin, and adaptive IRT Precision Check.

```text
Adaptive model feature commit: f45cc64caae443727aecd4079858680861d62e5c
Adaptive model feature timestamp: 2026-07-13T17:04:58-05:00
Final pushed branch: main
Verification record: this file's immediately following evidence commit
```

## Major original application logic

- Score-evidence normalization and goal vector planning.
- Original half-length ACT-style diagnostic and calibration.
- Bayesian 2PL IRT ability estimation, Fisher-information selection, coverage policy, uncertainty display, and stop rule.
- Durable ordered calibration sessions and IRT-to-BKT evidence handoff.
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
- Item Response Theory and Bayesian Knowledge Tracing as published modeling approaches; this repository’s implementations, parameter policies, product integration, tests, and interfaces are original application work.

## Final verification evidence

Run from the repository root and paste the final output summary:

```powershell
pnpm check
git diff --check
git status --short --branch
git log -1 --format="%H%n%aI%n%s"
```

```text
Automated test count: PASS — 106 tests (65 core, 9 content, 32 server)
Production build: PASS — Next.js production build completed with all seven app routes
Desktop browser QA: PASS — live IRT answer updated theta +0.13 → +0.24, met the precision rule, and appeared in BKT
Mobile browser QA: PASS — Progress at 390 × 844 with 375 px document width and no horizontal overflow
Console errors: PASS — no application errors or warnings in the final adaptive-model journey
Final video duration: PENDING
```

## Sensitive-file check

Before pushing, confirm that no `.env.local`, API key, cookies, or `.data` session files are tracked:

```powershell
git ls-files | Select-String -Pattern "(^|/)(\.env\.local|\.data/)|api[_-]?key|secret" -CaseSensitive:$false
```
