import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

const root = new URL("../../", import.meta.url)

async function source(path: string) {
  return readFile(new URL(path, root), "utf8")
}

describe("lesson remediation UI contract", () => {
  it("corrects every miss while emphasizing relearning only below the goal threshold", async () => {
    const [workspace, dashboard, route] = await Promise.all([
      source("components/tutor/lesson-workspace.tsx"),
      source("components/tutor/dashboard.tsx"),
      source("app/api/learning/route.ts"),
    ])

    expect(workspace).toContain('"Relearn recommended"')
    expect(workspace).toContain('"Correction review"')
    expect(workspace).toContain("belowLessonCheckTarget")
    expect(workspace).toContain("You met your")
    expect(workspace).toContain("Review the lesson or a free video")
    expect(workspace).toContain("Ask Mr. Kim about this question")
    expect(workspace).toContain("onSubmitRemediation")
    expect(workspace).not.toMatch(/rewrite the rule|teach it back/i)
    expect(dashboard).toContain('action: "answer_lesson_remediation"')
    expect(route).toContain('action === "answer_lesson_remediation"')
  })

  it("opens current and previous-round lessons as exact read-only snapshots", async () => {
    const [timeline, commandCenter, dashboard, workspace] = await Promise.all([
      source("components/tutor/lesson-timeline.tsx"),
      source("components/tutor/lessons-command-center.tsx"),
      source("components/tutor/dashboard.tsx"),
      source("components/tutor/lesson-workspace.tsx"),
    ])

    expect(timeline).not.toContain('lesson.status !== "completed"')
    expect(commandCenter).toContain('lesson.status === "completed"')
    expect(commandCenter).toContain("currentRoundLessonCheck")
    expect(commandCenter).toContain("historicalLessonRounds")
    expect(commandCenter).toContain("completed-lesson-library")
    expect(commandCenter).toContain("props.onReviewLesson(check.id)")
    expect(commandCenter).toContain("never changes")
    expect(dashboard).toContain("lessonReviewById")
    expect(dashboard).toContain("<LessonReviewWorkspace")
    expect(workspace).toContain("export function LessonReviewWorkspace")
    expect(workspace).toContain("Completed lesson")
  })

  it("keeps a no-busywork help tab in active and completed lessons", async () => {
    const workspace = await source("components/tutor/lesson-workspace.tsx")

    expect(workspace).toContain('"Still confused?"')
    expect(workspace).toContain("Choose one useful next step")
    expect(workspace).toContain("Ask Mr. Kim")
    expect(workspace).toContain("@khanacademy")
    expect(workspace).toContain("@TheOrganicChemistryTutor")
    expect(workspace.match(/<LessonSupportPanel/g)).toHaveLength(2)
  })
})
