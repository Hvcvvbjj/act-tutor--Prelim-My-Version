export const CORE_SECTIONS = ["english", "math", "reading"] as const

export type CoreSection = (typeof CORE_SECTIONS)[number]
export type ActScore = number
export type CoreSectionScores = Readonly<Record<CoreSection, ActScore>>

export type CurrentScoreInput =
  | { kind: "not_taken" }
  | {
      kind: "composite_only"
      composite: number
      science?: number
    }
  | {
      kind: "section_scores"
      composite?: number
      english: number
      math: number
      reading: number
      science?: number
    }

export interface NormalizedScoreEvidence {
  source: CurrentScoreInput["kind"]
  reportedComposite: ActScore | null
  calculatedComposite: ActScore | null
  reportedSections: CoreSectionScores | null
  planningBaseline: CoreSectionScores | null
  science: ActScore | null
  confidence: "none" | "low" | "medium"
  compositeDifference: number | null
}
