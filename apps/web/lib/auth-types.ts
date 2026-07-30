import type {
  DiagnosticSkillResult,
  NormalizedScoreEvidence,
} from "@act-tutor/core"

import type {
  AssessmentHistoryEntry,
  PlacementDraft,
  ProfileEvidenceSource,
  TutorJourney,
} from "@/components/tutor/types"

export type AuthRole = "guest" | "learner" | "judge"

export type UpcomingLessonReminderTiming =
  "same-day" | "one-day-before" | "two-days-before"
export type OverdueLessonReminderTiming =
  "same-day" | "one-day-after" | "three-days-after"

export interface LessonReminderPreferences {
  version: 1
  enabled: boolean
  emailEnabled: boolean
  emailAddress: string | null
  smsEnabled: boolean
  phoneNumber: string | null
  upcomingTiming: UpcomingLessonReminderTiming
  overdueTiming: OverdueLessonReminderTiming
  consentedAt: string | null
  updatedAt: string | null
}

export type LessonReminderDraft = Omit<
  LessonReminderPreferences,
  "version" | "consentedAt" | "updatedAt"
>

export const DEFAULT_LESSON_REMINDER_PREFERENCES: LessonReminderPreferences = {
  version: 1,
  enabled: false,
  emailEnabled: false,
  emailAddress: null,
  smsEnabled: false,
  phoneNumber: null,
  upcomingTiming: "one-day-before",
  overdueTiming: "one-day-after",
  consentedAt: null,
  updatedAt: null,
}

export interface SavedTutorPlan {
  version: 2
  savedAt: string
  draft: PlacementDraft
  evidence: NormalizedScoreEvidence
  currentComposite: number
  profileSkillResults: DiagnosticSkillResult[]
  profileSource?: ProfileEvidenceSource
  assessmentHistory?: AssessmentHistoryEntry[]
  journey: TutorJourney
  adaptiveBaselineRequired: boolean
  baselineSkipped: boolean
}

export interface PendingTutorSetup {
  version: 1
  savedAt: string
  draft: PlacementDraft
  diagnosticPurpose: "baseline"
  resumeSurface: "onboarding" | "diagnostic"
  onboardingStep: 1 | 2 | 3
}

export interface AuthViewer {
  authenticated: boolean
  role: AuthRole
  username: string | null
  displayName: string | null
  technicalDetails: boolean
  savedPlan: SavedTutorPlan | null
  pendingSetup: PendingTutorSetup | null
  lessonReminders: LessonReminderPreferences
}

export const GUEST_VIEWER: AuthViewer = {
  authenticated: false,
  role: "guest",
  username: null,
  displayName: null,
  technicalDetails: false,
  savedPlan: null,
  pendingSetup: null,
  lessonReminders: { ...DEFAULT_LESSON_REMINDER_PREFERENCES },
}
