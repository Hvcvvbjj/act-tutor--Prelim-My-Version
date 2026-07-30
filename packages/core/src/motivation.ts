import type { CoreSection } from "./types";

export const POINTS_PER_MOMENTUM_LEVEL = 1_000;
export const STUDY_POINTS_PER_ESTIMATED_ACT_POINT = POINTS_PER_MOMENTUM_LEVEL;

export type MotivationBadgeCategory =
  | "streak"
  | "mastery"
  | "section"
  | "improvement"
  | "consistency"
  | "volume"
  | "round";

export type MotivationBadgeTier =
  "bronze" | "silver" | "gold" | "platinum" | "single";

export type MotivationBadgeTone = "primary" | "coral" | "sun" | "mint" | "ink";

export type MotivationBadgeIcon =
  | "award"
  | "book-open"
  | "brain"
  | "calendar-check"
  | "circle-dot"
  | "flame"
  | "gauge"
  | "languages"
  | "layers"
  | "medal"
  | "sigma"
  | "shield-check"
  | "sparkles"
  | "target"
  | "trending-up"
  | "trophy";

export interface MotivationBadge {
  id: string;
  familyId: string;
  category: MotivationBadgeCategory;
  tier: MotivationBadgeTier;
  tierIndex: number;
  title: string;
  description: string;
  progress: number;
  target: number;
  earned: boolean;
  icon: MotivationBadgeIcon;
  tone: MotivationBadgeTone;
  scopeLabel: string | null;
}

export interface MotivationSkillProgress {
  skill: string;
  label: string;
  section: CoreSection;
  readiness: number;
  evidenceCount?: number;
}

export interface MotivationSectionProgress {
  section: CoreSection;
  label?: string;
  secureSkills: number;
  totalSkills: number;
  averageReadiness?: number;
  answered?: number;
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
  consistentWeeks?: number;
  estimatedActImprovement?: number;
  skillProgress?: ReadonlyArray<MotivationSkillProgress>;
  sectionProgress?: ReadonlyArray<MotivationSectionProgress>;
}

export interface BadgeEvolutionEvent {
  familyId: string;
  kind: "earned" | "evolved";
  badge: MotivationBadge;
  previousBadge: MotivationBadge | null;
}

export interface RewardGrowthAxis {
  id: string;
  label: string;
  before: number;
  after: number;
}

export interface LessonRewardSummary {
  id: string;
  lessonCheckId: string;
  roundNumber: number;
  skill: string;
  skillLabel: string;
  pointsBefore: number;
  pointsAfter: number;
  pointsGained: number;
  pointsTowardNextEstimatedActPoint: number;
  progressToNextEstimatedActPoint: number;
  newlyEarnedBadges: ReadonlyArray<MotivationBadge>;
  badgeEvents: ReadonlyArray<BadgeEvolutionEvent>;
  growth: ReadonlyArray<RewardGrowthAxis>;
}

export interface LearningRoundRewardSummary {
  id: string;
  completedRoundNumber: number;
  nextRoundNumber: number;
  assessmentKind: "diagnostic" | "full-test";
  pointsBefore: number;
  pointsAfter: number;
  pointsGained: number;
  studyPointActEquivalent: number;
  estimatedActScoreBefore: number;
  estimatedActScoreAfter: number;
  estimatedActScoreDelta: number;
  badgeEvents: ReadonlyArray<BadgeEvolutionEvent>;
  growth: ReadonlyArray<RewardGrowthAxis>;
}

const TIER_ORDER = ["bronze", "silver", "gold", "platinum"] as const;

const SECTION_LABELS: Record<CoreSection, string> = {
  english: "English",
  math: "Math",
  reading: "Reading",
};

const SECTION_ICON: Record<CoreSection, MotivationBadgeIcon> = {
  english: "languages",
  math: "sigma",
  reading: "book-open",
};

const SECTION_TONE: Record<CoreSection, MotivationBadgeTone> = {
  english: "coral",
  math: "primary",
  reading: "mint",
};

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

function clampUnit(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function tierBadge(input: {
  id: string;
  familyId: string;
  category: MotivationBadgeCategory;
  tier: Exclude<MotivationBadgeTier, "single">;
  title: string;
  description: string;
  progress: number;
  target: number;
  icon: MotivationBadgeIcon;
  tone: MotivationBadgeTone;
  scopeLabel?: string | null;
}): MotivationBadge {
  const progress = nonNegativeNumber(input.progress, "Badge progress");
  const target = nonNegativeNumber(input.target, "Badge target");
  if (target === 0) {
    throw new RangeError("Badge target must be greater than zero.");
  }
  return {
    ...input,
    tierIndex: TIER_ORDER.indexOf(input.tier),
    progress: Math.min(progress, target),
    earned: progress >= target,
    scopeLabel: input.scopeLabel ?? null,
  };
}

function singleBadge(input: {
  id: string;
  familyId: string;
  category: MotivationBadgeCategory;
  title: string;
  description: string;
  progress: number;
  target: number;
  icon: MotivationBadgeIcon;
  tone: MotivationBadgeTone;
  scopeLabel?: string | null;
}): MotivationBadge {
  const progress = nonNegativeNumber(input.progress, "Badge progress");
  const target = nonNegativeNumber(input.target, "Badge target");
  if (target === 0) {
    throw new RangeError("Badge target must be greater than zero.");
  }
  return {
    ...input,
    tier: "single",
    tierIndex: 0,
    progress: Math.min(progress, target),
    earned: progress >= target,
    scopeLabel: input.scopeLabel ?? null,
  };
}

function tierFamily(input: {
  familyId: string;
  category: MotivationBadgeCategory;
  progress: number;
  tiers: ReadonlyArray<{
    id: string;
    tier: Exclude<MotivationBadgeTier, "single">;
    target: number;
    title: string;
    description: string;
  }>;
  icon: MotivationBadgeIcon;
  tone: MotivationBadgeTone;
  scopeLabel?: string | null;
}) {
  return input.tiers.map((tier) =>
    tierBadge({
      ...tier,
      familyId: input.familyId,
      category: input.category,
      progress: input.progress,
      icon: input.icon,
      tone: input.tone,
      scopeLabel: input.scopeLabel,
    }),
  );
}

export function pointsProgressToNextMomentumLevel(points: number) {
  const normalized = nonNegativeInteger(points, "Points");
  const pointsInCurrentLevel = normalized % POINTS_PER_MOMENTUM_LEVEL;
  return {
    completedLevels: Math.floor(normalized / POINTS_PER_MOMENTUM_LEVEL),
    pointsInCurrentLevel,
    pointsUntilNextLevel: POINTS_PER_MOMENTUM_LEVEL - pointsInCurrentLevel,
    progress: pointsInCurrentLevel / POINTS_PER_MOMENTUM_LEVEL,
  };
}

export function estimatedActPointEquivalentForStudyPoints(points: number) {
  const normalized = nonNegativeInteger(points, "Points");
  return normalized / STUDY_POINTS_PER_ESTIMATED_ACT_POINT;
}

function skillMasteryBadges(skill: MotivationSkillProgress): MotivationBadge[] {
  const readiness = clampUnit(skill.readiness);
  return tierFamily({
    familyId: `skill-mastery:${skill.skill}`,
    category: "mastery",
    progress: readiness,
    icon: "brain",
    tone: SECTION_TONE[skill.section],
    scopeLabel: skill.label,
    tiers: [
      {
        id: `skill:${skill.skill}:bronze`,
        tier: "bronze",
        target: 0.5,
        title: `${skill.label} Explorer`,
        description: `Reach 50% readiness in ${skill.label}.`,
      },
      {
        id: `skill:${skill.skill}:silver`,
        tier: "silver",
        target: 0.65,
        title: `${skill.label} Builder`,
        description: `Reach 65% readiness in ${skill.label}.`,
      },
      {
        id: `skill:${skill.skill}:gold`,
        tier: "gold",
        target: 0.82,
        title: `${skill.label} Secure`,
        description: `Reach AlexACT's secure threshold in ${skill.label}.`,
      },
      {
        id: `skill:${skill.skill}:platinum`,
        tier: "platinum",
        target: 0.92,
        title: `${skill.label} Master`,
        description: `Reach 92% readiness in ${skill.label}.`,
      },
    ],
  });
}

function inferredSectionProgress(
  input: MotivationProgressInput,
): MotivationSectionProgress[] {
  if (input.sectionProgress?.length) {
    return [...input.sectionProgress];
  }
  const skills = input.skillProgress ?? [];
  return (["english", "math", "reading"] as const).map((section) => {
    const sectionSkills = skills.filter((skill) => skill.section === section);
    const readinessTotal = sectionSkills.reduce(
      (total, skill) => total + clampUnit(skill.readiness),
      0,
    );
    return {
      section,
      label: SECTION_LABELS[section],
      secureSkills: sectionSkills.filter((skill) => skill.readiness >= 0.82)
        .length,
      totalSkills: sectionSkills.length,
      averageReadiness:
        sectionSkills.length > 0 ? readinessTotal / sectionSkills.length : 0,
      answered: 0,
    };
  });
}

function sectionBadges(section: MotivationSectionProgress): MotivationBadge[] {
  const totalSkills = Math.max(
    1,
    nonNegativeInteger(section.totalSkills, "Section skills"),
  );
  const secureSkills = nonNegativeInteger(
    section.secureSkills,
    "Secure section skills",
  );
  const mastery =
    section.averageReadiness === undefined
      ? secureSkills / totalSkills
      : clampUnit(section.averageReadiness);
  const label = section.label ?? SECTION_LABELS[section.section];
  const masteryBadges = tierFamily({
    familyId: `section-mastery:${section.section}`,
    category: "section",
    progress: mastery,
    icon: SECTION_ICON[section.section],
    tone: SECTION_TONE[section.section],
    scopeLabel: label,
    tiers: [
      {
        id: `section:${section.section}:bronze`,
        tier: "bronze",
        target: 0.45,
        title: `${label} Pathfinder`,
        description: `Bring average ${label} readiness to 45%.`,
      },
      {
        id: `section:${section.section}:silver`,
        tier: "silver",
        target: 0.6,
        title: `${label} Climber`,
        description: `Bring average ${label} readiness to 60%.`,
      },
      {
        id: `section:${section.section}:gold`,
        tier: "gold",
        target: 0.75,
        title: `${label} Standout`,
        description: `Bring average ${label} readiness to 75%.`,
      },
      {
        id: `section:${section.section}:platinum`,
        tier: "platinum",
        target: 0.88,
        title: `${label} Ace`,
        description: `Bring average ${label} readiness to 88%.`,
      },
    ],
  });
  const answered = nonNegativeInteger(section.answered ?? 0, "Section answers");
  const volumeBadges = tierFamily({
    familyId: `section-volume:${section.section}`,
    category: "volume",
    progress: answered,
    icon: "target",
    tone: SECTION_TONE[section.section],
    scopeLabel: label,
    tiers: [
      {
        id: `section-volume:${section.section}:bronze`,
        tier: "bronze",
        target: 25,
        title: `${label} Reps I`,
        description: `Answer 25 scored ${label} questions.`,
      },
      {
        id: `section-volume:${section.section}:silver`,
        tier: "silver",
        target: 75,
        title: `${label} Reps II`,
        description: `Answer 75 scored ${label} questions.`,
      },
      {
        id: `section-volume:${section.section}:gold`,
        tier: "gold",
        target: 200,
        title: `${label} Reps III`,
        description: `Answer 200 scored ${label} questions.`,
      },
      {
        id: `section-volume:${section.section}:platinum`,
        tier: "platinum",
        target: 500,
        title: `${label} Reps IV`,
        description: `Answer 500 scored ${label} questions.`,
      },
    ],
  });
  return [...masteryBadges, ...volumeBadges];
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
  const points = nonNegativeInteger(input.points, "Points");
  const scoreImprovement = nonNegativeNumber(
    input.estimatedActImprovement ?? 0,
    "Estimated ACT improvement",
  );
  const consistentWeeks = nonNegativeInteger(
    input.consistentWeeks ?? 0,
    "Consistent weeks",
  );

  const badges: MotivationBadge[] = [
    ...tierFamily({
      familyId: "study-streak",
      category: "streak",
      progress: input.longestStreak,
      icon: "flame",
      tone: "coral",
      tiers: [
        {
          id: "streak-3",
          tier: "bronze",
          target: 3,
          title: "Three-day streak",
          description: "Study on three days in a row.",
        },
        {
          id: "streak-7",
          tier: "silver",
          target: 7,
          title: "Full-week streak",
          description: "Keep your study streak going for seven days.",
        },
        {
          id: "streak-14",
          tier: "gold",
          target: 14,
          title: "Two-week streak",
          description: "Keep your study streak going for fourteen days.",
        },
        {
          id: "streak-30",
          tier: "platinum",
          target: 30,
          title: "Thirty-day streak",
          description: "Show up for thirty study days in a row.",
        },
      ],
    }),
    ...tierFamily({
      familyId: "study-points",
      category: "improvement",
      progress: points,
      icon: "gauge",
      tone: "primary",
      tiers: [
        {
          id: "improvement-1",
          tier: "bronze",
          target: 1_000,
          title: "Momentum +1",
          description: "Earn 1,000 study points.",
        },
        {
          id: "improvement-3",
          tier: "silver",
          target: 3_000,
          title: "Momentum +3",
          description: "Earn 3,000 study points.",
        },
        {
          id: "improvement-5",
          tier: "gold",
          target: 5_000,
          title: "Momentum +5",
          description: "Earn 5,000 study points.",
        },
        {
          id: "improvement-10",
          tier: "platinum",
          target: 10_000,
          title: "Momentum +10",
          description: "Earn 10,000 study points.",
        },
      ],
    }),
    ...tierFamily({
      familyId: "composite-improvement",
      category: "improvement",
      progress: scoreImprovement,
      icon: "trending-up",
      tone: "mint",
      tiers: [
        {
          id: "score-improvement-1",
          tier: "bronze",
          target: 1,
          title: "Composite Climb +1",
          description: "Raise your scored ACT estimate by one composite point.",
        },
        {
          id: "score-improvement-2",
          tier: "silver",
          target: 2,
          title: "Composite Climb +2",
          description:
            "Raise your scored ACT estimate by two composite points.",
        },
        {
          id: "score-improvement-5",
          tier: "gold",
          target: 5,
          title: "Composite Climb +5",
          description:
            "Raise your scored ACT estimate by five composite points.",
        },
        {
          id: "score-improvement-8",
          tier: "platinum",
          target: 8,
          title: "Composite Climb +8",
          description:
            "Raise your scored ACT estimate by eight composite points.",
        },
      ],
    }),
    ...tierFamily({
      familyId: "focused-sessions",
      category: "consistency",
      progress: input.completedSets,
      icon: "calendar-check",
      tone: "sun",
      tiers: [
        {
          id: "consistency-3",
          tier: "bronze",
          target: 3,
          title: "Three focused sessions",
          description: "Complete three focused study sessions.",
        },
        {
          id: "consistency-10",
          tier: "silver",
          target: 10,
          title: "Ten focused sessions",
          description: "Complete ten focused study sessions.",
        },
        {
          id: "consistency-25",
          tier: "gold",
          target: 25,
          title: "Twenty-five sessions",
          description: "Complete twenty-five focused study sessions.",
        },
        {
          id: "consistency-50",
          tier: "platinum",
          target: 50,
          title: "Fifty sessions",
          description: "Complete fifty focused study sessions.",
        },
      ],
    }),
    ...tierFamily({
      familyId: "weekly-consistency",
      category: "consistency",
      progress: consistentWeeks,
      icon: "calendar-check",
      tone: "mint",
      tiers: [
        {
          id: "weeks-1",
          tier: "bronze",
          target: 1,
          title: "Week on plan",
          description: "Complete your scheduled work for one week.",
        },
        {
          id: "weeks-4",
          tier: "silver",
          target: 4,
          title: "Month on plan",
          description: "Complete your scheduled work for four weeks.",
        },
        {
          id: "weeks-8",
          tier: "gold",
          target: 8,
          title: "Eight weeks on plan",
          description: "Complete your scheduled work for eight weeks.",
        },
        {
          id: "weeks-16",
          tier: "platinum",
          target: 16,
          title: "Sixteen weeks on plan",
          description: "Complete your scheduled work for sixteen weeks.",
        },
      ],
    }),
    ...tierFamily({
      familyId: "answer-volume",
      category: "volume",
      progress: input.totalAnswered,
      icon: "circle-dot",
      tone: "coral",
      tiers: [
        {
          id: "milestone-50",
          tier: "bronze",
          target: 50,
          title: "Fifty answers",
          description: "Answer fifty scored practice questions.",
        },
        {
          id: "milestone-100",
          tier: "silver",
          target: 100,
          title: "One hundred answers",
          description: "Answer one hundred scored practice questions.",
        },
        {
          id: "milestone-500",
          tier: "gold",
          target: 500,
          title: "Five hundred answers",
          description: "Answer five hundred scored practice questions.",
        },
        {
          id: "milestone-1000",
          tier: "platinum",
          target: 1_000,
          title: "One thousand answers",
          description: "Answer one thousand scored practice questions.",
        },
      ],
    }),
    ...tierFamily({
      familyId: "lesson-volume",
      category: "volume",
      progress: input.completedLessons,
      icon: "layers",
      tone: "primary",
      tiers: [
        {
          id: "lessons-5",
          tier: "bronze",
          target: 5,
          title: "Five lessons",
          description: "Complete five AlexACT lessons.",
        },
        {
          id: "lessons-12",
          tier: "silver",
          target: 12,
          title: "Foundation complete",
          description: "Complete twelve AlexACT lessons.",
        },
        {
          id: "lessons-36",
          tier: "gold",
          target: 36,
          title: "Thirty-six lessons",
          description: "Complete thirty-six AlexACT lessons.",
        },
        {
          id: "lessons-72",
          tier: "platinum",
          target: 72,
          title: "Seventy-two lessons",
          description: "Complete seventy-two AlexACT lessons.",
        },
      ],
    }),
    ...tierFamily({
      familyId: "learning-rounds",
      category: "round",
      progress: completedRounds,
      icon: "trophy",
      tone: "sun",
      tiers: [
        {
          id: "milestone-round",
          tier: "bronze",
          target: 1,
          title: "Round complete",
          description: `Complete all ${totalSkills} lessons and the next assessment.`,
        },
        {
          id: "milestone-round-2",
          tier: "silver",
          target: 2,
          title: "Two rounds complete",
          description: "Complete two full learn-assess-review cycles.",
        },
        {
          id: "milestone-round-4",
          tier: "gold",
          target: 4,
          title: "Four rounds complete",
          description: "Complete four full learn-assess-review cycles.",
        },
        {
          id: "milestone-round-8",
          tier: "platinum",
          target: 8,
          title: "Eight rounds complete",
          description: "Complete eight full learn-assess-review cycles.",
        },
      ],
    }),
    singleBadge({
      id: "mastery-first",
      familyId: "secure-skills-first",
      category: "mastery",
      title: "First secure skill",
      description: "Bring one question type to secure.",
      progress: input.secureSkills,
      target: 1,
      icon: "shield-check",
      tone: "mint",
    }),
    singleBadge({
      id: "mastery-all",
      familyId: "secure-skills-all",
      category: "mastery",
      title: "All skills secure",
      description: `Bring all ${totalSkills} question types to secure.`,
      progress: input.secureSkills,
      target: totalSkills,
      icon: "medal",
      tone: "sun",
    }),
  ];

  for (const skill of input.skillProgress ?? []) {
    badges.push(...skillMasteryBadges(skill));
  }
  for (const section of inferredSectionProgress(input)) {
    badges.push(...sectionBadges(section));
  }
  return badges;
}

function highestEarnedByFamily(
  badges: ReadonlyArray<MotivationBadge>,
): Map<string, MotivationBadge> {
  const highest = new Map<string, MotivationBadge>();
  for (const badge of badges) {
    if (!badge.earned) continue;
    const current = highest.get(badge.familyId);
    if (!current || badge.tierIndex > current.tierIndex) {
      highest.set(badge.familyId, badge);
    }
  }
  return highest;
}

export function buildBadgeEvolutionEvents(
  before: MotivationProgressInput,
  after: MotivationProgressInput,
): BadgeEvolutionEvent[] {
  const beforeByFamily = highestEarnedByFamily(buildMotivationBadges(before));
  const afterByFamily = highestEarnedByFamily(buildMotivationBadges(after));
  const events: BadgeEvolutionEvent[] = [];
  for (const [familyId, badge] of afterByFamily) {
    const previousBadge = beforeByFamily.get(familyId) ?? null;
    if (previousBadge?.id === badge.id) continue;
    events.push({
      familyId,
      kind: previousBadge ? "evolved" : "earned",
      badge,
      previousBadge,
    });
  }
  return events.sort(
    (left, right) =>
      right.badge.tierIndex - left.badge.tierIndex ||
      left.badge.title.localeCompare(right.badge.title),
  );
}

function normalizedProgress(
  value: number,
  target: number,
  minimumFloor = 0.12,
) {
  if (target <= 0) return minimumFloor;
  return Math.max(minimumFloor, clampUnit(value / target));
}

function rewardGrowth(input: {
  skill: string;
  before: MotivationProgressInput;
  after: MotivationProgressInput;
}): RewardGrowthAxis[] {
  const beforeSkill = input.before.skillProgress?.find(
    (skill) => skill.skill === input.skill,
  );
  const afterSkill = input.after.skillProgress?.find(
    (skill) => skill.skill === input.skill,
  );
  const beforeSection = beforeSkill
    ? inferredSectionProgress(input.before).find(
        (section) => section.section === beforeSkill.section,
      )
    : null;
  const afterSection = afterSkill
    ? inferredSectionProgress(input.after).find(
        (section) => section.section === afterSkill.section,
      )
    : null;
  const pointTarget = Math.max(
    POINTS_PER_MOMENTUM_LEVEL,
    Math.ceil(input.after.points / POINTS_PER_MOMENTUM_LEVEL) *
      POINTS_PER_MOMENTUM_LEVEL,
  );
  const answerTarget = Math.max(100, input.after.totalAnswered);
  const sessionTarget = Math.max(10, input.after.completedSets);
  const secureTarget = Math.max(
    1,
    input.after.totalSkills ?? input.before.totalSkills ?? 12,
  );
  return [
    {
      id: "skill",
      label: "Skill",
      before: clampUnit(
        beforeSkill?.readiness ?? input.before.secureSkills / secureTarget,
      ),
      after: clampUnit(
        afterSkill?.readiness ?? input.after.secureSkills / secureTarget,
      ),
    },
    {
      id: "section",
      label: "Section",
      before: clampUnit(
        beforeSection?.averageReadiness ??
          (beforeSection
            ? beforeSection.secureSkills /
              Math.max(1, beforeSection.totalSkills)
            : input.before.secureSkills / secureTarget),
      ),
      after: clampUnit(
        afterSection?.averageReadiness ??
          (afterSection
            ? afterSection.secureSkills / Math.max(1, afterSection.totalSkills)
            : input.after.secureSkills / secureTarget),
      ),
    },
    {
      id: "practice",
      label: "Practice",
      before: normalizedProgress(input.before.totalAnswered, answerTarget),
      after: normalizedProgress(input.after.totalAnswered, answerTarget),
    },
    {
      id: "momentum",
      label: "Momentum",
      before: normalizedProgress(input.before.points, pointTarget),
      after: normalizedProgress(input.after.points, pointTarget),
    },
    {
      id: "consistency",
      label: "Consistency",
      before: normalizedProgress(input.before.completedSets, sessionTarget),
      after: normalizedProgress(input.after.completedSets, sessionTarget),
    },
  ];
}

export function buildLessonRewardSummary(input: {
  id: string;
  lessonCheckId: string;
  roundNumber: number;
  skill: string;
  skillLabel: string;
  before: MotivationProgressInput;
  after: MotivationProgressInput;
}): LessonRewardSummary {
  const pointsBefore = nonNegativeInteger(input.before.points, "Points");
  const pointsAfter = nonNegativeInteger(input.after.points, "Points");
  if (pointsAfter < pointsBefore) {
    throw new RangeError("Lesson points cannot decrease.");
  }
  const badgeEvents = buildBadgeEvolutionEvents(input.before, input.after);
  const pointProgress = pointsProgressToNextMomentumLevel(pointsAfter);

  return {
    id: input.id,
    lessonCheckId: input.lessonCheckId,
    roundNumber: input.roundNumber,
    skill: input.skill,
    skillLabel: input.skillLabel,
    pointsBefore,
    pointsAfter,
    pointsGained: pointsAfter - pointsBefore,
    pointsTowardNextEstimatedActPoint: pointProgress.pointsInCurrentLevel,
    progressToNextEstimatedActPoint: pointProgress.progress,
    newlyEarnedBadges: badgeEvents.map((event) => event.badge),
    badgeEvents,
    growth: rewardGrowth({
      skill: input.skill,
      before: input.before,
      after: input.after,
    }),
  };
}

export function buildLearningRoundRewardSummary(input: {
  id: string;
  completedRoundNumber: number;
  assessmentKind: "diagnostic" | "full-test";
  pointsBefore: number;
  pointsAfter: number;
  estimatedActScoreBefore: number;
  estimatedActScoreAfter: number;
}): LearningRoundRewardSummary {
  const pointsBefore = nonNegativeInteger(input.pointsBefore, "Points");
  const pointsAfter = nonNegativeInteger(input.pointsAfter, "Points");
  if (pointsAfter < pointsBefore) {
    throw new RangeError("Round points cannot decrease.");
  }
  const completedRoundNumber = nonNegativeInteger(
    input.completedRoundNumber,
    "Completed round",
  );
  const pointsGained = pointsAfter - pointsBefore;
  const estimatedActScoreDelta =
    input.estimatedActScoreAfter - input.estimatedActScoreBefore;
  const baselineProgress: MotivationProgressInput = {
    points: pointsBefore,
    currentStreak: 0,
    longestStreak: 0,
    completedLessons: 0,
    completedRounds: Math.max(0, completedRoundNumber - 1),
    completedSets: 0,
    totalAnswered: 0,
    secureSkills: 0,
    estimatedActImprovement: 0,
  };
  const completedProgress: MotivationProgressInput = {
    ...baselineProgress,
    points: pointsAfter,
    completedRounds: completedRoundNumber,
    estimatedActImprovement: Math.max(0, estimatedActScoreDelta),
  };
  const pointTarget = Math.max(
    POINTS_PER_MOMENTUM_LEVEL,
    Math.ceil(pointsAfter / POINTS_PER_MOMENTUM_LEVEL) *
      POINTS_PER_MOMENTUM_LEVEL,
  );
  return {
    id: input.id,
    completedRoundNumber,
    nextRoundNumber: completedRoundNumber + 1,
    assessmentKind: input.assessmentKind,
    pointsBefore,
    pointsAfter,
    pointsGained,
    studyPointActEquivalent:
      estimatedActPointEquivalentForStudyPoints(pointsGained),
    estimatedActScoreBefore: input.estimatedActScoreBefore,
    estimatedActScoreAfter: input.estimatedActScoreAfter,
    estimatedActScoreDelta,
    badgeEvents: buildBadgeEvolutionEvents(baselineProgress, completedProgress),
    growth: [
      {
        id: "score",
        label: "ACT estimate",
        before: normalizedProgress(input.estimatedActScoreBefore, 36),
        after: normalizedProgress(input.estimatedActScoreAfter, 36),
      },
      {
        id: "points",
        label: "Points",
        before: normalizedProgress(pointsBefore, pointTarget),
        after: normalizedProgress(pointsAfter, pointTarget),
      },
      {
        id: "improvement",
        label: "Improvement",
        before: 0.12,
        after: normalizedProgress(Math.max(0, estimatedActScoreDelta), 5),
      },
      {
        id: "round",
        label: "Rounds",
        before: normalizedProgress(Math.max(0, completedRoundNumber - 1), 4),
        after: normalizedProgress(completedRoundNumber, 4),
      },
    ],
  };
}

export function buildLessonRewardNarrationPrompt(reward: LessonRewardSummary) {
  const badgeCopy = reward.badgeEvents.length
    ? reward.badgeEvents
        .map(
          (event) =>
            `${event.kind === "evolved" ? "evolved to" : "earned"} ${event.badge.tier} ${event.badge.title}`,
        )
        .join(", ")
    : "no new badge";
  return [
    "You are Mr. Kim, a concise and encouraging ACT tutor.",
    `The student completed ${reward.skillLabel} and earned ${reward.pointsGained} study points.`,
    `Badge result: ${badgeCopy}.`,
    "Respond in one or two natural sentences. Celebrate the evidence, do not claim an official ACT score, and name the next useful action.",
  ].join(" ");
}
