import { describe, expect, it } from "vitest"

import { examLabTimerControls } from "./exam-lab-timer"

describe("exam lab timer controls", () => {
  it("locks response controls and makes the next action explicit at zero", () => {
    expect(
      examLabTimerControls(
        0,
        "2026-07-26T12:00:00.000Z",
        Date.parse("2026-07-26T12:00:01.000Z")
      )
    ).toEqual({
      locked: true,
      endSectionLabel: "End section to continue",
      statusMessage:
        "Time is up. Answers and flags are locked. End this section to continue.",
    })
  })

  it("does not briefly lock a newly loaded section before its clock initializes", () => {
    expect(
      examLabTimerControls(
        0,
        "2026-07-26T12:05:00.000Z",
        Date.parse("2026-07-26T12:00:00.000Z")
      ).locked
    ).toBe(false)
  })
})
