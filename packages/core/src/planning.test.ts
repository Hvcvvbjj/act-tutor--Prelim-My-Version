import { describe, expect, it } from "vitest"

import {
  buildPlanIntensity,
  calendarDaysUntil,
  selectTargetVector,
} from "./planning"

describe("selectTargetVector", () => {
  it("selects the lowest squared movement that reaches the goal", () => {
    expect(
      selectTargetVector({
        current: { english: 20, math: 20, reading: 20 },
        goalComposite: 24,
      })
    ).toMatchObject({
      mode: "growth",
      scores: { english: 24, math: 24, reading: 23 },
      movement: { english: 4, math: 4, reading: 3 },
      totalMovement: 11,
      squaredMovement: 41,
    })
  })

  it("uses opportunity evidence to break equal-cost ties", () => {
    expect(
      selectTargetVector({
        current: { english: 20, math: 20, reading: 20 },
        goalComposite: 24,
        opportunityWeights: { reading: 1 },
      }).scores
    ).toEqual({ english: 24, math: 23, reading: 24 })

    expect(
      selectTargetVector({
        current: { english: 36, math: 34, reading: 34 },
        goalComposite: 36,
        opportunityWeights: { reading: 1 },
      }).scores
    ).toEqual({ english: 36, math: 35, reading: 36 })
  })

  it("returns retention when the goal is already met", () => {
    expect(
      selectTargetVector({
        current: { english: 30, math: 28, reading: 29 },
        goalComposite: 27,
      })
    ).toMatchObject({
      mode: "retention",
      scores: { english: 30, math: 28, reading: 29 },
      totalMovement: 0,
    })
  })
})

describe("calendarDaysUntil", () => {
  it("calculates a timezone-independent 36-day runway", () => {
    expect(calendarDaysUntil("2026-07-12", "2026-08-17")).toBe(36)
  })

  it("rejects malformed and impossible dates", () => {
    expect(() => calendarDaysUntil("07/12/2026", "2026-08-17")).toThrow(
      RangeError
    )
    expect(() => calendarDaysUntil("2026-02-30", "2026-08-17")).toThrow(
      RangeError
    )
  })
})

describe("buildPlanIntensity", () => {
  it("builds a balanced plan for a 36-day runway", () => {
    expect(
      buildPlanIntensity({
        daysUntilTest: 36,
        current: { english: 20, math: 20, reading: 20 },
        target: { english: 24, math: 24, reading: 23 },
      })
    ).toEqual({
      mode: "growth",
      phase: "balanced",
      daysUntilTest: 36,
      totalSectionMovement: 11,
      studyDaysPerWeek: 5,
      minutesPerSession: 30,
      weeklyMinutes: 150,
      checkpointEveryDays: 7,
      mix: {
        review: 0.15,
        lesson: 0.3,
        focusedPractice: 0.35,
        timedMixed: 0.2,
      },
    })
  })

  it.each([
    [85, "foundation"],
    [84, "balanced"],
    [35, "balanced"],
    [34, "focused"],
    [7, "focused"],
    [6, "triage"],
  ])("maps %i days to the %s phase", (daysUntilTest, phase) => {
    expect(
      buildPlanIntensity({
        daysUntilTest,
        current: { english: 20, math: 20, reading: 20 },
        target: { english: 21, math: 21, reading: 21 },
      }).phase
    ).toBe(phase)
  })

  it("rejects past tests and targets below the current scores", () => {
    expect(() =>
      buildPlanIntensity({
        daysUntilTest: 0,
        current: { english: 20, math: 20, reading: 20 },
        target: { english: 21, math: 21, reading: 21 },
      })
    ).toThrow(RangeError)
    expect(() =>
      buildPlanIntensity({
        daysUntilTest: 10,
        current: { english: 20, math: 20, reading: 20 },
        target: { english: 19, math: 21, reading: 21 },
      })
    ).toThrow(RangeError)
  })
})
