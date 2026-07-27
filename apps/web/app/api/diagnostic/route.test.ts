import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

let temporaryDirectory = ""

function diagnosticRequest(body: Record<string, unknown>, cookie = "") {
  return new NextRequest("http://localhost/api/diagnostic", {
    method: "POST",
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
  it("replaces a completed general attempt, resumes an active one, and keeps round starts fresh", async () => {
    temporaryDirectory = await mkdtemp(
      join(tmpdir(), "scout-diagnostic-route-")
    )
    process.env.DIAGNOSTIC_STORE_PATH = join(
      temporaryDirectory,
      "diagnostic-sessions.json"
    )
    vi.resetModules()
    const { GET, POST } = await import("./route")

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

    const resumedResponse = await POST(
      diagnosticRequest(
        { action: "start_new_if_completed" },
        `ai_act_diag_session=${freshCookie}`
      )
    )
    const resumed = await resumedResponse.json()
    expect(resumed.attemptId).toBe(fresh.attemptId)

    const roundResponse = await POST(
      diagnosticRequest(
        { action: "start_new" },
        `ai_act_diag_session=${freshCookie}`
      )
    )
    const round = await roundResponse.json()
    expect(round.status).toBe("in_progress")
    expect(round.attemptId).not.toBe(fresh.attemptId)
  })
})
