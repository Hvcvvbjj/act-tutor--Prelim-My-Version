import type {
  CoreSection,
  ExamConfidence,
  ExamLabMode,
  ExamLabResponse,
} from "@act-tutor/core"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { syncLinkedSession } from "@/lib/auth.server"
import { RAPID_DIAGNOSTIC_FORM } from "@/lib/diagnostic-content.server"
import { examDebriefComposer, examLabSessions } from "@/lib/exam-lab.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SESSION_COOKIE = "scout_exam_lab_session"
const MODES = new Set<ExamLabMode>(["sprint", "section", "core"])
const SECTIONS = new Set<CoreSection>(["english", "math", "reading"])
const CONFIDENCE = new Set<ExamConfidence>(["guess", "unsure", "sure"])

function errorResponse(error: unknown, status = 400) {
  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "The Test Day Lab request failed.",
    },
    { status }
  )
}

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

function requireSessionId(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) throw new RangeError("Test Day Lab session not found.")
  return sessionId
}

function parseStart(body: Record<string, unknown>) {
  if (!MODES.has(body.mode as ExamLabMode))
    throw new RangeError("Unknown Test Day Lab mode.")
  const mode = body.mode as ExamLabMode
  const section = body.section
  if (mode === "section" && !SECTIONS.has(section as CoreSection)) {
    throw new RangeError(
      "Choose English, Math, or Reading for a section simulation."
    )
  }
  return {
    mode,
    section: mode === "section" ? (section as CoreSection) : null,
    timeMultiplier: body.timeMultiplier === 1.5 ? (1.5 as const) : (1 as const),
  }
}

function parseResponses(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RangeError("Test Day Lab responses must be an object.")
  }
  const responses: Record<string, ExamLabResponse> = {}
  for (const [questionId, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new RangeError(`Response for ${questionId} is malformed.`)
    }
    const response = raw as Record<string, unknown>
    if (
      (response.choiceId !== null && typeof response.choiceId !== "string") ||
      !CONFIDENCE.has(response.confidence as ExamConfidence) ||
      typeof response.flagged !== "boolean" ||
      typeof response.elapsedSeconds !== "number"
    ) {
      throw new RangeError(`Response for ${questionId} is incomplete.`)
    }
    responses[questionId] = {
      choiceId: response.choiceId as string | null,
      confidence: response.confidence as ExamConfidence,
      flagged: response.flagged,
      elapsedSeconds: response.elapsedSeconds,
    }
  }
  return responses
}

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) return NextResponse.json({ session: null })
  try {
    const session = await examLabSessions.get(sessionId, RAPID_DIAGNOSTIC_FORM)
    const response = NextResponse.json({ session })
    response.headers.set("Cache-Control", "no-store")
    return response
  } catch {
    const response = NextResponse.json({ session: null })
    response.cookies.delete(SESSION_COOKIE)
    return response
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    if (
      !Number.isInteger(body.currentIndex) ||
      (body.phase !== "questions" && body.phase !== "review")
    ) {
      throw new RangeError("Test Day Lab progress is malformed.")
    }
    const session = await examLabSessions.save(
      requireSessionId(request),
      RAPID_DIAGNOSTIC_FORM,
      {
        responses: parseResponses(body.responses),
        currentIndex: body.currentIndex as number,
        phase: body.phase,
      }
    )
    return NextResponse.json({ session })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    if (body.action === "start") {
      const started = await examLabSessions.start(
        RAPID_DIAGNOSTIC_FORM,
        parseStart(body)
      )
      const response = NextResponse.json({ session: started.payload })
      setSessionCookie(response, started.sessionId)
      await syncLinkedSession(request, "examLab", started.sessionId)
      return response
    }
    if (body.action === "advance_section") {
      const session = await examLabSessions.advanceSection(
        requireSessionId(request),
        RAPID_DIAGNOSTIC_FORM
      )
      return NextResponse.json({ session })
    }
    if (body.action === "review") {
      const session = await examLabSessions.beginReview(
        requireSessionId(request),
        RAPID_DIAGNOSTIC_FORM
      )
      return NextResponse.json({ session })
    }
    if (body.action === "finalize") {
      const session = await examLabSessions.finalize(
        requireSessionId(request),
        RAPID_DIAGNOSTIC_FORM,
        examDebriefComposer
      )
      return NextResponse.json({ session })
    }
    throw new RangeError("Unknown Test Day Lab action.")
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionId = request.cookies.get(SESSION_COOKIE)?.value
    if (sessionId) await examLabSessions.reset(sessionId)
    await syncLinkedSession(request, "examLab", null)
    const response = NextResponse.json({ reset: true })
    response.cookies.delete(SESSION_COOKIE)
    return response
  } catch (error) {
    return errorResponse(error)
  }
}
