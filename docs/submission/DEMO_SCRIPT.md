# Two-minute demo script

Target runtime: **1:52–1:57**. The official rules state that content after 2:00 will not be viewed, so do not use the final three seconds as planned content.

## Before recording

- Run the app from the fork and open a clean browser window.
- Use a 1440 × 900 or similar desktop viewport at 100% zoom.
- Begin on the onboarding screen with **Preview the adaptive demo** visible.
- Confirm the console is clean and the generative lesson stamp honestly shows either AI-personalized or reviewed fallback.
- Practice the lesson-stage clicks and one answer before recording.
- Record only the app window. Do not show API keys, terminals, DevTools, local data files, or browser bookmarks.

## Script and actions

### 0:00–0:08 — The problem

**Say:** “Most ACT tools give every student the same calendar. Generic chatbots can explain a problem, but they do not know what the student has actually proved.”

**Show:** Scout onboarding. Keep the three-input premise visible.

### 0:08–0:18 — One-click learner profile

**Say:** “Scout starts with a score or a half-length diagnostic, a goal, and a test date. I’ll load a representative diagnostic profile.”

**Do:** Click **Preview the adaptive demo**.

### 0:18–0:31 — Daily mission

**Say:** “It turns that evidence into today’s mission: one targeted lesson, ACT-shaped practice, mistake repair, and a mixed checkpoint.”

**Show:** The Sentence Boundaries mission and the 0% diagnostic-evidence explanation. Briefly point to the four mission stages and Scout.

### 0:31–1:01 — The first adaptive decision

**Do:** Open **Calibrate**. The judge path preloads seven visibly labeled representative responses. Answer the eighth question.

**Say:** “Scout’s first model decides what to ask. This two-parameter IRT check scores every unanswered item by Fisher information plus coverage. I’ll submit one real, server-scored answer.”

**Show:** The selected ACT-shaped item, Why this item panel, theta and uncertainty band. Submit the answer and pause on the before/after strip and precision stop reason.

**Say:** “The estimate and uncertainty move live. Scout stops only after eight items, evidence from every core section, and the precision target—or at twelve. This is readiness evidence, not an official ACT score.”

### 1:01–1:27 — The second adaptive decision

**Do:** Open **Progress**.

**Say:** “That same trusted response enters a different model: twelve-skill Bayesian Knowledge Tracing. IRT chooses what to ask; BKT chooses what to teach. The ledger proves the handoff.”

**Show:** Calibration count, newest IRT calibration event, selected skill’s P(Learned), P(Correct next), uncertainty, and priority contributions.

**Say:** “The next skill is ranked from knowledge gap, uncertainty, evidence scarcity, and recent lapses—every contribution is inspectable.”

### 1:27–1:49 — Personalized teaching

**Do:** Return to **Today**, open the targeted lesson, and show the worked example, decision rule, and generation stamp.

**Say:** “The learner model chooses what to teach. An LLM can then assemble the lesson from reviewed content at the right depth. It never controls answer keys or scoring, and a reviewed fallback keeps the product fully runnable without a key.”

### 1:49–1:57 — Close

**Say:** “Scout is ACT prep where every question earns its place, every answer teaches the plan, and every decision can be inspected.”

**Show:** The lesson and Scout ACT mark.

## Recording rules

- Never say the model predicts an official ACT score. It predicts skill readiness and next-answer probability.
- Never imply the representative judge profile is a real student.
- If the live LLM is not configured, show the reviewed fallback stamp and keep the narration honest.
- Prefer one clean cut over rushing or exceeding two minutes.
- Add captions. Keep music quiet enough that every technical claim is clear.
