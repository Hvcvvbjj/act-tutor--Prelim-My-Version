"use client"

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import dynamic from "next/dynamic"
import {
  examLabInterpretationReadiness,
  type AnswerConfidence,
  type CalibrationLearningBaseline,
  type CoreSection,
  type ExamLabMode,
  type ExamLabSessionPayload,
  type LearningActionRequest,
  type LearningAnswerRequest,
  type LearningSessionPayload,
  type LessonCheckResult,
  type LessonPlanContext,
  type StudyPlanTask,
} from "@act-tutor/core"
import {
  ArrowLeftIcon,
  InfoIcon,
  PencilLineIcon,
  Settings2Icon,
} from "lucide-react"

import { AccountAccess } from "@/components/tutor/account-access"
import { BadgesSurface } from "@/components/tutor/badges-surface"
import { DashboardTour } from "@/components/tutor/dashboard-tour"
import { GoalSupportPrompt } from "@/components/tutor/goal-support-prompt"
import { learningBaselineSkillResults } from "@/components/tutor/learning-baseline-evidence"
import { LessonsCommandCenter } from "@/components/tutor/lessons-command-center"
import { shouldShowRoundTransition } from "@/components/tutor/lesson-workspace-logic"
import {
  RapidAnswerCoachDialog,
  useRapidAnswerCoach,
} from "@/components/tutor/rapid-answer-coach"
import { ScoutCoach, ScoutMark } from "@/components/tutor/scout"
import {
  ScoutProvider,
  useScoutContext,
} from "@/components/tutor/scout-assistant"
import type { GeneratedPlan } from "@/components/tutor/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AuthViewer, SavedTutorPlan } from "@/lib/auth-types"
import {
  cacheLearningSession,
  consumeCompletedExamForLearningRound,
  deleteRemoteScoutData,
  flushOfflineAnswerQueue,
  learningRequest,
  loadLearningSession,
  readCachedLearningSession,
} from "@/lib/learning-client"
import { readScoutSettings } from "@/lib/scout-settings"
import { studyTaskLaunchDecision } from "@/lib/study-task-routing"

function DashboardSurfaceLoading({ message }: { message: string }) {
  return (
    <div
      className="mx-auto max-w-3xl px-5 py-20"
      role="status"
      aria-live="polite"
    >
      <ScoutCoach mood="thinking" message={message} />
    </div>
  )
}

const loadAdaptivePlanStudio = () =>
  import("@/components/tutor/adaptive-plan-studio").then(
    (module) => module.AdaptivePlanStudio
  )
const loadAdaptiveCalibrationLab = () =>
  import("@/components/tutor/adaptive-calibration-lab").then(
    (module) => module.AdaptiveCalibrationLab
  )
const loadLessonWorkspace = () =>
  import("@/components/tutor/lesson-workspace").then(
    (module) => module.LessonWorkspace
  )
const loadLessonReviewWorkspace = () =>
  import("@/components/tutor/lesson-workspace").then(
    (module) => module.LessonReviewWorkspace
  )
const loadLearningTwinLab = () =>
  import("@/components/tutor/learning-twin-lab").then(
    (module) => module.LearningTwinLab
  )
const loadTestDayLab = () =>
  import("@/components/tutor/test-day-lab").then((module) => module.TestDayLab)
const loadScoutOperationsLab = () =>
  import("@/components/tutor/scout-operations-lab").then(
    (module) => module.ScoutOperationsLab
  )
const loadRoundTransition = () =>
  import("@/components/tutor/round-transition").then(
    (module) => module.RoundTransition
  )

const AdaptivePlanStudio = dynamic(loadAdaptivePlanStudio, {
  loading: () => <DashboardSurfaceLoading message="Opening your study week…" />,
})
const AdaptiveCalibrationLab = dynamic(loadAdaptiveCalibrationLab, {
  loading: () => <DashboardSurfaceLoading message="Opening Quick Check…" />,
})
const LessonWorkspace = dynamic(loadLessonWorkspace, {
  loading: () => <DashboardSurfaceLoading message="Opening your lesson…" />,
})
const LessonReviewWorkspace = dynamic(loadLessonReviewWorkspace, {
  loading: () => <DashboardSurfaceLoading message="Opening lesson review…" />,
})
const LearningTwinLab = dynamic(loadLearningTwinLab, {
  loading: () => <DashboardSurfaceLoading message="Opening your progress…" />,
})
const TestDayLab = dynamic(loadTestDayLab, {
  loading: () => <DashboardSurfaceLoading message="Opening timed practice…" />,
})
const ScoutOperationsLab = dynamic(loadScoutOperationsLab, {
  loading: () => <DashboardSurfaceLoading message="Opening Data & privacy…" />,
})
const RoundTransition = dynamic(loadRoundTransition, {
  loading: () => (
    <DashboardSurfaceLoading message="Preparing your next lesson round…" />
  ),
})

function preloadDashboardSurface(value: string) {
  switch (value) {
    case "plan":
      void loadAdaptivePlanStudio()
      break
    case "calibrate":
      void loadAdaptiveCalibrationLab()
      break
    case "progress":
      void loadLearningTwinLab()
      break
    case "lab":
      void loadTestDayLab()
      break
    case "control":
      void loadScoutOperationsLab()
      break
  }
}

function DashboardTab({
  value,
  className,
  tourId,
  children,
}: {
  value: string
  className?: string
  tourId?: string
  children: ReactNode
}) {
  const preload = () => preloadDashboardSurface(value)
  return (
    <TabsTrigger
      value={value}
      className={className}
      data-tour-id={tourId}
      onPointerEnter={preload}
      onPointerDown={preload}
      onFocus={preload}
    >
      {children}
    </TabsTrigger>
  )
}

interface DashboardProps {
  plan: GeneratedPlan
  initialTab?: Extract<DashboardDestination, "today" | "calibrate">
  externalError?: string | null
  viewer: AuthViewer
  savedPlan: SavedTutorPlan
  onViewerChange: (viewer: AuthViewer) => void
  onEditPlan: () => void
  onStartFullDiagnostic: () => void
  onStartNewDiagnostic: () => Promise<void> | void
  onUseAdaptiveBaseline: (payload: CalibrationLearningBaseline) => void
  onUseFullTestAssessment: (
    session: ExamLabSessionPayload
  ) => Promise<void> | void
}

const DASHBOARD_DESTINATIONS = [
  "today",
  "plan",
  "calibrate",
  "progress",
  "badges",
  "lab",
  "control",
] as const
type DashboardDestination = (typeof DASHBOARD_DESTINATIONS)[number]

function isDashboardDestination(value: string): value is DashboardDestination {
  return DASHBOARD_DESTINATIONS.some((destination) => destination === value)
}

interface CalibrationRebaseResponse {
  learning: LearningSessionPayload
  baseline: CalibrationLearningBaseline
}

type MissionStartAction =
  | { action: "start_next" }
  | { action: "start_skill"; skill: string }
  | { action: "start_repair"; mistakeId: string }
  | { action: "start_checkpoint" }
  | { action: "start_retention"; skill: string }
  | { action: "start_challenge"; skill?: string }
  | { action: "start_micro"; skill?: string }
  | { action: "start_recovery" }

const SECTION_FALLBACK_SKILLS = {
  english: "sentence-boundaries",
  math: "linear-equations",
  reading: "supported-inference",
} as const

function assertFullTestReady(session: ExamLabSessionPayload) {
  const result = session.result
  if (
    !result ||
    result.mode !== "core" ||
    !examLabInterpretationReadiness(result).sufficient
  ) {
    throw new Error(
      "Complete enough of the full-length core test for Scout to interpret it before starting the next lesson round."
    )
  }
}

async function rebaseLearningSession(
  body: Omit<LessonPlanContext, "currentScore">
) {
  const response = await fetch("/api/learning", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "rebase_after_calibration", ...body }),
  })
  const payload = (await response.json()) as
    CalibrationRebaseResponse | { error: string }
  if (!response.ok || "error" in payload) {
    throw new Error(
      "error" in payload
        ? payload.error
        : "The Quick Check plan could not be saved."
    )
  }
  return payload
}

function Brand({ onHome }: { onHome?: () => void }) {
  const content = (
    <>
      <ScoutMark className="size-8 shrink-0" />
      <span className="min-w-0 truncate font-brand text-base leading-none font-black tracking-[-0.02em] whitespace-nowrap sm:text-lg">
        SCOUT <span className="text-primary">ACT</span>
      </span>
    </>
  )
  const className =
    "flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg sm:gap-2.5"

  return onHome ? (
    <button
      type="button"
      data-testid="app-brand"
      className={`${className} min-h-11 px-1 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none`}
      aria-label="Scout ACT, go to Lessons"
      onClick={onHome}
    >
      {content}
    </button>
  ) : (
    <div data-testid="app-brand" className={className}>
      {content}
    </div>
  )
}

function AccessibleTestDayLab({
  initialMode,
  initialSection,
  canViewTechnicalDetails,
  onUseForNextRound,
  lockToInitialMode = false,
  assessmentLabel,
}: {
  initialMode: ExamLabMode
  initialSection: CoreSection
  canViewTechnicalDetails: boolean
  onUseForNextRound?: (session: ExamLabSessionPayload) => Promise<void> | void
  lockToInitialMode?: boolean
  assessmentLabel?: string
}) {
  const { accommodations } = useScoutContext()
  return (
    <TestDayLab
      extendedTime={accommodations.extendedTime}
      initialMode={initialMode}
      initialSection={initialSection}
      canViewTechnicalDetails={canViewTechnicalDetails}
      onUseForNextRound={onUseForNextRound}
      lockToInitialMode={lockToInitialMode}
      assessmentLabel={assessmentLabel}
    />
  )
}

function MrKimHeaderButton() {
  const { openScout } = useScoutContext()
  return (
    <Button
      type="button"
      variant="ghost"
      className="min-h-11 min-w-11 px-2"
      data-tour-id="mr-kim"
      aria-label="Ask Mr. Kim"
      onClick={() => openScout()}
    >
      <ScoutMark className="size-7 border" />
      <span className="hidden 2xl:inline">Mr. Kim</span>
    </Button>
  )
}

function SettingsHeaderButton() {
  const { openSettings } = useScoutContext()
  return (
    <Button
      type="button"
      variant="ghost"
      className="min-h-11 min-w-11 px-2"
      data-tour-id="settings"
      aria-label="Open settings"
      onClick={openSettings}
    >
      <Settings2Icon />
      <span className="hidden 2xl:inline">Settings</span>
    </Button>
  )
}

function DashboardOverlays({
  plan,
  focusSkill,
  assessmentRound,
}: {
  plan: GeneratedPlan
  focusSkill?: string
  assessmentRound: number
}) {
  const { openScout } = useScoutContext()
  return (
    <>
      <DashboardTour />
      <GoalSupportPrompt
        currentScore={plan.currentComposite}
        goalScore={plan.draft.goal}
        weakestSection={plan.weakestSection}
        focusSkill={focusSkill}
        assessmentRound={assessmentRound}
        onAskMrKim={() =>
          openScout(
            `What should I study first to move from ${plan.currentComposite} toward ${plan.draft.goal}?`
          )
        }
      />
    </>
  )
}

export function Dashboard({
  plan,
  initialTab,
  externalError,
  viewer,
  savedPlan,
  onViewerChange,
  onEditPlan,
  onStartFullDiagnostic,
  onStartNewDiagnostic,
  onUseAdaptiveBaseline,
  onUseFullTestAssessment,
}: DashboardProps) {
  const diagnostic = plan.diagnosticResult
  const baselineSkillResults = useMemo(
    () =>
      learningBaselineSkillResults({
        profileSkillResults: plan.profileSkillResults,
        diagnosticResult: diagnostic,
      }),
    [diagnostic, plan.profileSkillResults]
  )
  const representativeDemo = diagnostic?.formId === "scout-judge-demo"
  const startingSkill =
    diagnostic?.focusSkills[0]?.skill ??
    SECTION_FALLBACK_SKILLS[plan.weakestSection]
  const [learning, setLearning] = useState<LearningSessionPayload | null>(null)
  const [learningError, setLearningError] = useState<string | null>(null)
  const visibleLearningError = externalError ?? learningError
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [lessonReview, setLessonReview] = useState<LessonCheckResult | null>(
    null
  )
  const [activeSection, setActiveSection] = useState(0)
  const [selectedChoice, setSelectedChoice] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [roundAssessmentView, setRoundAssessmentView] = useState<
    "choice" | "full-test"
  >(() =>
    typeof window !== "undefined" &&
    window.sessionStorage.getItem("scout-round-assessment-view") === "full-test"
      ? "full-test"
      : "choice"
  )
  const [activeTab, setActiveTab] = useState<DashboardDestination>(
    initialTab ??
      (representativeDemo || plan.adaptiveBaselineRequired
        ? "calibrate"
        : "today")
  )
  const [labLaunch, setLabLaunch] = useState<{
    mode: ExamLabMode
    section: CoreSection
    key: number
    assessmentLabel?: string
    lockToInitialMode?: boolean
  }>({ mode: "sprint", section: "english", key: 0 })
  const rapidAnswerCoach = useRapidAnswerCoach(
    learning?.sessionId ?? "learning-session-loading",
    learning?.answeredQuestionIds ?? []
  )

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeTab, workspaceOpen])

  useEffect(() => {
    if (!learning) return
    if (learning.cycle.status !== "assessment-choice") {
      window.sessionStorage.removeItem("scout-round-assessment-view")
    }
  }, [learning])

  const refreshLearningSession = useCallback(async () => {
    try {
      const payload = await loadLearningSession()
      setLearning(payload)
      setLearningError(null)
      return payload
    } catch (error) {
      const cached = readCachedLearningSession()
      if (cached) setLearning(cached)
      setLearningError(
        cached
          ? "You are offline. Scout opened the last saved lesson; new grading will sync when you reconnect."
          : error instanceof Error
            ? error.message
            : "Your latest skill results could not load."
      )
      return null
    }
  }, [])

  useEffect(() => {
    async function flushOfflineAnswers() {
      const result = await flushOfflineAnswerQueue()
      if (result.lastQuarantineReason) {
        setLearningError(
          `A saved answer was not applied: ${result.lastQuarantineReason} It is available in Data & privacy for review.`
        )
      } else if (result.lastTransientReason) {
        setLearningError(
          `Scout's server is temporarily busy. Your saved answer is still waiting on this device and will be tried again; it was not discarded.`
        )
      }
      if (result.applied > 0) await refreshLearningSession()
    }
    window.addEventListener("online", flushOfflineAnswers)
    if (navigator.onLine) void flushOfflineAnswers()
    return () => window.removeEventListener("online", flushOfflineAnswers)
  }, [refreshLearningSession])

  useEffect(() => {
    if (learning) {
      cacheLearningSession(learning)
    }
  }, [learning])

  useEffect(() => {
    let active = true
    learningRequest({
      action: "start",
      skill: startingSkill,
      diagnosticSkillResults: baselineSkillResults,
      goalScore: plan.draft.goal,
      currentScore: plan.currentComposite,
      scoreEvidenceKey: plan.journey.officialScoreHistory.at(-1)?.id,
      sectionScores: plan.evidence.planningBaseline ?? undefined,
      daysUntilTest: plan.intensity.daysUntilTest,
      minutesPerSession: plan.intensity.minutesPerSession,
      studyDaysPerWeek: plan.intensity.studyDaysPerWeek,
      preferredSection: plan.draft.preferredSection,
    })
      .then((payload) => {
        if (!active) return
        setLearning(payload)
        setLearningError(null)
      })
      .catch((error: unknown) => {
        if (!active) return
        const cached = readCachedLearningSession()
        if (cached) setLearning(cached)
        setLearningError(
          cached
            ? "You are offline. Scout opened the last saved lesson; new grading will sync when you reconnect."
            : error instanceof Error
              ? error.message
              : "The learning session could not load."
        )
      })
    return () => {
      active = false
    }
  }, [
    baselineSkillResults,
    plan.currentComposite,
    plan.journey.officialScoreHistory,
    plan.evidence.planningBaseline,
    plan.draft.goal,
    plan.draft.preferredSection,
    plan.intensity.daysUntilTest,
    plan.intensity.minutesPerSession,
    plan.intensity.studyDaysPerWeek,
    startingSkill,
  ])

  async function completeLesson() {
    setSubmitting(true)
    try {
      setLearning(await learningRequest({ action: "complete_lesson" }))
      setSelectedChoice("")
      setLearningError(null)
    } catch (error) {
      setLearningError(
        error instanceof Error
          ? error.message
          : "Could not complete the lesson."
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function correctLearnerModel(input: {
    skill: string
    kind: "too-high" | "too-low" | "wrong-misconception"
    note: string
  }) {
    setSubmitting(true)
    try {
      setLearning(await learningRequest({ action: "correct_model", ...input }))
      setLearningError(null)
    } catch (error) {
      setLearningError(
        error instanceof Error ? error.message : "Could not correct the model."
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteLearnerData() {
    setSubmitting(true)
    setLearningError(null)
    try {
      await deleteRemoteScoutData()
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith("scout-") || key.startsWith("ai-act-")) {
          window.localStorage.removeItem(key)
        }
      }
      window.location.reload()
    } catch (error) {
      setLearningError(
        error instanceof Error
          ? error.message
          : "Deletion was not confirmed. No local data was cleared."
      )
      setSubmitting(false)
    }
  }

  async function submitAnswer(metadata: {
    confidence: AnswerConfidence
    selfCorrected: boolean
    responseSeconds: number
  }) {
    const question = learning?.questions[learning.currentQuestionIndex]
    if (!question || !selectedChoice) return
    setSubmitting(true)
    try {
      const updatedLearning = await learningRequest({
        action: "answer",
        questionId: question.id,
        choiceId: selectedChoice,
        ...metadata,
        command: {
          schemaVersion: 2,
          idempotencyKey: window.crypto.randomUUID(),
          learnerSessionId: learning.sessionId,
          bankVersion: learning.bankVersion,
          questionVersion: question.version,
          sequence: learning.currentQuestionIndex,
          answerRevision: 1,
          issuedAt: new Date().toISOString(),
        },
      } satisfies LearningAnswerRequest)
      rapidAnswerCoach.recordAnswer(question.id)
      setLearning(updatedLearning)
      setSelectedChoice("")
      setLearningError(null)
    } catch (error) {
      setLearningError(
        error instanceof Error ? error.message : "Could not check the answer."
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function submitLessonRemediation(questionId: string, choiceId: string) {
    setSubmitting(true)
    try {
      const updatedLearning = await learningRequest({
        action: "answer_lesson_remediation",
        questionId,
        choiceId,
      })
      setLearning(updatedLearning)
      setSelectedChoice("")
      setLearningError(null)
    } catch (error) {
      setLearningError(
        error instanceof Error
          ? error.message
          : "Could not check that review answer."
      )
    } finally {
      setSubmitting(false)
    }
  }

  function planRequestFields() {
    return {
      goalScore: plan.draft.goal,
      currentScore: plan.currentComposite,
      scoreEvidenceKey: plan.journey.officialScoreHistory.at(-1)?.id,
      sectionScores: plan.evidence.planningBaseline ?? undefined,
      daysUntilTest: plan.intensity.daysUntilTest,
      minutesPerSession: plan.intensity.minutesPerSession,
      studyDaysPerWeek: plan.intensity.studyDaysPerWeek,
      preferredSection: plan.draft.preferredSection,
    }
  }

  async function applyAdaptiveBaseline() {
    setSubmitting(true)
    try {
      const planFields = planRequestFields()
      const rebased = await rebaseLearningSession({
        goalScore: planFields.goalScore,
        daysUntilTest: planFields.daysUntilTest,
        minutesPerSession: planFields.minutesPerSession,
        studyDaysPerWeek: planFields.studyDaysPerWeek,
        preferredSection: planFields.preferredSection,
      })
      setLearning(rebased.learning)
      setSelectedChoice("")
      setActiveSection(0)
      setWorkspaceOpen(false)
      onUseAdaptiveBaseline(rebased.baseline)
      setActiveTab("today")
      setLearningError(null)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The Quick Check plan could not be saved."
      setLearningError(message)
      throw error
    } finally {
      setSubmitting(false)
    }
  }

  async function startMissionAction(
    body: MissionStartAction,
    openWorkspace = false
  ) {
    if (openWorkspace) void loadLessonWorkspace()
    setSubmitting(true)
    try {
      const request: LearningActionRequest = { ...planRequestFields(), ...body }
      const payload = await learningRequest(request)
      setLearning(payload)
      setSelectedChoice("")
      setActiveSection(0)
      setLessonReview(null)
      setWorkspaceOpen(openWorkspace)
      setLearningError(null)
      return true
    } catch (error) {
      setLearningError(
        error instanceof Error
          ? error.message
          : "Could not start that study task."
      )
      return false
    } finally {
      setSubmitting(false)
    }
  }

  function startProgressCheck(section: CoreSection = plan.weakestSection) {
    void loadTestDayLab()
    setLabLaunch((current) => ({
      mode: "section",
      section,
      key: current.key + 1,
      assessmentLabel: "Progress check",
      lockToInitialMode: true,
    }))
    setActiveTab("lab")
  }

  function openTimedPractice() {
    void loadTestDayLab()
    setLabLaunch((current) => ({
      mode: "sprint",
      section: plan.weakestSection,
      key: current.key + 1,
      assessmentLabel: undefined,
      lockToInitialMode: false,
    }))
    setActiveTab("lab")
  }

  async function launchPlanTask(task: StudyPlanTask) {
    if (!learning) return
    const decision = studyTaskLaunchDecision(task, learning)
    if (decision.type === "timed-practice") {
      void loadTestDayLab()
      setLabLaunch((current) => ({
        mode: decision.mode,
        section: decision.section,
        key: current.key + 1,
      }))
      setActiveTab("lab")
      return
    }
    if (decision.type === "continue-current") {
      void loadLessonWorkspace()
      setWorkspaceOpen(true)
      setActiveTab("today")
      return
    }
    if (decision.type === "blocked") {
      setLearningError(
        "Finish your current task before starting a different one."
      )
      setActiveTab("today")
      return
    }
    if (decision.type === "start-checkpoint") {
      startProgressCheck(plan.weakestSection)
      return
    }
    if (decision.type === "start-retention") {
      if (
        await startMissionAction(
          { action: "start_retention", skill: decision.skill },
          true
        )
      ) {
        setActiveTab("today")
      }
      return
    }
    if (decision.type === "start-skill") {
      if (
        await startMissionAction(
          { action: "start_skill", skill: decision.skill },
          true
        )
      ) {
        setActiveTab("today")
      }
      return
    }
    setLearningError(
      "This calendar task is missing the study details it needs."
    )
  }

  async function startRoundDiagnostic() {
    setSubmitting(true)
    setLearningError(null)
    try {
      window.sessionStorage.removeItem("scout-round-assessment-view")
      await onStartNewDiagnostic()
    } catch (error) {
      setLearningError(
        error instanceof Error
          ? error.message
          : "Could not start a new diagnostic."
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function startRoundFullTest() {
    setSubmitting(true)
    setLearningError(null)
    try {
      const currentResponse = await fetch("/api/exam-lab", {
        cache: "no-store",
      })
      const currentPayload = (await currentResponse
        .json()
        .catch(() => null)) as {
        session?: ExamLabSessionPayload | null
        error?: string
      } | null
      const canResume =
        currentResponse.ok &&
        currentPayload?.session?.mode === "core" &&
        (currentPayload.session.status === "in_progress" ||
          currentPayload.session.status === "completed")
      if (!canResume) {
        const response = await fetch("/api/exam-lab", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "start",
            mode: "core",
            timeMultiplier: readScoutSettings().accommodations.extendedTime
              ? 1.5
              : 1,
          }),
        })
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string
          } | null
          throw new Error(
            payload?.error ??
              "Could not prepare a new full-length practice test."
          )
        }
      }
      void loadTestDayLab()
      setRoundAssessmentView("full-test")
      window.sessionStorage.setItem("scout-round-assessment-view", "full-test")
    } catch (error) {
      setLearningError(
        error instanceof Error
          ? error.message
          : "Could not prepare a new full-length practice test."
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function applyFullTestToNextRound(session: ExamLabSessionPayload) {
    assertFullTestReady(session)
    const payload = await consumeCompletedExamForLearningRound({
      startRound: () =>
        learningRequest({
          action: "start_adaptive_round",
          assessmentSource: "full-test",
          ...planRequestFields(),
        }),
      persistPlan: async () => {
        await onUseFullTestAssessment(session)
      },
    })
    setLearning(payload)
    setSelectedChoice("")
    setActiveSection(0)
    setWorkspaceOpen(false)
    setRoundAssessmentView("choice")
    window.sessionStorage.removeItem("scout-round-assessment-view")
    setActiveTab("today")
    setLearningError(null)
  }

  if (
    learning &&
    shouldShowRoundTransition({
      cycleStatus: learning.cycle.status,
      workspaceOpen,
      activeTab,
    })
  ) {
    if (roundAssessmentView === "full-test") {
      return (
        <ScoutProvider
          activeTab="lab"
          learning={learning}
          canViewTechnicalDetails={viewer.technicalDetails}
        >
          <div className="border-b bg-background px-5 py-3 sm:px-8">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRoundAssessmentView("choice")
                window.sessionStorage.removeItem("scout-round-assessment-view")
              }}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              Choose a different assessment
            </Button>
          </div>
          <AccessibleTestDayLab
            initialMode="core"
            initialSection="english"
            canViewTechnicalDetails={viewer.technicalDetails}
            onUseForNextRound={applyFullTestToNextRound}
            lockToInitialMode
          />
        </ScoutProvider>
      )
    }
    return (
      <>
        {visibleLearningError ? (
          <div className="mx-auto max-w-5xl px-5 pt-5">
            <Alert role="alert" className="bg-background">
              <InfoIcon />
              <AlertTitle>Mr. Kim could not start that assessment</AlertTitle>
              <AlertDescription>{visibleLearningError}</AlertDescription>
            </Alert>
          </div>
        ) : null}
        <RoundTransition
          roundNumber={learning.cycle.roundNumber}
          completedSkills={learning.cycle.completedSkills.length}
          totalSkills={learning.cycle.requiredSkills.length}
          busy={submitting}
          onDiagnostic={() => void startRoundDiagnostic()}
          onFullTest={() => void startRoundFullTest()}
        />
        <RapidAnswerCoachDialog
          open={rapidAnswerCoach.open}
          onDismiss={rapidAnswerCoach.dismiss}
        />
      </>
    )
  }

  if (plan.adaptiveBaselineRequired) {
    const preserveReportedScore =
      plan.evidence.source === "section_scores" ||
      plan.evidence.source === "composite_only"
    return (
      <ScoutProvider
        activeTab="calibrate"
        learning={learning}
        canViewTechnicalDetails={viewer.technicalDetails}
      >
        <div className="min-h-svh bg-[var(--canvas)]">
          <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 shadow-[0_1px_0_rgb(16_33_63_/_0.03)] backdrop-blur-xl">
            <div className="mx-auto flex min-h-14 max-w-[86rem] items-center justify-between gap-4 px-4 py-1.5 sm:px-7">
              <Brand />
              <div className="flex items-center gap-3">
                <p className="hidden max-w-md text-right text-xs leading-5 text-muted-foreground sm:block">
                  {preserveReportedScore
                    ? "Your reported score stays in place. These answers create the question-type profile used in the tour."
                    : "No plan or skill profile is shown until these answers replace the temporary setup placeholder."}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  onClick={onEditPlan}
                  aria-label="Edit goal and study schedule"
                >
                  <PencilLineIcon />
                </Button>
                <AccountAccess
                  viewer={viewer}
                  savedPlan={savedPlan}
                  onViewerChange={onViewerChange}
                />
              </div>
            </div>
          </header>

          {visibleLearningError ? (
            <div className="mx-auto w-full max-w-[96rem] px-4 pt-4 sm:px-7">
              <Alert className="bg-background" role="alert">
                <InfoIcon />
                <AlertTitle>Scout could not finish that change</AlertTitle>
                <AlertDescription>{visibleLearningError}</AlertDescription>
              </Alert>
            </div>
          ) : null}

          {learning ? (
            <AdaptiveCalibrationLab
              representativeDemo={false}
              learning={learning}
              onLearningTwinUpdated={refreshLearningSession}
              onInspectLearningTwin={() => undefined}
              onReturnToToday={() => undefined}
              onStartFullDiagnostic={onStartFullDiagnostic}
              adaptiveBaselineRequired
              preserveReportedScore={preserveReportedScore}
              onUseAdaptiveBaseline={applyAdaptiveBaseline}
              canViewTechnicalDetails={viewer.technicalDetails}
            />
          ) : (
            <main
              id="main-content"
              tabIndex={-1}
              className="mx-auto max-w-3xl px-5 py-20"
            >
              <ScoutCoach
                mood="thinking"
                message="Scout is loading your 8–12 question starting check."
                detail={
                  preserveReportedScore
                    ? "Your reported score remains the planning baseline. This check measures question types before the orientation tour."
                    : "The rest of the app stays hidden until this check creates your first planning baseline."
                }
              />
            </main>
          )}
        </div>
      </ScoutProvider>
    )
  }

  const secureSkillCount =
    learning?.learningTwin.skills.filter(
      (skill) => skill.learnedProbability >= 0.82 && skill.evidenceCount >= 6
    ).length ?? 0

  return (
    <ScoutProvider
      activeTab={activeTab}
      learning={learning}
      canViewTechnicalDetails={viewer.technicalDetails}
      onEditPlan={onEditPlan}
      onOpenDataPrivacy={() => setActiveTab("control")}
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          preloadDashboardSurface(value)
          if (isDashboardDestination(value)) setActiveTab(value)
        }}
        className={`min-h-svh gap-0 bg-[var(--canvas)] ${
          workspaceOpen && activeTab === "today"
            ? ""
            : "scroll-pb-24 pb-24 md:scroll-pb-0 md:pb-0"
        }`}
      >
        {workspaceOpen && activeTab === "today" ? null : (
          <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 shadow-[0_1px_0_rgb(16_33_63_/_0.03)] backdrop-blur-xl">
            <div className="mx-auto flex min-h-16 max-w-[94rem] items-center gap-3 px-4 py-2 sm:px-7">
              <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
                <Brand onHome={() => setActiveTab("today")} />
              </div>
              <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
                <TabsList
                  variant="line"
                  className="min-h-11 bg-transparent"
                  aria-label="Study navigation"
                >
                  <DashboardTab
                    value="today"
                    className="min-h-11 px-3"
                    tourId="nav-lessons"
                  >
                    Lessons
                  </DashboardTab>
                  <DashboardTab
                    value="plan"
                    className="min-h-11 px-3"
                    tourId="nav-week"
                  >
                    My Week
                  </DashboardTab>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 px-3"
                    data-tour-id="nav-diagnostic"
                    onClick={onStartFullDiagnostic}
                  >
                    Full Diagnostic
                  </Button>
                  <Button
                    type="button"
                    variant={activeTab === "lab" ? "secondary" : "ghost"}
                    className="min-h-11 px-3"
                    data-tour-id="nav-practice"
                    aria-current={activeTab === "lab" ? "page" : undefined}
                    onPointerEnter={() => preloadDashboardSurface("lab")}
                    onFocus={() => preloadDashboardSurface("lab")}
                    onClick={openTimedPractice}
                  >
                    Timed Practice
                  </Button>
                  <DashboardTab
                    value="progress"
                    className="min-h-11 px-3"
                    tourId="nav-progress"
                  >
                    Progress
                  </DashboardTab>
                  <DashboardTab
                    value="badges"
                    className="min-h-11 px-3"
                    tourId="nav-badges"
                  >
                    Badges
                  </DashboardTab>
                </TabsList>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                <MrKimHeaderButton />
                <SettingsHeaderButton />
                <div data-tour-id="account">
                  <AccountAccess
                    viewer={viewer}
                    savedPlan={savedPlan}
                    onViewerChange={onViewerChange}
                    className="w-11 px-0 [&>span]:hidden"
                  />
                </div>
              </div>
            </div>
          </header>
        )}

        {visibleLearningError ? (
          <div className="mx-auto w-full max-w-[96rem] px-4 pt-4 sm:px-7">
            <Alert className="bg-background" role="alert">
              <InfoIcon />
              <AlertTitle>Scout could not finish that change</AlertTitle>
              <AlertDescription>{visibleLearningError}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <TabsContent value="today">
          <main
            id={activeTab === "today" ? "main-content" : undefined}
            tabIndex={activeTab === "today" ? -1 : undefined}
            className={workspaceOpen ? "w-full bg-background" : "w-full"}
          >
            {workspaceOpen && lessonReview ? (
              <LessonReviewWorkspace
                review={lessonReview}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                onClose={() => {
                  setLessonReview(null)
                  setWorkspaceOpen(false)
                }}
              />
            ) : workspaceOpen && learning ? (
              <LessonWorkspace
                learning={learning}
                activeSection={activeSection}
                selectedChoice={selectedChoice}
                submitting={submitting}
                onSectionChange={setActiveSection}
                onChoiceChange={setSelectedChoice}
                onCompleteLesson={completeLesson}
                onSubmitAnswer={submitAnswer}
                onSubmitRemediation={submitLessonRemediation}
                onClose={() => {
                  setLessonReview(null)
                  setWorkspaceOpen(false)
                }}
              />
            ) : learning ? (
              <LessonsCommandCenter
                learning={learning}
                goalScore={plan.draft.goal}
                testDate={plan.draft.testDate}
                busy={submitting}
                onOpenWorkspace={() => {
                  void loadLessonWorkspace()
                  setLessonReview(null)
                  setWorkspaceOpen(true)
                }}
                onReviewLesson={(skill) => {
                  const review = [...(learning.lessonHistory ?? [])]
                    .reverse()
                    .find(
                      (item) =>
                        item.roundNumber === learning.cycle.roundNumber &&
                        item.skill === skill
                    )
                  if (!review) {
                    setLearningError(
                      "That completed lesson review is not available yet."
                    )
                    return
                  }
                  void loadLessonReviewWorkspace()
                  setLessonReview(review)
                  setSelectedChoice("")
                  setActiveSection(0)
                  setWorkspaceOpen(true)
                  setLearningError(null)
                }}
                onStartNext={() =>
                  startMissionAction({ action: "start_next" }, true)
                }
                onStartSkill={(skill) =>
                  startMissionAction({ action: "start_skill", skill }, true)
                }
                onStartRepair={(mistakeId) =>
                  startMissionAction(
                    { action: "start_repair", mistakeId },
                    true
                  )
                }
                onStartRetention={(skill) =>
                  startMissionAction({ action: "start_retention", skill }, true)
                }
                onStartChallenge={(skill) =>
                  startMissionAction({ action: "start_challenge", skill }, true)
                }
                onStartMicro={(skill) =>
                  startMissionAction({ action: "start_micro", skill }, true)
                }
                onStartRecovery={() =>
                  startMissionAction({ action: "start_recovery" }, true)
                }
                onStartProgressCheck={() => startProgressCheck()}
                onOpenBadges={() => setActiveTab("badges")}
                onOpenWeek={() => setActiveTab("plan")}
              />
            ) : (
              <div className="mx-auto max-w-2xl py-20">
                <ScoutCoach
                  mood="thinking"
                  message="Scout is loading today’s lesson…"
                />
                {visibleLearningError ? (
                  <Alert className="mt-7 bg-background">
                    <InfoIcon />
                    <AlertTitle>Could not load today’s work</AlertTitle>
                    <AlertDescription>{visibleLearningError}</AlertDescription>
                  </Alert>
                ) : null}
              </div>
            )}
          </main>
        </TabsContent>

        <TabsContent value="plan">
          {activeTab !== "plan" ? null : learning ? (
            <AdaptivePlanStudio
              plan={plan}
              learning={learning}
              busy={submitting}
              onLaunchTask={launchPlanTask}
              canViewTechnicalDetails={viewer.technicalDetails}
            />
          ) : (
            <main
              id="main-content"
              tabIndex={-1}
              className="mx-auto max-w-3xl px-5 py-20"
            >
              <ScoutCoach
                mood="thinking"
                message="Scout is loading your study week."
              />
            </main>
          )}
        </TabsContent>
        <TabsContent value="calibrate">
          {activeTab !== "calibrate" ? null : learning ? (
            <AdaptiveCalibrationLab
              representativeDemo={representativeDemo}
              learning={learning}
              onLearningTwinUpdated={refreshLearningSession}
              onInspectLearningTwin={() => setActiveTab("progress")}
              onReturnToToday={() => setActiveTab("today")}
              onStartFullDiagnostic={onStartFullDiagnostic}
              adaptiveBaselineRequired={false}
              onUseAdaptiveBaseline={applyAdaptiveBaseline}
              canViewTechnicalDetails={
                viewer.technicalDetails || representativeDemo
              }
            />
          ) : (
            <main
              id="main-content"
              tabIndex={-1}
              className="mx-auto max-w-3xl px-5 py-20"
            >
              <ScoutCoach
                mood="thinking"
                message="Scout is loading your starting-point check."
              />
            </main>
          )}
        </TabsContent>
        <TabsContent value="progress">
          {activeTab === "progress" ? (
            <LearningTwinLab
              learning={learning}
              onOpenLesson={() => {
                void loadLessonWorkspace()
                setWorkspaceOpen(true)
                setActiveTab("today")
              }}
              canViewTechnicalDetails={viewer.technicalDetails}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="badges">
          {activeTab === "badges" && learning ? (
            <BadgesSurface
              points={learning.mission.progress.xp}
              currentStreak={learning.mission.progress.currentStreak}
              longestStreak={learning.mission.progress.longestStreak}
              completedLessons={learning.cycle.completedSkills.length}
              completedRounds={Math.max(0, learning.cycle.roundNumber - 1)}
              completedSets={learning.mission.progress.completedSets}
              totalAnswered={learning.mission.progress.totalAnswered}
              secureSkills={secureSkillCount}
              totalSkills={learning.learningTwin.skills.length}
              onContinueStudying={() => setActiveTab("today")}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="lab">
          {activeTab === "lab" ? (
            <AccessibleTestDayLab
              key={labLaunch.key}
              initialMode={labLaunch.mode}
              initialSection={labLaunch.section}
              canViewTechnicalDetails={viewer.technicalDetails}
              lockToInitialMode={labLaunch.lockToInitialMode}
              assessmentLabel={labLaunch.assessmentLabel}
            />
          ) : null}
        </TabsContent>
        {activeTab === "control" && learning ? (
          <div>
            <ScoutOperationsLab
              plan={plan}
              learning={learning}
              busy={submitting}
              onCorrectModel={correctLearnerModel}
              onStartChallenge={(skill) =>
                startMissionAction(
                  { action: "start_challenge", skill },
                  true
                ).then((started) => {
                  if (started) setActiveTab("today")
                })
              }
              onStartRecovery={() =>
                startMissionAction({ action: "start_recovery" }, true).then(
                  (started) => {
                    if (started) setActiveTab("today")
                  }
                )
              }
              onDeleteData={deleteLearnerData}
              canViewTechnicalDetails={viewer.technicalDetails}
            />
          </div>
        ) : null}

        {workspaceOpen && activeTab === "today" ? null : (
          <nav
            className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/98 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgb(16_33_63_/_0.08)] backdrop-blur-xl lg:hidden"
            aria-label="Primary study navigation"
          >
            <TabsList className="grid h-auto w-full grid-cols-5 rounded-none bg-transparent p-0">
              <DashboardTab value="today" className="min-h-14 px-1 text-xs">
                Lessons
              </DashboardTab>
              <DashboardTab value="plan" className="min-h-14 px-1 text-xs">
                Week
              </DashboardTab>
              <Button
                type="button"
                variant="ghost"
                className="min-h-14 rounded-none px-1 text-xs"
                onClick={openTimedPractice}
              >
                Practice
              </Button>
              <DashboardTab value="progress" className="min-h-14 px-1 text-xs">
                Progress
              </DashboardTab>
              <DashboardTab value="badges" className="min-h-14 px-1 text-xs">
                Badges
              </DashboardTab>
            </TabsList>
          </nav>
        )}
        {learning && !workspaceOpen ? (
          <DashboardOverlays
            plan={plan}
            focusSkill={diagnostic?.focusSkills[0]?.label}
            assessmentRound={learning.cycle.roundNumber}
          />
        ) : null}
      </Tabs>
      <RapidAnswerCoachDialog
        open={rapidAnswerCoach.open}
        onDismiss={rapidAnswerCoach.dismiss}
      />
    </ScoutProvider>
  )
}
