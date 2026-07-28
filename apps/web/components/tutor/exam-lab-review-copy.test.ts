import { describe, expect, it } from "vitest"

import { examLabReviewCopy } from "./exam-lab-review-copy"

describe("exam lab final-review copy", () => {
  it("saves an incomplete timed run without promising a score", () => {
    expect(
      examLabReviewCopy({
        assessmentLabel: "Timed Practice",
        busy: false,
        sufficient: false,
        unanswered: 12,
      })
    ).toEqual({
      heading: "Review and save.",
      description:
        "12 questions are blank. Saving now keeps this incomplete run for review without creating a score range or lesson recommendation.",
      submitLabel: "Save incomplete run",
    })
  })

  it("uses the same evidence-aware language for a progress check", () => {
    expect(
      examLabReviewCopy({
        assessmentLabel: "Progress check",
        busy: true,
        sufficient: false,
        unanswered: 4,
      })
    ).toMatchObject({
      heading: "Review and save.",
      submitLabel: "Saving incomplete check…",
    })
  })

  it("keeps score language for a sufficiently answered run", () => {
    expect(
      examLabReviewCopy({
        assessmentLabel: "Timed Practice",
        busy: false,
        sufficient: true,
        unanswered: 2,
      })
    ).toEqual({
      heading: "Review and submit.",
      description:
        "2 questions are blank. Correct answers appear after submission.",
      submitLabel: "Score this practice test",
    })
  })
})
