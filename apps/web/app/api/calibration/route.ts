import { type NextRequest, NextResponse } from "next/server"

import {
  AuthRequestError,
  requireJudge,
  syncLinkedSession,
} from "@/lib/auth.server"
import { CALIBRATION_BANK, calibrationSessions } from "@/lib/calibration.server"
import { LEARNING_BANK } from "@/lib/learning-content.server"
import { learningSessions } from "@/lib/learning-sessions.server"
import type { CalibrationKnowledgeEvidence } from "@act-tutor/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CALIBRATION_COOKIE = "ai_act_calibration_session"
const LEARNING_COOKIE = "ai_act_learning_session"

function setSessionCookie(response: NextResponse, sessionId: string) {
  response.cookies.set(CALIBRATION_COOKIE, sessionId, {
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
          : "The Quick Check could not be completed.",
    },
    { status: error instanceof AuthRequestError ? error.status : 400 }
  )
}

async function syncLearningTwin(
  request: NextRequest,
  evidence: ReadonlyArray<CalibrationKnowledgeEvidence>
) {
  const learningSessionId = request.cookies.get(LEARNING_COOKIE)?.value
  if (!learningSessionId || evidence.length === 0) return false
  try {
    for (const observation of evidence) {
      await learningSessions.recordCalibrationEvidence(
        learningSessionId,
        LEARNING_BANK,
        observation
      )
    }
    return true
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await calibrationSessions.getOrCreate(
      request.cookies.get(CALIBRATION_COOKIE)?.value ?? null,
      CALIBRATION_BANK
    )
    const response = NextResponse.json(session.payload)
    response.headers.set("Cache-Control", "no-store")
    setSessionCookie(response, session.sessionId)
    await syncLinkedSession(request, "calibration", session.sessionId)
    return response
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    if (body.action === "seed_demo" || body.action === "seed_preview") {
      if (body.action === "seed_demo") await requireJudge(request)
      const existing = request.cookies.get(CALIBRATION_COOKIE)?.value
      if (existing) await calibrationSessions.reset(existing)
      const seeded =
        await calibrationSessions.seedRepresentative(CALIBRATION_BANK)
      const learningTwinUpdated = await syncLearningTwin(
        request,
        seeded.evidence
      )
      const response = NextResponse.json({
        ...seeded.payload,
        learningTwinUpdated,
      })
      response.headers.set("Cache-Control", "no-store")
      setSessionCookie(response, seeded.sessionId)
      await syncLinkedSession(request, "calibration", seeded.sessionId)
      return response
    }

    if (
      body.action !== "answer" ||
      typeof body.questionId !== "string" ||
      typeof body.choiceId !== "string"
    ) {
      throw new RangeError(
        "A calibration action, questionId, and choiceId are required."
      )
    }
    const sessionId = request.cookies.get(CALIBRATION_COOKIE)?.value
    if (!sessionId) throw new RangeError("Calibration session not found.")
    const answered = await calibrationSessions.answer(
      sessionId,
      CALIBRATION_BANK,
      {
        questionId: body.questionId,
        choiceId: body.choiceId,
        confidence:
          body.confidence === "unsure" || body.confidence === "guessing"
            ? body.confidence
            : "sure",
      }
    )
    const learningTwinUpdated = answered.evidence
      ? await syncLearningTwin(request, [answered.evidence])
      : false
    const response = NextResponse.json({
      ...answered.payload,
      learningTwinUpdated,
    })
    response.headers.set("Cache-Control", "no-store")
    return response
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionId = request.cookies.get(CALIBRATION_COOKIE)?.value
    if (sessionId) await calibrationSessions.reset(sessionId)
    await syncLinkedSession(request, "calibration", null)
    const response = NextResponse.json({ reset: true })
    response.cookies.delete(CALIBRATION_COOKIE)
    return response
  } catch (error) {
    return errorResponse(error)
  }
}
