import type { LessonCheckResult, StudyPlanTask } from "@act-tutor/core"
import { describe, expect, it } from "vitest"

import {
  learningAwareStudyTasks,
  summarizeStudyWeekStatuses,
} from "./adaptive-plan-studio-logic"

function task(overrides: Partial<StudyPlanTask> = {}): StudyPlanTask {
  return {
    id: "2026-08-01-0-lesson-sentence-boundaries",
    date: "2026-08-01",
    slot: 0,
    kind: "lesson",
    title: "Sentence boundaries lesson",
    section: "english",
    skill: "sentence-boundaries",
    skillLabel: "Sentence boundaries",
    minutes: 30,
    reason: "This is today's foundation lesson.",
    status: "scheduled",
    locked: true,
    completedAt: null,
    ...overrides,
  }
}

const HISTORY = [
  {
    roundNumber: 1,
    skill: "sentence-boundaries",
    completedAt: "2026-08-01T16:05:00.000Z",
  },
] satisfies ReadonlyArray<
  Pick<LessonCheckResult, "roundNumber" | "skill" | "completedAt">
>

describe("adaptive plan learning reconciliation", () => {
  it("shows today's matching lesson as verified complete", () => {
    const result = learningAwareStudyTasks({
      tasks: [task()],
      today: "2026-08-01",
      roundNumber: 1,
      completedSkills: ["sentence-boundaries"],
      lessonHistory: HISTORY,
      completedAtFallback: "2026-08-01T16:06:00.000Z",
    })

    expect(result.tasks[0]).toMatchObject({
      status: "complete",
      completedAt: "2026-08-01T16:05:00.000Z",
    })
    expect(result.verifiedTaskIds.has(result.tasks[0]!.id)).toBe(true)
  })

  it("does not erase a future repeat or a different kind of task", () => {
    const future = task({ id: "future", date: "2026-08-08" })
    const review = task({ id: "review", kind: "review" })
    const result = learningAwareStudyTasks({
      tasks: [future, review],
      today: "2026-08-01",
      roundNumber: 1,
      completedSkills: ["sentence-boundaries"],
      lessonHistory: HISTORY,
      completedAtFallback: "2026-08-01T16:06:00.000Z",
    })

    expect(result.tasks).toEqual([future, review])
    expect(result.verifiedTaskIds.size).toBe(0)
  })

  it("separates completed time from work that is still scheduled", () => {
    const summary = summarizeStudyWeekStatuses(
      [
        task({ status: "complete" }),
        task({
          id: "scheduled",
          date: "2026-08-02",
          skill: "concision-and-redundancy",
        }),
        task({ id: "missed", date: "2026-07-31", status: "skipped" }),
      ],
      "2026-07-27"
    )

    expect(summary).toEqual({
      scheduledDays: 1,
      scheduledMinutes: 30,
      completedDays: 1,
      completedMinutes: 30,
      missedDays: 1,
      missedMinutes: 30,
    })
  })
})
