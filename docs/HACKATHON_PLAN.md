# AI ACT Tutor — 48-Hour Hackathon Plan

## Assumption and goal

This schedule assumes a 48-hour hackathon and a three- or four-person team. If the event is shorter, use the cut line near the end of this document.

At submission, a judge must see one convincing adaptive loop:

1. Enter goal score, current scores, and test date.
2. Receive a baseline or take a rapid diagnostic.
3. See a personalized, dated study plan.
4. Open today's assigned lesson.
5. Complete a practice question.
6. See the mistake mapped to a skill and misconception.
7. See mastery and future work update.

The most important visible proof is not a chatbot. It is that two students with different evidence receive different tasks, and that one new answer changes the next learning action.

## Team roles

### Four-person team

| Role | Owns |
|---|---|
| Product/demo lead | scope, UX copy, dashboard coherence, content coordination, pitch, submission |
| Frontend lead | onboarding, diagnostic UI, dashboard, lesson/practice screens, responsive/accessibility polish |
| Backend/engine lead | schema, scoring, mastery, plan generation, persistence, security |
| Content/AI/QA lead | taxonomy, original questions, lesson content, AI prompts/fallbacks, content audit, E2E testing |

### Three-person team

- Product lead also owns content and pitch.
- Frontend lead owns UI and E2E wiring.
- Backend lead owns database, engine, and AI adapter.

### Two-person team

- Person A: product, frontend, content, pitch.
- Person B: database, engine, AI, deployment.
- Both stop feature work by Hour 32 and test together.

## Branch strategy

- `main` must always be deployable.
- Use short-lived branches: `feat/onboarding`, `feat/diagnostic`, `feat/learning-engine`, `feat/daily-loop`.
- Open small pull requests and merge at the scheduled integration gates.
- Keep schema/API contracts in shared types so frontend and backend can work in parallel.
- Never put API keys in commits; create `.env.example` in Hour 1.

## Hours 0–2 — Freeze the product

Entire team:

- agree on the product promise: “Every answer changes what you study next”;
- freeze the seven-step judge journey;
- choose English as the deepest hero section because redundancy and sentence-structure mistakes are easy to explain visually;
- support Math as the second adaptive proof;
- keep Reading and optional Science shallower if content time is limited;
- decide the rapid diagnostic item count for the live demo;
- assign roles and branch ownership;
- create Must / Stretch / Cut columns;
- confirm Vercel, Supabase, and AI-provider accounts;
- list required environment variables.

Deliverables:

- one-page journey sketch;
- schema/API contract;
- content JSON schema;
- named demo owner and backup presenter;
- exact hour checkpoints accepted by the team.

Gate: every teammate can recite the same demo path and the same non-goals.

## Hours 2–6 — Deploy the skeleton

Frontend:

- initialize Next.js, Tailwind, component primitives, typography, and app shell;
- create static routes for onboarding, diagnostic, results, dashboard, lesson, and practice;
- build shared score/date inputs, progress stepper, task card, question card, and mastery badge.

Backend:

- initialize Supabase locally and in development;
- create core migrations and RLS skeleton;
- configure anonymous auth;
- create generated TypeScript DB types;
- implement the content import and seed path.

Engine:

- scaffold pure `scoring`, `mastery`, `planning`, `scheduler`, and `selector` modules;
- add tests for current Composite calculation and Science exclusion.

Content:

- lock the first 10–12 deeply supported skills;
- write original demo questions and canonical explanations;
- draft five to eight micro-lessons;
- attach primary skills, distractor misconceptions, difficulty, and expected time.

Product:

- write all onboarding and results copy;
- define the seeded judge persona;
- prepare a one-sentence explanation of AI's bounded role.

Hour 6 gate:

- deployed URL exists;
- seeded data loads;
- static happy path is clickable;
- main is green;
- no unresolved stack decision blocks implementation.

## Hours 6–10 — Onboarding and both placement paths

Frontend:

- build the exact three gates;
- show/hide section inputs based on prior-score state;
- add score/date validation and clear error text;
- route no-score students to diagnostic and score students to plan generation.

Backend:

- save anonymous profile and target;
- save self-reported scores;
- create broad skill priors with low confidence;
- create an assessment session for the no-score path;
- make refresh safe.

Content/QA:

- validate every question completed so far;
- solve all Math questions independently;
- check that every wrong choice has a plausible misconception or is left unclassified rather than invented.

Hour 10 gate:

- both onboarding branches work in production;
- data persists after refresh;
- invalid scores and past dates are rejected;
- no sign-in is required to see a plan.

## Hours 10–14 — Diagnostic and mastery

Frontend:

- build question navigation, section progress, timer display, autosave, and submit confirmation;
- make answer options keyboard accessible;
- build a compact result view with range, confidence, strengths, weaknesses, and goal gap.

Backend/engine:

- freeze assessment items and versions;
- accept idempotent answer writes;
- finalize the assessment atomically;
- calculate section estimates, mastery, evidence, confidence, and misconception counts;
- create deterministic tests for known answer patterns.

Content:

- balance rapid-form coverage;
- preserve passage-based stimulus groups;
- remove ambiguous questions instead of trying to rescue them at the last minute.

Hour 14 gate:

- one complete diagnostic run produces a reproducible skill profile;
- a known wrong-answer pattern surfaces the intended weakness;
- answer keys are absent from browser responses.

## Hours 14–18 — Plan generation

Frontend:

- build plan summary, weekly list/calendar, and today's task path;
- show “Why this was assigned” on every task;
- display study minutes and allow later editing.

Backend/engine:

- choose section targets that satisfy the goal Composite;
- implement skill priority, prerequisites, capacity, and due reviews;
- generate dated tasks through the test date;
- keep today frozen and regenerate future tasks only;
- create fallback plans for very close dates and low content availability.

Product:

- make the plan feel specific without overclaiming;
- label all projected scores as estimates;
- make the first recommended action obvious.

Hour 18 gate:

- two seeded learners receive visibly different plans;
- a closer test date increases urgency;
- a larger goal gap changes target workload;
- the plan never schedules after the test date.

## Hours 18–22 — Lesson, practice, and adaptation loop

Frontend:

- build one polished English lesson and one Math lesson;
- build a five-question focused practice set;
- show immediate practice feedback, misconception, mastery change, and next review;
- add a light XP/streak treatment only after the core loop works.

Backend/engine:

- select questions by skill, difficulty, exposure, and review state;
- save practice attempts and mark tasks complete;
- update mastery and spaced intervals;
- regenerate future plan tasks after session completion.

AI/content:

- implement template explanations first;
- add the live “Explain another way” endpoint;
- ground prompts in the canonical answer and rationale;
- validate output and fall back within eight seconds.

Hour 22 gate:

- learner completes Lesson → Practice → Feedback → Updated Plan;
- wrong redundancy or algebra answer schedules a sibling and next-day review;
- the loop works with the AI key removed.

## Hours 22–24 — First full integration gate

Stop isolated feature work.

- merge every Must branch;
- run the entire production journey in a clean browser;
- classify issues as Demo-breaking, Trust-breaking, or Cosmetic;
- hide unfinished routes;
- back up seed data and environment configuration;
- record the first rough backup demo.

Hour 24 cut rule: if the complete loop is broken, cancel all stretch goals immediately.

## Hours 24–28 — Make personalization visible

- add a small mastery visualization;
- explain the assignment reason in plain language;
- show provisional confidence for self-reported scores;
- inject skill probes into the score user's first week;
- add completed-task history;
- ensure both placement paths converge into the same mastery/plan model;
- add a demo reset command or protected reset action.

Hour 28 gate: a judge can understand personalization without hearing the algorithm explanation.

## Hours 28–32 — UX and resilience

- add loading, empty, error, and provider-failure states;
- prevent duplicate submissions;
- handle assessment resume and expired sessions;
- handle an empty question pool gracefully;
- test mobile layout and keyboard navigation;
- make timers readable without creating panic;
- verify contrast, focus order, and labels;
- add the seeded demo mode.

Hour 32 gate: there are no dead ends in the primary journey.

## Hours 32–36 — Content and test audit

Engineering:

- run unit tests for scoring, mastery, selection, scheduling, and planning;
- run E2E onboarding → diagnostic/score → plan → lesson → practice;
- test RLS, answer-key isolation, and cross-user denial;
- verify production build and environment separation.

Content:

- independently solve every demo question;
- verify explanations, skill tags, difficulty, and licensing;
- open every video/resource link;
- remove anything ambiguous or copied.

Product:

- audit every claim and disclaimer;
- test the plan with a modest gap, large gap, no prior score, and near test date.

Hour 36 gate:

- all demo-critical tests pass;
- every shown question is reviewed;
- production completes the happy path.

## Hours 36–40 — Pitch and evidence

Build a three- to four-minute pitch:

1. Problem: test prep is generic, expensive, and difficult to sustain.
2. Insight: students need the next best action at the skill level.
3. Product: an adaptive daily ACT path.
4. Live demo with one learner.
5. Technical credibility: deterministic engine plus bounded AI.
6. Impact and next roadmap.

Prepare:

- one architecture slide;
- one baseline-to-plan example;
- one current-versus-goal visual;
- QR code and production URL;
- backup screenshots and video;
- concise answers for correctness, content rights, privacy, AI failure, and differentiation.

Hour 40 gate: the team completes the pitch under time twice, and a backup presenter can run it.

## Hours 40–44 — Adversarial demo testing

Test from:

- incognito;
- another laptop;
- phone;
- slow network;
- fresh anonymous user;
- seeded demo user;
- AI disabled.

Try:

- invalid scores;
- missing section scores;
- past and very close test dates;
- refresh during a diagnostic;
- duplicate submit;
- empty question pool;
- AI timeout;
- database cold start.

Fix only demonstrated high-impact failures. No architecture rewrites.

Hour 44 gate: three consecutive clean production demos. Feature freeze begins.

## Hours 44–47 — Final stabilization

- update README, setup, screenshots, architecture, and team contributions;
- verify all submission requirements and links;
- reset the seeded learner;
- tag or record the known-good commit;
- capture a final backup recording;
- rehearse judge questions;
- make no cosmetic refactor that risks the working build.

## Hours 47–48 — Submit early

- submit 30–45 minutes early;
- open every submitted link from a non-team device;
- assign one teammate to guard production;
- do one final rehearsal, then stop changing code.

## Non-negotiable checkpoints

| Hour | Proof |
|---:|---|
| 6 | deployed clickable skeleton |
| 10 | both placement branches persist |
| 14 | diagnostic produces mastery |
| 18 | different evidence produces different plans |
| 22 | complete adaptive learning loop works without AI |
| 24 | integrated production path |
| 36 | tests and content audit complete |
| 40 | pitch rehearsed |
| 44 | three clean demos and feature freeze |
| 47 | known-good submission build |

## Judge demo script

Use a seeded student to avoid spending the pitch on a long diagnostic.

> “Meet Maya. She wants a 30, currently has a 24, and takes the ACT in six weeks.”

1. Enter or show Maya's section scores.
2. Point out the weak section and provisional skill confidence.
3. Open the dated plan and its assignment reason.
4. Open today's redundancy lesson.
5. Intentionally choose a plausible wrong answer.
6. Show the trusted explanation and optional AI rephrasing.
7. Return to the dashboard and show mastery plus tomorrow's review changed.

Close:

> “Most prep products give every student the same library. AI ACT Tutor turns every answer into the next best learning action.”

## Risk register

| Risk | Warning sign | Response |
|---|---|---|
| Scope explosion | multiple incomplete sections by Hour 18 | keep English deepest, prove Math once, cut breadth |
| Content bottleneck | engineers waiting for questions | lock schema early; use a smaller reviewed bank |
| Incorrect content | teammates disagree on answer | remove the item; never ship ambiguous scored content |
| LLM hallucination | response contradicts key | canonical rationale, schema validation, template fallback |
| Provider quota/outage | slow or failed inference | short timeout, cached/template response, AI-optional demo |
| Fake personalization | plans look identical | make weakness, confidence, gap, and urgency visible |
| Bad score claims | UI shows a precise guarantee | ranges, confidence, and explicit estimate disclaimer |
| Copyright issue | copied ACT/commercial question | original/licensed content only; source/review metadata |
| Minor privacy | unnecessary PII collected | anonymous-first and minimal data |
| Fragile deployment | works only locally | deploy by Hour 6 and test continuously |
| Merge conflicts | long-lived branches | small PRs, shared contracts, integration gates |
| Demo too long | diagnostic consumes pitch | seeded result and rapid mode |
| Last-minute regression | stretch work after freeze | freeze at Hour 44; known-good tag and backup video |

## 24-hour cut line

If the event is 24 hours:

- support one hero section deeply and one secondary proof;
- use 12–20 rapid diagnostic questions;
- ship a one-week plan, not a full calendar UI;
- use anonymous sessions only;
- no live video search, social features, teacher view, or advanced gamification;
- one model-powered re-explanation only;
- integrate by Hour 12, test by Hour 18, pitch by Hour 21, freeze by Hour 23.

Do not cut deterministic adaptation or trusted explanations; those are the product.

## 72-hour extension

Use extra time for depth, not unrelated features:

- expand reviewed content across sections;
- complete the 66-question core half diagnostic;
- add optional Science content;
- improve calibration and checkpoints;
- run three to five student usability sessions;
- strengthen accessibility, mobile behavior, and analytics;
- add account linking and durable progress only after the core path is stable.
