import { describe, expect, it } from "vitest"

import { calculateEmrComposite, normalizeCurrentScore } from "./scoring"

describe("calculateEmrComposite", () => {
  it.each([
    [{ english: 1, math: 1, reading: 2 }, 1],
    [{ english: 1, math: 2, reading: 2 }, 2],
    [{ english: 25, math: 24, reading: 24 }, 24],
    [{ english: 25, math: 25, reading: 24 }, 25],
    [{ english: 35, math: 36, reading: 36 }, 36],
  ])("rounds %# using the current EMR Composite", (scores, expected) => {
    expect(calculateEmrComposite(scores)).toBe(expected)
  })

  it("validates score bounds and integer values", () => {
    expect(() =>
      calculateEmrComposite({ english: 0, math: 24, reading: 24 })
    ).toThrow(RangeError)
    expect(() =>
      calculateEmrComposite({ english: 24.5, math: 24, reading: 24 })
    ).toThrow(RangeError)
  })
})

describe("normalizeCurrentScore", () => {
  it("keeps Science out of the Composite", () => {
    expect(
      normalizeCurrentScore({
        kind: "section_scores",
        composite: 25,
        english: 24,
        math: 23,
        reading: 26,
        science: 36,
      })
    ).toMatchObject({
      calculatedComposite: 24,
      reportedComposite: 25,
      compositeDifference: -1,
      planningBaseline: { english: 24, math: 23, reading: 26 },
      science: 36,
    })
  })

  it("uses a low-confidence proxy for Composite-only evidence", () => {
    expect(
      normalizeCurrentScore({ kind: "composite_only", composite: 27 })
    ).toMatchObject({
      calculatedComposite: null,
      confidence: "low",
      planningBaseline: { english: 27, math: 27, reading: 27 },
    })
  })

  it("leaves the baseline empty for a first-time tester", () => {
    expect(normalizeCurrentScore({ kind: "not_taken" })).toMatchObject({
      confidence: "none",
      planningBaseline: null,
    })
  })
})
