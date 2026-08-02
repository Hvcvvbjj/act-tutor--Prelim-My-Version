import { describe, expect, it } from "vitest"

import { resolveDashboardDestination } from "@/components/tutor/dashboard-navigation"

const defaultInput = {
  representativeDemo: false,
  adaptiveBaselineRequired: false,
  storedTab: null,
} as const

describe("restorable dashboard navigation", () => {
  it("restores a saved learner destination", () => {
    expect(
      resolveDashboardDestination({ ...defaultInput, storedTab: "history" })
    ).toBe("history")
  })

  it("falls back to Lessons when saved navigation is invalid", () => {
    expect(
      resolveDashboardDestination({ ...defaultInput, storedTab: "unknown" })
    ).toBe("today")
  })

  it("keeps explicit and required Quick Check entry ahead of saved navigation", () => {
    expect(
      resolveDashboardDestination({
        ...defaultInput,
        initialTab: "today",
        storedTab: "badges",
      })
    ).toBe("today")
    expect(
      resolveDashboardDestination({
        ...defaultInput,
        adaptiveBaselineRequired: true,
        storedTab: "history",
      })
    ).toBe("calibrate")
    expect(
      resolveDashboardDestination({
        ...defaultInput,
        representativeDemo: true,
        storedTab: "progress",
      })
    ).toBe("calibrate")
  })
})
