import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

import { alexActTransitionFrame } from "@/components/tutor/alexact-transition"

const root = new URL("./", import.meta.url)

async function source(name: string) {
  return readFile(new URL(name, root), "utf8")
}

describe("assessment transition contract", () => {
  it("uses a brief branded white progress screen with rotating plain copy", async () => {
    const transition = await source("alexact-transition.tsx")

    expect(transition).toContain("Alex")
    expect(transition).toContain("bg-white")
    expect(transition).toContain('role="progressbar"')
    expect(transition).toContain("maximumMs = 7_000")
    expect(transition).toContain("Organizing missed questions for History.")
    expect(transition).toContain("prefers-reduced-motion: reduce")
    expect(transition).toContain("Your saved answers are safe.")
  })

  it("stops every animated frame at seven seconds and waits statically", () => {
    const beforeBound = alexActTransitionFrame({
      elapsedMs: 6_999,
      ready: false,
      reducedMotion: false,
      maximumMs: 7_000,
      copyLength: 3,
    })
    const atBound = alexActTransitionFrame({
      elapsedMs: 7_000,
      ready: false,
      reducedMotion: false,
      maximumMs: 7_000,
      copyLength: 3,
    })
    const longAfterBound = alexActTransitionFrame({
      elapsedMs: 45_000,
      ready: false,
      reducedMotion: false,
      maximumMs: 7_000,
      copyLength: 3,
    })

    expect(beforeBound.motionActive).toBe(true)
    expect(atBound).toMatchObject({
      elapsedMs: 7_000,
      delayed: true,
      motionActive: false,
      messageIndex: 2,
      progress: 94,
      completionDelayMs: null,
    })
    expect(longAfterBound).toEqual(atBound)
  })

  it("uses a static frame immediately when reduced motion is requested", () => {
    const initial = alexActTransitionFrame({
      elapsedMs: 0,
      ready: false,
      reducedMotion: true,
      maximumMs: 7_000,
      copyLength: 3,
    })
    const later = alexActTransitionFrame({
      elapsedMs: 5_000,
      ready: false,
      reducedMotion: true,
      maximumMs: 7_000,
      copyLength: 3,
    })
    const readyAtBound = alexActTransitionFrame({
      elapsedMs: 7_000,
      ready: true,
      reducedMotion: false,
      maximumMs: 7_000,
      copyLength: 3,
    })

    expect(initial).toMatchObject({
      motionActive: false,
      messageIndex: 0,
      progress: 36,
    })
    expect(later).toMatchObject({
      motionActive: false,
      messageIndex: 0,
      progress: 36,
    })
    expect(readyAtBound.completionDelayMs).toBe(0)
  })

  it("covers set preparation and diagnostic/full-test scoring", async () => {
    const [diagnostic, testLab] = await Promise.all([
      source("diagnostic-runner.tsx"),
      source("test-day-lab.tsx"),
    ])

    expect(diagnostic).toContain('setPhase("scoring")')
    expect(diagnostic).toContain('<AlexActTransition\n        kind="scoring"')
    expect(testLab).toContain('setScreen("preparing")')
    expect(testLab).toContain('setScreen("scoring")')
    expect(testLab).toContain("onFullTestCompleted")
  })

  it("returns an explicit composite and section result for a full test", async () => {
    const report = await source("exam-lab-report.tsx")

    expect(report).toContain("Composite estimate")
    expect(report).toContain("result.practiceEstimate.estimate")
    expect(report).toContain("Section breakdown")
  })
})
