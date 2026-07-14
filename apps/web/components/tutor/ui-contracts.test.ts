import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

const root = new URL("../../", import.meta.url)

async function source(path: string) {
  return readFile(new URL(path, root), "utf8")
}

describe("mobile navigation contract", () => {
  it("keeps four primary mobile tabs, docks Scout, and moves secondary tools to More", async () => {
    const dashboard = await source("components/tutor/dashboard.tsx")
    const mobileNav = dashboard.slice(
      dashboard.indexOf('aria-label="Primary study navigation"'),
      dashboard.indexOf(
        "<MobileOverflow",
        dashboard.indexOf('aria-label="Primary study navigation"')
      )
    )
    expect(mobileNav.match(/<TabsTrigger/g)).toHaveLength(4)
    expect(mobileNav).toContain('value="today"')
    expect(mobileNav).toContain('value="plan"')
    expect(mobileNav).toContain('value="calibrate"')
    expect(mobileNav).toContain('value="progress"')
    expect(mobileNav).toContain("<MobileScoutDock")
    expect(mobileNav).toContain("More")
    expect(dashboard).toContain("Test Lab")
    expect(dashboard).toContain("Evidence & data")
    expect(dashboard).toContain("Learning settings")
  })

  it("protects mobile width and 44px interaction targets", async () => {
    const styles = await source("app/globals.css")
    expect(styles).toContain("overflow-x: clip")
    expect(styles).toContain("min-height: 44px")
  })
})

describe("Scout drawer accessibility contract", () => {
  it("traps focus, closes on Escape, returns focus, and avoids a mobile floating launcher", async () => {
    const assistant = await source("components/tutor/scout-assistant.tsx")
    expect(assistant).toContain('event.key === "Escape"')
    expect(assistant).toContain('event.key !== "Tab"')
    expect(assistant).toContain("lastFocusRef.current?.focus()")
    expect(assistant).toContain('aria-modal="true"')
    expect(assistant).toContain("right-6 bottom-6")
    expect(assistant).toContain("hidden items-center gap-2 sm:flex")
  })
})

describe("practice timing contract", () => {
  it("starts the solving clock when a new question renders", async () => {
    const workspace = await source("components/tutor/lesson-workspace.tsx")
    const timerEffect = workspace.indexOf(
      "startedAt.current = window.performance.now()"
    )
    const choiceHandler = workspace.indexOf("onChoiceChange(choice)")
    expect(timerEffect).toBeGreaterThan(-1)
    expect(timerEffect).toBeLessThan(choiceHandler)
    expect(workspace).toContain("}, [currentQuestion?.id])")
  })
})
