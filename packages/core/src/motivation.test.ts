import { describe, expect, it } from "vitest";

import {
  POINTS_PER_MOMENTUM_LEVEL,
  buildMotivationBadges,
  pointsProgressToNextMomentumLevel,
} from "./motivation";

describe("motivation points", () => {
  it("uses exactly 1,000 points per momentum level", () => {
    expect(POINTS_PER_MOMENTUM_LEVEL).toBe(1_000);
  });

  it("shows deterministic progress toward the next momentum level", () => {
    expect(pointsProgressToNextMomentumLevel(2_350)).toEqual({
      completedLevels: 2,
      pointsInCurrentLevel: 350,
      pointsUntilNextLevel: 650,
      progress: 0.35,
    });
  });

  it("rejects invalid points", () => {
    expect(() => pointsProgressToNextMomentumLevel(-1)).toThrow(
      "Points must be non-negative.",
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
    expect(badges.find((item) => item.id === "improvement-3")).toMatchObject({
      progress: 1_200,
      target: 3_000,
    });
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
