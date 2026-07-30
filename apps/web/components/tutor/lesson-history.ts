import type { LessonCheckResult } from "@act-tutor/core"

export interface HistoricalLessonRound {
  roundNumber: number
  cycleKind: LessonCheckResult["cycleKind"]
  lessons: ReadonlyArray<LessonCheckResult>
}

export function currentRoundLessonCheck(
  history: ReadonlyArray<LessonCheckResult>,
  roundNumber: number,
  skill: string
) {
  return [...history]
    .reverse()
    .find((check) => check.roundNumber === roundNumber && check.skill === skill)
}

export function historicalLessonRounds(
  history: ReadonlyArray<LessonCheckResult>,
  currentRoundNumber: number
): HistoricalLessonRound[] {
  const grouped = new Map<number, LessonCheckResult[]>()
  for (const check of history) {
    if (check.roundNumber >= currentRoundNumber) continue
    const lessons = grouped.get(check.roundNumber) ?? []
    lessons.push(check)
    grouped.set(check.roundNumber, lessons)
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => right - left)
    .map(([roundNumber, lessons]) => ({
      roundNumber,
      cycleKind: lessons[0]?.cycleKind ?? "adaptive",
      lessons: [...lessons].sort((left, right) =>
        left.completedAt.localeCompare(right.completedAt)
      ),
    }))
}

export function lessonReviewById(
  history: ReadonlyArray<LessonCheckResult>,
  lessonCheckId: string
) {
  return history.find((check) => check.id === lessonCheckId) ?? null
}
