import type {
  ActScore,
  CoreSectionScores,
  CurrentScoreInput,
  NormalizedScoreEvidence,
} from "./types"

export function assertActScore(value: number, label = "ACT score"): void {
  if (!Number.isInteger(value) || value < 1 || value > 36) {
    throw new RangeError(`${label} must be an integer from 1 to 36.`)
  }
}

export function calculateEmrComposite(
  scores: CoreSectionScores
): ActScore {
  assertActScore(scores.english, "English score")
  assertActScore(scores.math, "Math score")
  assertActScore(scores.reading, "Reading score")

  return Math.floor(
    (scores.english + scores.math + scores.reading) / 3 + 0.5
  )
}

export function normalizeCurrentScore(
  input: CurrentScoreInput
): NormalizedScoreEvidence {
  if (input.kind === "not_taken") {
    return {
      source: input.kind,
      reportedComposite: null,
      calculatedComposite: null,
      reportedSections: null,
      planningBaseline: null,
      science: null,
      confidence: "none",
      compositeDifference: null,
    }
  }

  if (input.science !== undefined) {
    assertActScore(input.science, "Science score")
  }

  if (input.kind === "composite_only") {
    assertActScore(input.composite, "Composite score")
    const baseline = {
      english: input.composite,
      math: input.composite,
      reading: input.composite,
    } satisfies CoreSectionScores

    return {
      source: input.kind,
      reportedComposite: input.composite,
      calculatedComposite: null,
      reportedSections: null,
      planningBaseline: baseline,
      science: input.science ?? null,
      confidence: "low",
      compositeDifference: null,
    }
  }

  if (input.composite !== undefined) {
    assertActScore(input.composite, "Composite score")
  }

  const reportedSections = {
    english: input.english,
    math: input.math,
    reading: input.reading,
  } satisfies CoreSectionScores
  const calculatedComposite = calculateEmrComposite(reportedSections)
  const reportedComposite = input.composite ?? null

  return {
    source: input.kind,
    reportedComposite,
    calculatedComposite,
    reportedSections,
    planningBaseline: reportedSections,
    science: input.science ?? null,
    confidence: "medium",
    compositeDifference:
      reportedComposite === null
        ? null
        : calculatedComposite - reportedComposite,
  }
}
