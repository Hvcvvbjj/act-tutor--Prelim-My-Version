import { describe, expect, it } from "vitest"

import { emptyRapidAnswerTracker, recordRapidAnswer } from "./rapid-answer-pace"

function recordSequence(times: ReadonlyArray<number>) {
  let tracker = emptyRapidAnswerTracker()
  let prompted = false
  times.forEach((answeredAt, index) => {
    const update = recordRapidAnswer(tracker, `question-${index}`, answeredAt)
    tracker = update.tracker
    prompted ||= update.shouldPrompt
  })
  return { tracker, prompted }
}

describe("rapid-answer pace guard", () => {
  it("prompts after ten distinct answers inside thirty seconds", () => {
    const result = recordSequence(
      Array.from({ length: 10 }, (_, index) => index * 2_900)
    )

    expect(result.prompted).toBe(true)
    expect(result.tracker.prompted).toBe(true)
  })

  it("does not prompt when the tenth answer lands at exactly thirty seconds", () => {
    const result = recordSequence([
      0, 3_500, 7_000, 10_500, 14_000, 17_500, 21_000, 24_500, 28_000, 30_000,
    ])

    expect(result.prompted).toBe(false)
  })

  it("counts a question only once when the learner changes an answer", () => {
    let tracker = emptyRapidAnswerTracker()
    for (let index = 0; index < 9; index += 1) {
      tracker = recordRapidAnswer(
        tracker,
        `question-${index}`,
        index * 2_000
      ).tracker
    }

    const duplicate = recordRapidAnswer(tracker, "question-8", 18_000)

    expect(duplicate.shouldPrompt).toBe(false)
    expect(duplicate.tracker.answeredQuestionIds).toHaveLength(9)
  })

  it("does not count answers restored from a resumed attempt", () => {
    const tracker = emptyRapidAnswerTracker([
      "question-1",
      "question-2",
      "question-3",
    ])
    const update = recordRapidAnswer(tracker, "question-2", 1_000)

    expect(update.shouldPrompt).toBe(false)
    expect(update.tracker.answeredQuestionIds).toHaveLength(3)
  })

  it("uses the latest ten answers when an earlier answer was slow", () => {
    const result = recordSequence([
      0, 60_000, 62_000, 64_000, 66_000, 68_000, 70_000, 72_000, 74_000, 76_000,
      78_000,
    ])

    expect(result.prompted).toBe(true)
  })
})
