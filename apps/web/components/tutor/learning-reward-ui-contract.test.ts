import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

const root = new URL("../../", import.meta.url)

async function source(path: string) {
  return readFile(new URL(path, root), "utf8")
}

describe("learning reward UI contract", () => {
  it("shows the exact lesson points, badge gains, and Mr. Kim progress summary", async () => {
    const [summary, workspace] = await Promise.all([
      source("components/tutor/learning-reward-summary.tsx"),
      source("components/tutor/lesson-workspace.tsx"),
    ])

    expect(summary).toContain("Mr. Kim says")
    expect(summary).toContain("study points")
    expect(summary).toContain("Badges earned or evolved this lesson")
    expect(summary).toContain('role="progressbar"')
    expect(summary).toContain("Scored diagnostics and full")
    expect(workspace).toContain("<LessonRewardSummaryCard")
    expect(workspace).toContain("See lesson rewards")
  })

  it("keeps assessment movement separate from the 1,000-to-1 point equivalent", async () => {
    const [summary, commandCenter] = await Promise.all([
      source("components/tutor/learning-reward-summary.tsx"),
      source("components/tutor/lessons-command-center.tsx"),
    ])

    expect(summary).toContain("Assessment estimate")
    expect(summary).toContain("1,000-to-1 point equivalent")
    expect(summary).toContain("The assessment change comes from scored answers")
    expect(commandCenter).toContain("<LearningRoundRewardSummary")
  })

  it("ships one-time badge evolution celebrations with accessible motion and audio controls", async () => {
    const [summary, badges, motivation] = await Promise.all([
      source("components/tutor/learning-reward-summary.tsx"),
      source("components/tutor/badges-surface.tsx"),
      source("../../packages/core/src/motivation.ts"),
    ])

    expect(summary).toContain('role="dialog"')
    expect(summary).toContain('aria-modal="true"')
    expect(summary).toContain("Close badge celebration")
    expect(summary).toContain("Turn celebration sound off")
    expect(summary).toContain("prefers-reduced-motion: reduce")
    expect(summary).toContain("playCelebrationSound")
    expect(summary).toContain("if (!visible || !audioEnabled")
    expect(summary).toContain("<GrowthPolygon")
    expect(badges).toContain("Bronze to Platinum")
    expect(badges).toContain("BADGE_ICONS")
    expect(motivation).toContain("buildBadgeEvolutionEvents")
    expect(motivation).toContain("score-improvement-5")
  })
})
