# AI ACT Tutor — Product Specification

## 1. Product vision

AI ACT Tutor is a daily adaptive learning product for students who know they should prepare for the ACT but do not know what to study, in what order, or how much work is realistic before their test date.

The product combines:

- the low-friction daily loop and visible progress of Duolingo;
- the skill-level diagnosis of a strong human tutor;
- a deterministic study-plan engine that can explain why every task was assigned;
- bounded AI that makes trusted lessons and explanations feel personal.

The central user outcome is not “chat with an AI.” It is: **open the app and immediately know the highest-value thing to do today.**

## 2. Product principles

1. **Start with the student's reality.** Goal score, current evidence, and time remaining determine the plan.
2. **Every task needs a reason.** The UI should say which weakness, prerequisite, or due review caused an assignment.
3. **Correctness is deterministic.** An LLM never decides a scored answer or calculates mastery.
4. **Skill evidence beats vague personalization.** “Practice Math” is not enough; “Linear systems: elimination under time pressure” is actionable.
5. **No login wall.** Begin with an anonymous session and offer account linking after the plan is visible.
6. **Do not fake precision.** Short original diagnostics produce estimates and confidence ranges, not official ACT scores.
7. **Learning should survive provider failure.** Authored lessons, answer explanations, and scheduling work without live AI.

## 3. Current ACT model

The product should model the enhanced ACT, not the legacy format. The required Composite is the rounded mean of English, Math, and Reading; Science is optional and reported separately. The current displayed structure is documented by [ACT](https://www.act.org/content/act/en/products-and-services/the-act/test-preparation/act-exam-sections-and-structure.html):

| Section | Displayed questions | Full-section time | Composite role |
|---|---:|---:|---|
| English | 50 | 35 minutes | Required |
| Math | 45 | 50 minutes | Required |
| Reading | 36 | 40 minutes | Required |
| Science | 40 | 40 minutes | Optional; separate Science/STEM reporting |
| Writing | 1 essay | 40 minutes | Optional; out of MVP scope |

The content model must be versioned so later ACT blueprint changes do not require rewriting historical attempts.

## 4. Entry experience: exactly three gates

The home route is the onboarding experience. Do not put a marketing landing page in front of it during the hackathon.

### Gate 1 — Goal score

- Prompt: “What score are you aiming for?”
- Input: integer from 1–36.
- Helpful context: a small, optional explanation of Composite scoring.
- Validation: the goal may be below the current score; in that case the plan becomes retention and consistency work rather than forced improvement.

### Gate 2 — Current score evidence

Present two mutually exclusive choices:

- “I have ACT scores.”
- “I have not taken the ACT yet.”

If the student has scores:

- ask for current Composite;
- ask for English, Math, and Reading section scores;
- show Science only if the student took or plans to take Science;
- allow “I only know my Composite,” but mark the resulting plan low-confidence;
- preserve the self-reported Composite and calculate a current-format English/Math/Reading Composite for internal consistency.

If the student has not tested, do not ask for invented values. Route to the diagnostic after Gate 3.

### Gate 3 — Next ACT date

- Prompt: “When is your next ACT?”
- Offer official upcoming national dates as quick choices and allow a custom date for school/district testing.
- Reject past dates.
- Explain that the date controls study intensity.
- Do not block onboarding on schedule preferences; generate a default 30-minute, five-day-per-week plan and make it editable later.

Primary CTA:

- Score path: “Build my plan.”
- No-score path: “Start my diagnostic.”

## 5. Placement paths

### 5.1 Prior-score path

A section score can place a student broadly, but it cannot reveal whether the student struggles with redundancy, sentence boundaries, inference, functions, or another fine skill.

The product should:

1. Save the self-reported scores as a broad prior.
2. Generate a provisional plan immediately.
3. Mark the skill map “still learning about you.”
4. Place two or three short skill probes into each of the first three to five sessions.
5. Replace broad assumptions with real mastery evidence as answers arrive.

This preserves the user's requested fast path without pretending score reports contain detail they do not provide.

### 5.2 No-score path

The full product target is a half-length diagnostic based on half of the current displayed test:

| Section | Diagnostic questions | Target time | Notes |
|---|---:|---:|---|
| English | 25 | 18 minutes | Passage blocks; do not shuffle questions away from stimuli |
| Math | 23 | 25 minutes | Balanced difficulty and reporting categories |
| Reading | 18 | 20 minutes | Passage blocks, including paired/visual material |
| Science | 20 | 20 minutes | Only when the student selects Science |

Core diagnostic: 66 original scored questions in about 63 minutes. With optional Science: 86 questions in about 83 minutes.

This form is not psychometrically equated to an official ACT. Display a score range and a confidence label. Support autosave, section-level timers, pause between sections, and resume.

For the hackathon demo, add a **Rapid Estimate** mode with roughly 24 balanced questions. It must be visibly labeled less precise and must never be described as ACT-equivalent.

### Diagnostic assembly rules

- Use a fixed, human-reviewed form or deterministic seeded form for MVP.
- Preserve English, Reading, and Science stimulus groups.
- Cover official reporting-category proportions as closely as the item count allows.
- Use one primary skill per question and optional secondary tags.
- Do not reveal correctness until the diagnostic section is submitted.
- Do not include fake unscored field-test items.
- Do not branch adaptively inside the baseline; adapt after the baseline so coverage remains comparable.

## 6. Skill taxonomy

Use official reporting categories as parents and teachable product skills beneath them.

### English

- Production of Writing: relevance and purpose, focus, development, organization, introductions/conclusions, transitions, argumentative support.
- Knowledge of Language: concision and redundancy, precision, style and tone, logical connectors.
- Conventions: fragments, run-ons, comma splices, clauses, modifiers, parallelism, tense, voice, agreement, pronouns, verb forms, comparisons, idioms, commas, apostrophes, semicolons, colons, and dashes.

### Math

- Number and Quantity: real/rational numbers, ratios, proportions, percentages, exponents, radicals, complex numbers, matrices.
- Algebra: expressions, linear equations and inequalities, systems, polynomials, quadratics, rational equations.
- Functions: notation, domain/range, linear/quadratic/exponential behavior, transformations, composition, inverse, piecewise functions, sequences.
- Geometry: angles, triangles, coordinate geometry, circles, similarity, congruence, area, volume, trigonometry.
- Statistics and Probability: center/spread, tables and graphs, probability, counting, bivariate data, regression, sampling.
- Integrating Essential Skills: rates, units, measurement, percent, proportional reasoning, and multi-step applications.
- Modeling is stored as a cross-tag rather than a mutually exclusive category.

### Reading

- Key Ideas and Details: main idea, theme, detail, paraphrase, inference, sequence, relationships, cause/effect.
- Craft and Structure: word in context, connotation, purpose, viewpoint, text structure, rhetorical devices.
- Integration: claims and evidence, fact/opinion, reasoning quality, paired-passage comparison, synthesis, visual/quantitative information.

### Science

- Interpretation of Data: graphs, tables, diagrams, trends, units, interpolation, extrapolation, dataset comparison.
- Scientific Investigation: variables, controls, procedures, design, predictions, flaws, and improvements.
- Evaluation: claims, evidence, reasoning, models, hypotheses, support/refutation, assumptions, and tradeoffs.

Pacing, guessing, and careless-error signals are behavior tags, not academic mastery.

## 7. Baseline results experience

The result page must answer four questions in under ten seconds:

1. Where am I now?
2. How far am I from my goal?
3. Which skills are helping or hurting me most?
4. What should I do first?

Required result components:

- estimated Composite range and section ranges;
- confidence label and “not an official ACT score” disclosure;
- goal gap;
- strongest two skills;
- highest-value two or three weaknesses;
- pacing signal when supported by response-time evidence;
- CTA: “See my plan.”

Avoid a wall of analytics. The deeper heatmap belongs below the decision summary.

## 8. Study-plan generation

### Inputs

- goal Composite;
- baseline section scores and confidence;
- current mastery and evidence per skill;
- days until test;
- Science participation;
- default or edited weekly capacity;
- prerequisites, blueprint importance, and due reviews.

### Target section vector

Do not force every required section to equal the goal. Enumerate feasible English/Math/Reading target triples whose rounded mean reaches the goal, require that targets do not fall below current section baselines, and select the smallest realistic combined movement. Tie-break toward sections with well-supported weaknesses.

### Skill priority

Use a deterministic, versioned score such as:

```text
priority =
  section_gap_weight
  × blueprint_weight
  × (1 - mastery)
  × (0.6 + 0.4 × confidence)
  + uncertainty_probe_bonus
  + overdue_review_bonus
```

High-confidence weaknesses receive instruction. Low-confidence areas receive probes. Respect prerequisites before assigning advanced work.

### Default 30-minute session

- 5 minutes: due spaced reviews.
- 8 minutes: one micro-lesson.
- 10 minutes: five to eight focused questions.
- 5 minutes: a mixed timed sprint.
- 2 minutes: recap and error log.

### Plan phases

- More than 12 weeks: slow foundation and spaced mastery.
- 5–12 weeks: foundation, targeted practice, timed transfer, rehearsal.
- 1–4 weeks: high-impact gaps, weekly checkpoints, at least one half mock.
- Under 7 days: triage, pacing, confidence, sleep/rest guidance; no unrealistic content flood.

Recalculate future work after every completed session, but freeze today's task list so the interface does not thrash.

## 9. Daily “ACT Duolingo” loop

The home dashboard should show:

- days until the test;
- goal and current estimated range;
- today's total minutes;
- a vertical path of Lesson → Focus Practice → Mixed Review → Checkpoint;
- streak and weekly completion;
- one sentence explaining why the first task was selected.

### Lesson unit

1. One concept in plain language.
2. One worked example.
3. One common trap.
4. Three to five guided questions.
5. A short mastery check.

### After a wrong answer

1. Show the trusted canonical explanation.
2. Identify the misconception, when the distractor supports it.
3. Offer “Explain it another way” through the LLM.
4. Assign one isomorphic sibling immediately.
5. Schedule a different-context sibling later.

### Spaced review

Use a simple deterministic sequence:

- wrong: repair now and review tomorrow;
- first solid correct: two days;
- then four, seven, fourteen, and thirty days;
- lapse: reset to one day.

Require correct evidence on separate days and in mixed contexts before showing “mastered.”

## 10. Gamification

Use motivating feedback without punishing mistakes:

- XP for completing learning work, not only correct answers;
- a daily streak with one grace/freeze mechanism;
- skill nodes that move from Unmeasured → Learning → Practicing → Mastered → Review Due;
- weekly goal progress;
- celebratory moments at plan milestones.

Do not copy Duolingo's branding or exact visual language. Avoid “hearts” that lock a student out for making mistakes; errors are the evidence the tutor needs.

## 11. Lesson and video strategy

For MVP, lessons are short authored Markdown/MDX units. Curate YouTube resources manually by skill with:

- exact URL;
- title and channel;
- duration;
- section and skill tags;
- last-checked date;
- appropriateness and licensing notes.

Do not let the LLM invent or search for video URLs at runtime. Do not build a live YouTube search integration during the hackathon.

## 12. LLM responsibilities

Allowed:

- rephrase a stored explanation;
- give a Socratic hint grounded in the answer key and rationale;
- summarize why the plan focuses on specific skills;
- adjust reading level and tone;
- generate encouraging, evidence-based progress language.

Forbidden at runtime:

- decide the correct answer;
- calculate a score or mastery value;
- create an unreviewed scored question;
- invent a citation or video link;
- diagnose a disability;
- promise a score gain.

The first provider can be a free/open-weight Chinese model, but the product must use a provider adapter and a template fallback so the provider is replaceable.

## 13. MVP scope

### Must ship for the hackathon

- exact three-gate onboarding;
- both prior-score and no-score branches;
- rapid demo diagnostic plus architecture for the half-length form;
- original, reviewed question seed data;
- skill mastery and confidence;
- deterministic dated plan;
- one polished English weakness loop and one Math weakness loop;
- daily dashboard;
- lesson, practice, feedback, and plan update;
- AI re-explanation with static fallback;
- responsive deployed demo and seeded learner.

### Strong stretch goals

- full 66-question core diagnostic;
- optional Science path;
- account linking and cross-device sync;
- calendar editing;
- shareable result card;
- richer streak/XP animation;
- second progress checkpoint.

### Explicitly out of scope

- training or fine-tuning a model;
- real psychometric equating or official score claims;
- essay grading;
- live question generation;
- teacher/parent dashboards;
- payments;
- leaderboards/social feeds;
- native mobile apps;
- scraping ACT or commercial prep content.

## 14. Success metrics

Product funnel:

- onboarding completion;
- diagnostic start and completion;
- plan viewed;
- first lesson started and completed;
- first practice set completed;
- next-day return.

Learning quality:

- mastery change by skill;
- repeated misconception rate;
- due-review completion;
- timed accuracy and pacing trend;
- progress-check performance versus baseline.

Reliability:

- AI fallback rate;
- duplicate submission rate;
- content ambiguity reports;
- assessment resume success;
- production happy-path success.

## 15. MVP acceptance criteria

The MVP is complete when all of these are true:

1. A fresh visitor reaches the three onboarding questions immediately.
2. A scored learner receives a provisional plan without a full diagnostic.
3. A never-tested learner can complete the rapid diagnostic and receive a skill profile.
4. Different weaknesses produce visibly different plans.
5. Moving the test date changes plan intensity.
6. A practice answer updates mastery and schedules a future review.
7. Science never changes the Composite calculation.
8. The app works when the AI provider is disabled.
9. No draft question or answer key is exposed to the browser.
10. The full judge demo succeeds three consecutive times on the deployed site.
