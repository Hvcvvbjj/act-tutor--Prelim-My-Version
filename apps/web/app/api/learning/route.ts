import type { DiagnosticSkillResult } from "@act-tutor/core"
import { type NextRequest, NextResponse } from "next/server"

import { LEARNING_BANK } from "@/lib/learning-content.server"
import { learningSessions } from "@/lib/learning-sessions.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SESSION_COOKIE = "ai_act_learning_session"

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
          : "The learning request could not be completed.",
    },
    { status: 400 }
  )
}

function requireSessionId(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) throw new RangeError("Learning session not found.")
  return sessionId
}

function parseDiagnosticSkillResults(value: unknown): DiagnosticSkillResult[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new RangeError("Diagnostic skill results must be an array.")
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new RangeError("Diagnostic skill result must be an object.")
    }
    const candidate = item as Record<string, unknown>
    if (
      typeof candidate.skill !== "string" ||
      typeof candidate.label !== "string" ||
      (candidate.section !== "english" &&
        candidate.section !== "math" &&
        candidate.section !== "reading") ||
      typeof candidate.correct !== "number" ||
      typeof candidate.total !== "number" ||
      typeof candidate.accuracy !== "number" ||
      (candidate.signal !== "strength" &&
        candidate.signal !== "developing" &&
        candidate.signal !== "focus")
    ) {
      throw new RangeError("Diagnostic skill result is malformed.")
    }
    return {
      skill: candidate.skill,
      label: candidate.label,
      section: candidate.section,
      correct: candidate.correct,
      total: candidate.total,
      accuracy: candidate.accuracy,
      signal: candidate.signal,
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const payload = await learningSessions.get(requireSessionId(request), LEARNING_BANK)
    const response = NextResponse.json(payload)
    response.headers.set("Cache-Control", "no-store")
    return response
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const action = body.action

    if (action === "start") {
      if (typeof body.skill !== "string") throw new RangeError("Learning skill is required.")
      const session = await learningSessions.getOrCreate(
        request.cookies.get(SESSION_COOKIE)?.value ?? null,
        LEARNING_BANK,
        {
          skill: body.skill,
          diagnosticSkillResults: parseDiagnosticSkillResults(body.diagnosticSkillResults),
        }
      )
      const response = NextResponse.json(session.payload)
      response.headers.set("Cache-Control", "no-store")
      setSessionCookie(response, session.sessionId)
      return response
    }

    if (action === "complete_lesson") {
      const payload = await learningSessions.completeLesson(
        requireSessionId(request),
        LEARNING_BANK
      )
      return NextResponse.json(payload)
    }

    if (action === "answer") {
      if (typeof body.questionId !== "string" || typeof body.choiceId !== "string") {
        throw new RangeError("A questionId and choiceId are required.")
      }
      const payload = await learningSessions.answerQuestion(
        requireSessionId(request),
        LEARNING_BANK,
        { questionId: body.questionId, choiceId: body.choiceId }
      )
      return NextResponse.json(payload)
    }

    throw new RangeError("Unknown learning action.")
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionId = request.cookies.get(SESSION_COOKIE)?.value
    if (sessionId) await learningSessions.reset(sessionId)
    const response = NextResponse.json({ reset: true })
    response.cookies.delete(SESSION_COOKIE)
    return response
  } catch (error) {
    return errorResponse(error)
  }
}
