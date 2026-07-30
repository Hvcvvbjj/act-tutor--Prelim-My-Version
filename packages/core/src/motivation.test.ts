import { describe, expect, it } from "vitest";

import {
  POINTS_PER_MOMENTUM_LEVEL,
  STUDY_POINTS_PER_ESTIMATED_ACT_POINT,
  buildBadgeEvolutionEvents,
  buildLearningRoundRewardSummary,
  buildLessonRewardNarrationPrompt,
  buildLessonRewardSummary,
  buildMotivationBadges,
  estimatedActPointEquivalentForStudyPoints,
  pointsProgressToNextMomentumLevel,
} from "./motivation";

describe("motivation points", () => {
  it("uses exactly 1,000 points per momentum level", () => {
    expect(POINTS_PER_MOMENTUM_LEVEL).toBe(1_000);
    expect(STUDY_POINTS_PER_ESTIMATED_ACT_POINT).toBe(1_000);
    expect(estimatedActPointEquivalentForStudyPoints(2_350)).toBe(2.35);
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

describe("completion rewards", () => {
  const progress = {
    currentStreak: 1,
    longestStreak: 1,
    completedRounds: 0,
    secureSkills: 0,
    totalSkills: 12,
  };

  it("reports exact lesson points and only badges earned in that lesson", () => {
    const summary = buildLessonRewardSummary({
      id: "lesson-reward-1",
      lessonCheckId: "check-1",
      roundNumber: 1,
      skill: "linear-equations",
      skillLabel: "Linear equations",
      before: {
        ...progress,
        points: 940,
        completedLessons: 0,
        completedSets: 9,
        totalAnswered: 95,
      },
      after: {
        ...progress,
        points: 1_040,
        completedLessons: 1,
        completedSets: 10,
        totalAnswered: 100,
      },
    });

    expect(summary).toMatchObject({
      pointsBefore: 940,
      pointsAfter: 1_040,
      pointsGained: 100,
      pointsTowardNextEstimatedActPoint: 40,
      progressToNextEstimatedActPoint: 0.04,
    });
    expect(new Set(summary.newlyEarnedBadges.map((badge) => badge.id))).toEqual(
      new Set(["improvement-1", "consistency-10", "milestone-100"]),
    );
    expect(
      summary.badgeEvents.find((event) => event.badge.id === "consistency-10"),
    ).toMatchObject({
      kind: "evolved",
      previousBadge: expect.objectContaining({ id: "consistency-3" }),
    });
    expect(summary.growth).toHaveLength(5);
    expect(buildLessonRewardNarrationPrompt(summary)).toContain(
      "Linear equations",
    );
  });

  it("reports assessment score movement separately from point equivalence", () => {
    const reward = buildLearningRoundRewardSummary({
      id: "round-reward-1",
      completedRoundNumber: 1,
      assessmentKind: "diagnostic",
      pointsBefore: 200,
      pointsAfter: 1_450,
      estimatedActScoreBefore: 24,
      estimatedActScoreAfter: 26,
    });
    expect(reward).toMatchObject({
      id: "round-reward-1",
      completedRoundNumber: 1,
      nextRoundNumber: 2,
      assessmentKind: "diagnostic",
      pointsBefore: 200,
      pointsAfter: 1_450,
      pointsGained: 1_250,
      studyPointActEquivalent: 1.25,
      estimatedActScoreBefore: 24,
      estimatedActScoreAfter: 26,
      estimatedActScoreDelta: 2,
    });
    expect(reward.badgeEvents.map((event) => event.badge.id)).toEqual(
      expect.arrayContaining([
        "score-improvement-2",
        "improvement-1",
        "milestone-round",
      ]),
    );
    expect(reward.growth.map((axis) => axis.id)).toEqual([
      "score",
      "points",
      "improvement",
      "round",
    ]);
  });
});

describe("motivation badges", () => {
  it("builds substantial tiered streak, mastery, section, improvement, consistency, volume, and round badges", () => {
    const badges = buildMotivationBadges({
      points: 1_200,
      currentStreak: 2,
      longestStreak: 4,
      completedLessons: 5,
      completedSets: 10,
      totalAnswered: 64,
      secureSkills: 2,
      totalSkills: 12,
      consistentWeeks: 1,
      estimatedActImprovement: 1,
      skillProgress: [
        {
          skill: "linear-equations",
          label: "Linear equations",
          section: "math",
          readiness: 0.84,
        },
        {
          skill: "sentence-boundaries",
          label: "Sentence boundaries",
          section: "english",
          readiness: 0.62,
        },
        {
          skill: "supported-inference",
          label: "Supported inference",
          section: "reading",
          readiness: 0.48,
        },
      ],
    });

    expect(new Set(badges.map((item) => item.category))).toEqual(
      new Set([
        "streak",
        "mastery",
        "section",
        "improvement",
        "consistency",
        "volume",
        "round",
      ]),
    );
    expect(badges.length).toBeGreaterThanOrEqual(50);
    expect(new Set(badges.map((badge) => badge.icon)).size).toBeGreaterThan(8);
    expect(new Set(badges.map((badge) => badge.tone)).size).toBeGreaterThan(3);
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
    expect(
      badges.find((item) => item.id === "score-improvement-1")?.earned,
    ).toBe(true);
    expect(
      badges.find((item) => item.id === "score-improvement-5")?.earned,
    ).toBe(false);
    expect(
      badges.find((item) => item.id === "skill:linear-equations:gold"),
    ).toMatchObject({
      earned: true,
      tier: "gold",
      familyId: "skill-mastery:linear-equations",
    });
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
      progress: 1,
      target: 1,
      earned: true,
    });
  });

  it("reports a family evolution instead of replaying every prior tier", () => {
    const base = {
      points: 0,
      currentStreak: 0,
      completedLessons: 0,
      completedRounds: 0,
      completedSets: 0,
      totalAnswered: 0,
      secureSkills: 0,
      totalSkills: 12,
    };
    const events = buildBadgeEvolutionEvents(
      { ...base, longestStreak: 3 },
      { ...base, longestStreak: 14 },
    );

    expect(events).toEqual([
      expect.objectContaining({
        familyId: "study-streak",
        kind: "evolved",
        previousBadge: expect.objectContaining({ id: "streak-3" }),
        badge: expect.objectContaining({ id: "streak-14", tier: "gold" }),
      }),
    ]);
  });

  it("awards both one-point and five-point scored composite improvement tiers", () => {
    const base = {
      points: 0,
      currentStreak: 0,
      longestStreak: 0,
      completedLessons: 0,
      completedSets: 0,
      totalAnswered: 0,
      secureSkills: 0,
    };
    const plusOne = buildMotivationBadges({
      ...base,
      estimatedActImprovement: 1,
    });
    const plusFive = buildMotivationBadges({
      ...base,
      estimatedActImprovement: 5,
    });
    expect(
      plusOne.find((badge) => badge.id === "score-improvement-1"),
    ).toMatchObject({ earned: true, tier: "bronze" });
    expect(
      plusOne.find((badge) => badge.id === "score-improvement-5"),
    ).toMatchObject({ earned: false, tier: "gold" });
    expect(
      plusFive.find((badge) => badge.id === "score-improvement-5"),
    ).toMatchObject({ earned: true, tier: "gold" });
  });
});
