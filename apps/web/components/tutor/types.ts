import type {
  DiagnosticResult,
  NormalizedScoreEvidence,
  PlanIntensity,
  TargetVector,
} from "@act-tutor/core"

export type PriorScoreChoice = "scores" | "composite_only" | "never"
export type StartingCheckChoice = "take" | "skip"
export type DashboardTab = "today" | "plan" | "progress"

export interface PlacementDraft {
  goal: number
  priorScoreChoice: PriorScoreChoice
  startingCheckChoice: StartingCheckChoice
  composite: number
  english: number
  math: number
  reading: number
  scienceEnabled: boolean
  science: number
  testDate: string
  studyDaysPerWeek: number
  minutesPerSession: number
  preferredSection: "balanced" | "english" | "math" | "reading"
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
  adaptiveBaselineRequired?: boolean
  baselineSkipped?: boolean
}
