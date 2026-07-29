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
      warningLabel: null,
      statusMessage:
        "Time is up. Answers and flags are locked. End this section to continue.",
    })
  })

  it("adds a text warning during the final minute", () => {
    expect(
      examLabTimerControls(
        60,
        "2026-07-26T12:01:00.000Z",
        Date.parse("2026-07-26T12:00:00.000Z")
      )
    ).toMatchObject({
      locked: false,
      endSectionLabel: "Review and finish section",
      warningLabel: "One minute or less",
    })
  })

  it("does not briefly warn or lock before a newly loaded clock initializes", () => {
    const controls = examLabTimerControls(
      0,
      "2026-07-26T12:05:00.000Z",
      Date.parse("2026-07-26T12:00:00.000Z")
    )

    expect(controls.locked).toBe(false)
    expect(controls.warningLabel).toBeNull()
  })
})
