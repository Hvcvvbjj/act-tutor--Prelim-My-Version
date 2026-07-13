# Scout ACT — an ACT tutor with a learning model you can inspect

## One-line pitch

Scout ACT turns every diagnostic and practice answer into an interpretable learner model, then uses that model to choose the next lesson, practice set, review, and test-day rehearsal.

## Inspiration

ACT preparation usually fails in one of two directions: a static calendar treats every learner the same, while a generic chatbot can explain almost anything but does not know what the student has actually proved. We wanted the daily clarity and momentum of Duolingo, the rigor of ACT-shaped practice, and a transparent adaptation engine that a student can understand and trust.

## What it does

Scout begins with three inputs: goal score, current score or section scores, and test date. A learner without prior scores takes an original 66-question half-length diagnostic across English, Math, and Reading. That baseline becomes a skill-level route rather than a single opaque score.

From there Scout builds a dated study plan, assigns an individualized lesson, serves ACT-shaped practice, schedules spaced reviews, preserves a mistake notebook, and runs mixed checkpoints and timed Test Day Lab rehearsals. Every trusted response updates a separate Bayesian Knowledge Tracing model for each of twelve ACT skills.

The Learning Twin makes the system visible. Students can inspect:

- P(Learned): the latent probability that the skill has been acquired;
- P(Correct next): expected correctness on a fresh item;
- uncertainty: where Scout needs more evidence;
- the exact contribution of knowledge gap, uncertainty, evidence scarcity, and a recent lapse to the next-skill priority;
- a public evidence ledger showing how each response changed the model; and
- counterfactual readiness projections for additional evidence-rich sessions.

The probabilistic model chooses what to teach. An OpenAI-compatible LLM can then compose the lesson at the appropriate depth from reviewed content, diagnostic evidence, and the learner’s plan. A reviewed deterministic composer keeps the complete product runnable without an API key.

## How we built it

The app is a TypeScript monorepo using Next.js 16, React 19, pnpm workspaces, Tailwind CSS, Base UI, Vitest, and file-backed repositories for an immediately runnable hackathon build.

The core adaptation pipeline is:

1. server-only answer keys score diagnostic or practice evidence;
2. Bayesian Knowledge Tracing updates P(Learned) using explicit guess, slip, and transition parameters;
3. an interpretable ranking function scores knowledge gap, uncertainty, evidence scarcity, and recent lapses;
4. the planner selects the next skill and rebalances only future work;
5. the lesson composer combines the selected skill with reviewed instructional content and learner evidence;
6. the UI exposes the model state and audit trail instead of hiding it behind a chatbot.

Security and educational trust were product requirements. Correct choices and rationales stay on the server. Client payloads contain only public questions and post-answer feedback. XP, mastery, the Learning Twin, and scheduling are all controlled by server-verified evidence, not by LLM output.

## Creative use of AI/ML

AI is the control loop, not a decorative assistant. The Bayesian model determines the next learning decision after every response. The language model has a bounded teaching role: it explains and sequences reviewed instructional material for the skill the learner model selected. The student can inspect both layers and can still use the product when the generative provider is unavailable.

This hybrid design is intentional. A generative model is strong at explanation and reframing; it should not be trusted to invent answer keys, scoring, or mastery. The probabilistic student model provides repeatable decisions, while the LLM provides personalized teaching.

## Challenges

The hardest problem was making adaptation both useful and credible from sparse evidence. Short diagnostics can create false certainty, so the model uses smoothed priors, exposes uncertainty, and actively prioritizes evidence scarcity. We also had to keep ACT-shaped content and answer keys protected while still showing judges a transparent evidence trail.

Another challenge was fitting a serious learning workflow into a product that feels encouraging rather than clinical. Scout’s field-notebook design, interactive mascot, daily mission, mistake repair, and evidence language turn the model into a coach rather than a black-box analytics page.

## Accomplishments

- Built a complete score-to-plan-to-lesson-to-practice loop.
- Implemented twelve live Bayesian skill models with persistent update history.
- Made the next-skill recommendation inspectable at the feature-contribution level.
- Kept answer keys and scoring server-side.
- Added original half-length diagnostic and ACT-shaped question content.
- Added personalized lessons, spaced reviews, mistake repair, mixed checkpoints, an adaptive calendar, and timed Test Day Lab rehearsals.
- Made the full experience work without an account or paid model key.
- Added automated core, content, server, type, lint, and production-build checks.

## What we learned

Personalization is not just generating different words for each student. It requires a durable learner state, trustworthy evidence, an explicit decision policy, and a way for the learner to understand why the system changed. The most useful AI tutoring experience is a collaboration between probabilistic modeling, reviewed pedagogy, generative explanation, and human-visible controls.

## What is next

Next we would calibrate guess, slip, and transition parameters on consented longitudinal response data; add teacher and parent views; expand original reviewed item banks; add speech-based Socratic coaching; and run learning-outcome studies comparing Scout’s adaptive route with a fixed study plan.

## Built with

TypeScript, Next.js, React, Tailwind CSS, Base UI, pnpm, Vitest, Bayesian Knowledge Tracing, an OpenAI-compatible Responses API integration, and original ACT-style educational content.

## Try the judge path

Run the app, then choose **Preview the adaptive demo** on the first screen. It loads a clearly labeled representative diagnostic profile and opens the complete product without requiring an account or API key.
