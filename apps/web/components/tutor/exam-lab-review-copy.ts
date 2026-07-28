export interface ExamLabReviewCopyInput {
  assessmentLabel: string
  busy: boolean
  sufficient: boolean
  unanswered: number
}

export function examLabReviewCopy({
  assessmentLabel,
  busy,
  sufficient,
  unanswered,
}: ExamLabReviewCopyInput) {
  const blankSummary =
    unanswered > 0
      ? `${unanswered} question${unanswered === 1 ? " is" : "s are"} blank.`
      : "Every question has an answer."

  if (!sufficient) {
    const incompleteLabel =
      assessmentLabel === "Progress check" ? "check" : "run"
    return {
      heading: "Review and save.",
      description: `${blankSummary} Saving now keeps this incomplete ${incompleteLabel} for review without creating a score range or lesson recommendation.`,
      submitLabel: busy
        ? `Saving incomplete ${incompleteLabel}…`
        : `Save incomplete ${incompleteLabel}`,
    }
  }

  return {
    heading: "Review and submit.",
    description: `${blankSummary} Correct answers appear after submission.`,
    submitLabel: busy
      ? "Building your report…"
      : assessmentLabel === "Progress check"
        ? "Score this progress check"
        : "Score this practice test",
  }
}
