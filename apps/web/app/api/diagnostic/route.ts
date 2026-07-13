import {
  scoreDiagnostic,
  toPublicDiagnosticForm,
  type DiagnosticAnswer,
} from "@act-tutor/core"

import { STARTER_DIAGNOSTIC_FORM } from "@/lib/diagnostic-content.server"

export function GET() {
  return Response.json(toPublicDiagnosticForm(STARTER_DIAGNOSTIC_FORM))
}

function parseAnswers(value: unknown): DiagnosticAnswer[] {
  if (!Array.isArray(value)) {
    throw new RangeError("Answers must be an array.")
  }

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    if (body.formId !== STARTER_DIAGNOSTIC_FORM.id) {
      throw new RangeError("Unknown diagnostic form.")
    }
    if (body.formVersion !== STARTER_DIAGNOSTIC_FORM.version) {
      throw new RangeError("This diagnostic version is no longer current.")
    }

    const result = scoreDiagnostic(
      STARTER_DIAGNOSTIC_FORM,
      parseAnswers(body.answers)
    )
    return Response.json(result)
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The diagnostic could not be scored.",
      },
      { status: 400 }
    )
  }
}
