import type {
  DiagnosticResult,
  NormalizedScoreEvidence,
  PlanIntensity,
  TargetVector,
} from "@act-tutor/core"

export type PriorScoreChoice = "scores" | "composite_only" | "never"
export type DashboardTab = "today" | "plan" | "progress"

export interface PlacementDraft {
  goal: number
  priorScoreChoice: PriorScoreChoice
  composite: number
  english: number
  math: number
  reading: number
  scienceEnabled: boolean
  science: number
  testDate: string
}

export interface GeneratedPlan {
  today: string
  draft: PlacementDraft
  evidence: NormalizedScoreEvidence
  target: TargetVector
  intensity: PlanIntensity
  currentComposite: number
  weakestSection: "english" | "math" | "reading"
  diagnosticResult?: DiagnosticResult
}
