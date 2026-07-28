export const POINTS_PER_ACT_POINT = 1_000;

export type MotivationBadgeCategory =
  "streak" | "mastery" | "improvement" | "consistency" | "milestone";

export interface MotivationBadge {
  id: string;
  category: MotivationBadgeCategory;
  title: string;
  description: string;
  progress: number;
  target: number;
  earned: boolean;
}

export interface MotivationProgressInput {
  points: number;
  currentStreak: number;
  longestStreak: number;
  completedLessons: number;
  completedRounds?: number;
  completedSets: number;
  totalAnswered: number;
  secureSkills: number;
  totalSkills?: number;
}

function nonNegativeNumber(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be non-negative.`);
  }
  return value;
}

function nonNegativeInteger(value: number, label: string) {
  nonNegativeNumber(value, label);
  return Math.floor(value);
}

function actScore(value: number, label: string) {
  if (!Number.isFinite(value) || value < 1 || value > 36) {
    throw new RangeError(`${label} must be between 1 and 36.`);
  }
  return value;
}

export function actScoreImprovementFromPoints(points: number) {
  return nonNegativeInteger(points, "Points") / POINTS_PER_ACT_POINT;
}

export function actScoreEquivalentFromPoints(
  startingScore: number,
  points: number,
) {
  return Math.min(
    36,
    actScore(startingScore, "Starting score") +
      actScoreImprovementFromPoints(points),
  );
}

export function pointsProgressToNextActPoint(points: number) {
  const normalized = nonNegativeInteger(points, "Points");
  const pointsInCurrentActPoint = normalized % POINTS_PER_ACT_POINT;
  return {
    completedActPoints: Math.floor(normalized / POINTS_PER_ACT_POINT),
    pointsInCurrentActPoint,
    pointsUntilNextActPoint: POINTS_PER_ACT_POINT - pointsInCurrentActPoint,
    progress: pointsInCurrentActPoint / POINTS_PER_ACT_POINT,
  };
}

function badge(
  id: string,
  category: MotivationBadgeCategory,
  title: string,
  description: string,
  progress: number,
  target: number,
): MotivationBadge {
  return {
    id,
    category,
    title,
    description,
    progress: Math.min(nonNegativeNumber(progress, "Badge progress"), target),
    target,
    earned: progress >= target,
  };
}

export function buildMotivationBadges(
  input: MotivationProgressInput,
): MotivationBadge[] {
  const totalSkills = Math.max(
    1,
    nonNegativeInteger(input.totalSkills ?? 12, "Total skills"),
  );
  const completedRounds = nonNegativeInteger(
    input.completedRounds ?? 0,
    "Completed rounds",
  );
  const improvement = actScoreImprovementFromPoints(input.points);

  return [
    badge(
      "streak-3",
      "streak",
      "Three-day streak",
      "Study on three days in a row.",
      input.longestStreak,
      3,
    ),
    badge(
      "streak-7",
      "streak",
      "Full-week streak",
      "Keep your study streak going for seven days.",
      input.longestStreak,
      7,
    ),
    badge(
      "mastery-first",
      "mastery",
      "First secure skill",
      "Bring one question type to secure.",
      input.secureSkills,
      1,
    ),
    badge(
      "mastery-all",
      "mastery",
      "All skills secure",
      `Bring all ${totalSkills} question types to secure.`,
      input.secureSkills,
      totalSkills,
    ),
    badge(
      "improvement-1",
      "improvement",
      "One-point climb",
      `Earn ${POINTS_PER_ACT_POINT.toLocaleString("en-US")} study points.`,
      improvement,
      1,
    ),
    badge(
      "improvement-3",
      "improvement",
      "Three-point climb",
      `Earn ${(POINTS_PER_ACT_POINT * 3).toLocaleString("en-US")} study points.`,
      improvement,
      3,
    ),
    badge(
      "consistency-10",
      "consistency",
      "Ten sessions",
      "Complete ten focused study sessions.",
      input.completedSets,
      10,
    ),
    badge(
      "milestone-100",
      "milestone",
      "One hundred answers",
      "Answer one hundred scored practice questions.",
      input.totalAnswered,
      100,
    ),
    badge(
      "milestone-round",
      "milestone",
      "Round complete",
      `Complete all ${totalSkills} lessons in a learning round.`,
      completedRounds > 0 ? totalSkills : input.completedLessons,
      totalSkills,
    ),
  ];
}
