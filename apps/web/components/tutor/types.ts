import type {
  CoreSection,
  CoreSectionScores,
  DiagnosticSkillResult,
  DiagnosticResult,
  NormalizedScoreEvidence,
  PlanIntensity,
  TargetVector,
} from "@act-tutor/core"

export type PriorScoreChoice =
  "undecided" | "scores" | "composite_only" | "never"
export type ReportedScoreSource = "official" | "practice"
export type StartingCheckChoice = "take" | "skip"
export type DashboardTab = "today" | "plan" | "progress"

export interface PlacementDraft {
  goal: number
  priorScoreChoice: PriorScoreChoice
  scoreSource: ReportedScoreSource
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

export type LessonEntryChoice = "explain-types" | "start-lessons"
export type ProfileEvidenceSource = "quick-check" | "diagnostic" | "full-test"

export type AssessmentHistoryKind =
  | "diagnostic"
  | "full-test"
  | "lesson-check"

export interface AssessmentHistoryMistake {
  id: string
  questionId: string
  section: CoreSection
  skill: string
  skillLabel: string
  prompt: string
  selectedChoiceText: string
  correctChoiceText: string
  rationale: string
}

export interface AssessmentHistoryEntry {
  id: string
  kind: Exclude<AssessmentHistoryKind, "lesson-check">
  title: string
  completedAt: string
  correct: number
  total: number
  compositeScore: number
  sectionScores: CoreSectionScores
  mistakes: AssessmentHistoryMistake[]
}

export interface ReportedOfficialScore {
  id: string
  testDate: string
  recordedAt: string
  composite: number
  sections: CoreSectionScores | null
}

export interface PendingOfficialScore {
  testDate: string
  recordedAt: string
  nextPromptOn: string
}

export interface TutorJourney {
  version: 1
  tourVersion: 1
  onboardingCompleted: boolean
  lessonEntryChoice: LessonEntryChoice | null
  officialScoreHistory: ReportedOfficialScore[]
  pendingOfficialScores?: PendingOfficialScore[]
  baselineOfficialComposite?: number | null
  checkInSnoozedUntil: string | null
  doneForNow: boolean
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
  profileSkillResults: DiagnosticSkillResult[]
  profileSource?: ProfileEvidenceSource
  assessmentHistory?: AssessmentHistoryEntry[]
  journey: TutorJourney
  testDatePassed: boolean
  adaptiveBaselineRequired?: boolean
  baselineSkipped?: boolean
}
