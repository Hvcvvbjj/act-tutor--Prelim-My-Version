import type { MasteryState, PracticeDifficulty, SkillSlug } from "./learning";
import type { CoreSection } from "./types";

export type LearningSessionMode =
  | "focus"
  | "repair"
  | "checkpoint"
  | "retention"
  | "challenge"
  | "micro"
  | "recovery";
export type ReviewUrgency = "overdue" | "today" | "upcoming";

export interface LearnerProgress {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  totalCorrect: number;
  totalAnswered: number;
  completedSets: number;
}

export interface DueReviewItem {
  skill: SkillSlug;
  label: string;
  section: CoreSection;
  mastery: number;
  dueAt: string;
  urgency: ReviewUrgency;
  purpose: "retention-review";
  daysSincePractice: number;
  forgettingWindowDays: number;
  explanation: string;
}

export interface MistakeRecordPublic {
  id: string;
  questionId: string;
  skill: SkillSlug;
  skillLabel: string;
  section: CoreSection;
  prompt: string;
  selectedChoiceText: string;
  correctChoiceText: string;
  rationale: string;
  misconception: string | null;
  attempts: number;
  createdAt: string;
  resolvedAt: string | null;
}

export interface MissionStep {
  id: "learn" | "practice" | "repair" | "checkpoint";
  label: string;
  state: "done" | "current" | "queued";
  progress: number;
  total: number;
}

export interface DailyMissionSummary {
  progress: LearnerProgress;
  steps: ReadonlyArray<MissionStep>;
  dueReviews: ReadonlyArray<DueReviewItem>;
  mistakes: ReadonlyArray<MistakeRecordPublic>;
  unresolvedMistakes: number;
  skillMap: ReadonlyArray<MasteryState>;
  recommendedSkill: SkillSlug;
  recommendedReason: string;
}

const XP_PER_LEVEL = 250;

function dayKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid ISO date.");
  return date.toISOString().slice(0, 10);
}

function previousDay(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function calculateLearningStreak(
  activeDates: ReadonlyArray<string>,
  now: string,
): number {
  const active = new Set(activeDates.map(dayKey));
  const today = dayKey(now);
  let cursor = active.has(today) ? today : previousDay(today);
  let streak = 0;
  while (active.has(cursor)) {
    streak += 1;
    cursor = previousDay(cursor);
  }
  return streak;
}

export function learnerLevel(xp: number) {
  if (!Number.isFinite(xp) || xp < 0)
    throw new RangeError("XP must be non-negative.");
  const normalized = Math.floor(xp);
  return {
    level: Math.floor(normalized / XP_PER_LEVEL) + 1,
    xpIntoLevel: normalized % XP_PER_LEVEL,
    xpForNextLevel: XP_PER_LEVEL,
  };
}

export function xpForPractice(
  correct: boolean,
  difficulty: PracticeDifficulty,
) {
  if (!correct) return 3;
  return difficulty === "hard" ? 12 : difficulty === "medium" ? 10 : 8;
}

export function buildDueReviews(
  states: ReadonlyArray<MasteryState>,
  now: string,
): DueReviewItem[] {
  const nowTime = new Date(now).getTime();
  if (Number.isNaN(nowTime)) throw new RangeError("Invalid current date.");
  const horizon = nowTime + 3 * 24 * 60 * 60 * 1000;
  return states
    .flatMap((state) => {
      if (!state.nextReviewAt) return [];
      const dueTime = new Date(state.nextReviewAt).getTime();
      if (Number.isNaN(dueTime) || dueTime > horizon) return [];
      const dueDay = dayKey(state.nextReviewAt);
      const today = dayKey(now);
      const urgency: ReviewUrgency =
        dueTime < new Date(`${today}T00:00:00.000Z`).getTime()
          ? "overdue"
          : dueDay === today
            ? "today"
            : "upcoming";
      return [
        {
          skill: state.skill,
          label: state.label,
          section: state.section,
          mastery: state.mastery,
          dueAt: state.nextReviewAt,
          urgency,
          purpose: "retention-review" as const,
          daysSincePractice: state.lastPracticedAt
            ? Math.max(
                0,
                Math.floor(
                  (nowTime - new Date(state.lastPracticedAt).getTime()) /
                    (24 * 60 * 60 * 1000),
                ),
              )
            : 0,
          forgettingWindowDays: state.lastPracticedAt
            ? Math.max(
                1,
                Math.round(
                  (dueTime - new Date(state.lastPracticedAt).getTime()) /
                    (24 * 60 * 60 * 1000),
                ),
              )
            : 1,
          explanation: state.lastPracticedAt
            ? `You last practiced ${state.label.toLowerCase()} ${Math.max(
                0,
                Math.floor(
                  (nowTime - new Date(state.lastPracticedAt).getTime()) /
                    (24 * 60 * 60 * 1000),
                ),
              )} day${
                Math.max(
                  0,
                  Math.floor(
                    (nowTime - new Date(state.lastPracticedAt).getTime()) /
                      (24 * 60 * 60 * 1000),
                  ),
                ) === 1
                  ? ""
                  : "s"
              } ago. Scout scheduled a two-question review near its forgetting window.`
            : `Scout scheduled a short review before this skill fades.`,
        },
      ];
    })
    .sort((left, right) => {
      const urgencyRank = { overdue: 0, today: 1, upcoming: 2 } as const;
      const rank = urgencyRank[left.urgency] - urgencyRank[right.urgency];
      return (
        rank ||
        left.dueAt.localeCompare(right.dueAt) ||
        left.mastery - right.mastery
      );
    });
}
