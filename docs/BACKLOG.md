# AI ACT Tutor — Prioritized Backlog

## How to use this backlog

Create one GitHub issue per numbered item. Add these labels:

- Priority: `P0-demo`, `P1-mvp`, `P2-stretch`
- Area: `product`, `frontend`, `engine`, `database`, `content`, `ai`, `qa`, `devops`
- Status: `ready`, `blocked`, `review`, `done`

Keep `main` deployable. An issue is done only when its acceptance criteria and relevant tests pass in the preview deployment.

## Current implementation checkpoint

This table records local evidence only. It does not mark an issue `done` before every acceptance criterion and relevant preview test passes.

| Backlog item | Local evidence                                                                                                                                                    | Remaining before done                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 0.1          | pnpm workspace, Next.js/Tailwind/shadcn Base UI app, `packages/core`, `packages/content`, `packages/server`, lint/typecheck/build scripts, and Vitest are present | add Playwright, `packages/ai`, `.env.example`, and clean-checkout CI proof                 |
| 1.1          | goal-score gate and versioned local refresh persistence are implemented                                                                                           | finish browser, keyboard, and mobile acceptance verification                               |
| 1.2          | full-score, Composite-only low-confidence, and never-tested branches plus optional Science are implemented and manually exercised                                 | add automated browser coverage and preview acceptance proof                                |
| 1.3          | quick/custom dates, past-date rejection, and routing to plan or diagnostic setup are implemented                                                                  | capture timezone and add browser coverage                                                  |
| 2.2          | Zod-backed secure/public contracts cover version, choices, skills, difficulty, key, rationale, status/license/review metadata, and stimulus text                  | add stimulus groups, lesson schemas, distractor misconceptions, and importer tooling       |
| 2.4          | 66 original half-length questions cover 12 skills across the three core sections, use passage grouping, and pass blueprint validation                             | complete independent editorial/psychometric review and empirical calibration               |
| 3.1          | cookie-bound server sessions freeze form ID/version/order and survive process restarts through an atomic local-file repository                                    | replace the single-node file store with Supabase ownership, RLS, and cross-device identity |
| 3.2          | the runner shows section/progress, hides correctness, autosaves to the server, exits, and resumes                                                                 | add automated keyboard/focus coverage and authenticated cross-device resume                |
| 3.3          | deterministic scoring creates section ranges, 12 skill signals, baseline evidence, and planner handoff; duplicate finalization is idempotent                      | make scoring, mastery, baseline, and completion one Postgres transaction                   |
| 4.1          | English/Math/Reading round-half-up Composite logic and Science-exclusion unit tests exist                                                                         | keep this covered in the integrated placement and diagnostic paths                         |
| 4.2          | a wide, smoothed rapid calibration returns bounded section and Composite practice ranges                                                                          | calibrate against larger reviewed forms and empirical version lookup tables                |
| 4.5          | twelve persistent Bayesian Knowledge Tracing models update from trusted diagnostic/practice evidence and drive an inspectable next-skill recommendation           | calibrate guess/slip/transition parameters from consented longitudinal response data       |
| 5.1          | deterministic feasible target-vector selection and unit tests exist                                                                                               | expose/verify edge-case rationale in the integrated plan flow                              |
| 5.3          | deterministic dated tasks, checkpoints, rehearsal, milestones, capacity/health, and durable server persistence are implemented                                    | add prerequisite graph and production database transactions                                |
| 5.4          | per-day availability editing, capacity preview, completion history, catch-up, and future-only rebalance are implemented                                           | add timezone-aware reminders and production cross-device persistence                       |
| 6.1          | Today/Plan/Progress dashboard, real dated tasks, assignment reasons, completion state, and provisional confidence are implemented                                 | connect hosted baseline history and notification delivery                                  |
| 6.5          | live mastery signals re-rank future plan tasks while today and completed work stay frozen; deterministic fixtures cover the behavior                              | connect Test Lab results and multi-day hosted evidence transactions                        |

The half-length diagnostic is a real end-to-end slice, not a psychometrically finished assessment system. Production database sessions, transactional mastery/baseline finalization, empirical calibration, independent review, and broader longitudinal mastery remain open work. The current file repository is durable for a local single-node demo, but it is not a substitute for multi-instance database transactions.

## Epic 0 — Foundation

### 0.1 Initialize the pnpm/Next.js workspace — P0

Acceptance criteria:

- Next.js App Router, TypeScript, Tailwind, lint, typecheck, Vitest, and Playwright run locally.
- Shared `packages/core`, `packages/ai`, and `packages/content` exist.
- `.env.example` contains names but no secrets.
- CI builds a minimal page.

### 0.2 Configure Supabase development and migrations — P0

- Local and hosted development projects are documented.
- Anonymous auth is enabled.
- First migration creates profile/content/assessment/mastery/plan tables.
- RLS is enabled on every user-owned table.
- Generated DB types are committed.

### 0.3 Create CI and Vercel preview deployment — P0

- Pull requests run lint, typecheck, unit tests, content validation, and build.
- Vercel creates a preview deployment.
- Production secrets are not exposed to untrusted previews.
- `main` deployment is visible from an incognito browser.

## Epic 1 — Immediate three-gate onboarding

### 1.1 Build goal score gate — P0

- Integer 1–36 validation.
- Keyboard and mobile accessible.
- State survives refresh.

### 1.2 Build current-score branch — P0

- Prior-score and never-tested options are explicit.
- English, Math, Reading, and optional Science fields behave correctly.
- Composite-only entry is allowed and marked low-confidence.
- Current-format English/Math/Reading Composite is calculated separately from any legacy self-report.

### 1.3 Build target-date gate — P0

- Upcoming dates and a custom date are available.
- Past dates are rejected.
- Timezone is saved.
- CTA routes to plan or diagnostic.

### 1.4 Persist anonymous onboarding — P0

- Anonymous user and profile records are created server-side.
- Duplicate submission is idempotent.
- Another user cannot read the profile.

## Epic 2 — Taxonomy and content system

### 2.1 Define versioned ACT taxonomy — P0

- Required official categories and initial teachable skills have stable slugs.
- Prerequisite edges are explicit.
- Modeling is a Math cross-tag.
- Pacing/careless/guessing are behavior tags, not skills.

### 2.2 Define question/stimulus/lesson JSON schemas — P0

- Zod schemas cover version, status, choices, key, rationale, skills, difficulty, license, and review metadata.
- Passage and chart stimuli can group questions.
- Canonical explanations and distractor misconceptions are represented.

### 2.3 Build content validator/importer — P0

- Invalid IDs, choices, keys, skills, licenses, stimuli, and statuses fail CI.
- Only published content imports into production seed data.
- Draft answer keys cannot be served publicly.

### 2.4 Produce reviewed demo content — P0

- At least 10–12 deeply supported skills.
- One polished English redundancy/sentence-boundary sequence.
- One polished Math algebra/functions sequence.
- Every demo item is independently solved and reviewed.
- All passages/questions are original or licensed.

### 2.5 Produce the half-length core diagnostic content — P0

- 25 English, 23 Math, and 18 Reading reviewed diagnostic items.
- Stimulus blocks and category coverage meet blueprint tolerances.
- Fixed/seeded form passes validation.

### 2.6 Add optional Science diagnostic and lessons — P2

- 20 reviewed Science diagnostic items.
- Science tasks appear only for opted-in users.
- Science never affects Composite.

## Epic 3 — Diagnostic

### 3.1 Create assessment session and freeze item versions — P0

- The 66-question half-length diagnostic is the intended no-score path.
- A rapid form can be selected as a clearly labeled fallback.
- Item/version/order are fixed at start.
- Seeded generation is reproducible.

### 3.2 Build accessible diagnostic runner — P0

- Question progress, section, autosave, and resume work.
- Keyboard navigation and focus behavior are correct.
- No answer key/correctness is exposed before submit.

### 3.3 Implement atomic diagnostic submission — P0

- Duplicate submits return one final result.
- Scoring, mastery update, baseline creation, and completion occur atomically.
- Known response fixtures produce expected skill weaknesses.

### 3.4 Add rapid fallback mode — P0

- Uses a smaller reviewed, seeded subset of the same core blueprint.
- Returns a wider estimated score range than the half-length form.
- Is labeled as a fallback/rapid estimate, not equivalent evidence.
- Uses the same autosave, resume, answer-key isolation, and submission path as the half-length form.

## Epic 4 — Scoring, mastery, and misconceptions

### 4.1 Implement current Composite calculation — P0

- English/Math/Reading only.
- Round-half-up behavior is unit tested.
- Science and Writing never enter Composite.

### 4.2 Implement practice-score range — P0

- Versioned calibration table.
- Rapid mode returns a wider range than half mode.
- Result clearly says estimated/not official.
- Lookup bounds and missing evidence are tested.

### 4.3 Implement Beta mastery and confidence — P0

- Primary/secondary weights work.
- Difficulty evidence weights work.
- Unseen skills are Unmeasured.
- Mastered requires enough evidence across at least two days.

### 4.4 Track distractor misconceptions and pacing — P1

- Known distractors increment a misconception code.
- Slow correct answers can be marked fragile without becoming incorrect.
- Behavior signals remain separate from academic mastery.

### 4.5 Add an interpretable Bayesian Learning Twin — P0

- Maintain P(Learned), P(Correct next), uncertainty, and evidence counts for every supported skill.
- Update only from server-scored diagnostic and practice responses.
- Make guess, slip, transition, and next-skill feature contributions inspectable.
- Persist a public before/after evidence ledger without exposing answer keys.
- Use the model to choose future skill work and mixed checkpoints.
- **Implemented locally:** twelve BKT models, difficulty-aware observation updates, four-feature recommendation scoring, persistent evidence events, counterfactual readiness projections, core/server tests, and the Learning Twin UI are complete.

## Epic 5 — Plan generator and scheduler

### 5.1 Generate feasible section target vector — P0

- Target English/Math/Reading scores round to the goal Composite.
- Targets do not fall below baseline unless retention mode is active.
- The chosen vector minimizes unrealistic movement.

### 5.2 Rank skills and respect prerequisites — P0

- Weakness, confidence, blueprint value, section gap, and due review affect priority.
- Unknown skills receive probes.
- Advanced tasks do not precede required foundations.

### 5.3 Generate dated tasks within capacity — P0

- Default is 30 minutes, five days per week.
- Tasks never fall after the test date.
- Close-date and long-runway modes behave differently.
- Today's task list remains stable after regeneration.
- **Implemented locally:** the deterministic scheduler fills only selected days before test day, varies work by runway, inserts checkpoints/rehearsal, and persists the frozen route in a cookie-bound atomic repository.

### 5.4 Add editable study availability — P1

- User can edit days and minutes after plan creation.
- Future tasks rebalance without losing completion history.
- **Implemented locally:** students can toggle weekdays, choose 15–120 minutes per day, preview capacity, save/rebalance, mark assignments complete, and run catch-up without moving today or completed work.

## Epic 6 — Daily learning loop

### 6.1 Build dashboard/today path — P0

- Shows days remaining, baseline range, goal, minutes, streak, and task path.
- First task explains why it was assigned.
- Provisional skill confidence is visible for score-only users.
- **Implemented locally:** four-stage mission trail, level/XP rail, due reviews, twelve-skill map, and adaptive next action.

### 6.2 Build micro-lesson view — P0

- Concept, worked example, common trap, and CTA to practice.
- Authored content always renders without AI.
- Curated video is allowlisted and optional.

### 6.3 Build focused practice and feedback — P0

- Five-question set by skill/difficulty.
- Correctness uses server-owned keys.
- Trusted explanation and misconception appear.
- Task completion updates XP and mastery.
- **Implemented locally:** XP is awarded only after server-verified lesson and question events; completion bonuses are idempotent.

### 6.4 Implement spaced repetition — P0

- Wrong → repair now + tomorrow.
- Correct intervals follow 2/4/7/14/30 days.
- Lapse resets to one day.
- Different-context sibling is preferred to exact repeat.
- **Implemented locally:** Beta mastery schedules due reviews and the UI orders overdue/today/upcoming work; sibling-question selection remains future work.

### 6.5 Regenerate future plan after practice — P0

- Future tasks change after meaningful evidence.
- Today stays frozen.
- Demo fixtures visibly show the adaptation.
- **Implemented locally:** the Plan Studio syncs the twelve live Beta-mastery signals, keeps the current Daily Mission aligned, and re-ranks future skill tasks through an idempotent server action.

### 6.6 Add polished gamification — P2

- Completion XP, weekly goal, streak grace, and mastery celebrations.
- Mistakes never lock the learner out.
- **Implemented locally:** XP/levels, current and longest streaks, durable mistake notebook, exact-question repair, mastery bars, and mixed checkpoints. Weekly goals and streak grace remain future work.

### 6.7 Build Test Day Lab — P1

- **Implemented locally:** 12-skill sprint, English/Math/Reading half-length section simulations, and full 66-question core rehearsal.
- **Implemented locally:** section deadlines, passage-aware runner, confidence/flag/time capture, autosave, review, omissions, and idempotent server scoring.
- **Implemented locally:** practice score ranges, section/skill evidence, pacing diagnosis, confidence calibration, aggregate-only AI debrief with fallback, and question review.
- Future work: additional independently reviewed forms, empirical timing/score calibration, pause accommodations, and production database persistence.

## Epic 7 — AI tutor layer

### 7.1 Implement provider interface and template provider — P0

- Explain, hint, and plan narration methods are typed.
- Template provider is deterministic and complete.
- Tests use the template provider.

### 7.2 Implement Cloudflare/Qwen adapter — P1

- API key remains server-only.
- Requests contain no unnecessary PII.
- Timeout, token cap, and low temperature are configured.
- Output is Zod-validated.

### 7.3 Add fallback and privacy-safe AI logging — P0

- Any provider/validation error returns authored content.
- `ai_runs` records purpose, latency, validation, and fallback reason.
- Raw personal data is not logged.

### 7.4 Add “Explain another way” — P1

- Prompt is grounded in selected answer, correct answer, canonical rationale, skill, and misconception.
- Model cannot alter the score or key.
- UI clearly distinguishes optional re-explanation from official scoring.

## Epic 8 — Security, privacy, and accessibility

### 8.1 Prove RLS and answer-key isolation — P0

- Cross-user reads/writes fail in database tests.
- Browser role cannot select from `question_keys`.
- Service key never appears in browser bundles.

### 8.2 Add minimum privacy controls — P0

- No unnecessary child PII is collected.
- 13+ gate or under-13 block is explicit.
- Data deletion exists.
- Anonymous stale-data retention is documented.
- Score and legal disclaimers are visible.

### 8.3 Accessibility audit — P0

- Onboarding and diagnostic are keyboard complete.
- Timers are announced appropriately.
- Focus, contrast, labels, and error messages pass manual review.

## Epic 9 — Demo, QA, and submission

### 9.1 Create seeded demo learner and reset — P0

- Maya fixture has a goal of 30, current 24, an upcoming ACT date, and intended English/Math weakness.
- Reset is one protected action or script.
- Seed contains no real student information.

### 9.2 Add critical automated journeys — P0

- Score path.
- No-score half-length diagnostic path.
- No-score rapid fallback path.
- AI-disabled path.
- Optional Science exclusion.
- Duplicate submit and resume.

### 9.3 Run production adversarial test — P0

- Incognito, other laptop, phone, slow network, fresh user, seeded user, and AI disabled.
- Three consecutive clean demos are recorded.
- Demo-breaking issues are closed before freeze.

### 9.4 Prepare pitch and backup assets — P0

- Three- to four-minute script.
- Architecture and learner-progress slides.
- QR code and live URL.
- Backup screenshots/video.
- Backup presenter rehearsed.

## Recommended execution order

```text
Foundation
→ Onboarding + content contracts
→ Diagnostic + mastery
→ Plan generator
→ Daily lesson/practice loop
→ AI re-explanation
→ Resilience/accessibility
→ Demo freeze
```

If time is lost, remove breadth, visual flourishes, and live AI before removing the deterministic adaptive loop.
