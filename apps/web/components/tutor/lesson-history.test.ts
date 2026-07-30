import { describe, expect, it } from "vitest"
import type { LessonCheckResult } from "@act-tutor/core"

import {
  currentRoundLessonCheck,
  historicalLessonRounds,
  lessonReviewById,
} from "@/components/tutor/lesson-history"

function lessonCheck(
  id: string,
  roundNumber: number,
  skill: string,
  completedAt: string,
  cycleKind: LessonCheckResult["cycleKind"] = "adaptive"
) {
  return {
    id,
    roundNumber,
    cycleKind,
    skill,
    completedAt,
    lesson: { title: `${skill} lesson` },
  } as LessonCheckResult
}

describe("completed lesson history", () => {
  const history = [
    lessonCheck(
      "round-1-english",
      1,
      "sentence-boundaries",
      "2026-07-01T12:00:00.000Z",
      "foundation"
    ),
    lessonCheck(
      "round-2-math",
      2,
      "linear-equations",
      "2026-07-10T12:00:00.000Z"
    ),
    lessonCheck(
      "round-3-reading",
      3,
      "supported-inference",
      "2026-07-20T12:00:00.000Z"
    ),
  ] as const

  it("resolves a completed lesson in the current round by its saved check", () => {
    expect(currentRoundLessonCheck(history, 3, "supported-inference")?.id).toBe(
      "round-3-reading"
    )
    expect(currentRoundLessonCheck(history, 3, "linear-equations")).toBe(
      undefined
    )
  })

  it("keeps earlier rounds available in newest-first, read-only groups", () => {
    const snapshot = structuredClone(history)
    const rounds = historicalLessonRounds(history, 3)

    expect(rounds.map((round) => round.roundNumber)).toEqual([2, 1])
    expect(rounds[0]?.lessons.map((lesson) => lesson.id)).toEqual([
      "round-2-math",
    ])
    expect(rounds[1]).toMatchObject({
      roundNumber: 1,
      cycleKind: "foundation",
    })
    expect(history).toEqual(snapshot)
  })

  it("opens an exact previous-round snapshot without falling back to the current skill", () => {
    expect(lessonReviewById(history, "round-1-english")).toMatchObject({
      id: "round-1-english",
      roundNumber: 1,
      skill: "sentence-boundaries",
    })
    expect(lessonReviewById(history, "missing-check")).toBeNull()
  })
})
