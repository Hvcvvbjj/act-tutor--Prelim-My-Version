import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

const root = new URL("../../", import.meta.url)

async function source(path: string) {
  return readFile(new URL(path, root), "utf8")
}

describe("desktop secondary-surface hierarchy", () => {
  it("leads Data and privacy with controls and keeps model details optional", async () => {
    const operations = await source("components/tutor/scout-operations-lab.tsx")
    const learnerModel = await source(
      "components/tutor/scout-operations/learner-model-view.tsx"
    )

    expect(operations).toContain("Data &amp; privacy")
    expect(operations).toContain("See and control what Scout saves")
    expect(operations).toContain('label: "Your data"')
    expect(operations).toContain('label: "ACT timing"')
    expect(learnerModel).toContain("What Scout saves")
    expect(learnerModel.indexOf("What Scout saves")).toBeLessThan(
      learnerModel.indexOf("Current skill estimate")
    )
    expect(learnerModel).toContain("Correct a skill estimate")
    expect(learnerModel).not.toContain("Practice options")
    expect(learnerModel.match(/<details/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it("keeps ACT strategy to a useful timing reference", async () => {
    const actTiming = await source(
      "components/tutor/scout-operations/act-strategy-view.tsx"
    )

    expect(actTiming).toContain("ACT timing reference")
    expect(actTiming).toContain("A simple pacing ladder")
    expect(actTiming).not.toContain("Target-score simulator")
    expect(actTiming).not.toContain("Section strategy trainer")
    expect(actTiming).not.toContain("Parallel forms and exposure protection")
  })

  it("centers the latest Scout answer and demotes older answers", async () => {
    const assistant = await source("components/tutor/scout-assistant.tsx")

    expect(assistant).toContain("screenMessages.length === 0")
    expect(assistant).toContain("latestMessage")
    expect(assistant).toContain("Earlier answers")
    expect(assistant).toContain("Simplify this answer")
    expect(assistant).not.toContain("Another example")
  })

  it("separates the current lesson from the adaptive skill priority", async () => {
    const progress = await source("components/tutor/learning-twin-lab.tsx")
    const profile = await source("components/tutor/mastery-profile.tsx")

    expect(progress).toContain("Continue lesson:")
    expect(progress).toContain("adaptive priority may")
    expect(profile).toContain("Adaptive priority")
    expect(profile).toContain("Your current lesson may still come first.")
    expect(profile).toContain("Why Scout prioritizes this")
    expect(profile).not.toContain("Study next")
    expect(profile).not.toContain("Why this is next")
  })
})
