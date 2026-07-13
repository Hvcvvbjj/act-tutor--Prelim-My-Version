import { describe, expect, it } from "vitest";

import {
  applyKnowledgeObservation,
  buildLearningTwinForecast,
  buildLearningTwinSnapshot,
  compareLearningTwinSnapshots,
  createInitialKnowledgeState,
  recommendKnowledgeState,
} from "./learning-twin";

const skill = {
  slug: "sentence-boundaries",
  label: "Sentence boundaries",
  section: "english" as const,
  category: "Conventions",
  diagnosticSkill: "sentence-boundaries",
};

describe("Bayesian learning twin", () => {
  it("starts from direct diagnostic evidence when it exists", () => {
    const state = createInitialKnowledgeState(
      skill,
      { correct: 1, total: 4 },
      28,
    );

    expect(state.priorSource).toBe("diagnostic");
    expect(state.baselineEvidence).toBe(4);
    expect(state.learnedProbability).toBeCloseTo(2 / 6);
    expect(state.predictedCorrectProbability).toBeGreaterThan(0.3);
    expect(state.predictedCorrectProbability).toBeLessThan(0.5);
  });

  it("uses a cautious score prior when direct skill evidence is unavailable", () => {
    const low = createInitialKnowledgeState(skill, null, 18);
    const high = createInitialKnowledgeState(skill, null, 31);

    expect(low.priorSource).toBe("score-estimate");
    expect(high.learnedProbability).toBeGreaterThan(low.learnedProbability);
    expect(high.evidenceCount).toBe(0);
    expect(high.confidence).toBe("exploring");
  });

  it("raises and lowers the latent skill estimate from trusted responses", () => {
    const initial = createInitialKnowledgeState(skill, {
      correct: 1,
      total: 2,
    });
    const correct = applyKnowledgeObservation(initial, {
      questionId: "q1",
      correct: true,
      difficulty: "hard",
      observedAt: "2026-07-13T12:00:00.000Z",
    });
    const missed = applyKnowledgeObservation(correct.state, {
      questionId: "q2",
      correct: false,
      difficulty: "medium",
      observedAt: "2026-07-13T12:01:00.000Z",
    });

    expect(correct.state.learnedProbability).toBeGreaterThan(
      initial.learnedProbability,
    );
    expect(missed.state.learnedProbability).toBeLessThan(
      correct.state.learnedProbability,
    );
    expect(missed.event.questionId).toBe("q2");
    expect(missed.state.observations).toBe(2);
  });

  it("ranks a weak, uncertain skill ahead of a well-supported skill", () => {
    const weak = createInitialKnowledgeState(skill, { correct: 0, total: 2 });
    const secureSkill = {
      ...skill,
      slug: "linear-equations",
      label: "Linear equations",
      section: "math" as const,
    };
    let secure = createInitialKnowledgeState(secureSkill, {
      correct: 2,
      total: 2,
    });
    for (let index = 0; index < 5; index += 1) {
      secure = applyKnowledgeObservation(secure, {
        questionId: `math-${index}`,
        correct: true,
        difficulty: "medium",
        observedAt: `2026-07-13T12:0${index}:00.000Z`,
      }).state;
    }

    const recommendation = recommendKnowledgeState([secure, weak]);
    expect(recommendation.skill).toBe("sentence-boundaries");
    expect(recommendation.contributions).toHaveLength(4);
    expect(recommendation.reason).toContain("ranks first");
  });

  it("produces monotonic, explicitly non-score readiness forecasts", () => {
    const state = createInitialKnowledgeState(skill, { correct: 0, total: 2 });
    const forecast = buildLearningTwinForecast([state]);

    expect(forecast.map((item) => item.additionalSessions)).toEqual([
      0, 3, 6, 10,
    ]);
    expect(forecast[3].averageReadiness).toBeGreaterThan(
      forecast[0].averageReadiness,
    );
  });

  it("exposes only model evidence and public update history", () => {
    const state = createInitialKnowledgeState(skill, { correct: 0, total: 2 });
    const update = applyKnowledgeObservation(state, {
      questionId: "q-public",
      correct: false,
      difficulty: "easy",
      observedAt: "2026-07-13T12:00:00.000Z",
    });
    const snapshot = buildLearningTwinSnapshot({
      states: [update.state],
      events: [update.event],
      preferredSkill: skill.slug,
    });

    expect(snapshot.model.shortName).toBe("BKT");
    expect(snapshot.evidence).toEqual({
      total: 3,
      diagnostic: 2,
      practice: 1,
      calibration: 0,
      lastUpdatedAt: "2026-07-13T12:00:00.000Z",
    });
    expect(JSON.stringify(snapshot)).not.toContain("correctChoiceId");
  });

  it("counts the full evidence history while limiting the public ledger", () => {
    let state = createInitialKnowledgeState(skill, { correct: 1, total: 2 });
    const events = [];

    for (let index = 0; index < 15; index += 1) {
      const update = applyKnowledgeObservation(state, {
        questionId: `long-session-${index}`,
        correct: index % 3 !== 0,
        difficulty: "medium",
        observedAt: new Date(
          Date.UTC(2026, 6, 13, 12, index),
        ).toISOString(),
        source: index < 8 ? "calibration" : "practice",
      });
      state = update.state;
      events.push(update.event);
    }

    const snapshot = buildLearningTwinSnapshot({ states: [state], events });

    expect(snapshot.events).toHaveLength(12);
    expect(snapshot.events[0]?.questionId).toBe("long-session-14");
    expect(snapshot.evidence).toMatchObject({
      total: 17,
      diagnostic: 2,
      practice: 7,
      calibration: 8,
    });
  });

  it("explains one answer using the exact BKT event and recommendation change", () => {
    const beforeState = createInitialKnowledgeState(skill, {
      correct: 1,
      total: 2,
    });
    const otherSkill = createInitialKnowledgeState(
      {
        ...skill,
        slug: "linear-equations",
        label: "Linear equations",
        section: "math" as const,
      },
      { correct: 0, total: 2 },
    );
    const before = buildLearningTwinSnapshot({
      states: [beforeState, otherSkill],
      preferredSkill: skill.slug,
    });
    const update = applyKnowledgeObservation(beforeState, {
      questionId: "proof-question",
      correct: false,
      difficulty: "hard",
      observedAt: "2026-07-13T12:00:00.000Z",
      source: "calibration",
    });
    const after = buildLearningTwinSnapshot({
      states: [update.state, otherSkill],
      events: [update.event],
    });

    const comparison = compareLearningTwinSnapshots({
      before,
      after,
      skill: skill.slug,
      questionId: "proof-question",
    });

    expect(comparison).not.toBeNull();
    expect(comparison?.learnedBefore).toBe(update.event.learnedBefore);
    expect(comparison?.learnedAfter).toBe(update.event.learnedAfter);
    expect(comparison?.predictedCorrectAfter).toBe(
      update.event.predictedCorrectAfter,
    );
    expect(comparison?.recommendationBefore.label).toBeTruthy();
    expect(comparison?.recommendationAfter.label).toBeTruthy();
  });

  it("returns null when a snapshot does not contain the answered skill", () => {
    const snapshot = buildLearningTwinSnapshot({
      states: [createInitialKnowledgeState(skill, { correct: 1, total: 2 })],
    });

    expect(
      compareLearningTwinSnapshots({
        before: snapshot,
        after: snapshot,
        skill: "linear-equations",
      }),
    ).toBeNull();
  });
});
