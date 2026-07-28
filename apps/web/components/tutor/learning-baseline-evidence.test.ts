import { describe, expect, it } from "vitest"

import { learningBaselineSkillResults } from "./learning-baseline-evidence"

describe("learning baseline evidence", () => {
  it("keeps completed diagnostic evidence after the ephemeral result is gone", () => {
    const persisted = [
      {
        skill: "sentence-boundaries",
        label: "Sentence boundaries",
        section: "english" as const,
        correct: 3,
        total: 5,
        accuracy: 0.6,
        signal: "developing" as const,
      },
    ]

    expect(
      learningBaselineSkillResults({
        profileSkillResults: persisted,
      })
    ).toEqual(persisted)
  })

  it("falls back to the live diagnostic result before the plan is persisted", () => {
    const live = [
      {
        skill: "linear-equations",
        label: "Linear equations",
        section: "math" as const,
        correct: 2,
        total: 5,
        accuracy: 0.4,
        signal: "focus" as const,
      },
    ]

    expect(
      learningBaselineSkillResults({
        profileSkillResults: [],
        diagnosticResult: { skillResults: live },
      })
    ).toEqual(live)
  })
})
