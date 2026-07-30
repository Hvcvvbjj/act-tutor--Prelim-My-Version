import { describe, expect, it } from "vitest"

import { shouldResumeRoundFullTest } from "@/components/tutor/round-full-test"

describe("round full-test resume policy", () => {
  it("resumes a core test that is still in progress", () => {
    expect(
      shouldResumeRoundFullTest(
        { id: "exam-in-progress", mode: "core", status: "in_progress" },
        "round-reward:full-test:an-older-exam"
      )
    ).toBe(true)
  })

  it("resumes a completed full test that has not started a lesson round", () => {
    expect(
      shouldResumeRoundFullTest(
        { id: "exam-unapplied", mode: "core", status: "completed" },
        null
      )
    ).toBe(true)
    expect(
      shouldResumeRoundFullTest(
        { id: "exam-unapplied", mode: "core", status: "completed" },
        "round-reward:diagnostic:diagnostic-attempt"
      )
    ).toBe(true)
  })

  it("starts fresh when the completed test already started the current round", () => {
    expect(
      shouldResumeRoundFullTest(
        { id: "exam-already-applied", mode: "core", status: "completed" },
        "round-reward:full-test:exam-already-applied"
      )
    ).toBe(false)
  })

  it("never resumes a section test or a missing session", () => {
    expect(
      shouldResumeRoundFullTest(
        { id: "section-test", mode: "section", status: "completed" },
        null
      )
    ).toBe(false)
    expect(shouldResumeRoundFullTest(null, null)).toBe(false)
  })
})
