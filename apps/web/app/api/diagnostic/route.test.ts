import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

let temporaryDirectory = ""

function diagnosticRequest(
  body: Record<string, unknown>,
  cookie = "",
  method: "POST" | "PATCH" = "POST"
) {
  return new NextRequest("http://localhost/api/diagnostic", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

afterEach(async () => {
  delete process.env.DIAGNOSTIC_STORE_PATH
  vi.resetModules()
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true })
    temporaryDirectory = ""
  }
})

describe("diagnostic attempt preparation", () => {
  it("replaces a completed attempt but preserves saved progress when the active attempt is reopened", async () => {
    temporaryDirectory = await mkdtemp(
      join(tmpdir(), "scout-diagnostic-route-")
    )
    process.env.DIAGNOSTIC_STORE_PATH = join(
      temporaryDirectory,
      "diagnostic-sessions.json"
    )
    vi.resetModules()
    const { GET, PATCH, POST } = await import("./route")

    const initialResponse = await GET(
      new NextRequest("http://localhost/api/diagnostic")
    )
    const initial = await initialResponse.json()
    const initialCookie = initialResponse.cookies.get(
      "ai_act_diag_session"
    )?.value
    expect(initialCookie).toBeTruthy()

    const completedResponse = await POST(
      diagnosticRequest(
        {
          formId: initial.form.id,
          formVersion: initial.form.version,
          answers: initial.form.questions.map(
            (question: { id: string; choices: Array<{ id: string }> }) => ({
              questionId: question.id,
              choiceId: question.choices[0].id,
            })
          ),
        },
        `ai_act_diag_session=${initialCookie}`
      )
    )
    expect((await completedResponse.json()).status).toBe("completed")

    const freshResponse = await POST(
      diagnosticRequest(
        { action: "start_new_if_completed" },
        `ai_act_diag_session=${initialCookie}`
      )
    )
    const fresh = await freshResponse.json()
    const freshCookie = freshResponse.cookies.get("ai_act_diag_session")?.value
    expect(fresh.status).toBe("in_progress")
    expect(fresh.attemptId).not.toBe(initial.attemptId)
    expect(freshCookie).toBe(fresh.attemptId)

    const firstQuestion = fresh.form.questions[0] as {
      id: string
      choices: Array<{ id: string }>
    }
    const savedResponse = await PATCH(
      diagnosticRequest(
        {
          formId: fresh.form.id,
          formVersion: fresh.form.version,
          progress: {
            answers: {
              [firstQuestion.id]: firstQuestion.choices[0].id,
            },
            currentIndex: 1,
            phase: "questions",
          },
        },
        `ai_act_diag_session=${freshCookie}`,
        "PATCH"
      )
    )
    expect(savedResponse.status).toBe(200)

    const resumedResponse = await POST(
      diagnosticRequest(
        { action: "start_new_if_completed" },
        `ai_act_diag_session=${freshCookie}`
      )
    )
    const resumed = await resumedResponse.json()
    expect(resumed.attemptId).toBe(fresh.attemptId)
    expect(resumed.progress).toMatchObject({
      answers: {
        [firstQuestion.id]: firstQuestion.choices[0].id,
      },
      currentIndex: 1,
      phase: "questions",
    })

    const resetResponse = await POST(
      diagnosticRequest(
        { action: "start_new" },
        `ai_act_diag_session=${freshCookie}`
      )
    )
    const reset = await resetResponse.json()
    expect(reset.status).toBe("in_progress")
    expect(reset.attemptId).not.toBe(fresh.attemptId)
  })
})
