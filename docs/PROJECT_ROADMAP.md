# AI ACT Tutor — Build Roadmap

## Target outcome

The goal is a deployed, credible MVP that proves one complete adaptive learning loop:

1. A student enters a goal score, prior scores when available, and a test date.
2. A student without scores completes a shortened diagnostic.
3. The system produces an estimated baseline and a dated study plan.
4. The student opens an assigned lesson and completes focused practice.
5. Each answer updates skill mastery, misconceptions, and review timing.
6. Future tasks change when the evidence changes.

The central proof is not a generic chatbot. Two students with different evidence must receive different work, and a new answer must visibly change the next learning action. AI-generated re-explanations make the product friendlier, but deterministic code owns scoring, answer keys, mastery, schedules, and question selection.

This roadmap is milestone-based rather than calendar-based. It works for a solo builder, but the workstreams can be divided among a small team. Complete every P0 gate before taking on P1 depth or P2 polish, regardless of how much time remains before the event.

## What ships in the MVP

### Required, P0

- Immediate three-gate onboarding.
- Both placement paths: submitted scores and the intended 66-question half-length core diagnostic.
- A clearly labeled rapid diagnostic fallback for demo recovery or learners who cannot complete the half-length form in one sitting.
- Current English/Math/Reading Composite rules.
- A versioned skill taxonomy and validated original content.
- Deterministic scoring, mastery, prioritization, scheduling, and spaced repetition.
- A dated plan, daily dashboard, micro-lessons, focused practice, and feedback.
- An authored explanation fallback that works with AI disabled.
- Anonymous persistence, answer-key isolation, basic privacy controls, and accessibility.
- A public deployment, seeded demo learner, automated critical paths, and backup demo assets.

### Valuable after the core loop, P1

- Editable weekly availability.
- Misconception and pacing signals.
- Cloudflare Workers AI/Qwen adapter.
- “Explain another way.”
- Wider content coverage and stronger score calibration.

### Stretch, P2

- Optional Science diagnostic and lessons.
- Deeper gamification, social features, teacher views, or account linking.
- Broad video recommendations beyond a small reviewed allowlist.

## Current implementation checkpoint

This checkpoint records local implementation evidence, not completion of the later preview, accessibility, security, or production acceptance gates.

Working locally or in verification:

- the pnpm workspace, Next.js application, Tailwind/shadcn Base UI primitives, and tested `packages/core`, `packages/content`, and `packages/server` packages;
- the responsive three-gate onboarding shell with versioned local draft persistence;
- full-score, Composite-only, and never-tested branching, optional Science input, custom/quick test dates, and past-date rejection;
- deterministic English/Math/Reading Composite calculation, goal-aligned section target selection, and runway intensity modes;
- a generated Today/Plan/Progress dashboard, assignment reasons, and an authored lesson preview;
- a validated 24-question rapid diagnostic with original reviewed content across 12 skills, server autosave/resume, hidden pre-submit keys, deterministic scoring, baseline results, and planner handoff;
- cookie-bound anonymous diagnostic sessions with frozen form versions, atomic local-file writes, and idempotent finalization.

Not complete yet:

- timezone capture, production database persistence, anonymous auth, and RLS;
- the full 66-question bank, stronger calibration, database-backed multi-instance finalization, and broader reviewed content;
- skill taxonomy/mastery, focused practice, answer feedback, spaced repetition, and future-plan regeneration;
- Playwright, CI, hosted deployment, AI adapters, and production resilience/security proof.

The immediate next gate is the adaptive learning loop: define mastery evidence and misconception contracts, assign lessons and focused practice from the 12 diagnostic skill signals, then visibly regenerate the learner's next task after each answer. In parallel, replace the local session file with Supabase anonymous auth, RLS, and a transactional finalization function before deployment.

## Operating model

### Execution rhythm

- Work one milestone at a time and keep the current branch runnable after each completed slice.
- End each build block with a short progress note and the next concrete task already chosen.
- Keep explicit integration and recovery checkpoints between major product phases.
- Enter feature freeze only after every P0 gate passes; use the final stage for verification rather than feature development.

### Team ownership

| Workstream     | Primary responsibility                                                                 |
| -------------- | -------------------------------------------------------------------------------------- |
| Product/demo   | scope, learner journey, copy, prioritization, user testing, pitch                      |
| Frontend       | onboarding, diagnostic runner, dashboard, lessons, practice, responsive UI             |
| Engine/backend | schema, scoring, mastery, plan generation, persistence, security                       |
| Content/AI/QA  | taxonomy, original questions, lessons, model prompts/fallbacks, content review, E2E QA |

For a solo build, follow the milestone order below and avoid working on more than one major feature at a time. For a team, the frontend and engine tracks can run in parallel once the shared schemas are merged; content work should continue throughout the project.

### GitHub workflow

- Create one issue for each numbered item in [the prioritized backlog](BACKLOG.md).
- Use short-lived branches such as `feat/onboarding`, `feat/diagnostic`, `feat/learning-engine`, and `feat/daily-loop`.
- Keep `main` deployable and merge through reviewed pull requests.
- Put shared schemas and API contracts ahead of UI and backend work that depend on them.
- Keep secrets out of Git. Commit only variable names in `.env.example`.
- Attach screenshots, test output, or a preview URL to each completed P0 issue.

### Definition of done

An item is complete only when:

- its backlog acceptance criteria pass;
- expected, empty, loading, and error states are handled;
- relevant unit or browser tests pass;
- the behavior works in a preview or production-like deployment;
- user-facing claims and content have been reviewed;
- setup or architecture documentation is updated when behavior changes.

## Phase 1 — Foundation and contracts

### Milestone 1 — Freeze the MVP and organize execution

Goals:

- Confirm the product promise: “Every answer changes what you study next.”
- Turn backlog P0 items into GitHub issues with owners and dependencies.
- Create a project board with `Ready`, `In progress`, `Review`, and `Done` columns.
- Mark the deterministic adaptive loop as the cut-resistant core.
- Choose English redundancy and sentence boundaries as the deepest demo sequence; use algebra/functions as the second proof.
- Define a seeded learner and the exact three- to four-minute demonstration path.

Deliverables:

- P0/P1/P2 scope is visible in GitHub.
- Every P0 issue has an owner and acceptance criteria.
- Stretch features cannot block the core loop.

Gate: everyone can explain the same seven-step learner journey and name the features that will be cut first.

### Milestone 2 — Initialize the application and continuous integration

Backlog: 0.1 and the CI portion of 0.3.

- Create the pnpm workspace, Next.js App Router application, and shared packages.
- Configure TypeScript strictness, linting, formatting, Vitest, and Playwright.
- Add Tailwind and the minimum component primitives needed for forms, cards, progress, dialogs, and feedback.
- Add CI checks for install, lint, typecheck, unit tests, content validation, and build.
- Add `.env.example` with names only.

Gate: a minimal page builds locally and in CI from a clean checkout.

### Milestone 3 — Establish database and deployment foundations

Backlog: 0.2 and 0.3.

- Create development and hosted Supabase projects.
- Enable anonymous authentication.
- Add the initial profile, score, assessment, mastery, plan, task, content, and AI-run migrations described in the architecture document.
- Enable Row Level Security on every user-owned table and generate TypeScript database types.
- Connect Vercel preview deployments without exposing production secrets to untrusted previews.

Gate: an incognito visitor can open the deployment and create an anonymous session; another session cannot read its profile.

### Milestone 4 — Define domain contracts before feature code

Backlog: 2.1 and 2.2.

- Define stable slugs for ACT sections, official categories, teachable skills, and prerequisite edges.
- Keep modeling as a Math cross-tag and pacing/carelessness/guessing as behavior signals rather than academic skills.
- Define Zod schemas for questions, stimuli, lessons, attempts, scores, mastery evidence, plans, and tasks.
- Separate public question data from server-only answer keys.
- Add schema fixtures for one English and one Math learning sequence.

Gate: both UI and server code can import the same validated contracts, and answer keys have no public type or endpoint.

### Milestone 5 — Build the application shell and route map

- Create routes for onboarding, diagnostic, results, dashboard, lesson, and practice.
- Build shared score/date fields, progress stepper, question card, task card, mastery badge, and feedback panel.
- Add responsive layout, typography, skip links, focus styles, and top-level loading/error boundaries.
- Use static fixture data so the complete route sequence is clickable before backend wiring.

Gate: a mobile-sized browser and desktop browser can click through the entire static happy path with a keyboard.

### Milestone 6 — Create the content pipeline and first trusted content

Backlog: 2.3 and the first slice of 2.4.

- Build the content validator/importer and fail CI on invalid IDs, skills, choices, keys, licenses, or stimulus references.
- Create a review-state workflow: `draft` → `reviewed` → `published`.
- Write the first original English redundancy/sentence-boundary questions, rationales, distractor misconceptions, and micro-lessons.
- Independently solve every scored item before marking it reviewed.

Gate: only published content imports; intentionally malformed or unreviewed fixtures fail validation.

### Milestone 7 — Foundation integration checkpoint

- Merge the week's P0 work and remove temporary contract inconsistencies.
- Run the clean-checkout setup and deploy from `main`.
- Audit environment variables, migrations, RLS defaults, route accessibility, and content validation.
- Record known risks and re-estimate the next ten days.
- Use remaining time only to recover incomplete P0 foundation work.

Phase gate:

- CI and preview deployment are green.
- Shared contracts are stable enough for parallel work.
- Anonymous auth and RLS have a working proof.
- Original content can be validated and seeded.

## Phase 2 — Placement and diagnostic

### Milestone 8 — Implement the three-gate onboarding UI

Backlog: 1.1, 1.2, and 1.3.

- Build goal Composite input with integer 1–36 validation.
- Build the prior-score versus never-tested branch.
- Accept English, Math, Reading, and optional Science section scores; allow Composite-only entry but label it low-confidence.
- Build target-date selection with common upcoming dates plus custom date.
- Reject past dates and save the learner's timezone.
- Persist in-progress form state across refreshes.

Gate: both branches are usable by keyboard and screen-reader labels clearly describe every score.

### Milestone 9 — Persist onboarding and create placement sessions

Backlog: 1.4 and 3.1.

- Create profile, goal, availability default, and self-reported score records server-side.
- Make submission idempotent and safe across refreshes.
- Create broad low-confidence skill priors for score-only students.
- Create a frozen, seeded half-length diagnostic session for never-tested students, with the rapid form available as an explicit fallback.
- Route both branches toward the same baseline/mastery/plan model.

Gate: a returning anonymous session resumes correctly, while a separate browser session is denied access.

### Milestone 10 — Build the diagnostic runner

Backlog: 3.2.

- Render section, progress, stimulus, question, and timer state.
- Add keyboard answer selection, clear focus movement, autosave, resume, and submit confirmation.
- Freeze question versions and order at session start.
- Never return answer keys or correctness before submission.
- Use the same runner for the intended half-length form and the rapid fallback.
- If reviewed content is temporarily incomplete, reduce the fallback form rather than padding either mode with low-quality questions.

Gate: a student can refresh mid-assessment, resume at the same point, and finish without losing answers.

### Milestone 11 — Implement scoring and atomic finalization

Backlog: 3.3, 4.1, and the first slice of 4.2.

- Implement the current Composite calculation using English, Math, and Reading with round-half-up behavior.
- Explicitly exclude Science and Writing from the Composite.
- Create a versioned practice-score calibration lookup with a wider range for rapid mode.
- Finalize the assessment, attempts, baseline, and initial mastery evidence in one transaction.
- Make duplicate submissions return the same completed result.

Gate: known response fixtures return expected section ranges, and optional Science cannot change the Composite.

### Milestone 12 — Build baseline results and test both placement paths

- Show estimated score ranges, confidence, strengths, weaknesses, and goal gap.
- Label shortened-diagnostic results as estimated practice ranges, never official or guaranteed scores.
- Explain low confidence for Composite-only self-reports and schedule early probes.
- Run browser tests for prior scores, Composite-only, never-tested, optional Science, invalid scores, past dates, resume, and duplicate submit.

Phase gate:

- Both onboarding branches persist and converge.
- A completed diagnostic deterministically produces a baseline and skill evidence.
- Answer keys remain server-only.

## Phase 3 — Adaptive engine and plan generation

### Milestone 13 — Implement skill mastery and evidence confidence

Backlog: 4.3.

- Implement Beta mastery updates with primary/secondary skill and difficulty weights.
- Store evidence count, last-seen time, and confidence separately from mastery probability.
- Keep unseen skills `Unmeasured` rather than assuming weakness.
- Require enough evidence across at least two days before labeling a skill mastered.
- Add deterministic fixtures for all-correct, all-wrong, mixed, sparse, and repeated evidence.

Gate: the same answer evidence always produces the same mastery profile, and sparse evidence cannot masquerade as confidence.

### Milestone 14 — Convert submitted scores into useful provisional priors

- Map section scores to broad category priors without pretending to know exact skill weaknesses.
- Make confidence visibly lower than diagnostic-derived evidence.
- Schedule short probes across the student's first sessions.
- Verify that future question evidence overrides provisional priors instead of being trapped by them.

Gate: a score-only learner receives a useful initial plan that openly distinguishes known facts from inferred weaknesses.

### Milestone 15 — Generate goal-aligned targets and rank skills

Backlog: 5.1 and 5.2.

- Generate a feasible English/Math/Reading target vector that rounds to the requested Composite.
- Avoid lowering section targets below baseline except in explicit retention mode.
- Rank skills using weakness, evidence confidence, section gap, ACT blueprint value, due review, and prerequisite readiness.
- Insert probes for unknown but important skills.
- Add snapshot tests that explain why each skill was ranked.

Gate: two seeded learners with different evidence receive materially different ranked skill lists.

### Milestone 16 — Build the learner scheduler

Backlog: 5.3.

- Schedule lessons, focused practice, mixed review, and checkpoints through the test date.
- Start with 30 minutes on five days per week and model capacity explicitly.
- Never schedule work after the test date.
- Use different strategies for very close dates, normal runways, and long runways.
- Freeze today's tasks and change only future tasks during regeneration.

Gate: tests cover a near test date, six-week date, long runway, oversized goal gap, no available content, and timezone boundary.

### Milestone 17 — Plan engine integration checkpoint

- Connect both placement paths to mastery, target selection, prioritization, and scheduling.
- Build the plan summary and a simple weekly list or calendar.
- Put a plain-language “Why this was assigned” reason on every task.
- Compare at least three seeded learners and capture their output as regression fixtures.
- Use this day to recover any incomplete P0 engine behavior before building more UI.

Phase gate:

- Different evidence creates visibly different plans.
- Goal gap and time remaining change workload and urgency.
- No task is scheduled after the test date.
- Plan generation remains deterministic with AI disabled.

## Phase 4 — Daily learning and adaptation

### Milestone 18 — Build the dashboard and today’s path

Backlog: 6.1.

- Show baseline range, goal, days remaining, weekly capacity, streak, and today's task sequence.
- Make the first recommended action visually obvious.
- Show provisional confidence for score-only students.
- Add empty, complete, behind-schedule, and plan-generation failure states.

Gate: a first-time student can understand what to do next without reading an algorithm explanation.

### Milestone 19 — Build trusted micro-lessons

Backlog: 6.2.

- Render concept, worked example, common trap, and practice CTA from authored content.
- Complete one polished English and one polished Math lesson sequence.
- If videos are used, allowlist and manually review every URL; lessons must remain complete without video.
- Add progress and return-to-plan behavior.

Gate: all core lesson content works offline from the model provider and contains no copied ACT material.

### Milestone 20 — Build focused practice and feedback

Backlog: 6.3.

- Select a five-question set by assigned skill, difficulty, exposure history, and content availability.
- Keep keys on the server and return correctness only after each practice submission.
- Show the canonical rationale, selected misconception when known, and skill involved.
- Save attempts, completion, XP, and mastery evidence idempotently.

Gate: one intentional English and one Math mistake reliably surface the expected skill and corrective explanation.

### Milestone 21 — Add spaced repetition and future-plan regeneration

Backlog: 6.4 and 6.5.

- Wrong answers trigger immediate repair plus a next-day review.
- Correct reviews move through 2/4/7/14/30-day intervals.
- A lapse resets the interval to one day.
- Prefer a different-context sibling question over repeating the exact item.
- Regenerate future tasks after meaningful evidence while leaving today's visible list stable.

Gate: a fixture learner's wrong answer visibly changes mastery, review timing, and a future task.

### Milestone 22 — Complete adaptive-loop integration checkpoint

- Run Onboarding → Baseline → Plan → Lesson → Practice → Feedback → Updated Plan in production.
- Run the path for both submitted-score and diagnostic students.
- Remove the AI key and repeat the complete path.
- Add a protected demo reset and a stable seeded learner.
- Classify defects as demo-breaking, trust-breaking, or cosmetic; fix the first two categories before continuing.

Phase gate:

- The full learning loop works with AI disabled.
- A judge can see why work was assigned and how an answer changed future work.
- Refreshes and duplicate actions do not corrupt progress.

## Phase 5 — AI layer, content depth, and product polish

### Milestone 23 — Create the bounded tutor interface and template provider

Backlog: 7.1 and 7.3.

- Define typed `explain`, `hint`, and `narratePlan` methods.
- Implement a deterministic template provider using canonical content.
- Make provider errors, timeouts, invalid output, and missing credentials fall back automatically.
- Record purpose, latency, validation status, and fallback reason without unnecessary personal data.
- Keep tests on the template provider.

Gate: every AI-enabled surface still produces a trusted response when no model is configured.

### Milestone 24 — Integrate one live model provider

Backlog: 7.2.

- Implement Cloudflare Workers AI/Qwen behind the provider interface, or swap another provider without changing the domain layer.
- Keep the credential server-only.
- Send only the selected answer, correct answer, canonical rationale, skill, misconception, and minimal tone context.
- Set a short timeout, token cap, low temperature, and Zod output validation.
- Add simple rate limiting and provider-observability metrics.

Gate: a provider outage or malformed response cannot block, rescore, or contradict the canonical learning flow.

### Milestone 25 — Add “Explain another way” and prompt evaluation

Backlog: 7.4.

- Add an optional re-explanation action after trusted authored feedback.
- Clearly distinguish the model's rephrasing from official scoring and answer keys.
- Create a small evaluation set covering redundancy, boundaries, algebra, incomplete context, prompt injection, and provider failure.
- Reject output that changes the answer, invents a score, or exceeds the intended tutoring scope.

Gate: evaluation fixtures pass and the fallback is visibly graceful on timeout.

### Milestone 26 — Add high-value P1 usability improvements

Backlog: 5.4 and, only if core stability permits, 6.6.

- Let the learner edit study days and minutes, then rebalance only future incomplete tasks.
- Add concise streak and XP feedback without punishing mistakes.
- Improve assignment reasons and plan-change summaries.
- Avoid building leaderboards, social systems, shops, or decorative reward complexity.

Gate: availability changes preserve history and never move tasks beyond the test date.

### Milestone 27 — Expand reviewed diagnostic and practice content

Backlog: 2.4 and 2.5.

- Work toward 25 English, 23 Math, and 18 Reading reviewed diagnostic items.
- Preserve Reading passage groups and meet category-coverage tolerances.
- Expand practice variants for the hero English and Math skills so spaced review can use sibling items.
- Keep draft items out of production until separately solved and reviewed.

Gate: the content report shows coverage, review state, license, and available variants by skill.

### Milestone 28 — Content, calibration, and copyright audit

- Independently solve every item visible in the demo.
- Review canonical rationales, distractor misconceptions, difficulty, timing, skill tags, and prerequisite links.
- Remove ambiguous items rather than trying to justify them.
- Verify that every passage, chart, image, and question is original or separately licensed.
- Test score-range calibration boundaries and retain explicit estimated/not-official labels.

Gate: no demo-critical question has a disputed key, missing review, or unclear provenance.

### Milestone 29 — Security and privacy hardening

Backlog: 8.1 and 8.2.

- Add database tests for cross-user denial and user-owned row policies.
- Prove the browser role cannot select server-only answer keys.
- Inspect browser bundles and network calls for service credentials or premature correctness.
- Add a 13+ gate or an explicit under-13 block, data deletion, retention documentation, and minimal-data policy.
- Verify logs do not contain raw student answers plus unnecessary identity data.

Gate: security tests pass from two isolated users and no privileged credential is present client-side.

### Milestone 30 — Accessibility, mobile, resilience, and performance checkpoint

Backlog: 8.3.

- Complete onboarding and diagnostic flows by keyboard only.
- Review focus order, focus restoration, contrast, labels, validation errors, status announcements, and timer behavior.
- Test common phone sizes, slow network, database cold start, refresh, offline transition, empty pools, and AI timeouts.
- Remove dead ends and add actionable recovery messages.
- Measure the deployed happy path and fix only meaningful performance bottlenecks.

Phase gate:

- The MVP is content-trustworthy, secure at its main boundaries, mobile usable, and resilient to an AI outage.
- P1 work has not destabilized the deterministic adaptive loop.

## Phase 6 — Validation, presentation, and freeze

### Milestone 31 — Complete automated critical journeys

Backlog: 9.1 and 9.2.

- Add unit coverage for scoring, mastery, target vectors, priority, scheduling, selection, and spaced repetition.
- Add browser journeys for the score path, no-score half-length path, no-score rapid fallback, AI-disabled path, optional Science exclusion, duplicate submission, and resume.
- Seed a fictional learner with a reproducible weakness pattern and protected reset.
- Run the suite against the deployed environment, not just localhost.

Gate: all P0 checks pass from a clean database seed and a clean browser context.

### Milestone 32 — Conduct learner usability tests

- Recruit three to five people who did not build the product.
- Give them a goal, prior-score/no-score scenario, and no navigation coaching.
- Observe where they hesitate, misunderstand score claims, lose progress, or fail to notice adaptation.
- Ask them what the next assigned task is and why they think it was assigned.
- Fix repeated journey problems before cosmetic feedback.

Gate: most testers complete onboarding and find today's task without help; they can explain that the plan adapts from evidence.

### Milestone 33 — Build the pitch and evidence package

Backlog: 9.4.

Prepare a three- to four-minute story:

1. Problem: test prep is generic, expensive, and difficult to sustain.
2. Insight: students need the next best action at the skill level.
3. Product: an adaptive daily ACT path.
4. Live demo of one evidence-to-plan-to-adaptation loop.
5. Technical credibility: deterministic engine plus bounded, optional AI.
6. Impact and the next product milestone.

Create one architecture visual, one baseline-to-plan example, current-versus-goal visual, QR code, live URL, backup screenshots, and a short backup recording. Prepare concise answers about scoring accuracy, content rights, privacy, AI failure, and differentiation.

Gate: the primary and backup presenter can finish under time twice without rushing.

### Milestone 34 — Run adversarial production testing

Backlog: 9.3.

Test from incognito, another laptop, a phone, a slow connection, a fresh anonymous user, the seeded user, and with AI disabled. Try invalid and missing scores, past and near test dates, refresh during assessment, duplicate submit, empty content, provider timeout, and database cold start.

Fix only demonstrated demo-breaking or trust-breaking failures. Do not start an architecture rewrite. Finish with three consecutive clean production demonstrations and record the exact known-good commit.

Gate: three clean runs from reset to visible adaptation, including one AI-disabled run.

### Milestone 35 — Feature freeze and submission preparation

- Stop feature development.
- Update README, setup steps, architecture notes, screenshots, and team contributions.
- Verify repository visibility and every submission requirement.
- Reset and verify the seeded learner.
- Create a known-good tag or record the release commit.
- Back up seed data, configuration instructions, slides, screenshots, and video.
- Rehearse likely judge questions and handoff between presenters.

Gate: the release candidate can be rebuilt or restored by someone other than its primary developer.

### Milestone 36 — Final verification and event readiness

- Open every submitted link from a non-team device and account.
- Confirm production environment variables, database health, rate limits, and reset behavior.
- Run one final automated smoke test and one final live rehearsal.
- Submit early enough to recover from an upload or form problem.
- Assign one person to guard the known-good production build; make no unreviewed changes.

Final gate: the public URL, repository, pitch, backup assets, and seeded demo all show the same tested release.

## Milestone scorecard

| Day | Proof required                                                           |
| --: | ------------------------------------------------------------------------ |
|   3 | clean build, CI, anonymous session, preview deployment                   |
|   7 | stable contracts, RLS skeleton, validated content pipeline               |
|  12 | both placement paths produce a trustworthy baseline                      |
|  17 | different evidence creates different dated plans                         |
|  22 | full adaptive loop works without AI                                      |
|  25 | optional live re-explanation is bounded and has a fallback               |
|  30 | reviewed content, privacy/security checks, mobile and accessibility pass |
|  31 | automated critical journeys pass against a deployed environment          |
|  34 | three consecutive clean production demonstrations                        |
|  35 | feature-frozen, restorable release candidate                             |
|  36 | submitted and verified from a non-team device                            |

## Demo script

Use a seeded student so the live presentation does not spend its limited time completing a long diagnostic.

> “Meet Maya. She wants a 30, currently has a 24, and has an upcoming ACT date.”

1. Show Maya's section scores and the target date.
2. Point out the weak section and the provisional confidence.
3. Open the dated plan and its assignment reason.
4. Open today's redundancy lesson.
5. Intentionally choose a plausible wrong answer.
6. Show the trusted explanation and optional AI rephrasing.
7. Return to the dashboard and show the mastery change and scheduled review.

Close with:

> “Most prep products give every student the same library. AI ACT Tutor turns every answer into the next best learning action.”

## Risk register

| Risk                     | Early warning                              | Response                                                                           |
| ------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Scope expansion          | P0 issues remain open while P2 work starts | pause stretch work and return to the next incomplete phase gate                    |
| Content bottleneck       | engineering waits for reviewed questions   | lock schemas early; ship a smaller, deeper reviewed bank                           |
| Incorrect content        | reviewers disagree on the answer           | remove the item; do not ship ambiguous scored content                              |
| Weak personalization     | seeded plans look alike                    | expose weakness, confidence, gap, urgency, and assignment reasons                  |
| LLM hallucination        | response contradicts the key               | canonical rationale, constrained input, schema validation, authored fallback       |
| Provider outage or quota | slow or failed inference                   | short timeout, rate limit, cached/template response, AI-optional flow              |
| Misleading score claim   | UI shows a precise guarantee               | use ranges, confidence, calibration version, and estimate disclaimer               |
| Copyright problem        | item resembles copied prep material        | require original/licensed provenance and content review metadata                   |
| Privacy overreach        | unnecessary identity data is collected     | anonymous-first design, minimal fields, deletion, documented retention             |
| Fragile deployment       | behavior only works locally                | deploy during the foundation phase and test the hosted path throughout development |
| Merge conflicts          | long-lived branches diverge                | merge small contract-first PRs and use scheduled integration days                  |
| Last-minute regression   | feature work continues after freeze        | lock the day-35 release commit and use backup video/assets                         |

## Scope reduction order

If progress falls behind, reduce scope in this order:

1. Remove optional Science.
2. Remove decorative gamification and secondary visualizations.
3. Use the deterministic template tutor instead of a live model.
4. Reduce content breadth while keeping English deep and Math as a second proof.
5. Only if the reviewed half-length form cannot meet the quality gate, keep the clearly labeled rapid fallback for the demo and defer the incomplete portion of the half-length bank.
6. Use a weekly list instead of a complex calendar.

Do not cut answer-key integrity, deterministic adaptation, trusted explanations, accessibility of the primary flow, or the evidence that a new answer changes future work. Those are the product.

## After the event

The strongest next investments are a fully reviewed diagnostic bank, real calibration data, broader lesson coverage, longitudinal efficacy measurement, durable accounts, educator tooling, and student research. These should follow proof that the core daily adaptive loop is useful and trustworthy.
