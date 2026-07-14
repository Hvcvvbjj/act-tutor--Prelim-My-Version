# Scout feature ledger

This is the implementation contract for the hackathon build. A feature is not counted because copy mentions it; it must have a learner-visible control, a server or browser state change, and an honest empty/uncertain state.

## Ten headline requirements

| Requirement | Implementation proof |
| --- | --- |
| What would change the plan? | My Skills shows the held/changed state, current evidence, change line, responses needed, and correct/incorrect counterfactual from `planCounterfactual`. |
| Adaptive Precision Check | Quick Check uses 2PL IRT, section coverage, item information, an 8–12 item stop rule, a stop explanation, confidence input, an optional 66-question diagnostic, and a button that rebuilds a no-score learner's plan from the completed baseline. |
| Complete learning loop | Mission → personalized lesson → worked example → guided practice → independent exit ticket → mastery update → scheduled retention. A failed exit ticket changes explanation style; repair uses a different question; teach-back uses a three-part rubric. |
| Decision history | Evidence Timeline records the answer, information value, skill estimate change, plan change/hold, protected current mission, misconception, and model version. |
| Spaced review | Reviews use prior state and time since practice, explain the forgetting window, and launch an exact two-question retention session. Mission purposes distinguish new learning, repair, confidence building, and retention. |
| Coach Brief | My Skills provides the strongest skill, main misconception, certainty, evidence count, current/next mission, offline intervention, and unknowns with copy/print support. |
| Goal-aware planning | Onboarding and Plan use target score, test date, study days, minutes per session, preferred domain, availability, capacity tradeoffs, and no-shame catch-up. |
| Grounded-generation receipts | Every lesson exposes the objective, reviewed rule, evidence question IDs, provider status, validation result/checks, and generated/fallback delivery. Unsafe or malformed AI output falls back to reviewed content. |
| Interactive skill map | Fill means mastery, border means certainty, size means score impact, arrows mean prerequisite order, badges mean today/next/review, and selection opens the evidence inspector. |
| Accessibility accommodations | Reduced motion, larger text, higher contrast, keyboard emphasis, read-aloud, simplified wording, extended Test Lab time, and distraction reduction persist locally. Explanation preferences are collected during onboarding. |

## Learner model

| Feature | Product behavior |
| --- | --- |
| Misconception fingerprinting | Groups unresolved misses by the exact distractor misconception, skill, count, and evidence item. |
| Answer confidence | Sure, Unsure, and Guessing are collected in practice and Quick Check; guesses receive less skill-model weight. |
| Self-correction | Practice records the first choice and whether the learner changed it before scoring. |
| Response-time interpretation | Median time feeds pacing advice and is explicitly excluded from mastery penalties, including accommodation use. |
| Cross-skill/prerequisite confusion | Scout checks a defined prerequisite graph and recommends prerequisite repair before returning to the target skill. |
| Transfer detection | Consecutive correct evidence across different skills produces a transfer signal; otherwise Scout abstains. |
| Knowledge decay | Due reviews expose time since practice and the predicted forgetting window. |
| Learner correction | “Scout got this wrong about me” records a bounded correction, preserves original evidence, reruns the next-skill policy, and keeps an audit trail. |
| Mastery versus certainty | Scout Lab displays the skill estimate and certainty as separate values with plain-language meaning. |
| Exploration questions | The model names the highest-uncertainty skill and checkpoints include uncertainty-seeking items. |

## Teaching system

| Feature | Product behavior |
| --- | --- |
| Socratic hint ladder | Guided practice has graduated hints; the independent exit ticket stays hint-free. |
| Teach-back mode | Learner explanation is scored for naming the rule, explaining why, and giving an example. |
| Two-solution comparison | Worked examples compare the correct path with the tempting wrong path. |
| Alternate explanations | Normal, concise, analogy, visual, step-by-step, compare-choice, and simple views are available. |
| Error journal | Misses persist with selected/correct choices, rationale, misconception, attempt count, and resolution state. |
| Personalized examples | Learner-selected school, sports, gaming, or everyday contexts change worked-example framing. |
| Mistake replay | Repair selects a different, least-exposed question in the same skill and resolves the original misconception on success. |
| Progressive independence | Lesson → worked example → hints → independent exit ticket → delayed review removes support in stages. |
| Prerequisite repair | The learner model identifies weak prerequisites and names the repair-return path. |
| Mastery challenge | A three-question harder set lets a learner prove a skill instead of repeating the full lesson. |
| Lesson-quality feedback | “Helped” and “Still confusing” are persisted by skill and explanation style. |
| AI escalation | Two confusion/rejection signals replace AI output with the reviewed fallback. |

## ACT preparation

| Feature | Product behavior |
| --- | --- |
| Pacing coach | Accuracy, speed, and combined modes use the current enhanced ACT section clocks. |
| Time-pressure ramp | Untimed learning progresses through extended, standard, and pressure-finish stages. |
| Section strategy trainer | Interactive answer/skip/flag/return choices teach no-penalty guessing and time protection. |
| Target-score simulator | English, Math, and Reading scenarios recalculate the current three-section Composite. |
| Test-date planner | The adaptive plan moves from instruction to timed work based on the selected test date. |
| Readiness gate | Full timed work is recommended only when the score scenario and evidence certainty both clear their gates. |
| Parallel-form assessment | Repair, retention, challenge, and recovery choose the least-exposed reviewed item form; Scout says when the local bank cannot provide a truly unseen item. |
| Exposure protection | Per-question attempts are tracked; high-exposure items are held back when an alternate exists. |
| Predicted versus actual | Learners enter a timed result and Scout explains whether the skill estimate or pacing is miscalibrated. |
| Composite scenarios | Scenario controls show how section changes alter the Composite and whether the goal is reached. |
| ACT blueprint | Scout Lab shows current questions, minutes, average pace, optional Science, and official reporting-category percentages. |

## Planning and motivation

| Feature | Product behavior |
| --- | --- |
| Missed-day replanning | Plan marks missed work and rebalances future tasks without changing completed work or shaming the learner. |
| Three-minute mode | A real server session contains one shortened lesson and one question. |
| Session energy | Low, normal, and challenge choices recommend the appropriate session shape. |
| Effort versus progress | Scout compares trusted answers with average readiness and names stable skills. |
| Mastery streak | The product emphasizes stable skills and retained learning, not login-only streaks. |
| Weekly reflection | A learner reflection persists on the device and remains available offline. |
| Goal tradeoffs | Plan explains capacity, score movement, preferred section, and what cannot fit. |
| Recovery sessions | A two-question, two-priority-skill reset restores momentum without breaking progress. |

## Teacher, tutor, and parent tools

| Feature | Product behavior |
| --- | --- |
| Intervention queue | Skills are sorted by readiness and certainty with the evidence count visible. |
| Tutor override | A human can choose the next skill only with a saved reason; the current unfinished mission remains protected. |
| AI-content approval | A teacher can review and edit the main explanation, save the edited version with a human-review receipt, approve it, or reject it into reviewed fallback content. |
| Cohort heatmap | A teacher can import multiple consented Scout JSON exports; aggregation happens locally in the browser. With no files, Scout makes no cohort claim. |
| Assignment builder | Selected skills produce a lesson, guided practice, exit ticket, and retention assignment pattern. |
| Student conference | A concise ask/listen/try/do-not-assume script uses the learner's actual brief. |
| Parent digest | A plain-language digest can be copied without exposing a giant analytics dashboard. |
| Human handoff | Coach brief, misconceptions, teach-back, evidence IDs, and unknowns export as a tutor handoff. |

## Trust, governance, and data

| Feature | Product behavior |
| --- | --- |
| Why not this skill? | Recommendation contributions and the counterfactual compare the selected skill with the runner-up. |
| Model comparison | BKT 1.0 is compared with the simpler accuracy/mastery policy; each new decision stores both choices for historical replay, and older unrecorded counterfactuals visibly abstain. |
| Fairness audit | Consented local JSON records compare question-selection rate, prediction error, and stopping time by group. Without two sufficiently represented groups, the dashboard explicitly abstains. |
| Item health | Repeated exposure and misses produce healthy/watch/not-enough-data states. |
| Bad-question detection | Consented cohort imports flag an item when at least three high-readiness learners independently choose the same wrong idea; it never auto-declares an item bad from one response. |
| Model abstention | Unsupported fairness, item-quality, and misconception claims visibly return “not enough evidence.” |
| Policy benchmark | Adaptive, weakest-only, uncertainty exploration, and random policies show next-skill tradeoffs and can run a seeded 100-learner, 20-session synthetic comparison. |
| Private guest mode | No account is required; session data uses private cookies and local preferences. |
| Data export/delete | A JSON export is downloadable and all session/local Scout data can be permanently deleted. |
| Weak-connection sync | The latest lesson is cached locally; a scored answer that loses connection is queued on-device and replayed in order when online. The UI states that new grading and AI generation still require a connection. |
| Generation safety | Generated lessons are schema checked, grounded to reviewed terms, and rejected for answer leakage, leaked/official-item claims, or score guarantees. |

## Scout as the product-wide plain-English layer

- Persistent labeled **Ask Scout** launcher; side panel on desktop and bottom sheet on mobile.
- Screen-aware prompts, multi-turn history, progressive response structure, action chips, read-aloud, and technical receipts.
- Highlight any page text to reveal **Explain selection**.
- Explicit `TEST_MODE`, `CAN_HINT`, `CAN_REPHRASE`, and `CAN_EXPLAIN_AFTER_ATTEMPT` permissions are sent with each request.
- Timed testing blocks content help and answer leakage; pre-attempt practice blocks direct answers while allowing a small hint.
- Responses carry source, question ID, skill ID, delivery mode, permissions, and validation checks.
- Explanation length, reading level, example style, fewer technical terms, and accommodations persist across the product.
