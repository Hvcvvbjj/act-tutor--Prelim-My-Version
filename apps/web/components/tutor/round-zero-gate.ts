const ROUND_ZERO_QUESTION_COUNT = 66

export function hasCompletedRoundZeroDiagnostic(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const session = value as Record<string, unknown>
  if (
    session.status !== "completed" ||
    !session.result ||
    typeof session.result !== "object" ||
    Array.isArray(session.result) ||
    !session.form ||
    typeof session.form !== "object" ||
    Array.isArray(session.form)
  ) {
    return false
  }

  const result = session.result as Record<string, unknown>
  const form = session.form as Record<string, unknown>
  return (
    typeof form.id === "string" &&
    typeof form.version === "string" &&
    Array.isArray(form.questions) &&
    form.questions.length === ROUND_ZERO_QUESTION_COUNT &&
    result.formId === form.id &&
    result.formVersion === form.version
  )
}

export function hasResumableRoundZeroDiagnostic(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const session = value as Record<string, unknown>
  if (
    session.status !== "in_progress" ||
    !session.progress ||
    typeof session.progress !== "object" ||
    Array.isArray(session.progress)
  ) {
    return false
  }

  const progress = session.progress as Record<string, unknown>
  const answers =
    progress.answers &&
    typeof progress.answers === "object" &&
    !Array.isArray(progress.answers)
      ? Object.keys(progress.answers as Record<string, unknown>)
      : []
  return (
    answers.length > 0 ||
    progress.phase === "review" ||
    (typeof progress.currentIndex === "number" && progress.currentIndex > 0)
  )
}
