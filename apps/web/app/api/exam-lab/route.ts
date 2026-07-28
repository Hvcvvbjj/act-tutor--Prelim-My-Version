import type {
  CoreSection,
  ExamConfidence,
  ExamLabMode,
  ExamLabResponse,
} from "@act-tutor/core"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { syncLinkedSession } from "@/lib/auth.server"
import {
  EXAM_LAB_FORMS,
  assessmentFormForAttempt,
} from "@/lib/diagnostic-content.server"
import {
  examDebriefComposer,
  examLabSessions,
  getExamLabSession,
} from "@/lib/exam-lab.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SESSION_COOKIE = "scout_exam_lab_session"
const FORM_COOKIE = "scout_exam_lab_form"
const FULL_ROTATION_COOKIE = "scout_exam_full_rotation"
const PROGRESS_ROTATION_COOKIE = "scout_exam_progress_rotation"
const MODES = new Set<ExamLabMode>(["sprint", "section", "core"])
const SECTIONS = new Set<CoreSection>(["english", "math", "reading"])
const CONFIDENCE = new Set<ExamConfidence>([
  "guess",
  "unsure",
  "sure",
  "unreported",
])

function errorResponse(error: unknown, status = 400) {
  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "The Timed Practice request failed.",
    },
    { status }
  )
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    priority: "high" as const,
  }
}

function setSessionCookie(
  response: NextResponse,
  sessionId: string,
  formId: string
) {
  response.cookies.set(SESSION_COOKIE, sessionId, {
    ...cookieOptions(),
  })
  response.cookies.set(FORM_COOKIE, formId, cookieOptions())
}

function requireSessionId(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) throw new RangeError("Timed Practice session not found.")
  return sessionId
}

function parseRotation(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "0", 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0
}

function startForm(request: NextRequest, purpose: unknown) {
  const progress = purpose === "progress-check"
  const rotationCookie = progress
    ? PROGRESS_ROTATION_COOKIE
    : FULL_ROTATION_COOKIE
  const rotation = parseRotation(request.cookies.get(rotationCookie)?.value)
  return {
    form: assessmentFormForAttempt(
      progress ? "progress-check" : "full-test",
      rotation
    ),
    rotationCookie,
    nextRotation: rotation + 1,
  }
}

async function formForRequest(request: NextRequest) {
  const formId = request.cookies.get(FORM_COOKIE)?.value
  const fromCookie = EXAM_LAB_FORMS.find((form) => form.id === formId)
  if (fromCookie) return fromCookie
  return (await getExamLabSession(requireSessionId(request))).form
}

function parseStart(body: Record<string, unknown>) {
  if (!MODES.has(body.mode as ExamLabMode))
    throw new RangeError("Unknown Timed Practice mode.")
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
    throw new RangeError("Timed Practice responses must be an object.")
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
    const { form, session } = await getExamLabSession(sessionId)
    const response = NextResponse.json({ session })
    response.cookies.set(FORM_COOKIE, form.id, cookieOptions())
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
      throw new RangeError("Timed Practice progress is malformed.")
    }
    const sessionId = requireSessionId(request)
    const session = await examLabSessions.save(
      sessionId,
      await formForRequest(request),
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
      const startInput = parseStart(body)
      const selected = startForm(request, body.purpose)
      const existingSessionId = request.cookies.get(SESSION_COOKIE)?.value
      const started = await examLabSessions.start(
        selected.form,
        startInput,
        existingSessionId ?? null
      )
      const response = NextResponse.json({ session: started.payload })
      setSessionCookie(response, started.sessionId, selected.form.id)
      response.cookies.set(
        selected.rotationCookie,
        String(selected.nextRotation),
        cookieOptions()
      )
      await syncLinkedSession(request, "examLab", started.sessionId)
      return response
    }
    if (body.action === "advance_section") {
      const form = await formForRequest(request)
      const session = await examLabSessions.advanceSection(
        requireSessionId(request),
        form
      )
      return NextResponse.json({ session })
    }
    if (body.action === "review") {
      const form = await formForRequest(request)
      const session = await examLabSessions.beginReview(
        requireSessionId(request),
        form
      )
      return NextResponse.json({ session })
    }
    if (body.action === "finalize") {
      const form = await formForRequest(request)
      const session = await examLabSessions.finalize(
        requireSessionId(request),
        form,
        examDebriefComposer
      )
      return NextResponse.json({ session })
    }
    throw new RangeError("Unknown Timed Practice action.")
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
    response.cookies.delete(FORM_COOKIE)
    return response
  } catch (error) {
    return errorResponse(error)
  }
}
