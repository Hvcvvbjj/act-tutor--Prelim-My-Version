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
| Cross-skill activity | Consecutive correct answers across different skills are labeled only as a cross-skill activity signal—not proof that learning transferred. |
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
| Pacing advice | Accuracy, speed, and combined controls change the advice shown beside the current enhanced ACT section clocks; they do not change timers. |
| Suggested time-pressure progression | A four-step reference explains how to move from untimed work to test pace. The current build does not automatically advance stages. |
| Section strategy trainer | Interactive answer/skip/flag/return choices teach no-penalty guessing and time protection. |
| Target-score simulator | English, Math, and Reading scenarios recalculate the current three-section Composite. |
| Test-date planner | The adaptive plan moves from instruction to timed work based on the selected test date. |
| Timed-practice guidance | Scout explains when a reviewed timed form is more useful than another short skill set; it does not turn skill estimates into a readiness gate. |
| Parallel-form assessment | Repair, retention, challenge, and recovery choose the least-exposed reviewed item form; Scout says when the local bank cannot provide a truly unseen item. |
| Exposure protection | Per-question attempts are tracked; high-exposure items are held back when an alternate exists. |
| Manual Composite scenarios | Learners enter hypothetical English, Math, and Reading scores and see only the resulting rounded average. The control explicitly does not predict future performance. |
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

## Read-only human handoff

| Feature | Product behavior |
| --- | --- |
| Coach Brief | A read-only learner summary names the strongest demonstrated skill, main misconception, evidence level, current and next missions, an offline teaching prompt, and what Scout still does not know. There is no unauthenticated teacher-edit surface. |
| Human handoff | The Coach Brief can be copied or printed, and the learner can export their own session data. Adults receive no write controls in guest mode. |

## Trust, governance, and data

| Feature | Product behavior |
| --- | --- |
| Why not this skill? | Recommendation contributions and the counterfactual compare the selected skill with the runner-up. |
| Model comparison | BKT 1.0 is compared with the simpler accuracy/mastery policy; each new decision stores both choices for historical replay, and older unrecorded counterfactuals visibly abstain. |
| Imported group-metric viewer | Consented local JSON rows supply precomputed selection, error, and stopping metrics. Scout averages and displays them but does not derive or verify a fairness audit from raw events. |
| Learner question history | Exact per-question exposure and misses produce learner-history states. The UI explicitly does not infer item quality from one learner. |
| Model abstention | Unsupported fairness, item-quality, and misconception claims visibly return “not enough evidence.” |
| Policy decision comparison | Adaptive, weakest-only, uncertainty exploration, and random rules show what each would choose for the current state. The UI explicitly says this is not an experiment or performance benchmark. |
| Private guest mode | No account is required; session data uses private cookies and local preferences. |
| Data export/delete | A JSON export is downloadable and all session/local Scout data can be permanently deleted. |
| Weak-connection sync | The latest lesson is cached locally; a scored answer that loses connection is queued on-device and replayed in order when online. The UI states that new grading and AI generation still require a connection. |
| Generation safety | Generated lessons are schema checked, grounded to reviewed terms, and rejected for answer leakage, leaked/official-item claims, or score guarantees. |

## Scout as the product-wide plain-English layer

- Persistent labeled **Ask Scout** launcher on desktop; a compact Scout mascot is docked inside the mobile navigation. The assistant opens as a side panel or bottom sheet.
- Screen-aware prompts, multi-turn history, progressive response structure, action chips, read-aloud, and technical receipts.
- Highlight any page text to reveal **Explain selection**.
- The client sends only a question, page, optional question ID, and selected text. The server derives test mode, attempt state, reviewed content, accommodations, and allowed help from cookie-bound sessions.
- Timed testing blocks content help and answer leakage; pre-attempt practice blocks direct answers while allowing a small hint.
- Responses carry source, question ID, skill ID, delivery mode, permissions, and validation checks.
- Explanation length, reading level, example style, fewer technical terms, and accommodations persist across the product.
