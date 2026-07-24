import { describe, expect, it } from "vitest"

import { studyTaskLaunchDecision } from "@/lib/study-task-routing"

const activeFocus = {
  mode: "focus",
  status: "lesson",
  todaySkill: "sentence-boundaries",
} as const

describe("study task routing", () => {
  it("does not mistake a future review for the current lesson", () => {
    expect(
      studyTaskLaunchDecision(
        {
          kind: "review",
          section: "english",
          skill: "sentence-boundaries",
        },
        activeFocus
      )
    ).toEqual({ type: "blocked" })
  })

  it("continues only when the task kind and active mission both match", () => {
    expect(
      studyTaskLaunchDecision(
        {
          kind: "focus",
          section: "english",
          skill: "sentence-boundaries",
        },
        activeFocus
      )
    ).toEqual({ type: "continue-current" })
    expect(
      studyTaskLaunchDecision(
        {
          kind: "review",
          section: "english",
          skill: "sentence-boundaries",
        },
        { ...activeFocus, mode: "retention", status: "practice" }
      )
    ).toEqual({ type: "continue-current" })
  })

  it("starts the workflow promised by each completed-plan task", () => {
    const completed = { ...activeFocus, status: "complete" } as const
    expect(
      studyTaskLaunchDecision(
        {
          kind: "review",
          section: "english",
          skill: "sentence-boundaries",
        },
        completed
      )
    ).toEqual({ type: "start-retention", skill: "sentence-boundaries" })
    expect(
      studyTaskLaunchDecision(
        { kind: "checkpoint", section: null, skill: null },
        completed
      )
    ).toEqual({ type: "start-checkpoint" })
    expect(
      studyTaskLaunchDecision(
        { kind: "timed", section: "math", skill: null },
        activeFocus
      )
    ).toEqual({
      type: "timed-practice",
      mode: "section",
      section: "math",
    })
  })
})
