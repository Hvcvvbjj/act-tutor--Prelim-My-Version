import { describe, expect, it } from "vitest"

import {
  buildPracticeExplanation,
  lessonSegmentMinutes,
  shouldHoldPracticeFeedback,
} from "@/components/tutor/lesson-workspace-logic"

describe("lesson workspace learner flow", () => {
  it("distributes the lesson estimate across the actual number of sections", () => {
    const sixPartLesson = Array.from({ length: 6 }, (_, index) =>
      lessonSegmentMinutes(15, 6, index)
    )
    const shortLesson = Array.from({ length: 6 }, (_, index) =>
      lessonSegmentMinutes(10, 6, index)
    )

    expect(sixPartLesson).toEqual([3, 3, 3, 2, 2, 2])
    expect(sixPartLesson.reduce((sum, minutes) => sum + minutes, 0)).toBe(15)
    expect(shortLesson).toEqual([2, 2, 2, 2, 1, 1])
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

  it("builds distinct learner-facing alternate explanations", () => {
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

    expect(steps.title).toBe("Step by step")
    expect(steps.ordered).toBe(true)
    expect(steps.lines).toContain(
      "Name the rule: Check whether both sides are complete sentences."
    )
    expect(comparison.lines).toContain("Your choice: Keep the comma")
    expect(comparison.lines).toContain("Correct choice: Use a semicolon")
    expect(simpler.title).toBe("The simpler version")
    expect(simpler.lines[0]).toBe("The answer is Use a semicolon.")
    expect(
      new Set([
        steps.lines.join(" "),
        comparison.lines.join(" "),
        simpler.lines.join(" "),
      ])
    ).toHaveLength(3)
  })
})
