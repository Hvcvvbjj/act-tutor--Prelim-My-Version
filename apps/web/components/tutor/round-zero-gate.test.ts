import { describe, expect, it } from "vitest"

import {
  hasCompletedRoundZeroDiagnostic,
  hasResumableRoundZeroDiagnostic,
} from "./round-zero-gate"

function diagnosticSession(overrides: Record<string, unknown> = {}) {
  return {
    status: "completed",
    form: {
      id: "scout-full-diagnostic",
      version: "v1",
      questions: Array.from({ length: 66 }, (_, index) => ({
        id: `question-${index + 1}`,
      })),
    },
    result: {
      formId: "scout-full-diagnostic",
      formVersion: "v1",
    },
    ...overrides,
  }
}

describe("Round 0 restore gate", () => {
  it("accepts a completed, matching 66-question diagnostic", () => {
    expect(hasCompletedRoundZeroDiagnostic(diagnosticSession())).toBe(true)
  })

  it("keeps Lessons gated while the diagnostic is unfinished", () => {
    expect(
      hasCompletedRoundZeroDiagnostic(
        diagnosticSession({ status: "in_progress", result: null })
      )
    ).toBe(false)
  })

  it("does not mistake a shorter check for the required diagnostic", () => {
    expect(
      hasCompletedRoundZeroDiagnostic(
        diagnosticSession({
          form: {
            id: "scout-full-diagnostic",
            version: "v1",
            questions: Array.from({ length: 12 }, (_, index) => ({
              id: `question-${index + 1}`,
            })),
          },
        })
      )
    ).toBe(false)
  })

  it("rejects stale results from a different form version", () => {
    expect(
      hasCompletedRoundZeroDiagnostic(
        diagnosticSession({
          result: {
            formId: "scout-full-diagnostic",
            formVersion: "old-version",
          },
        })
      )
    ).toBe(false)
  })

  it("resumes a saved answer instead of returning to the intro", () => {
    expect(
      hasResumableRoundZeroDiagnostic({
        status: "in_progress",
        progress: {
          answers: { "question-1": "a" },
          currentIndex: 0,
          phase: "questions",
        },
      })
    ).toBe(true)
  })

  it("keeps a brand-new attempt on the diagnostic intro", () => {
    expect(
      hasResumableRoundZeroDiagnostic({
        status: "in_progress",
        progress: {
          answers: {},
          currentIndex: 0,
          phase: "questions",
        },
      })
    ).toBe(false)
  })
})
