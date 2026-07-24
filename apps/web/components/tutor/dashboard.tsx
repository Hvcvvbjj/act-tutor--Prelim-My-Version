"use client"

import { type ReactNode, useCallback, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import type {
  AnswerConfidence,
  CalibrationLearningBaseline,
  CoreSection,
  ExamLabMode,
  LearningActionRequest,
  LearningAnswerRequest,
  LearningSessionPayload,
  LessonPlanContext,
  StudyPlanTask,
} from "@act-tutor/core"
import {
  ArrowRightIcon,
  CircleGaugeIcon,
  EllipsisIcon,
  FlaskConicalIcon,
  InfoIcon,
  PencilLineIcon,
  Settings2Icon,
  ShieldCheckIcon,
} from "lucide-react"

import { AccountAccess } from "@/components/tutor/account-access"
import { DailyMissionHub } from "@/components/tutor/daily-mission-hub"
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
  deleteRemoteScoutData,
  flushOfflineAnswerQueue,
  learningRequest,
  loadLearningSession,
  readCachedLearningSession,
} from "@/lib/learning-client"

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

const AdaptivePlanStudio = dynamic(loadAdaptivePlanStudio, {
  loading: () => <DashboardSurfaceLoading message="Opening your study week…" />,
})
const AdaptiveCalibrationLab = dynamic(loadAdaptiveCalibrationLab, {
  loading: () => <DashboardSurfaceLoading message="Opening Quick Check…" />,
})
const LessonWorkspace = dynamic(loadLessonWorkspace, {
  loading: () => <DashboardSurfaceLoading message="Opening your lesson…" />,
})
const LearningTwinLab = dynamic(loadLearningTwinLab, {
  loading: () => <DashboardSurfaceLoading message="Opening your progress…" />,
})
const TestDayLab = dynamic(loadTestDayLab, {
  loading: () => <DashboardSurfaceLoading message="Opening timed practice…" />,
})
const ScoutOperationsLab = dynamic(loadScoutOperationsLab, {
  loading: () => <DashboardSurfaceLoading message="Opening Learning data…" />,
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
  children,
}: {
  value: string
  className?: string
  children: ReactNode
}) {
  const preload = () => preloadDashboardSurface(value)
  return (
    <TabsTrigger
      value={value}
      className={className}
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
  viewer: AuthViewer
  savedPlan: SavedTutorPlan
  onViewerChange: (viewer: AuthViewer) => void
  onEditPlan: () => void
  onStartFullDiagnostic: () => void
  onUseAdaptiveBaseline: (payload: CalibrationLearningBaseline) => void
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

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <ScoutMark className="size-9" />
      <p className="font-heading text-xl leading-none font-black tracking-[-0.02em]">
        SCOUT <span className="text-primary">ACT</span>
      </p>
    </div>
  )
}

function ScoreRoute({ plan }: { plan: GeneratedPlan }) {
  const isInternalProxy =
    plan.evidence.source === "rapid_diagnostic" ||
    plan.evidence.source === "starter_diagnostic" ||
    plan.evidence.source === "not_taken"
  return (
    <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
      <div>
        <p className="text-base leading-none font-black tabular-nums">
          {plan.currentComposite}{" "}
          <span className="text-xs font-normal text-muted-foreground">
            {isInternalProxy ? "planning baseline" : "reported baseline"}
          </span>
        </p>
      </div>
      <ArrowRightIcon
        className="size-4 text-muted-foreground"
        aria-hidden="true"
      />
      <div>
        <p className="text-base leading-none font-black text-primary tabular-nums">
          {plan.draft.goal}{" "}
          <span className="text-xs font-normal text-muted-foreground">
            goal
          </span>
        </p>
      </div>
    </div>
  )
}

function AccessibleTestDayLab({
  initialMode,
  initialSection,
  canViewTechnicalDetails,
}: {
  initialMode: ExamLabMode
  initialSection: CoreSection
  canViewTechnicalDetails: boolean
}) {
  const { accommodations } = useScoutContext()
  return (
    <TestDayLab
      extendedTime={accommodations.extendedTime}
      initialMode={initialMode}
      initialSection={initialSection}
      canViewTechnicalDetails={canViewTechnicalDetails}
    />
  )
}

function MobileScoutDock({ onOpen }: { onOpen: () => void }) {
  const { openScout } = useScoutContext()
  return (
    <Button
      type="button"
      variant="ghost"
      className="min-h-14 rounded-none px-1 text-[0.68rem]"
      aria-label="Ask Scout"
      onClick={() => {
        onOpen()
        openScout()
      }}
    >
      <ScoutMark className="size-8" />
    </Button>
  )
}

function MobileOverflow({
  open,
  onNavigate,
  onClose,
}: {
  open: boolean
  onNavigate: (tab: string) => void
  onClose: () => void
}) {
  const { openSettings } = useScoutContext()
  if (!open) return null
  return (
    <div
      id="mobile-more-destinations"
      className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[45] rounded-xl border bg-background p-3 shadow-xl md:hidden"
      aria-label="More destinations"
    >
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 w-full justify-start"
        onPointerEnter={() => preloadDashboardSurface("lab")}
        onPointerDown={() => preloadDashboardSurface("lab")}
        onFocus={() => preloadDashboardSurface("lab")}
        onClick={() => {
          onNavigate("lab")
          onClose()
        }}
      >
        <FlaskConicalIcon /> Timed practice
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 w-full justify-start"
        onPointerEnter={() => preloadDashboardSurface("control")}
        onPointerDown={() => preloadDashboardSurface("control")}
        onFocus={() => preloadDashboardSurface("control")}
        onClick={() => {
          onNavigate("control")
          onClose()
        }}
      >
        <ShieldCheckIcon /> Learning data
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 w-full justify-start"
        onClick={() => {
          openSettings()
          onClose()
        }}
      >
        <Settings2Icon /> Learning settings
      </Button>
    </div>
  )
}

function DesktopOverflow({
  open,
  onNavigate,
  onClose,
}: {
  open: boolean
  onNavigate: (tab: string) => void
  onClose: () => void
}) {
  const { openSettings } = useScoutContext()
  if (!open) return null
  return (
    <div
      id="desktop-more-destinations"
      className="absolute top-[calc(100%+0.75rem)] right-0 z-40 hidden w-56 rounded-xl border bg-background p-2 shadow-xl md:block"
      aria-label="More destinations"
    >
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 w-full justify-start"
        onPointerEnter={() => preloadDashboardSurface("lab")}
        onPointerDown={() => preloadDashboardSurface("lab")}
        onFocus={() => preloadDashboardSurface("lab")}
        onClick={() => {
          onNavigate("lab")
          onClose()
        }}
      >
        <FlaskConicalIcon /> Timed practice
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 w-full justify-start"
        onPointerEnter={() => preloadDashboardSurface("control")}
        onPointerDown={() => preloadDashboardSurface("control")}
        onFocus={() => preloadDashboardSurface("control")}
        onClick={() => {
          onNavigate("control")
          onClose()
        }}
      >
        <ShieldCheckIcon /> Learning data
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 w-full justify-start"
        onClick={() => {
          openSettings()
          onClose()
        }}
      >
        <Settings2Icon /> Learning settings
      </Button>
    </div>
  )
}

export function Dashboard({
  plan,
  viewer,
  savedPlan,
  onViewerChange,
  onEditPlan,
  onStartFullDiagnostic,
  onUseAdaptiveBaseline,
}: DashboardProps) {
  const diagnostic = plan.diagnosticResult
  const representativeDemo = diagnostic?.formId === "scout-judge-demo"
  const startingSkill =
    diagnostic?.focusSkills[0]?.skill ??
    SECTION_FALLBACK_SKILLS[plan.weakestSection]
  const [learning, setLearning] = useState<LearningSessionPayload | null>(null)
  const [learningError, setLearningError] = useState<string | null>(null)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [activeSection, setActiveSection] = useState(0)
  const [selectedChoice, setSelectedChoice] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(
    representativeDemo || plan.adaptiveBaselineRequired ? "calibrate" : "today"
  )
  const [labLaunch, setLabLaunch] = useState<{
    mode: ExamLabMode
    section: CoreSection
    key: number
  }>({ mode: "sprint", section: "english", key: 0 })

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeTab, workspaceOpen])

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
          `A saved answer was not applied: ${result.lastQuarantineReason} It is available in Learning data for review.`
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
      diagnosticSkillResults: diagnostic?.skillResults ?? [],
      goalScore: plan.draft.goal,
      currentScore: plan.currentComposite,
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
    diagnostic?.skillResults,
    plan.currentComposite,
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

  async function submitTeachBack(response: string) {
    setSubmitting(true)
    try {
      setLearning(await learningRequest({ action: "teach_back", response }))
      setLearningError(null)
    } catch (error) {
      setLearningError(
        error instanceof Error
          ? error.message
          : "Could not check the teach-back."
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function submitLessonFeedback(helpful: boolean, style: string) {
    try {
      setLearning(
        await learningRequest({ action: "lesson_feedback", helpful, style })
      )
      setLearningError(null)
      return true
    } catch (error) {
      setLearningError(
        error instanceof Error
          ? error.message
          : "Could not save lesson feedback."
      )
      return false
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
      setLearning(
        await learningRequest({
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
      )
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

  function planRequestFields() {
    return {
      goalScore: plan.draft.goal,
      currentScore: plan.currentComposite,
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

  async function launchPlanTask(task: StudyPlanTask) {
    if (!learning) return
    if (task.kind === "rehearsal") {
      void loadTestDayLab()
      setLabLaunch((current) => ({
        mode: "core",
        section: "english",
        key: current.key + 1,
      }))
      setActiveTab("lab")
      return
    }
    if (task.kind === "timed") {
      void loadTestDayLab()
      setLabLaunch((current) => ({
        mode: "section",
        section: task.section ?? "english",
        key: current.key + 1,
      }))
      setActiveTab("lab")
      return
    }
    if (learning.status !== "complete") {
      if (task.skill && task.skill === learning.todaySkill) {
        void loadLessonWorkspace()
        setWorkspaceOpen(true)
        setActiveTab("today")
        return
      }
      setLearningError(
        "Finish your current task before starting a different one."
      )
      setActiveTab("today")
      return
    }
    if (task.kind === "checkpoint") {
      if (await startMissionAction({ action: "start_checkpoint" }, true)) {
        setActiveTab("today")
      }
      return
    }
    if (task.kind === "review" && task.skill) {
      if (
        await startMissionAction(
          { action: "start_retention", skill: task.skill },
          true
        )
      ) {
        setActiveTab("today")
      }
      return
    }
    if (task.skill) {
      if (
        await startMissionAction(
          { action: "start_skill", skill: task.skill },
          true
        )
      ) {
        setActiveTab("today")
      }
    }
  }

  if (plan.adaptiveBaselineRequired) {
    return (
      <ScoutProvider
        activeTab="calibrate"
        learning={learning}
        canViewTechnicalDetails={viewer.technicalDetails}
      >
        <div className="min-h-svh bg-background">
          <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
            <div className="mx-auto flex min-h-16 max-w-[86rem] items-center justify-between gap-4 px-4 py-2 sm:px-7">
              <Brand />
              <div className="flex items-center gap-3">
                <p className="hidden max-w-md text-right text-xs leading-5 text-muted-foreground sm:block">
                  No plan or skill profile is shown until these answers replace
                  the temporary setup placeholder.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
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

          {learningError ? (
            <div className="mx-auto w-full max-w-[96rem] px-4 pt-4 sm:px-7">
              <Alert className="bg-background" role="alert">
                <InfoIcon />
                <AlertTitle>Scout could not finish that change</AlertTitle>
                <AlertDescription>{learningError}</AlertDescription>
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
              onUseAdaptiveBaseline={applyAdaptiveBaseline}
              canViewTechnicalDetails={viewer.technicalDetails}
            />
          ) : (
            <main className="mx-auto max-w-3xl px-5 py-20">
              <ScoutCoach
                mood="thinking"
                message="Scout is loading your 8–12 question starting check."
                detail="The rest of the app stays hidden until this check creates your first planning baseline."
              />
            </main>
          )}
        </div>
      </ScoutProvider>
    )
  }

  return (
    <ScoutProvider
      activeTab={activeTab}
      learning={learning}
      canViewTechnicalDetails={viewer.technicalDetails}
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          preloadDashboardSurface(value)
          setActiveTab(value)
          setMoreOpen(false)
        }}
        className="min-h-svh scroll-pb-24 gap-0 bg-transparent pb-24 md:scroll-pb-0 md:pb-0"
      >
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto grid min-h-16 max-w-[86rem] grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-7 lg:grid-cols-[1fr_auto_1fr]">
            <Brand />
            <div className="order-3 col-span-2 hidden items-center justify-self-center md:flex lg:order-none lg:col-span-1">
              <TabsList
                variant="line"
                className="bg-transparent"
                aria-label="Study navigation"
              >
                <DashboardTab value="today">Today</DashboardTab>
                <DashboardTab value="plan">My week</DashboardTab>
                <DashboardTab value="calibrate">Quick Check</DashboardTab>
                <DashboardTab value="progress">Progress</DashboardTab>
              </TabsList>
              <div className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  aria-expanded={moreOpen}
                  aria-controls="desktop-more-destinations"
                  onClick={() => setMoreOpen((current) => !current)}
                >
                  More <EllipsisIcon data-icon="inline-end" />
                </Button>
                <DesktopOverflow
                  open={moreOpen}
                  onNavigate={setActiveTab}
                  onClose={() => setMoreOpen(false)}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 justify-self-end">
              <div className="hidden sm:block">
                <ScoreRoute plan={plan} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onEditPlan}
                aria-label="Edit goal and study schedule"
              >
                <PencilLineIcon />
              </Button>
              <AccountAccess
                viewer={viewer}
                savedPlan={savedPlan}
                onViewerChange={onViewerChange}
                className="max-w-40 px-2 sm:max-w-52"
              />
            </div>
          </div>
        </header>

        {learningError ? (
          <div className="mx-auto w-full max-w-[96rem] px-4 pt-4 sm:px-7">
            <Alert className="bg-background" role="alert">
              <InfoIcon />
              <AlertTitle>Scout could not finish that change</AlertTitle>
              <AlertDescription>{learningError}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        {plan.baselineSkipped ? (
          <div className="mx-auto w-full max-w-[86rem] px-4 pt-4 sm:px-7">
            <Alert className="border-primary bg-[var(--info-surface)]">
              <CircleGaugeIcon />
              <AlertTitle>Your starter plan uses a temporary 18.</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  That number is not your ACT score. Take the 8–12 question
                  Quick Check whenever you want Scout to replace it with
                  answer-based starting points.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 bg-background"
                  onClick={() => {
                    void loadAdaptiveCalibrationLab()
                    setActiveTab("calibrate")
                  }}
                >
                  Take Quick Check
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : null}

        <TabsContent value="today">
          <main className="mx-auto w-full max-w-[86rem] px-4 py-6 sm:px-7 lg:py-8">
            {workspaceOpen && learning ? (
              <LessonWorkspace
                learning={learning}
                activeSection={activeSection}
                selectedChoice={selectedChoice}
                submitting={submitting}
                onSectionChange={setActiveSection}
                onChoiceChange={setSelectedChoice}
                onCompleteLesson={completeLesson}
                onTeachBack={submitTeachBack}
                onLessonFeedback={submitLessonFeedback}
                onSubmitAnswer={submitAnswer}
                onClose={() => setWorkspaceOpen(false)}
                canViewTechnicalDetails={viewer.technicalDetails}
              />
            ) : learning ? (
              <DailyMissionHub
                plan={plan}
                learning={learning}
                busy={submitting}
                canViewTechnicalDetails={viewer.technicalDetails}
                onOpenWorkspace={() => {
                  void loadLessonWorkspace()
                  setWorkspaceOpen(true)
                }}
                onStartNext={() => startMissionAction({ action: "start_next" })}
                onStartSkill={(skill) =>
                  startMissionAction({ action: "start_skill", skill })
                }
                onStartRepair={(mistakeId) =>
                  startMissionAction(
                    { action: "start_repair", mistakeId },
                    true
                  )
                }
                onStartCheckpoint={() =>
                  startMissionAction({ action: "start_checkpoint" }, true)
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
              />
            ) : (
              <div className="mx-auto max-w-2xl py-20">
                <ScoutCoach
                  mood="thinking"
                  message="Scout is loading today’s lesson…"
                />
                {learningError ? (
                  <Alert className="mt-7 bg-background">
                    <InfoIcon />
                    <AlertTitle>Could not load today’s work</AlertTitle>
                    <AlertDescription>{learningError}</AlertDescription>
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
            <main className="mx-auto max-w-3xl px-5 py-20">
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
            <main className="mx-auto max-w-3xl px-5 py-20">
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
              plan={plan}
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
        <TabsContent value="lab">
          {activeTab === "lab" ? (
            <AccessibleTestDayLab
              key={labLaunch.key}
              initialMode={labLaunch.mode}
              initialSection={labLaunch.section}
              canViewTechnicalDetails={viewer.technicalDetails}
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

        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-foreground bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
          aria-label="Primary study navigation"
        >
          <div className="grid w-full grid-cols-6">
            <TabsList className="col-span-4 grid h-auto w-full grid-cols-4 rounded-none bg-transparent p-0">
              <DashboardTab
                value="today"
                className="min-h-14 px-1 text-[0.68rem]"
              >
                Today
              </DashboardTab>
              <DashboardTab
                value="plan"
                className="min-h-14 px-1 text-[0.68rem]"
              >
                Week
              </DashboardTab>
              <DashboardTab
                value="calibrate"
                className="min-h-14 px-1 text-[0.68rem]"
              >
                Check
              </DashboardTab>
              <DashboardTab
                value="progress"
                className="min-h-14 px-1 text-[0.68rem]"
              >
                Progress
              </DashboardTab>
            </TabsList>
            <div className="col-span-2 grid grid-cols-2">
              <MobileScoutDock onOpen={() => setMoreOpen(false)} />
              <Button
                type="button"
                variant={moreOpen ? "secondary" : "ghost"}
                className="min-h-14 rounded-none px-1 text-[0.68rem]"
                aria-expanded={moreOpen}
                aria-controls="mobile-more-destinations"
                onClick={() => setMoreOpen((current) => !current)}
              >
                <EllipsisIcon /> More
              </Button>
            </div>
          </div>
        </nav>
        <MobileOverflow
          open={moreOpen}
          onNavigate={setActiveTab}
          onClose={() => setMoreOpen(false)}
        />
      </Tabs>
    </ScoutProvider>
  )
}
