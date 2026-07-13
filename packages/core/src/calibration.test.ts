import { describe, expect, it } from "vitest";

import {
  CALIBRATION_MAX_ITEMS,
  calibrationStopDecision,
  estimateAbility,
  irtItemInformation,
  irtProbabilityCorrect,
  parametersForDifficulty,
  selectNextCalibrationItem,
  type CalibrationItemDescriptor,
  type CalibrationObservation,
} from "./calibration";

const sections = ["english", "math", "reading"] as const;

function item(
  id: string,
  section: (typeof sections)[number],
  difficulty: "easy" | "medium" | "hard" = "medium",
): CalibrationItemDescriptor {
  return {
    id,
    section,
    skill: `${section}-skill`,
    skillLabel: `${section} skill`,
    difficulty,
    parameters: parametersForDifficulty(difficulty),
  };
}

function observation(
  descriptor: CalibrationItemDescriptor,
  correct: boolean,
): CalibrationObservation {
  return {
    ...descriptor,
    correct,
    answeredAt: "2026-07-13T12:00:00.000Z",
  };
}

describe("2PL adaptive calibration", () => {
  it("raises correctness probability as ability rises", () => {
    const parameters = parametersForDifficulty("medium");
    expect(irtProbabilityCorrect(1, parameters)).toBeGreaterThan(
      irtProbabilityCorrect(-1, parameters),
    );
  });

  it("makes harder items less likely at the same ability", () => {
    expect(
      irtProbabilityCorrect(0, parametersForDifficulty("easy")),
    ).toBeGreaterThan(
      irtProbabilityCorrect(0, parametersForDifficulty("hard")),
    );
  });

  it("maximizes information near an item's difficulty", () => {
    const parameters = parametersForDifficulty("hard");
    expect(
      irtItemInformation(parameters.difficulty, parameters),
    ).toBeGreaterThan(irtItemInformation(-2, parameters));
  });

  it("moves the MAP ability estimate with trusted outcomes", () => {
    const bank = [
      item("e1", "english"),
      item("m1", "math"),
      item("r1", "reading"),
    ];
    const correct = estimateAbility(
      bank.map((entry) => observation(entry, true)),
    );
    const missed = estimateAbility(
      bank.map((entry) => observation(entry, false)),
    );
    expect(correct.theta).toBeGreaterThan(0);
    expect(missed.theta).toBeLessThan(0);
    expect(correct.theta).toBeGreaterThan(missed.theta);
  });

  it("shrinks uncertainty as informative evidence accumulates", () => {
    const first = item("e1", "english");
    const many = Array.from({ length: 9 }, (_, index) =>
      item(`q${index}`, sections[index % sections.length]),
    );
    expect(
      estimateAbility(
        many.map((entry, index) => observation(entry, index % 2 === 0)),
      ).standardError,
    ).toBeLessThan(estimateAbility([observation(first, true)]).standardError);
  });

  it("covers an unseen core section before resampling a covered one", () => {
    const bank = [
      item("e1", "english"),
      item("e2", "english"),
      item("m1", "math"),
      item("r1", "reading"),
    ];
    const selection = selectNextCalibrationItem(bank, [
      observation(bank[0], true),
      observation(bank[2], false),
    ]);
    expect(selection?.candidates[0].section).toBe("reading");
  });

  it("does not stop before the minimum evidence floor", () => {
    const observations = Array.from({ length: 7 }, (_, index) =>
      observation(item(`q${index}`, sections[index % 3]), index % 2 === 0),
    );
    expect(calibrationStopDecision(observations, 30).complete).toBe(false);
  });

  it("always stops at the item cap", () => {
    const observations = Array.from(
      { length: CALIBRATION_MAX_ITEMS },
      (_, index) =>
        observation(item(`q${index}`, sections[index % 3]), index % 2 === 0),
    );
    expect(calibrationStopDecision(observations, 30)).toMatchObject({
      complete: true,
      reason: expect.stringContaining("evidence cap"),
    });
  });
});
