import type { DiagnosticAnswer } from "@act-tutor/core"
import type { SaveDiagnosticProgress } from "@act-tutor/server"
import { type NextRequest, NextResponse } from "next/server"

import { syncLinkedSession } from "@/lib/auth.server"
import { RAPID_DIAGNOSTIC_FORM } from "@/lib/diagnostic-content.server"
import { diagnosticSessions } from "@/lib/diagnostic-sessions.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SESSION_COOKIE = "ai_act_diag_session"

function setSessionCookie(response: NextResponse, sessionId: string) {
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    priority: "high",
  })
}

function errorResponse(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "The diagnostic request could not be completed.",
    },
    { status: 400 }
  )
}

function requireSessionId(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) throw new RangeError("Diagnostic session not found.")
  return sessionId
}

function parseAnswers(value: unknown): DiagnosticAnswer[] {
  if (!Array.isArray(value)) throw new RangeError("Answers must be an array.")
  return value.map((answer) => {
    if (!answer || typeof answer !== "object") {
      throw new RangeError("Each answer must be an object.")
    }
    const candidate = answer as Record<string, unknown>
    if (
      typeof candidate.questionId !== "string" ||
      typeof candidate.choiceId !== "string"
    ) {
      throw new RangeError("Each answer needs a questionId and choiceId.")
    }
    return {
      questionId: candidate.questionId,
      choiceId: candidate.choiceId,
    }
  })
}

function parseProgress(value: unknown): SaveDiagnosticProgress {
  if (!value || typeof value !== "object") {
    throw new RangeError("Progress must be an object.")
  }
  const candidate = value as Record<string, unknown>
  if (
    !candidate.answers ||
    typeof candidate.answers !== "object" ||
    Array.isArray(candidate.answers) ||
    typeof candidate.currentIndex !== "number" ||
    (candidate.phase !== "questions" && candidate.phase !== "review")
  ) {
    throw new RangeError("Progress is incomplete or malformed.")
  }

  const answers: Record<string, string> = {}
  for (const [questionId, choiceId] of Object.entries(candidate.answers)) {
    if (typeof choiceId !== "string") {
      throw new RangeError(`Answer for ${questionId} must be a choice ID.`)
    }
    answers[questionId] = choiceId
  }
  return {
    answers,
    currentIndex: candidate.currentIndex,
    phase: candidate.phase,
  }
}

function assertCurrentForm(body: Record<string, unknown>) {
  if (body.formId !== RAPID_DIAGNOSTIC_FORM.id) {
    throw new RangeError("Unknown diagnostic form.")
  }
  if (body.formVersion !== RAPID_DIAGNOSTIC_FORM.version) {
    throw new RangeError("This diagnostic version is no longer current.")
  }
}

function parsePurpose(value: unknown): "baseline" | "round" {
  if (value === undefined || value === "baseline") return "baseline"
  if (value === "round") return "round"
  throw new RangeError("Unknown diagnostic purpose.")
}

export async function GET(request: NextRequest) {
  try {
    const session = await diagnosticSessions.getOrCreate(
      request.cookies.get(SESSION_COOKIE)?.value ?? null,
      RAPID_DIAGNOSTIC_FORM
    )
    const response = NextResponse.json(session.payload)
    response.headers.set("Cache-Control", "no-store")
    setSessionCookie(response, session.sessionId)
    await syncLinkedSession(request, "diagnostic", session.sessionId)
    return response
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    assertCurrentForm(body)
    const payload = await diagnosticSessions.saveProgress(
      requireSessionId(request),
      RAPID_DIAGNOSTIC_FORM,
      parseProgress(body.progress)
    )
    return NextResponse.json(payload)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    if (body.action === "answer_remediation") {
      if (
        typeof body.questionId !== "string" ||
        typeof body.choiceId !== "string"
      ) {
        throw new RangeError("A review question and answer are required.")
      }
      const payload = await diagnosticSessions.answerRemediation(
        requireSessionId(request),
        RAPID_DIAGNOSTIC_FORM,
        {
          questionId: body.questionId,
          choiceId: body.choiceId,
        }
      )
      return NextResponse.json(payload)
    }
    if (body.action === "start_new") {
      const purpose = parsePurpose(body.purpose)
      const existingSessionId = request.cookies.get(SESSION_COOKIE)?.value
      const session = await diagnosticSessions.startNew(
        existingSessionId ?? null,
        RAPID_DIAGNOSTIC_FORM,
        purpose
      )
      const response = NextResponse.json(session.payload)
      response.headers.set("Cache-Control", "no-store")
      setSessionCookie(response, session.sessionId)
      await syncLinkedSession(request, "diagnostic", session.sessionId)
      return response
    }
    if (body.action === "start_new_if_completed") {
      const purpose = parsePurpose(body.purpose)
      const current = await diagnosticSessions.getOrCreate(
        request.cookies.get(SESSION_COOKIE)?.value ?? null,
        RAPID_DIAGNOSTIC_FORM,
        purpose
      )
      const session =
        current.payload.status === "completed" &&
        (purpose === "baseline" ||
          current.payload.purpose !== purpose ||
          current.payload.remediation?.status === "complete")
          ? await diagnosticSessions.startNew(
              current.sessionId,
              RAPID_DIAGNOSTIC_FORM,
              purpose
            )
          : current
      const response = NextResponse.json(session.payload)
      response.headers.set("Cache-Control", "no-store")
      setSessionCookie(response, session.sessionId)
      await syncLinkedSession(request, "diagnostic", session.sessionId)
      return response
    }
    assertCurrentForm(body)
    const payload = await diagnosticSessions.finalize(
      requireSessionId(request),
      RAPID_DIAGNOSTIC_FORM,
      parseAnswers(body.answers)
    )
    return NextResponse.json(payload)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionId = request.cookies.get(SESSION_COOKIE)?.value
    if (sessionId) await diagnosticSessions.reset(sessionId)
    await syncLinkedSession(request, "diagnostic", null)
    const response = NextResponse.json({ reset: true })
    response.cookies.delete(SESSION_COOKIE)
    return response
  } catch (error) {
    return errorResponse(error)
  }
}
