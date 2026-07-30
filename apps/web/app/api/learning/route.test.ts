import { NextRequest } from "next/server"
import { createAssessmentRemediationProgress } from "@act-tutor/core"
import { describe, expect, it } from "vitest"

import { assertRoundRemediationComplete } from "./round-remediation"
import { GET, POST } from "./route"

describe("round assessment remediation gate", () => {
  it("rejects an incomplete diagnostic or full-test review", () => {
    const required = createAssessmentRemediationProgress(
      ["missed-question"],
      "2026-07-28T12:00:00.000Z"
    )
    expect(() =>
      assertRoundRemediationComplete("diagnostic", required)
    ).toThrow("Correct every missed diagnostic question")
    expect(() => assertRoundRemediationComplete("full-test", required)).toThrow(
      "Correct every missed full-test question"
    )
  })

  it("accepts an assessment with no remaining missed questions", () => {
    const complete = createAssessmentRemediationProgress(
      [],
      "2026-07-28T12:00:00.000Z"
    )
    expect(() =>
      assertRoundRemediationComplete("diagnostic", complete)
    ).not.toThrow()
  })
})

describe("student learning API permissions", () => {
  it("requires the server's completed Round 0 diagnostic before creating Lessons", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          skill: "sentence-boundaries",
          diagnosticSkillResults: [
            {
              skill: "sentence-boundaries",
              label: "Sentence boundaries",
              section: "english",
              correct: 5,
              total: 5,
              accuracy: 1,
              signal: "strength",
            },
          ],
          goalScore: 30,
          currentScore: 24,
          daysUntilTest: 36,
          minutesPerSession: 30,
          studyDaysPerWeek: 3,
          preferredSection: "balanced",
        }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error:
        "Complete AlexACT's full 66-question diagnostic before opening Lessons.",
    })
  })

  it("does not let an old learning cookie bypass the Round 0 diagnostic", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/learning", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "ai_act_learning_session=legacy-learning-session",
        },
        body: JSON.stringify({
          action: "start",
          skill: "sentence-boundaries",
          diagnosticSkillResults: [
            {
              skill: "sentence-boundaries",
              label: "Sentence boundaries",
              section: "english",
              correct: 5,
              total: 5,
              accuracy: 1,
              signal: "strength",
            },
          ],
          goalScore: 30,
          currentScore: 24,
          daysUntilTest: 36,
          minutesPerSession: 30,
          studyDaysPerWeek: 3,
          preferredSection: "balanced",
        }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error:
        "Complete AlexACT's full 66-question diagnostic before opening Lessons.",
    })
  })

  it("does not expose an old lesson session through the restore endpoint", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/learning", {
        headers: {
          Cookie: "ai_act_learning_session=legacy-learning-session",
        },
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error:
        "Complete AlexACT's full 66-question diagnostic before opening Lessons.",
    })
  })

  it.each(["tutor_override", "review_lesson"])(
    "denies the removed %s staff action",
    async (action) => {
      const response = await POST(
        new NextRequest("http://localhost/api/learning", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            skill: "linear-equations",
            reason: "forged student request",
            approved: true,
          }),
        })
      )
      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: "Unknown learning action.",
      })
    }
  )
})
