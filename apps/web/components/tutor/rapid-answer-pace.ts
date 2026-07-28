export const RAPID_ANSWER_COUNT = 10
export const RAPID_ANSWER_WINDOW_MS = 30_000

export interface RapidAnswerTracker {
  answeredQuestionIds: ReadonlyArray<string>
  recentAnswerTimes: ReadonlyArray<number>
  prompted: boolean
}

export interface RapidAnswerUpdate {
  tracker: RapidAnswerTracker
  shouldPrompt: boolean
}

export function emptyRapidAnswerTracker(
  answeredQuestionIds: ReadonlyArray<string> = []
): RapidAnswerTracker {
  return {
    answeredQuestionIds: [...new Set(answeredQuestionIds)],
    recentAnswerTimes: [],
    prompted: false,
  }
}

export function recordRapidAnswer(
  tracker: RapidAnswerTracker,
  questionId: string,
  answeredAt: number
): RapidAnswerUpdate {
  if (tracker.prompted || tracker.answeredQuestionIds.includes(questionId)) {
    return { tracker, shouldPrompt: false }
  }

  const answeredQuestionIds = [...tracker.answeredQuestionIds, questionId]
  const recentAnswerTimes = [...tracker.recentAnswerTimes, answeredAt].slice(
    -RAPID_ANSWER_COUNT
  )
  const shouldPrompt =
    recentAnswerTimes.length === RAPID_ANSWER_COUNT &&
    recentAnswerTimes.at(-1)! - recentAnswerTimes[0] < RAPID_ANSWER_WINDOW_MS

  return {
    tracker: {
      answeredQuestionIds,
      recentAnswerTimes,
      prompted: shouldPrompt,
    },
    shouldPrompt,
  }
}
