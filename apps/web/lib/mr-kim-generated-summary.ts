import type { ScoutAnswer } from "@act-tutor/core"

const ANSWER_LEDGER_LABEL =
  /\b(?:you chose|your answer|correct answer|reviewed rationale|the learner chose)\b/i
const INCOMPLETE_ENDING =
  /\b(?:a|an|and|are|because|but|for|is|of|or|the|to|while|with)$/i

export function generatedMrKimSummaryIsUsable(
  summary: string,
  reviewedAnswer: ScoutAnswer
) {
  const normalized = summary.replace(/\s+/g, " ").trim()
  if (
    normalized.length < 16 ||
    normalized.length > 180 ||
    normalized.includes("…") ||
    normalized.includes("...") ||
    ANSWER_LEDGER_LABEL.test(normalized) ||
    INCOMPLETE_ENDING.test(normalized) ||
    /[{}[\]]/.test(normalized)
  ) {
    return false
  }
  if ((normalized.match(/[.!?]/g) ?? []).length > 2) return false

  const reviewedText =
    `${reviewedAnswer.summary} ${reviewedAnswer.explanation}`.toLowerCase()
  const reviewedNumbers = new Set(reviewedText.match(/\d+(?:\.\d+)?/g) ?? [])
  const generatedNumbers = normalized.match(/\d+(?:\.\d+)?/g) ?? []
  if (generatedNumbers.some((number) => !reviewedNumbers.has(number))) {
    return false
  }
  return !/\b(?:answer|choice)\s+[a-d]\b/i.test(normalized)
}
