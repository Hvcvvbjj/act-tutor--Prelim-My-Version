import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface ScoutRequest {
  question?: unknown
  screen?: unknown
  mode?: unknown
  simple?: unknown
  context?: unknown
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.slice(0, 1200) : fallback
}

export async function POST(request: Request) {
  const body = (await request.json()) as ScoutRequest
  const question = text(body.question).trim()
  const screen = text(body.screen, "today")
  const mode = text(body.mode, "study")
  const context =
    body.context && typeof body.context === "object"
      ? (body.context as Record<string, unknown>)
      : {}
  if (!question) {
    return NextResponse.json(
      { error: "Ask Scout a question first." },
      { status: 400 }
    )
  }

  const lower = question.toLowerCase()
  const answerSeeking =
    /\b(answer|which choice|tell me which|solve|hint)\b/.test(lower)
  if (mode === "test" && answerSeeking) {
    return NextResponse.json({
      summary: "I can’t help with answers while you’re in Test Lab.",
      explanation:
        "That keeps the result useful. Finish or leave the timed section, and I can explain every missed question in review mode.",
      example: null,
      technical: "Guardrail: assessment_answer_leakage_blocked",
      nextAction:
        "Keep working, skip the question, or end the section and review it.",
      source: "Test Lab rules",
      mode: "guarded",
    })
  }

  const lessonTitle = text(context.lessonTitle, "today’s skill")
  const objective = text(
    context.objective,
    "Use the rule on a new ACT-style question."
  )
  const rule = text(
    context.rule,
    "Read the sentence, name the rule, then compare the choices."
  )
  const nextSkill = text(context.nextSkill, lessonTitle)
  const planReason = text(
    context.planReason,
    `${nextSkill} currently has the strongest evidence that it should come next.`
  )
  const correctOutcome = text(context.correctOutcome)
  const incorrectOutcome = text(context.incorrectOutcome)

  let summary = `Scout is focusing on ${lessonTitle} right now.`
  let explanation = objective
  let example: string | null = null
  let nextAction =
    "Continue the current mission and let the next scored answer update the plan."
  let source = "Current mission and reviewed lesson rule"

  if (/why.*(plan|skill|mission)|why this/.test(lower)) {
    summary = `${nextSkill} is first because it offers the best next learning move.`
    explanation = planReason
    example =
      correctOutcome && incorrectOutcome
        ? `${correctOutcome} ${incorrectOutcome}`
        : null
    nextAction = "Open My Skills to see the exact evidence and change line."
    source = "Learning Twin recommendation and plan counterfactual"
  } else if (/simpl|plain|layman|what does/.test(lower)) {
    summary = objective
    explanation = rule
    example = `In plain terms: name what the question is testing before you compare answer choices.`
    nextAction = "Try saying the rule once in your own words."
  } else if (/hint|stuck|help/.test(lower)) {
    summary = "Start by naming the rule before looking at the choices."
    explanation = rule
    example =
      "Cross out a choice only when you can name the exact rule it breaks."
    nextAction =
      "Use Hint 1 in guided practice. The exit ticket stays hint-free."
  } else if (/confidence|percent|mastery|estimate/.test(lower)) {
    const estimate = text(context.skillEstimate, "still forming")
    summary = `Scout’s current skill estimate is ${estimate}.`
    explanation =
      "That number is a practice estimate, not an ACT score. Correct, confident answers move it more than guesses, and Scout keeps uncertainty visible when evidence is thin."
    nextAction = "Open the Evidence Timeline to see which answers moved it."
    source = "Bayesian Knowledge Tracing learner model"
  } else if (screen === "plan") {
    summary = "The plan fits the time you said you can actually study."
    explanation = planReason
    nextAction = "Change your available days if this week no longer fits."
    source = "Goal, test date, availability, and current skill evidence"
  } else if (screen === "calibrate") {
    summary =
      "Quick Check chooses the question that can reduce uncertainty the most."
    explanation =
      "It samples every major domain, adapts the next question to your answers, and stops once it has enough confidence to choose a useful first mission."
    nextAction =
      "Answer independently; the full diagnostic remains optional for a narrower range."
    source = "2PL IRT adaptive assessment"
  }

  if (body.simple === true) {
    explanation = explanation.split(/(?<=[.!?])\s+/)[0] ?? explanation
  }

  return NextResponse.json({
    summary,
    explanation,
    example,
    technical: `Screen: ${screen} · grounded fallback · no answer key provided`,
    nextAction,
    source,
    mode: "grounded",
  })
}
