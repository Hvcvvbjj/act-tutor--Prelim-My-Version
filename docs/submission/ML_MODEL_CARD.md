# Scout ACT adaptive-model card

## Decision summary

Scout uses three bounded adaptive layers:

1. **2PL Item Response Theory asks:** which unanswered ACT-aligned item should collect the most useful evidence now?
2. **Bayesian Knowledge Tracing asks:** which skill should the learner study next after that trusted evidence arrives?
3. **A structured LLM asks:** how should reviewed instructional material be explained for this learner and plan?

The LLM never scores an answer, chooses a correct key, mutates an ability estimate, awards XP, or changes mastery. Both probabilistic layers run locally without an API key.

## Model A — adaptive Precision Check

### Purpose

Reduce baseline uncertainty with fewer questions than another fixed form while preserving core-section coverage. This is an optional evidence-refinement step after score entry or the fixed, half-length diagnostic; it does not replace the 66-question blueprint-balanced baseline.

### Form

Scout uses a two-parameter logistic model:

```text
P(correct | theta, a, b) = 1 / (1 + exp(-1.7a(theta - b)))
information(theta) = (1.7a)^2 P(correct)(1 - P(correct))
```

`theta` is estimated with a `N(0, 1.5^2)` prior and a maximum-a-posteriori Newton update. The public payload includes the estimate, standard error, 80% model interval, and total information. Theta is clamped to `[-3, 3]` for numerical and presentation stability.

### Current item priors

| Reviewed difficulty band | Difficulty `b` | Discrimination `a` |
| ------------------------ | -------------: | -----------------: |
| Easy                     |          -1.05 |               1.05 |
| Medium                   |           0.00 |               1.20 |
| Hard                     |           1.05 |               1.35 |

These are product priors, not parameters estimated from official ACT response data. Scout therefore labels the output practice readiness and never converts theta into an official score prediction.

### Selection policy

Every unanswered candidate receives:

```text
selection score = Fisher information
                + section coverage boost
                + first-sample skill boost
```

The top five candidates, their scores, and the selected item’s explanation are public in the judge-facing interface. Answer-key data is not part of the selection input or public payload.

### Stop policy

- Minimum: 8 responses.
- Coverage: at least 2 responses in each of English, Math, and Reading.
- Precision: standard error at or below `0.56`.
- Hard cap: 12 responses, even if the precision condition is not met.

## Model B — twelve-skill Learning Twin

Each skill owns a BKT state with P(Learned), guess, slip, transition, predicted next-answer probability, uncertainty, and evidence count. Diagnostic evidence creates the prior. Every server-scored calibration or practice response performs an observation update and learning transition.

The next-skill policy is fully inspectable:

| Feature             | Weight |
| ------------------- | -----: |
| Knowledge gap       |    52% |
| Model uncertainty   |    24% |
| Evidence scarcity   |    14% |
| Recent lapse        |    10% |

The evidence ledger records source, correctness, difficulty, P(Learned) before/after, and P(Correct next). Calibration evidence affects the model but intentionally awards no XP or practice mastery.

## Model C — bounded lesson composer

The optional OpenAI-compatible provider receives the selected reviewed lesson foundation, the learner’s non-sensitive plan context, and a strict JSON contract. Output is validated before display. A missing, slow, or malformed provider response falls back to reviewed deterministic teaching. The interface discloses which path produced each lesson.

## Trust and misuse controls

- Answer keys and rationales remain server-only until a response is scored.
- Calibration questions must be answered in the server-selected order.
- Repeated identical submissions replay the same evidence so a transient BKT-sync failure can recover safely; BKT deduplicates the event and conflicting retries are rejected.
- Only server-scored evidence can reach IRT/BKT.
- Representative judge evidence is visibly labeled and never presented as a real learner record.
- Model outputs are labeled as practice readiness, not an official ACT score or score guarantee.
- File persistence uses queued atomic writes with restrictive file permissions for the local demo.

## Tests and acceptance criteria

Automated tests cover probability monotonicity, harder-item behavior, peak information near item difficulty, directional MAP updates, uncertainty reduction, section coverage, minimum/cap stop rules, ordered submission, key sanitization, persistence, retries, representative seeding, and IRT-to-BKT integration.

Before submission, the model passes only if:

- a live answer visibly changes theta or uncertainty;
- the same trusted evidence appears in the BKT ledger;
- keys do not appear in unanswered client payloads;
- the stop rule cannot end before the evidence floor;
- long evidence histories report complete counts while limiting rendered ledger rows; and
- all core, content, server, type, lint, production-build, desktop, and mobile checks pass.

## Known limits and responsible next steps

- Current IRT and BKT parameters are reviewed product priors, not population-calibrated estimates.
- The item bank is original and ACT-shaped but has not undergone official ACT review or equating.
- A single theta is useful for short-form item selection but does not replace the twelve skill states.
- Longitudinal outcome evidence is still needed before making learning-gain claims.

The production research path is to estimate item and transition parameters from consented response data, test differential item functioning, compare adaptive and fixed-form routes, monitor calibration error by subgroup, and retain the current human-review and server-scoring boundaries.
