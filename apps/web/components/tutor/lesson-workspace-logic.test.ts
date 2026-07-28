import { describe, expect, it } from "vitest"

import {
  buildPracticeExplanation,
  lessonSegmentMinutes,
  lessonSectionsForDisplay,
  shouldHoldPracticeFeedback,
  shouldShowRoundTransition,
} from "@/components/tutor/lesson-workspace-logic"

describe("lesson workspace learner flow", () => {
  it("hides the retired rewrite-the-rule step from new and saved lessons", () => {
    expect(
      lessonSectionsForDisplay([
        { id: "question-type" },
        { id: "need-to-know" },
        { id: "transfer" },
      ])
    ).toEqual([{ id: "question-type" }, { id: "need-to-know" }])
  })

  it("distributes the lesson estimate across the actual number of sections", () => {
    const fivePartLesson = Array.from({ length: 5 }, (_, index) =>
      lessonSegmentMinutes(15, 5, index)
    )
    const shortLesson = Array.from({ length: 5 }, (_, index) =>
      lessonSegmentMinutes(10, 5, index)
    )

    expect(fivePartLesson).toEqual([3, 3, 3, 3, 3])
    expect(fivePartLesson.reduce((sum, minutes) => sum + minutes, 0)).toBe(15)
    expect(shortLesson).toEqual([2, 2, 2, 2, 2])
    expect(shortLesson.reduce((sum, minutes) => sum + minutes, 0)).toBe(10)
    expect(lessonSegmentMinutes(3, 1, 0)).toBe(3)
  })

  it("holds a scored nonfinal question until its feedback is dismissed", () => {
    const input = {
      status: "practice",
      currentQuestionId: "question-2",
      feedbackQuestionId: "question-1",
      feedbackIdentity: "question-1:attempt-1",
    }

    expect(
      shouldHoldPracticeFeedback({
        ...input,
        dismissedFeedbackIdentity: null,
      })
    ).toBe(true)
    expect(
      shouldHoldPracticeFeedback({
        ...input,
        dismissedFeedbackIdentity: "question-1:attempt-1",
      })
    ).toBe(false)
    expect(
      shouldHoldPracticeFeedback({
        ...input,
        status: "complete",
        dismissedFeedbackIdentity: null,
      })
    ).toBe(true)
    expect(
      shouldHoldPracticeFeedback({
        status: "complete",
        currentQuestionId: "question-2",
        feedbackQuestionId: "question-2",
        feedbackIdentity: "question-2:attempt-1",
        dismissedFeedbackIdentity: null,
      })
    ).toBe(true)
    expect(
      shouldHoldPracticeFeedback({
        status: "complete",
        currentQuestionId: "question-2",
        feedbackQuestionId: "question-2",
        feedbackIdentity: "question-2:attempt-1",
        dismissedFeedbackIdentity: "question-2:attempt-1",
      })
    ).toBe(false)
    expect(
      shouldHoldPracticeFeedback({
        status: "complete",
        currentQuestionId: "question-2",
        feedbackQuestionId: "question-2",
        feedbackIdentity: "question-2:attempt-2",
        dismissedFeedbackIdentity: "question-2:attempt-1",
      })
    ).toBe(true)
  })

  it("keeps the final lesson workspace visible until its feedback is dismissed", () => {
    expect(
      shouldShowRoundTransition({
        cycleStatus: "assessment-choice",
        workspaceOpen: true,
        activeTab: "today",
      })
    ).toBe(false)
    expect(
      shouldShowRoundTransition({
        cycleStatus: "assessment-choice",
        workspaceOpen: false,
        activeTab: "today",
      })
    ).toBe(true)
    expect(
      shouldShowRoundTransition({
        cycleStatus: "lessons",
        workspaceOpen: false,
        activeTab: "today",
      })
    ).toBe(false)
  })

  it("keeps incorrect-answer feedback concise in every display mode", () => {
    const input = {
      correct: false,
      rationale: "A comma alone cannot join two complete sentences.",
      selectedChoiceId: "A",
      correctChoiceId: "B",
      choices: [
        { id: "A", text: "Keep the comma" },
        { id: "B", text: "Use a semicolon" },
      ],
      concept: "Use a semicolon between related complete sentences.",
      strategyChecklist: ["Check whether both sides are complete sentences."],
    } as const

    const steps = buildPracticeExplanation({
      ...input,
      style: "step-by-step",
    })
    const comparison = buildPracticeExplanation({
      ...input,
      style: "compare",
    })
    const simpler = buildPracticeExplanation({ ...input, style: "simple" })

    for (const explanation of [steps, comparison, simpler]) {
      expect(explanation.title).toBe("Review")
      expect(explanation.ordered).toBe(false)
      expect(explanation.lines).toEqual([
        "The answer is Use a semicolon. A comma alone cannot join two complete sentences.",
      ])
    }
  })
})
