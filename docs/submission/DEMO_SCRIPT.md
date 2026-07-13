# Two-minute demo script

Target runtime: **1:52–1:57**. The official rules state that content after 2:00 will not be viewed, so do not use the final three seconds as planned content.

## Before recording

- Run the app from the fork and open a clean browser window.
- Use a 1440 × 900 or similar desktop viewport at 100% zoom.
- Begin on the onboarding screen with **See one answer change the plan** visible.
- Confirm the console is clean and the generative lesson stamp honestly shows either AI-personalized or reviewed fallback.
- Practice the lesson-stage clicks and one answer before recording.
- Record only the app window. Do not show API keys, terminals, DevTools, local data files, or browser bookmarks.

## Script and actions

### 0:00–0:08 — The problem

**Say:** “Most ACT tools give every student the same calendar. Generic chatbots can explain a problem, but they do not know what the student has actually proved.”

**Show:** Scout onboarding. Keep the three-input premise visible.

### 0:08–0:18 — One-click learner profile

**Say:** “Scout starts with a score or a half-length diagnostic, a goal, and a test date. I’ll load a representative diagnostic profile.”

**Do:** Click **See one answer change the plan**. The app opens directly on the last Quick Check question.

### 0:18–0:43 — One answer, three visible changes

**Say:** “Seven example answers are already loaded and labeled. Scout picked this last question because it matches the student’s current level and will teach the model something useful.”

**Show:** The ACT-shaped ratio question, current practice level, margin of error, and the plain-English “Why this question?” panel. Select B, 12, and submit.

**Say:** “One scored answer now changes three things in the same screen: the overall practice estimate, the exact Ratios and percent skill estimate, and the next lesson choice.”

**Show:** Pause on the proof replay: 52 to 54, 50% to 83%, and Punctuation and commas held steady.

**Say:** “The lesson stayed put because punctuation still needs more work. A trustworthy tutor should not reshuffle the plan just to look dramatic.”

### 0:43–1:08 — Inspect the decision

**Do:** Click **Open My Skills**.

**Say:** “The numbers are not decoration. Every scored answer is saved in the evidence history. The skill model ranks what to teach from the size of the gap, how unsure it is, how much evidence it has, and whether the student just missed one.”

**Show:** Ratios and percent, the newest Quick Check event, P(Learned), predicted next-answer chance, and the Punctuation and commas recommendation.

**Say:** “Under the hood, IRT chooses what to ask and Bayesian Knowledge Tracing chooses what to teach. Judges can inspect the handoff instead of trusting an AI claim.”

### 1:08–1:40 — Personalized teaching

**Do:** Open **Today**, then open the targeted lesson.

**Say:** “Scout turns that decision into a full lesson, a worked example, a rule to remember, and ACT-shaped practice. The explanation can be assembled by a local Qwen model, while reviewed content keeps the app working without an AI connection.”

**Show:** The lesson stages, Scout’s teaching prompt, diagnostic reason, and the honest AI-personalized or reviewed-fallback label.

**Say:** “The language model never controls answer keys, scores, or the skill model. It only helps explain reviewed material at the right level.”

### 1:40–1:57 — Close

**Say:** “Scout is an ACT tutor that can show why it asked the question, what it learned from the answer, and why that changed—or did not change—the next lesson.”

**Show:** The lesson and Scout ACT mark.

## Recording rules

- Never say the model predicts an official ACT score. It predicts skill readiness and next-answer probability.
- Never imply the representative judge profile is a real student.
- If the live LLM is not configured, show the reviewed fallback stamp and keep the narration honest.
- Prefer one clean cut over rushing or exceeding two minutes.
- Add captions. Keep music quiet enough that every technical claim is clear.
