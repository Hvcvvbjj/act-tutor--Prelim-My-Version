import { describe, expect, it } from "vitest"

import {
  assessmentSecondsRemaining,
  diagnosticTimerStorageKey,
  formatAssessmentTime,
  PRACTICE_DIFFICULTY_LABELS,
  resolveAssessmentDeadline,
} from "./assessment-display"

describe("assessment display helpers", () => {
  it("formats section and full-test countdowns without going negative", () => {
    expect(formatAssessmentTime(65)).toBe("01:05")
    expect(formatAssessmentTime(7_501)).toBe("2:05:01")
    expect(formatAssessmentTime(-1)).toBe("00:00")
  })

  it("resumes a saved diagnostic deadline instead of resetting the clock", () => {
    const now = Date.parse("2026-07-27T12:00:00.000Z")
    const saved = now + 15 * 60_000

    expect(resolveAssessmentDeadline(String(saved), now, 3_780)).toBe(saved)
    expect(assessmentSecondsRemaining(saved, now)).toBe(900)
    expect(diagnosticTimerStorageKey("attempt-1")).toContain("attempt-1")
  })

  it("creates a duration-based deadline when no valid saved value exists", () => {
    const now = 1_000
    expect(resolveAssessmentDeadline(null, now, 90)).toBe(91_000)
    expect(resolveAssessmentDeadline("not-a-date", now, 90)).toBe(91_000)
  })

  it("publishes plain-language labels for every lesson difficulty", () => {
    expect(PRACTICE_DIFFICULTY_LABELS).toEqual({
      easy: "Easy",
      medium: "Medium",
      hard: "Hard",
    })
  })
})
