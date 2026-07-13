import { describe, expect, it } from "vitest";

import { createInitialMastery } from "./learning";
import {
  buildDueReviews,
  calculateLearningStreak,
  learnerLevel,
  xpForPractice,
} from "./mission";

const skill = {
  slug: "sentence-boundaries",
  label: "Sentence boundaries",
  section: "english",
  category: "Conventions",
  diagnosticSkill: "sentence-boundaries",
} as const;

describe("daily mission progression", () => {
  it("keeps a streak alive through today or yesterday", () => {
    const dates = ["2026-07-09", "2026-07-10", "2026-07-11"];
    expect(calculateLearningStreak(dates, "2026-07-12T09:00:00.000Z")).toBe(3);
    expect(calculateLearningStreak([...dates, "2026-07-12"], "2026-07-12T09:00:00.000Z")).toBe(4);
    expect(calculateLearningStreak(dates, "2026-07-14T09:00:00.000Z")).toBe(0);
  });

  it("calculates deterministic levels and difficulty-weighted XP", () => {
    expect(learnerLevel(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNextLevel: 250 });
    expect(learnerLevel(275)).toEqual({ level: 2, xpIntoLevel: 25, xpForNextLevel: 250 });
    expect(xpForPractice(true, "hard")).toBeGreaterThan(xpForPractice(true, "easy"));
    expect(xpForPractice(false, "hard")).toBe(3);
  });

  it("orders due reviews before upcoming work", () => {
    const overdue = {
      ...createInitialMastery(skill, { correct: 1, total: 2 }),
      nextReviewAt: "2026-07-10T12:00:00.000Z",
    };
    const upcoming = {
      ...createInitialMastery({ ...skill, slug: "punctuation" }),
      nextReviewAt: "2026-07-14T12:00:00.000Z",
    };
    const reviews = buildDueReviews([upcoming, overdue], "2026-07-12T12:00:00.000Z");
    expect(reviews.map((review) => review.urgency)).toEqual(["overdue", "upcoming"]);
  });
});
