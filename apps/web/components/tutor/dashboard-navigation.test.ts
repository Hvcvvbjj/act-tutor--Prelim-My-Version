import { describe, expect, it } from "vitest"

import {
  dashboardDestinationFromSearch,
  dashboardUrlForDestination,
  resolveDashboardDestination,
} from "@/components/tutor/dashboard-navigation"

const defaultInput = {
  representativeDemo: false,
  adaptiveBaselineRequired: false,
  urlTab: null,
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

  it("uses the URL destination ahead of a saved destination", () => {
    expect(
      resolveDashboardDestination({
        ...defaultInput,
        urlTab: "progress",
        storedTab: "history",
      })
    ).toBe("progress")
  })

  it("keeps explicit and required Quick Check entry ahead of restored navigation", () => {
    expect(
      resolveDashboardDestination({
        ...defaultInput,
        initialTab: "today",
        urlTab: "history",
        storedTab: "badges",
      })
    ).toBe("today")
    expect(
      resolveDashboardDestination({
        ...defaultInput,
        adaptiveBaselineRequired: true,
        urlTab: "progress",
        storedTab: "history",
      })
    ).toBe("calibrate")
    expect(
      resolveDashboardDestination({
        ...defaultInput,
        representativeDemo: true,
        urlTab: "history",
        storedTab: "progress",
      })
    ).toBe("calibrate")
  })

  it("reads only supported destinations from the URL", () => {
    expect(dashboardDestinationFromSearch("?view=history")).toBe("history")
    expect(dashboardDestinationFromSearch("?view=unknown")).toBeNull()
    expect(dashboardDestinationFromSearch("?other=history")).toBeNull()
  })

  it("updates the destination without dropping other URL context", () => {
    expect(
      dashboardUrlForDestination(
        "https://example.test/?mode=demo#main-content",
        "history"
      )
    ).toBe("/?mode=demo&view=history#main-content")
    expect(
      dashboardUrlForDestination(
        "https://example.test/?mode=demo&view=history#main-content",
        "today"
      )
    ).toBe("/?mode=demo#main-content")
  })
})
