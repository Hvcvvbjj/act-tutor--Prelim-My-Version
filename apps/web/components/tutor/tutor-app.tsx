"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import {
  buildPlanIntensity,
  calendarDaysUntil,
  diagnosticResultToEvidence,
  normalizeCurrentScore,
  selectTargetVector,
  type CoreSection,
  type CoreSectionScores,
  type DiagnosticResult,
  type DiagnosticSkillResult,
  type ExamLabSessionPayload,
  type NormalizedScoreEvidence,
  type CalibrationLearningBaseline,
} from "@act-tutor/core"

import { Onboarding } from "@/components/tutor/onboarding"
import type { TestDayCheckInResult } from "@/components/tutor/test-day-check-in"
import { DASHBOARD_TOUR_STORAGE_KEY } from "@/components/tutor/dashboard-tour"
import {
  applyEditedPlanJourney,
  applyReportedScoreSource,
  baselineStateForDraft,
} from "@/components/tutor/tutor-journey"
import type {
  GeneratedPlan,
  PlacementDraft,
  ProfileEvidenceSource,
  TutorJourney,
} from "@/components/tutor/types"
import {
  GUEST_VIEWER,
  type AuthViewer,
  type PendingTutorSetup,
  type SavedTutorPlan,
} from "@/lib/auth-types"
import { addCalendarDaysFrom } from "@/lib/dates"
import {
  diagnosticPurposeForStorage,
  restoreDiagnosticPurpose,
  type DiagnosticPurpose,
} from "@/lib/tutor-resume"

const STORAGE_KEY = "ai-act-tutor-placement-v3"
const LEGACY_STORAGE_KEYS = [
  "ai-act-tutor-placement-v2",
  "ai-act-tutor-placement-v1",
] as const

type TutorSurface =
  | "onboarding"
  | "orientation"
  | "dashboard"
  | "diagnostic"
  | "diagnostic-runner"
  | "test-day-check-in"
type DashboardInitialTab = "today" | "calibrate"

function isDiagnosticSurface(
  value: unknown
): value is Extract<TutorSurface, "diagnostic" | "diagnostic-runner"> {
  return value === "diagnostic" || value === "diagnostic-runner"
}

function TutorSurfaceLoading({ message }: { message: string }) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-svh items-center justify-center bg-background px-5 text-foreground"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-xl border-y-2 border-foreground py-10">
        <p className="ink-label text-primary">Scout is getting ready</p>
        <p className="mt-3 font-heading text-4xl leading-none font-black sm:text-5xl">
          {message}
        </p>
      </div>
    </main>
  )
}

const loadDashboard = () =>
  import("@/components/tutor/dashboard").then((module) => module.Dashboard)
const loadLearnerOrientation = () =>
  import("@/components/tutor/learner-orientation").then(
    (module) => module.LearnerOrientation
  )
const loadTestDayCheckIn = () =>
  import("@/components/tutor/test-day-check-in").then(
    (module) => module.TestDayCheckIn
  )
const loadDiagnosticIntro = () =>
  import("@/components/tutor/diagnostic-intro").then(
    (module) => module.DiagnosticIntro
  )
const loadDiagnosticRunner = () =>
  import("@/components/tutor/diagnostic-runner").then(
    (module) => module.DiagnosticRunner
  )

const Dashboard = dynamic(loadDashboard, {
  loading: () => <TutorSurfaceLoading message="Opening your study plan…" />,
})
const LearnerOrientation = dynamic(loadLearnerOrientation, {
  loading: () => (
    <TutorSurfaceLoading message="Preparing your starting profile…" />
  ),
})
const TestDayCheckIn = dynamic(loadTestDayCheckIn, {
  loading: () => (
    <TutorSurfaceLoading message="Opening your test-day check-in…" />
  ),
})
const DiagnosticIntro = dynamic(loadDiagnosticIntro, {
  loading: () => (
    <TutorSurfaceLoading message="Opening your starting diagnostic…" />
  ),
})
const DiagnosticRunner = dynamic(loadDiagnosticRunner, {
  loading: () => <TutorSurfaceLoading message="Preparing your questions…" />,
})

interface TutorAppProps {
  today: string
  initialTestDate: string
  initialViewer?: AuthViewer
}

function initialDraft(initialTestDate: string): PlacementDraft {
  return {
    goal: 30,
    priorScoreChoice: "undecided",
    scoreSource: "practice",
    startingCheckChoice: "take",
    composite: 0,
    english: 0,
    math: 0,
    reading: 0,
    scienceEnabled: false,
    science: 0,
    testDate: initialTestDate,
    studyDaysPerWeek: 3,
    minutesPerSession: 30,
    preferredSection: "balanced",
  }
}

function clearLegacyDefaultScoreAssumptions(
  draft: PlacementDraft
): PlacementDraft {
  if (
    draft.priorScoreChoice === "scores" &&
    draft.composite === 24 &&
    draft.english === 26 &&
    draft.math === 20 &&
    draft.reading === 25 &&
    !draft.scienceEnabled &&
    draft.science === 24
  ) {
    return {
      ...draft,
      priorScoreChoice: "undecided",
      composite: 0,
      english: 0,
      math: 0,
      reading: 0,
      science: 0,
    }
  }

  return draft
}

function isPlacementDraft(value: unknown): value is PlacementDraft {
  if (!value || typeof value !== "object") return false
  const draft = value as Partial<PlacementDraft>
  return (
    typeof draft.goal === "number" &&
    (draft.priorScoreChoice === "undecided" ||
      draft.priorScoreChoice === "scores" ||
      draft.priorScoreChoice === "composite_only" ||
      draft.priorScoreChoice === "never") &&
    (draft.scoreSource === undefined ||
      draft.scoreSource === "official" ||
      draft.scoreSource === "practice") &&
    (draft.startingCheckChoice === undefined ||
      draft.startingCheckChoice === "take" ||
      draft.startingCheckChoice === "skip") &&
    typeof draft.composite === "number" &&
    typeof draft.english === "number" &&
    typeof draft.math === "number" &&
    typeof draft.reading === "number" &&
    typeof draft.scienceEnabled === "boolean" &&
    typeof draft.science === "number" &&
    typeof draft.testDate === "string" &&
    Number.isInteger(draft.studyDaysPerWeek) &&
    Number(draft.studyDaysPerWeek) >= 1 &&
    Number(draft.studyDaysPerWeek) <= 7 &&
    Number.isInteger(draft.minutesPerSession) &&
    Number(draft.minutesPerSession) >= 15 &&
    Number(draft.minutesPerSession) <= 180 &&
    (draft.preferredSection === "balanced" ||
      draft.preferredSection === "english" ||
      draft.preferredSection === "math" ||
      draft.preferredSection === "reading")
  )
}

function isCoreSectionScores(value: unknown): value is CoreSectionScores {
  if (!value || typeof value !== "object") return false
  const scores = value as Partial<CoreSectionScores>
  return [scores.english, scores.math, scores.reading].every(
    (score) =>
      typeof score === "number" &&
      Number.isInteger(score) &&
      score >= 1 &&
      score <= 36
  )
}

function validateScore(value: number, label: string): string | null {
  if (!Number.isInteger(value) || value < 1 || value > 36) {
    return `${label} score must be a whole number from 1 to 36.`
  }
  return null
}

function validateScoreStep(draft: PlacementDraft): string | null {
  if (draft.priorScoreChoice === "undecided") {
    return "Choose what you know about your current ACT scores."
  }
  if (draft.priorScoreChoice === "never") return null

  const compositeError = validateScore(draft.composite, "Composite")
  if (compositeError) return compositeError

  if (draft.priorScoreChoice === "scores") {
    for (const [label, value] of [
      ["English", draft.english],
      ["Math", draft.math],
      ["Reading", draft.reading],
    ] as const) {
      const sectionError = validateScore(value, label)
      if (sectionError) return sectionError
    }
  }

  if (draft.scienceEnabled) {
    return validateScore(draft.science, "Science")
  }

  return null
}

function weakestSection(scores: CoreSectionScores): CoreSection {
  return (Object.entries(scores) as Array<[CoreSection, number]>).reduce(
    (weakest, entry) => (entry[1] < weakest[1] ? entry : weakest)
  )[0]
}

function newTutorJourney(): TutorJourney {
  return {
    version: 1,
    tourVersion: 1,
    onboardingCompleted: false,
    lessonEntryChoice: null,
    officialScoreHistory: [],
    pendingOfficialScores: [],
    baselineOfficialComposite: null,
    checkInSnoozedUntil: null,
    doneForNow: false,
  }
}

function migratedTutorJourney(): TutorJourney {
  return {
    ...newTutorJourney(),
    onboardingCompleted: true,
  }
}

function isDiagnosticSkillResults(
  value: unknown
): value is DiagnosticSkillResult[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== "object") return false
      const result = item as Partial<DiagnosticSkillResult>
      return (
        typeof result.skill === "string" &&
        typeof result.label === "string" &&
        (result.section === "english" ||
          result.section === "math" ||
          result.section === "reading") &&
        Number.isInteger(result.correct) &&
        Number.isInteger(result.total) &&
        Number(result.correct) >= 0 &&
        Number(result.total) >= Number(result.correct) &&
        typeof result.accuracy === "number" &&
        result.accuracy >= 0 &&
        result.accuracy <= 1 &&
        (result.signal === "strength" ||
          result.signal === "developing" ||
          result.signal === "focus")
      )
    })
  )
}

function isTutorJourney(value: unknown): value is TutorJourney {
  if (!value || typeof value !== "object") return false
  const journey = value as Partial<TutorJourney>
  return (
    journey.version === 1 &&
    journey.tourVersion === 1 &&
    typeof journey.onboardingCompleted === "boolean" &&
    (journey.lessonEntryChoice === null ||
      journey.lessonEntryChoice === "explain-types" ||
      journey.lessonEntryChoice === "start-lessons") &&
    Array.isArray(journey.officialScoreHistory) &&
    journey.officialScoreHistory.every(
      (entry) =>
        Boolean(entry) &&
        typeof entry.id === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(entry.testDate) &&
        !Number.isNaN(Date.parse(entry.recordedAt)) &&
        Number.isInteger(entry.composite) &&
        entry.composite >= 1 &&
        entry.composite <= 36 &&
        (entry.sections === null || isCoreSectionScores(entry.sections))
    ) &&
    (journey.pendingOfficialScores === undefined ||
      (Array.isArray(journey.pendingOfficialScores) &&
        journey.pendingOfficialScores.every(
          (entry) =>
            Boolean(entry) &&
            /^\d{4}-\d{2}-\d{2}$/.test(entry.testDate) &&
            !Number.isNaN(Date.parse(entry.recordedAt)) &&
            /^\d{4}-\d{2}-\d{2}$/.test(entry.nextPromptOn)
        ))) &&
    (journey.baselineOfficialComposite === undefined ||
      journey.baselineOfficialComposite === null ||
      (Number.isInteger(journey.baselineOfficialComposite) &&
        journey.baselineOfficialComposite >= 1 &&
        journey.baselineOfficialComposite <= 36)) &&
    (journey.checkInSnoozedUntil === null ||
      (typeof journey.checkInSnoozedUntil === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(journey.checkInSnoozedUntil))) &&
    typeof journey.doneForNow === "boolean"
  )
}

function makeGeneratedPlan(input: {
  today: string
  draft: PlacementDraft
  evidence: NormalizedScoreEvidence
  baseline: CoreSectionScores
  currentComposite: number
  diagnosticResult?: DiagnosticResult
  profileSkillResults?: DiagnosticSkillResult[]
  profileSource?: ProfileEvidenceSource
  journey?: TutorJourney
  adaptiveBaselineRequired?: boolean
  baselineSkipped?: boolean
}): GeneratedPlan {
  const rawDaysUntilTest = calendarDaysUntil(input.today, input.draft.testDate)
  if (!Number.isInteger(rawDaysUntilTest)) {
    throw new RangeError("Choose a valid test date.")
  }
  const daysUntilTest = Math.max(1, rawDaysUntilTest)

  const target = selectTargetVector({
    current: input.baseline,
    goalComposite: input.draft.goal,
    opportunityWeights: {
      english:
        (36 - input.baseline.english) *
        (input.draft.preferredSection === "english" ? 1.35 : 1),
      math:
        (36 - input.baseline.math) *
        (input.draft.preferredSection === "math" ? 1.35 : 1),
      reading:
        (36 - input.baseline.reading) *
        (input.draft.preferredSection === "reading" ? 1.35 : 1),
    },
  })
  const intensity = buildPlanIntensity({
    daysUntilTest,
    current: input.baseline,
    target: target.scores,
    studyDaysPerWeek: input.draft.studyDaysPerWeek,
    minutesPerSession: input.draft.minutesPerSession,
  })

  return {
    today: input.today,
    draft: input.draft,
    evidence: input.evidence,
    target,
    intensity,
    currentComposite: input.currentComposite,
    weakestSection: weakestSection(input.baseline),
    ...(input.diagnosticResult
      ? { diagnosticResult: input.diagnosticResult }
      : {}),
    profileSkillResults: [
      ...(input.profileSkillResults ??
        input.diagnosticResult?.skillResults ??
        []),
    ],
    ...(input.profileSource ? { profileSource: input.profileSource } : {}),
    journey: input.journey ?? newTutorJourney(),
    testDatePassed: input.draft.testDate < input.today,
    ...(input.adaptiveBaselineRequired
      ? { adaptiveBaselineRequired: true }
      : {}),
    ...(input.baselineSkipped ? { baselineSkipped: true } : {}),
  }
}

function savedPlanFrom(plan: GeneratedPlan): SavedTutorPlan {
  return {
    version: 2,
    savedAt: new Date().toISOString(),
    draft: plan.draft,
    evidence: plan.evidence,
    currentComposite: plan.currentComposite,
    profileSkillResults: plan.profileSkillResults,
    ...(plan.profileSource ? { profileSource: plan.profileSource } : {}),
    journey: plan.journey,
    adaptiveBaselineRequired: plan.adaptiveBaselineRequired === true,
    baselineSkipped: plan.baselineSkipped === true,
  }
}

function restoredPlanFrom(today: string, value: unknown): GeneratedPlan | null {
  try {
    if (!value || typeof value !== "object") return null
    const savedPlan = value as {
      version?: unknown
      draft?: unknown
      evidence?: NormalizedScoreEvidence
      currentComposite?: unknown
      profileSkillResults?: unknown
      profileSource?: unknown
      journey?: unknown
      adaptiveBaselineRequired?: unknown
      baselineSkipped?: unknown
    }
    if (
      (savedPlan.version !== 1 && savedPlan.version !== 2) ||
      !isPlacementDraft(savedPlan.draft) ||
      !savedPlan.evidence ||
      !isCoreSectionScores(savedPlan.evidence.planningBaseline) ||
      typeof savedPlan.currentComposite !== "number" ||
      !Number.isInteger(savedPlan.currentComposite) ||
      savedPlan.currentComposite < 1 ||
      savedPlan.currentComposite > 36 ||
      typeof savedPlan.adaptiveBaselineRequired !== "boolean" ||
      typeof savedPlan.baselineSkipped !== "boolean"
    ) {
      return null
    }
    if (
      savedPlan.profileSource !== undefined &&
      savedPlan.profileSource !== "quick-check" &&
      savedPlan.profileSource !== "diagnostic" &&
      savedPlan.profileSource !== "full-test"
    ) {
      return null
    }
    const normalizedDraft: PlacementDraft = {
      ...savedPlan.draft,
      scoreSource: savedPlan.draft.scoreSource ?? "practice",
    }
    const restoredJourney =
      savedPlan.version === 2 && isTutorJourney(savedPlan.journey)
        ? savedPlan.journey
        : migratedTutorJourney()
    return makeGeneratedPlan({
      today,
      draft: normalizedDraft,
      evidence: savedPlan.evidence,
      baseline: savedPlan.evidence.planningBaseline,
      currentComposite: savedPlan.currentComposite,
      profileSkillResults:
        savedPlan.version === 2 &&
        isDiagnosticSkillResults(savedPlan.profileSkillResults)
          ? savedPlan.profileSkillResults
          : [],
      ...(savedPlan.profileSource
        ? { profileSource: savedPlan.profileSource }
        : {}),
      journey: applyReportedScoreSource(restoredJourney, normalizedDraft),
      adaptiveBaselineRequired: savedPlan.adaptiveBaselineRequired,
      baselineSkipped: savedPlan.baselineSkipped,
    })
  } catch {
    return null
  }
}

function pendingOfficialScores(journey: TutorJourney) {
  return journey.pendingOfficialScores ?? []
}

function duePendingOfficialScore(plan: GeneratedPlan) {
  return [...pendingOfficialScores(plan.journey)]
    .filter((entry) => entry.nextPromptOn <= plan.today)
    .sort((left, right) =>
      left.nextPromptOn.localeCompare(right.nextPromptOn)
    )[0]
}

function activeTestDayCheckIn(plan: GeneratedPlan) {
  const activeTestSnoozed =
    plan.journey.checkInSnoozedUntil !== null &&
    plan.journey.checkInSnoozedUntil > plan.today
  if (plan.testDatePassed && !plan.journey.doneForNow && !activeTestSnoozed) {
    return {
      kind: "active" as const,
      testDate: plan.draft.testDate,
    }
  }
  const pending = duePendingOfficialScore(plan)
  return pending
    ? {
        kind: "pending" as const,
        testDate: pending.testDate,
      }
    : null
}

function surfaceForPlan(plan: GeneratedPlan): TutorSurface {
  if (
    plan.draft.priorScoreChoice === "never" &&
    (plan.adaptiveBaselineRequired || plan.baselineSkipped)
  ) {
    return "diagnostic"
  }
  if (!plan.journey.onboardingCompleted && !plan.adaptiveBaselineRequired) {
    return "orientation"
  }
  if (activeTestDayCheckIn(plan)) {
    return "test-day-check-in"
  }
  return "dashboard"
}

const JUDGE_DEMO_SKILLS: ReadonlyArray<DiagnosticSkillResult> = [
  {
    skill: "sentence-boundaries",
    label: "Sentence boundaries",
    section: "english",
    correct: 0,
    total: 2,
    accuracy: 0,
    signal: "focus",
  },
  {
    skill: "concision-and-redundancy",
    label: "Concision and redundancy",
    section: "english",
    correct: 1,
    total: 2,
    accuracy: 0.5,
    signal: "focus",
  },
  {
    skill: "logical-transitions",
    label: "Logical transitions",
    section: "english",
    correct: 2,
    total: 2,
    accuracy: 1,
    signal: "strength",
  },
  {
    skill: "linear-equations",
    label: "Linear equations",
    section: "math",
    correct: 2,
    total: 2,
    accuracy: 1,
    signal: "strength",
  },
  {
    skill: "ratios-and-percent",
    label: "Ratios and percent",
    section: "math",
    correct: 1,
    total: 2,
    accuracy: 0.5,
    signal: "focus",
  },
  {
    skill: "functions-and-modeling",
    label: "Functions and modeling",
    section: "math",
    correct: 1,
    total: 2,
    accuracy: 0.5,
    signal: "focus",
  },
  {
    skill: "supported-inference",
    label: "Supported inference",
    section: "reading",
    correct: 0,
    total: 2,
    accuracy: 0,
    signal: "focus",
  },
  {
    skill: "central-ideas-and-details",
    label: "Central ideas and details",
    section: "reading",
    correct: 2,
    total: 2,
    accuracy: 1,
    signal: "strength",
  },
  {
    skill: "author-purpose-and-structure",
    label: "Author purpose and structure",
    section: "reading",
    correct: 1,
    total: 2,
    accuracy: 0.5,
    signal: "focus",
  },
]

function judgeDemoDiagnostic(): DiagnosticResult {
  const strengths = JUDGE_DEMO_SKILLS.filter(
    (skill) => skill.signal === "strength"
  ).slice(0, 2)
  const focusSkills = JUDGE_DEMO_SKILLS.filter(
    (skill) => skill.signal === "focus"
  ).filter(
    (skill) =>
      skill.skill === "sentence-boundaries" ||
      skill.skill === "supported-inference"
  )
  return {
    formId: "scout-judge-demo",
    formVersion: "judge-demo-v1",
    source: "rapid_diagnostic",
    calibrationVersion: "rapid-v1",
    sectionResults: [
      {
        section: "english",
        correct: 3,
        total: 6,
        range: { low: 20, high: 24, estimate: 22 },
      },
      {
        section: "math",
        correct: 4,
        total: 6,
        range: { low: 23, high: 27, estimate: 25 },
      },
      {
        section: "reading",
        correct: 4,
        total: 6,
        range: { low: 22, high: 26, estimate: 24 },
      },
    ],
    compositeRange: { low: 22, high: 26, estimate: 24 },
    planningBaseline: { english: 22, math: 25, reading: 24 },
    skillResults: JUDGE_DEMO_SKILLS,
    strengths,
    focusSkills,
    feedback: [],
  }
}

export function TutorApp({
  today,
  initialTestDate,
  initialViewer = GUEST_VIEWER,
}: TutorAppProps) {
  const [restoredAtLoad] = useState(() =>
    restoredPlanFrom(today, initialViewer.savedPlan)
  )
  const [pendingSetupAtLoad] = useState(
    () => initialViewer.pendingSetup ?? null
  )
  const [draft, setDraft] = useState<PlacementDraft>(
    () =>
      pendingSetupAtLoad?.draft ??
      restoredAtLoad?.draft ??
      initialDraft(initialTestDate)
  )
  const [step, setStep] = useState<number>(
    pendingSetupAtLoad?.resumeSurface === "onboarding"
      ? (pendingSetupAtLoad.onboardingStep ?? 1)
      : 1
  )
  const [surface, setSurface] = useState<TutorSurface>(
    pendingSetupAtLoad
      ? pendingSetupAtLoad.resumeSurface === "onboarding"
        ? "onboarding"
        : "diagnostic"
      : restoredAtLoad
        ? surfaceForPlan(restoredAtLoad)
        : "onboarding"
  )
  const [dashboardInitialTab, setDashboardInitialTab] =
    useState<DashboardInitialTab>()
  const [diagnosticPurpose, setDiagnosticPurpose] =
    useState<DiagnosticPurpose>("baseline")
  const [plan, setPlan] = useState<GeneratedPlan | null>(restoredAtLoad)
  const [viewer, setViewer] = useState<AuthViewer>(initialViewer)
  const [error, setError] = useState<string | null>(null)
  const [storageReady, setStorageReady] = useState(false)
  const [welcomeComplete, setWelcomeComplete] = useState(
    Boolean(restoredAtLoad || pendingSetupAtLoad)
  )
  const [editingPlan, setEditingPlan] = useState(false)
  const [orientationTourActive, setOrientationTourActive] = useState(false)
  const [orientationResumeProfile, setOrientationResumeProfile] =
    useState(false)

  useEffect(() => {
    if (!orientationTourActive) return
    const finishOrientationTour = () => {
      setOrientationTourActive(false)
      setOrientationResumeProfile(true)
      setSurface("orientation")
    }
    window.addEventListener("scout:tour-complete", finishOrientationTour, {
      once: true,
    })
    return () =>
      window.removeEventListener("scout:tour-complete", finishOrientationTour)
  }, [orientationTourActive])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const stored =
          window.localStorage.getItem(STORAGE_KEY) ??
          LEGACY_STORAGE_KEYS.map((key) =>
            window.localStorage.getItem(key)
          ).find(Boolean)
        if (stored) {
          const parsed = JSON.parse(stored) as {
            version?: number
            draft?: unknown
            guestPlan?: unknown
            viewerRole?: AuthViewer["role"]
            resumeSurface?: unknown
            diagnosticPurpose?: unknown
          }
          let resumableSetupAvailable = Boolean(
            restoredAtLoad || pendingSetupAtLoad
          )
          if (!restoredAtLoad && initialViewer.role === "guest") {
            const restoredGuestPlan =
              parsed.version === 2 ||
              parsed.version === 3 ||
              parsed.version === 4 ||
              parsed.version === 5 ||
              parsed.version === 6
                ? restoredPlanFrom(today, parsed.guestPlan)
                : null
            if (restoredGuestPlan) {
              setDraft(restoredGuestPlan.draft)
              setPlan(restoredGuestPlan)
              setSurface(surfaceForPlan(restoredGuestPlan))
              setWelcomeComplete(true)
              resumableSetupAvailable = true
            } else if (
              (parsed.version === 1 ||
                parsed.version === 2 ||
                parsed.version === 3 ||
                parsed.version === 4 ||
                parsed.version === 5 ||
                parsed.version === 6) &&
              isPlacementDraft(parsed.draft)
            ) {
              const restoredDraft =
                parsed.version === 4 ||
                parsed.version === 5 ||
                parsed.version === 6
                  ? parsed.draft
                  : clearLegacyDefaultScoreAssumptions(parsed.draft)
              setDraft({ ...initialDraft(initialTestDate), ...restoredDraft })
              resumableSetupAvailable = true
            }
          }
          if (
            (parsed.version === 3 ||
              parsed.version === 4 ||
              parsed.version === 5 ||
              parsed.version === 6) &&
            parsed.viewerRole === initialViewer.role &&
            resumableSetupAvailable &&
            isDiagnosticSurface(parsed.resumeSurface)
          ) {
            setDiagnosticPurpose(
              restoreDiagnosticPurpose({
                storageVersion: parsed.version,
                resumeSurface: parsed.resumeSurface,
                diagnosticPurpose: parsed.diagnosticPurpose,
              })
            )
            setDashboardInitialTab("calibrate")
            setSurface(parsed.resumeSurface)
          }
        }
      } catch {
        try {
          window.localStorage.removeItem(STORAGE_KEY)
          for (const key of LEGACY_STORAGE_KEYS) {
            window.localStorage.removeItem(key)
          }
        } catch {}
      } finally {
        setStorageReady(true)
      }
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [
    initialTestDate,
    initialViewer.role,
    pendingSetupAtLoad,
    restoredAtLoad,
    today,
  ])

  useEffect(() => {
    if (!storageReady) return
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 6,
          draft,
          guestPlan:
            viewer.role === "guest" && plan ? savedPlanFrom(plan) : null,
          viewerRole: viewer.role,
          resumeSurface: isDiagnosticSurface(surface) ? surface : null,
          diagnosticPurpose: diagnosticPurposeForStorage(
            surface,
            diagnosticPurpose
          ),
        })
      )
      for (const key of LEGACY_STORAGE_KEYS) {
        window.localStorage.removeItem(key)
      }
    } catch {}
  }, [diagnosticPurpose, draft, plan, storageReady, surface, viewer.role])

  function updateDraft(update: Partial<PlacementDraft>) {
    setDraft((current) => ({ ...current, ...update }))
    setError(null)
  }

  function buildPlanFromEvidence(
    evidence: NormalizedScoreEvidence,
    baseline: CoreSectionScores,
    currentComposite: number,
    diagnosticResult?: DiagnosticResult,
    placementDraft: PlacementDraft = draft,
    options: {
      adaptiveBaselineRequired?: boolean
      baselineSkipped?: boolean
      profileSkillResults?: DiagnosticSkillResult[]
      profileSource?: ProfileEvidenceSource
      journey?: TutorJourney
      save?: boolean
    } = {}
  ) {
    const nextPlan = makeGeneratedPlan({
      today,
      draft: placementDraft,
      evidence,
      baseline,
      currentComposite,
      diagnosticResult,
      profileSkillResults: options.profileSkillResults,
      profileSource: options.profileSource,
      journey: options.journey,
      adaptiveBaselineRequired: options.adaptiveBaselineRequired,
      baselineSkipped: options.baselineSkipped,
    })
    setPlan(nextPlan)
    setSurface(surfaceForPlan(nextPlan))
    setError(null)
    if (options.save !== false) void persistPlan(nextPlan)
    return nextPlan
  }

  async function persistPlan(nextPlan: GeneratedPlan) {
    try {
      if (viewer.role !== "learner") {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            version: 6,
            draft: nextPlan.draft,
            guestPlan: savedPlanFrom(nextPlan),
            viewerRole: viewer.role,
            resumeSurface: null,
            diagnosticPurpose: null,
          })
        )
        for (const key of LEGACY_STORAGE_KEYS) {
          window.localStorage.removeItem(key)
        }
        return true
      }
      const response = await fetch("/api/auth", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_plan",
          savedPlan: savedPlanFrom(nextPlan),
        }),
      })
      const payload = (await response.json()) as {
        viewer?: AuthViewer
        error?: string
      }
      if (!response.ok || !payload.viewer) {
        throw new Error(payload.error ?? "The plan could not be saved.")
      }
      setViewer(payload.viewer)
      return true
    } catch {
      setError(
        "Your plan is open, but Scout could not sync it to your account yet."
      )
      return false
    }
  }

  async function persistPendingSetup(nextDraft: PlacementDraft) {
    if (viewer.role !== "learner") return true
    const pendingSetup: PendingTutorSetup = {
      version: 1,
      savedAt: new Date().toISOString(),
      draft: {
        ...nextDraft,
        startingCheckChoice: "take",
      },
      diagnosticPurpose: "baseline",
      resumeSurface: "diagnostic",
      onboardingStep: 3,
    }
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_setup",
          pendingSetup,
        }),
      })
      const payload = (await response.json()) as {
        viewer?: AuthViewer
        error?: string
      }
      if (!response.ok || !payload.viewer) {
        throw new Error(payload.error ?? "The setup could not be saved.")
      }
      setViewer(payload.viewer)
      return true
    } catch {
      return false
    }
  }

  function handleViewerChange(nextViewer: AuthViewer) {
    setViewer(nextViewer)
    const restored = restoredPlanFrom(today, nextViewer.savedPlan)
    if (nextViewer.pendingSetup) {
      setDraft(nextViewer.pendingSetup.draft)
      setPlan(restored)
      setDiagnosticPurpose("baseline")
      if (nextViewer.pendingSetup.resumeSurface === "onboarding") {
        setStep(nextViewer.pendingSetup.onboardingStep ?? 1)
        setSurface("onboarding")
      } else {
        setSurface("diagnostic")
      }
      setWelcomeComplete(true)
      setError(null)
      return
    }
    if (restored) {
      setDraft(restored.draft)
      setPlan(restored)
      setSurface(surfaceForPlan(restored))
      setWelcomeComplete(true)
      setError(null)
      return
    }
  }

  async function createPlan() {
    try {
      const daysUntilTest = calendarDaysUntil(today, draft.testDate)
      if (!Number.isInteger(daysUntilTest) || daysUntilTest <= 0) {
        throw new RangeError("Choose a test date after today.")
      }

      if (draft.priorScoreChoice === "undecided") {
        throw new Error("Choose what you know about your current ACT scores.")
      }

      if (draft.priorScoreChoice === "never") {
        const nextDraft = {
          ...draft,
          startingCheckChoice: "take" as const,
        }
        const [setupSaved, response] = await Promise.all([
          persistPendingSetup(nextDraft),
          fetch("/api/diagnostic", {
            method: "POST",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "start_new_if_completed" }),
          }),
        ])
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string
          } | null
          throw new Error(
            payload?.error ?? "Could not prepare the starting diagnostic."
          )
        }
        setDraft(nextDraft)
        if (!editingPlan) setPlan(null)
        setDiagnosticPurpose("baseline")
        setDashboardInitialTab(undefined)
        setSurface("diagnostic")
        setError(
          setupSaved
            ? null
            : "Your diagnostic is ready, but Scout could not sync this setup to your account yet."
        )
        void loadDiagnosticIntro()
        setEditingPlan(false)
        return
      }

      void loadDashboard()
      const evidence =
        draft.priorScoreChoice === "composite_only"
          ? normalizeCurrentScore({
              kind: "composite_only",
              composite: draft.composite,
              ...(draft.scienceEnabled ? { science: draft.science } : {}),
            })
          : normalizeCurrentScore({
              kind: "section_scores",
              composite: draft.composite,
              english: draft.english,
              math: draft.math,
              reading: draft.reading,
              ...(draft.scienceEnabled ? { science: draft.science } : {}),
            })
      const baseline = evidence.planningBaseline
      if (!baseline)
        throw new Error("Section scores are required for this path.")
      const baselineState = baselineStateForDraft(
        draft,
        Boolean(editingPlan && plan?.profileSkillResults.length)
      )
      buildPlanFromEvidence(
        evidence,
        baseline,
        evidence.reportedComposite ??
          evidence.calculatedComposite ??
          draft.composite,
        editingPlan && plan ? plan.diagnosticResult : undefined,
        draft,
        {
          ...baselineState,
          profileSkillResults:
            editingPlan && plan ? [...plan.profileSkillResults] : undefined,
          profileSource: editingPlan && plan ? plan.profileSource : undefined,
          journey:
            editingPlan && plan
              ? applyEditedPlanJourney(plan.journey, plan.draft, draft)
              : applyReportedScoreSource(newTutorJourney(), draft),
        }
      )
      setEditingPlan(false)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We could not build this plan yet. Check the scores and date."
      )
    }
  }

  function editPlan() {
    setEditingPlan(true)
    setStep(1)
    setSurface("onboarding")
    setDashboardInitialTab(undefined)
    setWelcomeComplete(true)
    setError(null)
  }

  function cancelEditingPlan() {
    if (plan) setDraft(plan.draft)
    setEditingPlan(false)
    setStep(1)
    setDashboardInitialTab(undefined)
    setSurface(plan ? surfaceForPlan(plan) : "onboarding")
    setError(null)
  }

  function returnFromBaselineDiagnostic() {
    const planAlreadyHasBaseline =
      plan &&
      draft.priorScoreChoice !== "never" &&
      !(
        plan.draft.priorScoreChoice === "never" &&
        (plan.adaptiveBaselineRequired || plan.baselineSkipped)
      )
    if (planAlreadyHasBaseline) {
      setDashboardInitialTab("today")
      setSurface("dashboard")
      setError(null)
      return
    }
    setEditingPlan(Boolean(plan))
    setStep(2)
    setWelcomeComplete(true)
    setSurface("onboarding")
    setError(null)
  }

  async function startNewRoundDiagnostic() {
    const response = await fetch("/api/diagnostic", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start_new_if_completed" }),
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      throw new Error(
        payload?.error ?? "Could not prepare a new diagnostic attempt."
      )
    }
    void loadDiagnosticIntro()
    setDiagnosticPurpose("round")
    setDashboardInitialTab(undefined)
    setSurface("diagnostic")
    setError(null)
  }

  async function completeDiagnostic(result: DiagnosticResult) {
    try {
      const evidence = diagnosticResultToEvidence(result)
      if (diagnosticPurpose === "round") {
        if (!plan) {
          throw new Error("Open your lesson round before applying this result.")
        }
        const response = await fetch("/api/learning", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "start_adaptive_round",
            assessmentSource: "diagnostic",
            goalScore: draft.goal,
            currentScore: result.compositeRange.estimate,
            scoreEvidenceKey: plan.journey.officialScoreHistory.at(-1)?.id,
            sectionScores: result.planningBaseline,
            daysUntilTest: Math.max(
              1,
              calendarDaysUntil(today, draft.testDate)
            ),
            minutesPerSession: draft.minutesPerSession,
            studyDaysPerWeek: draft.studyDaysPerWeek,
            preferredSection: draft.preferredSection,
          }),
        })
        const payload = (await response.json()) as {
          error?: string
        }
        if (!response.ok) {
          throw new Error(
            payload.error ?? "Could not build the next lesson round."
          )
        }
      } else if (
        plan &&
        (plan.adaptiveBaselineRequired || plan.baselineSkipped)
      ) {
        const response = await fetch("/api/learning", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rebase_after_diagnostic",
            goalScore: draft.goal,
            currentScore: result.compositeRange.estimate,
            scoreEvidenceKey: plan.journey.officialScoreHistory.at(-1)?.id,
            sectionScores: result.planningBaseline,
            daysUntilTest: Math.max(
              1,
              calendarDaysUntil(today, draft.testDate)
            ),
            minutesPerSession: draft.minutesPerSession,
            studyDaysPerWeek: draft.studyDaysPerWeek,
            preferredSection: draft.preferredSection,
          }),
        })
        const payload = (await response.json()) as {
          error?: string
        }
        if (!response.ok) {
          throw new Error(
            payload.error ??
              "Could not align the first lesson round with this diagnostic."
          )
        }
      }
      setDiagnosticPurpose("baseline")
      const nextPlan = buildPlanFromEvidence(
        evidence,
        result.planningBaseline,
        result.compositeRange.estimate,
        result,
        draft,
        {
          profileSkillResults: [...result.skillResults],
          profileSource: "diagnostic",
          journey: plan?.journey,
          adaptiveBaselineRequired: false,
          baselineSkipped: false,
          save: false,
        }
      )
      if (!(await persistPlan(nextPlan))) {
        throw new Error(
          "Scout scored the diagnostic, but could not save your starting point yet. Try again before leaving this page."
        )
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We could not build the plan from this baseline."
      )
      setSurface("diagnostic")
    }
  }

  function useAdaptiveBaseline(payload: CalibrationLearningBaseline) {
    void loadLearnerOrientation()
    void loadDashboard()
    const keepReportedScore =
      plan?.evidence.source === "section_scores" ||
      plan?.evidence.source === "composite_only"
    if (plan && keepReportedScore && plan.evidence.planningBaseline) {
      buildPlanFromEvidence(
        plan.evidence,
        plan.evidence.planningBaseline,
        plan.currentComposite,
        undefined,
        plan.draft,
        {
          profileSkillResults: [...payload.skillResults],
          profileSource: "quick-check",
          journey: plan.journey,
        }
      )
      return
    }
    const baseline = payload.sections
    const composite = payload.composite
    const evidence: NormalizedScoreEvidence = {
      source: "rapid_diagnostic",
      reportedComposite: null,
      calculatedComposite: composite,
      reportedSections: null,
      planningBaseline: baseline,
      science: null,
      confidence: "low",
      compositeDifference: null,
    }
    buildPlanFromEvidence(evidence, baseline, composite, undefined, draft, {
      profileSkillResults: [...payload.skillResults],
      profileSource: "quick-check",
      journey: plan?.journey,
    })
  }

  async function useFullTestAssessment(session: ExamLabSessionPayload) {
    if (!plan || !session.result || session.result.mode !== "core") return
    const sectionScores = Object.fromEntries(
      session.result.sections.map((section) => [
        section.section,
        section.practiceEstimate,
      ])
    ) as CoreSectionScores
    if (
      !Number.isInteger(sectionScores.english) ||
      !Number.isInteger(sectionScores.math) ||
      !Number.isInteger(sectionScores.reading)
    ) {
      throw new Error("The full-length test is missing section results.")
    }
    const skillResults: DiagnosticSkillResult[] = session.result.skills.map(
      (skill) => ({
        skill: skill.skill,
        label: skill.label,
        section: skill.section,
        correct: skill.correct,
        total: skill.total,
        accuracy: skill.accuracy,
        signal:
          skill.accuracy >= 0.75
            ? "strength"
            : skill.accuracy < 0.5
              ? "focus"
              : "developing",
      })
    )
    const evidence: NormalizedScoreEvidence = {
      source: "full_test",
      reportedComposite: null,
      calculatedComposite: session.result.practiceEstimate.estimate,
      reportedSections: null,
      planningBaseline: sectionScores,
      science: null,
      confidence: "medium",
      compositeDifference: null,
    }
    const nextPlan = makeGeneratedPlan({
      today,
      draft: plan.draft,
      evidence,
      baseline: sectionScores,
      currentComposite: session.result.practiceEstimate.estimate,
      diagnosticResult: plan.diagnosticResult,
      profileSkillResults: skillResults,
      profileSource: "full-test",
      journey: plan.journey,
      adaptiveBaselineRequired: plan.adaptiveBaselineRequired,
      baselineSkipped: plan.baselineSkipped,
    })
    if (!(await persistPlan(nextPlan))) {
      throw new Error(
        "Scout kept the full-test result open, but could not save the updated plan yet. Try again before leaving this page."
      )
    }
    setPlan(nextPlan)
    setSurface(surfaceForPlan(nextPlan))
    setError(null)
  }

  async function saveTestDayCheckIn(result: TestDayCheckInResult) {
    if (!plan) return
    const handlesActiveTest = result.testDate === plan.draft.testDate
    const officialScore = result.newOfficialScore
    const latestOfficialScore = [...plan.journey.officialScoreHistory]
      .sort(
        (left, right) =>
          left.testDate.localeCompare(right.testDate) ||
          left.recordedAt.localeCompare(right.recordedAt)
      )
      .at(-1)
    const scoreBecomesCurrent =
      Boolean(officialScore) &&
      (!latestOfficialScore ||
        (officialScore?.testDate ?? "") >= latestOfficialScore.testDate)
    const currentOfficialScore = scoreBecomesCurrent ? officialScore : undefined
    const pendingWithoutCurrent = pendingOfficialScores(plan.journey).filter(
      (entry) => entry.testDate !== result.testDate
    )
    const nextPendingOfficialScores =
      result.outcome === "scores_pending"
        ? [
            ...pendingWithoutCurrent,
            {
              testDate: result.testDate,
              recordedAt: new Date().toISOString(),
              nextPromptOn: addCalendarDaysFrom(today, 7),
            },
          ]
        : pendingWithoutCurrent
    const nextDraft: PlacementDraft = {
      ...plan.draft,
      ...(handlesActiveTest && result.nextTestDate
        ? { testDate: result.nextTestDate }
        : {}),
      ...(currentOfficialScore
        ? {
            priorScoreChoice: currentOfficialScore.sections
              ? ("scores" as const)
              : ("composite_only" as const),
            scoreSource: "official" as const,
            composite: currentOfficialScore.composite,
            ...(currentOfficialScore.sections
              ? {
                  english: currentOfficialScore.sections.english,
                  math: currentOfficialScore.sections.math,
                  reading: currentOfficialScore.sections.reading,
                }
              : {}),
          }
        : {}),
    }
    const evidence = currentOfficialScore
      ? currentOfficialScore.sections
        ? normalizeCurrentScore({
            kind: "section_scores",
            composite: currentOfficialScore.composite,
            english: currentOfficialScore.sections.english,
            math: currentOfficialScore.sections.math,
            reading: currentOfficialScore.sections.reading,
            ...(nextDraft.scienceEnabled ? { science: nextDraft.science } : {}),
          })
        : normalizeCurrentScore({
            kind: "composite_only",
            composite: currentOfficialScore.composite,
            ...(nextDraft.scienceEnabled ? { science: nextDraft.science } : {}),
          })
      : plan.evidence
    const baseline = evidence.planningBaseline ?? plan.evidence.planningBaseline
    if (!baseline) {
      throw new Error("The next plan is missing a section starting point.")
    }
    const journey: TutorJourney = {
      ...plan.journey,
      officialScoreHistory: (officialScore
        ? [
            ...plan.journey.officialScoreHistory.filter(
              (entry) => entry.testDate !== officialScore.testDate
            ),
            {
              id: globalThis.crypto.randomUUID(),
              testDate: officialScore.testDate,
              recordedAt: new Date().toISOString(),
              composite: officialScore.composite,
              sections: officialScore.sections,
            },
          ]
        : plan.journey.officialScoreHistory
      ).sort(
        (left, right) =>
          left.testDate.localeCompare(right.testDate) ||
          left.recordedAt.localeCompare(right.recordedAt)
      ),
      pendingOfficialScores: nextPendingOfficialScores,
      checkInSnoozedUntil: handlesActiveTest
        ? null
        : plan.journey.checkInSnoozedUntil,
      doneForNow: handlesActiveTest
        ? result.doneForNow
        : plan.journey.doneForNow,
    }
    const nextPlan = makeGeneratedPlan({
      today,
      draft: nextDraft,
      evidence,
      baseline,
      currentComposite:
        currentOfficialScore?.composite ?? plan.currentComposite,
      profileSkillResults: plan.profileSkillResults,
      profileSource: plan.profileSource,
      journey,
      adaptiveBaselineRequired: plan.adaptiveBaselineRequired,
      baselineSkipped: plan.baselineSkipped,
    })
    const saved = await persistPlan(nextPlan)
    if (!saved) {
      throw new Error("The check-in could not be saved to your account.")
    }
    setDraft(nextDraft)
    setPlan(nextPlan)
    setSurface("dashboard")
    setError(null)
  }

  function snoozeTestDayCheckIn() {
    if (!plan) return
    const activeCheckIn = activeTestDayCheckIn(plan)
    if (!activeCheckIn) return
    const nextPlan: GeneratedPlan = {
      ...plan,
      journey: {
        ...plan.journey,
        pendingOfficialScores:
          activeCheckIn.kind === "pending"
            ? pendingOfficialScores(plan.journey).map((entry) =>
                entry.testDate === activeCheckIn.testDate
                  ? {
                      ...entry,
                      nextPromptOn: addCalendarDaysFrom(today, 7),
                    }
                  : entry
              )
            : pendingOfficialScores(plan.journey),
        checkInSnoozedUntil:
          activeCheckIn.kind === "active"
            ? addCalendarDaysFrom(today, 7)
            : plan.journey.checkInSnoozedUntil,
      },
    }
    setPlan(nextPlan)
    setSurface("dashboard")
    void persistPlan(nextPlan)
  }

  async function launchJudgeDemo() {
    void loadDashboard()
    try {
      const [learningResponse, calibrationResponse] = await Promise.all([
        fetch("/api/learning", { method: "DELETE" }),
        fetch("/api/calibration", { method: "DELETE" }),
      ])
      if (!learningResponse.ok || !calibrationResponse.ok) {
        throw new Error("Could not reset the demo learner.")
      }
      const demoDraft: PlacementDraft = {
        goal: 31,
        priorScoreChoice: "scores",
        scoreSource: "practice",
        startingCheckChoice: "take",
        composite: 24,
        english: 22,
        math: 25,
        reading: 24,
        scienceEnabled: false,
        science: 24,
        testDate: addCalendarDaysFrom(today, 36),
        studyDaysPerWeek: 3,
        minutesPerSession: 30,
        preferredSection: "english",
      }
      const diagnosticResult = judgeDemoDiagnostic()
      const evidence = diagnosticResultToEvidence(diagnosticResult)
      setDraft(demoDraft)
      buildPlanFromEvidence(
        evidence,
        diagnosticResult.planningBaseline,
        diagnosticResult.compositeRange.estimate,
        diagnosticResult,
        demoDraft,
        {
          profileSource: "diagnostic",
          journey: migratedTutorJourney(),
        }
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load the adaptive demo."
      )
    }
  }

  if (!storageReady && !restoredAtLoad) {
    return <TutorSurfaceLoading message="Checking for a saved plan…" />
  }

  if (surface === "orientation" && plan) {
    return (
      <LearnerOrientation
        startAtProfile={orientationResumeProfile}
        currentComposite={plan.currentComposite}
        targetComposite={plan.draft.goal}
        skillResults={plan.profileSkillResults}
        sectionScores={plan.evidence.planningBaseline}
        evidenceSource={
          plan.profileSource === "diagnostic"
            ? "diagnostic"
            : plan.profileSource === "quick-check"
              ? "quick-check"
              : plan.diagnosticResult
                ? "diagnostic"
                : plan.profileSkillResults.length > 0
                  ? "quick-check"
                  : undefined
        }
        onStartDashboardTour={() => {
          if (!window.matchMedia("(min-width: 900px)").matches) return false
          try {
            window.localStorage.removeItem(DASHBOARD_TOUR_STORAGE_KEY)
          } catch {
            // The tour can still open in this session without persistence.
          }
          setDashboardInitialTab("today")
          setOrientationTourActive(true)
          setSurface("dashboard")
          return true
        }}
        onComplete={(choice) => {
          const nextPlan: GeneratedPlan = {
            ...plan,
            journey: {
              ...plan.journey,
              onboardingCompleted: true,
              lessonEntryChoice: choice,
            },
          }
          setPlan(nextPlan)
          setOrientationResumeProfile(false)
          setSurface("dashboard")
          setError(null)
          void persistPlan(nextPlan)
        }}
      />
    )
  }

  if (surface === "test-day-check-in" && plan) {
    const activeCheckIn = activeTestDayCheckIn(plan)
    return (
      <TestDayCheckIn
        testDate={activeCheckIn?.testDate ?? plan.draft.testDate}
        preserveCurrentCycle={activeCheckIn?.kind === "pending"}
        currentComposite={plan.currentComposite}
        officialScoreHistory={plan.journey.officialScoreHistory}
        baselineOfficialComposite={plan.journey.baselineOfficialComposite}
        onComplete={saveTestDayCheckIn}
        onSnooze={snoozeTestDayCheckIn}
      />
    )
  }

  if (surface === "dashboard" && plan) {
    return (
      <Dashboard
        plan={plan}
        initialTab={dashboardInitialTab}
        externalError={error}
        viewer={viewer}
        savedPlan={savedPlanFrom(plan)}
        onViewerChange={handleViewerChange}
        onEditPlan={editPlan}
        onStartFullDiagnostic={() => {
          void (async () => {
            try {
              const response = await fetch("/api/diagnostic", {
                method: "POST",
                cache: "no-store",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "start_new_if_completed",
                }),
              })
              if (!response.ok) {
                const payload = (await response.json().catch(() => null)) as {
                  error?: string
                } | null
                throw new Error(
                  payload?.error ??
                    "Could not prepare the full diagnostic attempt."
                )
              }
              void loadDiagnosticIntro()
              setDiagnosticPurpose("baseline")
              setDashboardInitialTab("calibrate")
              setSurface("diagnostic")
              setError(null)
            } catch (caught) {
              setError(
                caught instanceof Error
                  ? caught.message
                  : "Could not prepare the full diagnostic attempt."
              )
            }
          })()
        }}
        onStartNewDiagnostic={startNewRoundDiagnostic}
        onUseAdaptiveBaseline={useAdaptiveBaseline}
        onUseFullTestAssessment={useFullTestAssessment}
      />
    )
  }

  if (surface === "diagnostic") {
    return (
      <DiagnosticIntro
        backLabel={
          plan && diagnosticPurpose === "baseline"
            ? "Return to dashboard"
            : undefined
        }
        error={error}
        goal={draft.goal}
        purpose={diagnosticPurpose}
        testDate={draft.testDate}
        onBack={() => {
          setError(null)
          if (diagnosticPurpose === "round") {
            setSurface("dashboard")
            return
          }
          returnFromBaselineDiagnostic()
        }}
        onStart={() => {
          void loadDiagnosticRunner()
          setSurface("diagnostic-runner")
        }}
      />
    )
  }

  if (surface === "diagnostic-runner") {
    return (
      <DiagnosticRunner
        onBack={() => setSurface("diagnostic")}
        canViewTechnicalDetails={viewer.technicalDetails}
        purpose={diagnosticPurpose}
        onComplete={(result) => {
          void completeDiagnostic(result)
        }}
      />
    )
  }

  const pendingOnboardingSetup: PendingTutorSetup | null =
    !plan && welcomeComplete
      ? {
          version: 1,
          savedAt: new Date().toISOString(),
          draft,
          diagnosticPurpose: "baseline",
          resumeSurface: "onboarding",
          onboardingStep: step === 2 || step === 3 ? step : 1,
        }
      : null

  return (
    <Onboarding
      draft={draft}
      viewer={viewer}
      savedPlan={plan ? savedPlanFrom(plan) : null}
      pendingSetup={pendingOnboardingSetup}
      error={error}
      step={step}
      today={today}
      onBack={() => setStep((current) => Math.max(1, current - 1))}
      onCancel={editingPlan ? cancelEditingPlan : undefined}
      onContinue={() => {
        if (step < 3) {
          if (step === 2) {
            const scoreError = validateScoreStep(draft)
            if (scoreError) {
              setError(scoreError)
              return
            }
          }
          setStep((current) => current + 1)
          setError(null)
          return
        }
        void createPlan()
      }}
      showWelcome={!welcomeComplete}
      onDismissWelcome={() => setWelcomeComplete(true)}
      onStartFullDiagnostic={() => {
        setDraft((current) => ({
          ...current,
          priorScoreChoice: "never",
          startingCheckChoice: "take",
        }))
        setStep(1)
        setError(null)
        setWelcomeComplete(true)
      }}
      onJudgeDemo={() => {
        setWelcomeComplete(true)
        void launchJudgeDemo()
      }}
      onViewerChange={handleViewerChange}
      onUpdate={updateDraft}
    />
  )
}
