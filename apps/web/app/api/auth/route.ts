import { type NextRequest, NextResponse } from "next/server"

import {
  applyLinkedSessionCookies,
  assertSameOriginJson,
  AuthRequestError,
  clearAuthCookies,
  registerLearner,
  saveAccountPlan,
  setAuthCookie,
  signIn,
  signOut,
  viewerForRequest,
} from "@/lib/auth.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function json(payload: unknown, status = 200) {
  const response = NextResponse.json(payload, { status })
  response.headers.set("Cache-Control", "no-store")
  response.headers.set("Vary", "Cookie")
  return response
}

function errorResponse(error: unknown) {
  if (error instanceof AuthRequestError) {
    return json({ error: error.message }, error.status)
  }
  return json({ error: "The account request could not be completed." }, 500)
}

export async function GET(request: NextRequest) {
  try {
    return json({ viewer: await viewerForRequest(request) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOriginJson(request)
    const body = (await request.json()) as Record<string, unknown>

    if (body.action === "signup") {
      const result = await registerLearner(request, {
        username: body.username,
        displayName: body.displayName,
        password: body.password,
        savedPlan: body.savedPlan,
      })
      const response = json({ viewer: result.viewer }, 201)
      setAuthCookie(response, result.token, "learner")
      return response
    }

    if (body.action === "login") {
      const result = await signIn(
        { username: body.username, password: body.password },
        request
      )
      const response = json({ viewer: result.viewer })
      applyLinkedSessionCookies(response, result.linkedSessions)
      setAuthCookie(
        response,
        result.token,
        result.viewer.role === "judge" ? "judge" : "learner"
      )
      return response
    }

    if (body.action === "save_plan") {
      return json({ viewer: await saveAccountPlan(request, body.savedPlan) })
    }

    if (body.action === "logout") {
      await signOut(request)
      const response = json({ signedOut: true })
      clearAuthCookies(response)
      return response
    }

    throw new AuthRequestError("Unknown account action.", 400)
  } catch (error) {
    return errorResponse(error)
  }
}
