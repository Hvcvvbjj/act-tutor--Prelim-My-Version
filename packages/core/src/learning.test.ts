import { describe, expect, it } from "vitest";

import {
  applyPracticeAttempt,
  chooseNextSkill,
  createInitialMastery,
  decideFutureTask,
  type SkillDefinition,
} from "./learning";

const sentenceSkill: SkillDefinition = {
  slug: "sentence-boundaries",
  label: "Sentence boundaries",
  section: "english",
  category: "Conventions",
  diagnosticSkill: "sentence-boundaries",
};

const algebraSkill: SkillDefinition = {
  slug: "linear-equations",
  label: "Linear equations",
  section: "math",
  category: "Algebra",
  diagnosticSkill: "linear-equations",
};

describe("learning mastery", () => {
  it("seeds mastery from diagnostic evidence with a cautious prior", () => {
    const mastery = createInitialMastery(sentenceSkill, {
      correct: 0,
      total: 2,
    });

    expect(mastery.mastery).toBeCloseTo(0.25);
    expect(mastery.band).toBe("building");
    expect(mastery.evidence).toBe(2);
  });

  it("updates mastery and schedules quick repair after a miss", () => {
    const seed = createInitialMastery(sentenceSkill, { correct: 1, total: 2 });
    const result = applyPracticeAttempt(seed, {
      skill: "sentence-boundaries",
      correct: false,
      difficulty: "medium",
      answeredAt: "2026-07-12T12:00:00.000Z",
    });

    expect(result.mastery.mastery).toBeLessThan(seed.mastery);
    expect(result.mastery.streak).toBe(0);
    expect(result.mastery.lapses).toBe(1);
    expect(result.review.intervalDays).toBe(1);
    expect(result.review.nextReviewAt).toBe("2026-07-13T12:00:00.000Z");
  });

  it("extends spacing after correct evidence", () => {
    const seed = createInitialMastery(sentenceSkill, { correct: 2, total: 2 });
    const first = applyPracticeAttempt(seed, {
      skill: "sentence-boundaries",
      correct: true,
      difficulty: "hard",
      answeredAt: "2026-07-12T12:00:00.000Z",
    });

    expect(first.mastery.mastery).toBeGreaterThan(seed.mastery);
    expect(first.review.intervalDays).toBeGreaterThan(1);
  });

  it("treats a confident answer as stronger evidence than a guess", () => {
    const seed = createInitialMastery(sentenceSkill, { correct: 1, total: 2 });
    const sure = applyPracticeAttempt(seed, {
      skill: sentenceSkill.slug,
      correct: true,
      difficulty: "medium",
      confidence: "sure",
      answeredAt: "2026-07-12T12:00:00.000Z",
    });
    const guessed = applyPracticeAttempt(seed, {
      skill: sentenceSkill.slug,
      correct: true,
      difficulty: "medium",
      confidence: "guessing",
      answeredAt: "2026-07-12T12:00:00.000Z",
    });

    expect(sure.mastery.mastery).toBeGreaterThan(guessed.mastery.mastery);
  });

  it("keeps today's skill stable while letting the future task change", () => {
    const sentence = createInitialMastery(sentenceSkill, {
      correct: 2,
      total: 2,
    });
    const algebra = createInitialMastery(algebraSkill, {
      correct: 0,
      total: 2,
    });

    expect(chooseNextSkill([sentence, algebra]).skill).toBe("linear-equations");

    const decision = decideFutureTask(
      "sentence-boundaries",
      "sentence-boundaries",
      [sentence, algebra],
    );

    expect(decision.todaySkill).toBe("sentence-boundaries");
    expect(decision.nextSkill).toBe("linear-equations");
    expect(decision.changed).toBe(true);
  });
});
