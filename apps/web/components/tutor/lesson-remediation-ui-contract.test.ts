import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

const root = new URL("../../", import.meta.url)

async function source(path: string) {
  return readFile(new URL(path, root), "utf8")
}

describe("lesson remediation UI contract", () => {
  it("keeps failed lesson checks in a required Mr. Kim correction flow", async () => {
    const [workspace, dashboard, route] = await Promise.all([
      source("components/tutor/lesson-workspace.tsx"),
      source("components/tutor/dashboard.tsx"),
      source("app/api/learning/route.ts"),
    ])

    expect(workspace).toContain("Mr. Kim · Required review")
    expect(workspace).toContain("Correct every")
    expect(workspace).toContain("Ask Mr. Kim about this question")
    expect(workspace).toContain("onSubmitRemediation")
    expect(workspace).not.toMatch(/rewrite the rule|teach it back/i)
    expect(dashboard).toContain('action: "answer_lesson_remediation"')
    expect(route).toContain('action === "answer_lesson_remediation"')
  })

  it("opens completed lessons as read-only reviews instead of restarting them", async () => {
    const [timeline, commandCenter, dashboard, workspace] = await Promise.all([
      source("components/tutor/lesson-timeline.tsx"),
      source("components/tutor/lessons-command-center.tsx"),
      source("components/tutor/dashboard.tsx"),
      source("components/tutor/lesson-workspace.tsx"),
    ])

    expect(timeline).not.toContain('lesson.status !== "completed"')
    expect(commandCenter).toContain('lesson.status === "completed"')
    expect(commandCenter).toContain("props.onReviewLesson(lesson.id)")
    expect(dashboard).toContain("learning.lessonHistory ?? []")
    expect(dashboard).toContain("<LessonReviewWorkspace")
    expect(workspace).toContain("export function LessonReviewWorkspace")
    expect(workspace).toContain("Completed lesson")
  })
})
