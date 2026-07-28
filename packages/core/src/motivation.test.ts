import { describe, expect, it } from "vitest";

import {
  POINTS_PER_ACT_POINT,
  actScoreEquivalentFromPoints,
  actScoreImprovementFromPoints,
  buildMotivationBadges,
  pointsProgressToNextActPoint,
} from "./motivation";

describe("motivation points", () => {
  it("maps exactly 1,000 points to one ACT point of improvement", () => {
    expect(POINTS_PER_ACT_POINT).toBe(1_000);
    expect(actScoreImprovementFromPoints(1_000)).toBe(1);
    expect(actScoreImprovementFromPoints(2_500)).toBe(2.5);
    expect(actScoreEquivalentFromPoints(24, 2_500)).toBe(26.5);
  });

  it("caps the point-based score equivalent at 36", () => {
    expect(actScoreEquivalentFromPoints(35, 4_000)).toBe(36);
  });

  it("shows deterministic progress toward the next score point", () => {
    expect(pointsProgressToNextActPoint(2_350)).toEqual({
      completedActPoints: 2,
      pointsInCurrentActPoint: 350,
      pointsUntilNextActPoint: 650,
      progress: 0.35,
    });
  });

  it("rejects invalid points and scores", () => {
    expect(() => actScoreImprovementFromPoints(-1)).toThrow(
      "Points must be non-negative.",
    );
    expect(() => actScoreEquivalentFromPoints(37, 0)).toThrow(
      "Starting score must be between 1 and 36.",
    );
  });
});

describe("motivation badges", () => {
  it("builds streak, mastery, improvement, consistency, and milestone badges", () => {
    const badges = buildMotivationBadges({
      points: 1_200,
      currentStreak: 2,
      longestStreak: 4,
      completedLessons: 5,
      completedSets: 10,
      totalAnswered: 64,
      secureSkills: 2,
      totalSkills: 12,
    });

    expect(new Set(badges.map((item) => item.category))).toEqual(
      new Set(["streak", "mastery", "improvement", "consistency", "milestone"]),
    );
    expect(badges.find((item) => item.id === "streak-3")?.earned).toBe(true);
    expect(badges.find((item) => item.id === "mastery-first")?.earned).toBe(
      true,
    );
    expect(badges.find((item) => item.id === "improvement-1")?.earned).toBe(
      true,
    );
    expect(badges.find((item) => item.id === "improvement-3")?.progress).toBe(
      1.2,
    );
    expect(badges.find((item) => item.id === "consistency-10")?.earned).toBe(
      true,
    );
    expect(badges.find((item) => item.id === "milestone-100")?.earned).toBe(
      false,
    );
  });

  it("keeps the round-complete badge earned after a later round begins", () => {
    const badges = buildMotivationBadges({
      points: 0,
      currentStreak: 0,
      longestStreak: 0,
      completedLessons: 0,
      completedRounds: 1,
      completedSets: 0,
      totalAnswered: 0,
      secureSkills: 0,
      totalSkills: 12,
    });

    expect(badges.find((item) => item.id === "milestone-round")).toMatchObject({
      progress: 12,
      target: 12,
      earned: true,
    });
  });
});
