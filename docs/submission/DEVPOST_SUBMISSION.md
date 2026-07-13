# Scout ACT — every question earns its place

## One-line pitch

Scout ACT uses IRT to choose what to ask, BKT to choose what to teach, and a bounded LLM to choose how to explain it—while showing the learner every decision.

## Inspiration

ACT preparation usually fails in one of two directions: a static calendar treats every learner the same, while a generic chatbot can explain almost anything but does not know what the student has actually proved. We wanted the daily clarity and momentum of Duolingo, the rigor of ACT-shaped practice, and a transparent adaptation engine that a student can understand and trust.

## What it does

Scout begins with three inputs: goal score, current score or section scores, and test date. A learner without prior scores takes an original 66-question half-length diagnostic across English, Math, and Reading. That baseline becomes a skill-level route rather than a single opaque score. An 8–12 item adaptive Precision Check can then refine uncertainty by selecting the unanswered ACT-shaped item with the most Fisher information while preserving section coverage.

From there Scout builds a dated study plan, assigns an individualized lesson, serves ACT-shaped practice, schedules spaced reviews, preserves a mistake notebook, and runs mixed checkpoints and timed Test Day Lab rehearsals. Every trusted response updates a separate Bayesian Knowledge Tracing model for each of twelve ACT skills.

The Precision Check and Learning Twin make both adaptive decisions visible. Students can inspect:

- the current ability estimate, 80% interval, standard error, and item information;
- why the next item beat the other top candidates;
- the exact stop rule and section-coverage status;

- P(Learned): the latent probability that the skill has been acquired;
- P(Correct next): expected correctness on a fresh item;
- uncertainty: where Scout needs more evidence;
- the exact contribution of knowledge gap, uncertainty, evidence scarcity, and a recent lapse to the next-skill priority;
- a public evidence ledger showing how each response changed the model; and
- counterfactual readiness projections for additional evidence-rich sessions.

The two probabilistic models have separate jobs: 2PL IRT chooses the evidence to collect, and BKT chooses the skill to teach. An OpenAI-compatible LLM can then compose the lesson at the appropriate depth from reviewed content, diagnostic evidence, and the learner’s plan. A reviewed deterministic composer keeps the complete product runnable without an API key.

## How we built it

The app is a TypeScript monorepo using Next.js 16, React 19, pnpm workspaces, Tailwind CSS, Base UI, Vitest, and file-backed repositories for an immediately runnable hackathon build.

The core adaptation pipeline is:

1. a Bayesian 2PL IRT model ranks unanswered items by Fisher information plus coverage;
2. server-only answer keys score the selected response;
3. the IRT estimate and uncertainty update, and trusted skill evidence enters BKT;
4. Bayesian Knowledge Tracing updates P(Learned) using explicit guess, slip, and transition parameters;
5. an interpretable ranking function scores knowledge gap, uncertainty, evidence scarcity, and recent lapses;
6. the planner selects the next skill and rebalances only future work;
7. the lesson composer combines the selected skill with reviewed instructional content and learner evidence;
8. the UI exposes both model states and the audit trail instead of hiding them behind a chatbot.

Security and educational trust were product requirements. Correct choices and rationales stay on the server. Client payloads contain only public questions and post-answer feedback. XP, mastery, the Learning Twin, and scheduling are all controlled by server-verified evidence, not by LLM output.

## Creative use of AI/ML

AI is the control loop, not a decorative assistant. IRT determines which question will teach the system the most. BKT determines the next learning decision after every response. The language model has a bounded teaching role: it explains and sequences reviewed instructional material for the skill the learner model selected. The student can inspect all three layers and can still use the product when the generative provider is unavailable.

This hybrid design is intentional. A generative model is strong at explanation and reframing; it should not be trusted to invent answer keys, scoring, or mastery. The probabilistic student model provides repeatable decisions, while the LLM provides personalized teaching.

## Challenges

The hardest problem was making adaptation both useful and credible from sparse evidence. Short diagnostics can create false certainty, so the Precision Check exposes standard error, will not stop before eight items, requires coverage across every core section, and caps itself at twelve. The Learning Twin uses smoothed priors, exposes uncertainty, and actively prioritizes evidence scarcity. We also had to keep ACT-shaped content and answer keys protected while still showing judges a transparent evidence trail.

Another challenge was fitting a serious learning workflow into a product that feels encouraging rather than clinical. Scout’s field-notebook design, interactive mascot, daily mission, mistake repair, and evidence language turn the model into a coach rather than a black-box analytics page.

## Accomplishments

- Built a complete score-to-plan-to-lesson-to-practice loop.
- Built a Bayesian 2PL IRT adaptive Precision Check with visible candidate ranking and a precision stop rule.
- Wired every calibration answer into the twelve-skill BKT model without awarding fake XP.
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

Next we would calibrate IRT item and BKT transition parameters on consented longitudinal response data; test differential item functioning and calibration error by subgroup; add teacher and parent views; expand original reviewed item banks; and run outcome studies comparing Scout’s adaptive route with a fixed study plan.

## Built with

TypeScript, Next.js, React, Tailwind CSS, Base UI, pnpm, Vitest, two-parameter logistic Item Response Theory, Bayesian Knowledge Tracing, an OpenAI-compatible model integration, and original ACT-style educational content.

## Try the judge path

Run the app, then choose **Preview the adaptive demo** on the first screen. It loads a clearly labeled representative diagnostic profile and opens the complete product without requiring an account or API key.
