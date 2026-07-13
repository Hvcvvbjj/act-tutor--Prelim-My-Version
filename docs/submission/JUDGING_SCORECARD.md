# Competition readiness scorecard

This scorecard maps the product to the four equally weighted official judging dimensions. It is an internal red-team document, not marketing copy.

## 1. Educational Impact — target 23–25 / 25

### Evidence already in the product

- Three-input placement flow supports prior section scores, composite-only evidence, or no prior ACT attempt.
- Learners without scores receive a 66-question half-length English, Math, and Reading diagnostic rather than a shallow quiz.
- Twelve skill models turn section-level evidence into specific instructional targets.
- Daily missions combine teaching, ACT-shaped practice, mistake repair, spaced repetition, and mixed retrieval.
- Adaptive Plan Studio preserves completed work and today while rebalancing future assignments.
- Test Day Lab adds timed section rehearsal, confidence capture, flags, pacing analysis, and an AI-capable debrief.
- Accessibility basics include semantic controls, keyboard-focus treatments, responsive layouts, reduced-motion handling, explicit errors, and no-account entry.

### Proof to show judges

- Onboarding’s no-score diagnostic path.
- Sentence Boundaries assignment tied to 0% diagnostic evidence.
- Mistake notebook and due-review states.
- Counterfactual disclaimer that avoids false score promises.

### Remaining submission risk

The team should avoid claiming measured score improvement without a longitudinal learner study. Frame the impact as a complete, accessible intervention with a credible measurement plan.

## 2. Creative Use of AI/ML — target 24–25 / 25

### Evidence already in the product

- Bayesian Knowledge Tracing is in the trusted answer path, not a demo-only visualization.
- A Bayesian 2PL IRT Precision Check actively selects the next item by Fisher information plus section/skill coverage.
- The public interface exposes ability, uncertainty, an 80% interval, item parameters, top candidate scores, and the stop policy.
- Every calibration response crosses a tested server boundary into BKT; calibration never awards practice XP.
- Every server-scored response updates P(Learned), P(Correct next), uncertainty, and the public evidence ledger.
- The next-skill decision is driven by explicit knowledge-gap, uncertainty, evidence-scarcity, and lapse contributions.
- Twelve skill models expose guess, slip, and transition parameters.
- The counterfactual lab projects readiness under additional evidence cycles.
- The LLM’s role is bounded to lesson composition and debrief explanation using reviewed content and learner evidence.
- A deterministic reviewed composer provides graceful degradation while BKT remains the active ML control loop.

### Proof to show judges

- One response changing theta and uncertainty live, then appearing in BKT.
- The recommendation changing or remaining stable for an inspectable reason.
- The AI-personalized or reviewed-fallback generation stamp.
- Architecture diagram separating trusted scoring, BKT, planner, and generative teaching.

### Remaining submission risk

Do not spend the video explaining implementation jargon before showing the model move. The visible IRT update and BKT handoff are the proof. Describe current item parameters as reviewed product priors, not empirical ACT calibration.

## 3. Technical Execution / UI / UX — target 23–25 / 25

### Evidence already in the product

- Next.js 16 and React 19 application with typed package boundaries for core, content, server, and web.
- Server-only answer keys and rationales; public question payloads are sanitized.
- Durable, atomic file repositories and duplicate-answer protection for the hackathon build.
- Resumable diagnostics, learning sessions, adaptive plans, and exam rehearsals.
- Test coverage across scoring, IRT estimation/selection/stopping, diagnostics, learning, BKT, missions, study plans, repositories, lesson composition, and exam debriefs.
- Distinctive Scout field-notebook interface rather than a generic chatbot or card-grid dashboard.
- Desktop and mobile flows, keyboard-visible focus, reduced motion, loading, empty, error, and disabled states.

### Proof to show judges

- Clean `pnpm check` output before submission.
- Production build route list.
- Browser console with no app errors.
- Mobile screenshot of the Learning Twin and teaching workspace.

### Remaining submission risk

File storage is appropriate for a runnable hackathon demo but not horizontal production scale. Describe the repository interface as the seam for a database rather than pretending this is already multi-tenant infrastructure.

## 4. Pitch & Demo — target 24–25 / 25

### Evidence already prepared

- One-sentence differentiator: “IRT chooses what to ask, BKT chooses what to teach, and the LLM chooses how to explain it.”
- Closing line: “Every question earns its place; every answer teaches the plan.”
- One-click representative judge profile.
- A 1:52–1:57 script centered on the visible evidence update.
- Competition-specific Devpost story and technical architecture.
- Honest language for model limits and fallback behavior.

### Must be true before submission

- Final video is 2:00 or shorter after export.
- Captions are readable at normal Devpost player size.
- The first 20 seconds show the problem and product, not a slide deck.
- The live model update is visible.
- Source link points to the fork, not the original shared repository.
- README run instructions work on a clean Windows PowerShell setup and on macOS/Linux.

## Submission gates

- [ ] Student/team eligibility confirmed for every member.
- [ ] Team size is four or fewer.
- [ ] Source code URL is public or otherwise accessible to judges.
- [ ] Final commit is pushed to the fork.
- [ ] Demo video is uploaded and at most two minutes.
- [ ] All third-party assets and model/provider usage are disclosed.
- [ ] No API key, cookie store, learner data, or `.data` file is committed.
- [ ] Originality log contains final commit and test evidence.
