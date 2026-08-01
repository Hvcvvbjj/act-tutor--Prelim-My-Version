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
    expect(summary).toContain("Toward momentum level")
    expect(summary).toContain("Study points unlock momentum levels")
    expect(summary).toContain("Badges earned or evolved this lesson")
    expect(summary).toContain('role="progressbar"')
    expect(workspace).toContain("<LessonRewardSummaryCard")
    expect(workspace).toContain("See lesson rewards")
  })

  it("keeps assessment movement separate from study-point momentum", async () => {
    const [summary, commandCenter] = await Promise.all([
      source("components/tutor/learning-reward-summary.tsx"),
      source("components/tutor/lessons-command-center.tsx"),
    ])

    expect(summary).toContain("Assessment estimate")
    expect(summary).toContain("Next round")
    expect(summary).toContain(
      "The assessment change comes from scored assessment answers"
    )
    expect(summary).not.toContain("motivational ACT-point")
    expect(commandCenter).toContain("<LearningRoundRewardSummary")
  })

  it("does not open optional cloud authorization from an automatic reward recap", async () => {
    const dashboard = await source("components/tutor/dashboard.tsx")

    expect(dashboard).toContain('"openai-responses-api"')
    expect(dashboard).toContain("if (!alreadyGenerated) return null")
    expect(dashboard).not.toContain("beginFreeCloudMrKimConnection")
    expect(dashboard).not.toContain("answerWithFreeCloudMrKimAI")
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
    expect(summary).toContain(
      "window.requestAnimationFrame(() => onDismiss?.())"
    )
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
