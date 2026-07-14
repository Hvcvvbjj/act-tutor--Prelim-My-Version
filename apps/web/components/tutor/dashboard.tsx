"use client"

import { useCallback, useEffect, useState } from "react"
import type {
  AdaptiveCalibrationPayload,
  AnswerConfidence,
  LearningSessionPayload,
  StudyPlanTask,
} from "@act-tutor/core"
import { ArrowRightIcon, InfoIcon, PencilLineIcon } from "lucide-react"

import { AdaptivePlanStudio } from "@/components/tutor/adaptive-plan-studio"
import { AdaptiveCalibrationLab } from "@/components/tutor/adaptive-calibration-lab"
import { DailyMissionHub } from "@/components/tutor/daily-mission-hub"
import { LessonWorkspace } from "@/components/tutor/lesson-workspace"
import { LearningTwinLab } from "@/components/tutor/learning-twin-lab"
import { ScoutCoach, ScoutMark } from "@/components/tutor/scout"
import { ScoutOperationsLab } from "@/components/tutor/scout-operations-lab"
import {
  ScoutProvider,
  useScoutContext,
} from "@/components/tutor/scout-assistant"
import { TestDayLab } from "@/components/tutor/test-day-lab"
import type { GeneratedPlan } from "@/components/tutor/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface DashboardProps {
  plan: GeneratedPlan
  onEditPlan: () => void
  onStartFullDiagnostic: () => void
  onUseAdaptiveBaseline: (payload: AdaptiveCalibrationPayload) => void
}

const SECTION_FALLBACK_SKILLS = {
  english: "sentence-boundaries",
  math: "linear-equations",
  reading: "supported-inference",
} as const

const OFFLINE_QUEUE_KEY = "scout-offline-answer-queue-v1"
const OFFLINE_LESSON_KEY = "scout-offline-learning-session-v1"

function readOfflineQueue() {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(OFFLINE_QUEUE_KEY) ?? "[]"
    ) as unknown
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : []
  } catch {
    return []
  }
}

function readCachedLearningSession() {
  try {
    return JSON.parse(
      window.localStorage.getItem(OFFLINE_LESSON_KEY) ?? "null"
    ) as LearningSessionPayload | null
  } catch {
    return null
  }
}

function queueOfflineAnswer(body: Record<string, unknown>) {
  const current = readOfflineQueue()
  if (!current.some((item) => item.questionId === body.questionId)) {
    current.push(body)
    window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(current))
  }
}

async function learningRequest(body: Record<string, unknown>) {
  let response: Response
  try {
    response = await fetch("/api/learning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch (error) {
    if (body.action === "answer" && typeof window !== "undefined") {
      queueOfflineAnswer(body)
      throw new Error(
        "You are offline. This answer is saved on this device and will be scored when the connection returns."
      )
    }
    throw error
  }
  const payload = (await response.json()) as
    LearningSessionPayload | { error: string }
  if (!response.ok || "error" in payload) {
    throw new Error(
      "error" in payload ? payload.error : "Learning request failed."
    )
  }
  return payload
}

async function loadLearningSession() {
  const response = await fetch("/api/learning", { cache: "no-store" })
  const payload = (await response.json()) as
    LearningSessionPayload | { error: string }
  if (!response.ok || "error" in payload) {
    throw new Error(
      "error" in payload ? payload.error : "Learning session refresh failed."
    )
  }
  return payload
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <ScoutMark className="size-10" />
      <div>
        <p className="font-heading text-xl leading-none font-black tracking-[-0.02em]">
          SCOUT ACT
        </p>
        <p className="font-mono text-[0.58rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">
          Every answer shapes your plan
        </p>
      </div>
    </div>
  )
}

function ScoreRoute({ plan }: { plan: GeneratedPlan }) {
  return (
    <div className="flex items-center gap-3 border-l-2 border-foreground pl-4">
      <div>
        <p className="ink-label text-muted-foreground">Now</p>
        <p className="font-heading text-3xl leading-none font-black tabular-nums">
          {plan.currentComposite}
        </p>
      </div>
      <ArrowRightIcon className="text-primary" aria-hidden="true" />
      <div>
        <p className="ink-label text-muted-foreground">Goal</p>
        <p className="font-heading text-3xl leading-none font-black text-primary tabular-nums">
          {plan.draft.goal}
        </p>
      </div>
    </div>
  )
}

function AccessibleTestDayLab() {
  const { accommodations } = useScoutContext()
  return <TestDayLab extendedTime={accommodations.extendedTime} />
}

export function Dashboard({
  plan,
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
  const [activeTab, setActiveTab] = useState(
    representativeDemo || plan.adaptiveBaselineRequired ? "calibrate" : "today"
  )

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
      const queued = readOfflineQueue()
      if (!queued.length) return
      for (let index = 0; index < queued.length; index += 1) {
        try {
          await learningRequest(queued[index])
          const remaining = queued.slice(index + 1)
          window.localStorage.setItem(
            OFFLINE_QUEUE_KEY,
            JSON.stringify(remaining)
          )
        } catch {
          return
        }
      }
      await refreshLearningSession()
    }
    window.addEventListener("online", flushOfflineAnswers)
    if (navigator.onLine) void flushOfflineAnswers()
    return () => window.removeEventListener("online", flushOfflineAnswers)
  }, [refreshLearningSession])

  useEffect(() => {
    if (learning) {
      window.localStorage.setItem(OFFLINE_LESSON_KEY, JSON.stringify(learning))
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
        error instanceof Error ? error.message : "Could not check the teach-back."
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
    } catch (error) {
      setLearningError(
        error instanceof Error ? error.message : "Could not save lesson feedback."
      )
    }
  }

  async function correctLearnerModel(input: {
    skill: string
    kind: "too-high" | "too-low" | "wrong-misconception"
    note: string
  }) {
    setSubmitting(true)
    try {
      setLearning(
        await learningRequest({ action: "correct_model", ...input })
      )
      setLearningError(null)
    } catch (error) {
      setLearningError(
        error instanceof Error ? error.message : "Could not correct the model."
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function saveTutorOverride(input: {
    skill: string
    reason: string
  }) {
    setSubmitting(true)
    try {
      setLearning(
        await learningRequest({ action: "tutor_override", ...input })
      )
      setLearningError(null)
    } catch (error) {
      setLearningError(
        error instanceof Error ? error.message : "Could not save the override."
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function decideLessonContent(input: {
    approved: boolean
    editedExplanation?: string
  }) {
    setSubmitting(true)
    try {
      const payload = await learningRequest({ action: "review_lesson", ...input })
      setLearning(payload)
      setLearningError(null)
    } catch (error) {
      setLearningError(
        error instanceof Error
          ? error.message
          : "Could not save the lesson decision."
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteLearnerData() {
    await Promise.allSettled(
      ["/api/learning", "/api/calibration", "/api/diagnostic", "/api/exam-lab", "/api/study-plan"].map(
        (url) => fetch(url, { method: "DELETE" })
      )
    )
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("scout-") || key.startsWith("ai-act-")) {
        window.localStorage.removeItem(key)
      }
    }
    window.location.reload()
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
        })
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
      daysUntilTest: plan.intensity.daysUntilTest,
      minutesPerSession: plan.intensity.minutesPerSession,
      studyDaysPerWeek: plan.intensity.studyDaysPerWeek,
      preferredSection: plan.draft.preferredSection,
    }
  }

  async function startMissionAction(
    body: Record<string, unknown>,
    openWorkspace = false
  ) {
    setSubmitting(true)
    try {
      const payload = await learningRequest({ ...body, ...planRequestFields() })
      setLearning(payload)
      setSelectedChoice("")
      setActiveSection(0)
      setWorkspaceOpen(openWorkspace)
      setLearningError(null)
    } catch (error) {
      setLearningError(
        error instanceof Error
          ? error.message
          : "Could not start that study task."
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function launchPlanTask(task: StudyPlanTask) {
    if (!learning) return
    if (task.kind === "rehearsal") {
      setActiveTab("lab")
      return
    }
    if (learning.status !== "complete") {
      if (task.skill && task.skill === learning.todaySkill) {
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
      await startMissionAction({ action: "start_checkpoint" }, true)
      setActiveTab("today")
      return
    }
    if (task.skill) {
      await startMissionAction(
        { action: "start_skill", skill: task.skill },
        true
      )
      setActiveTab("today")
    }
  }

  return (
    <ScoutProvider activeTab={activeTab} plan={plan} learning={learning}>
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="min-h-svh gap-0 bg-transparent"
      >
        <header className="sticky top-0 z-20 border-b-2 border-foreground bg-background">
          <div className="mx-auto grid min-h-20 max-w-[96rem] grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-7 lg:grid-cols-[1fr_auto_1fr]">
            <Brand />
            <TabsList
              variant="line"
              className="order-3 col-span-2 justify-self-center lg:order-none lg:col-span-1"
              aria-label="Study navigation"
            >
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="plan">Plan</TabsTrigger>
              <TabsTrigger value="calibrate">Quick Check</TabsTrigger>
              <TabsTrigger value="progress">My Skills</TabsTrigger>
              <TabsTrigger value="lab">Test Lab</TabsTrigger>
              <TabsTrigger value="control">Scout Lab</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-3 justify-self-end">
              <div className="hidden sm:block">
                <ScoreRoute plan={plan} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onEditPlan}
                aria-label="Edit score plan"
              >
                <PencilLineIcon />
              </Button>
            </div>
          </div>
        </header>

        <TabsContent value="today">
          <main className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-7 lg:py-10">
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
              />
            ) : learning ? (
              <DailyMissionHub
                plan={plan}
                learning={learning}
                busy={submitting}
                onOpenWorkspace={() => setWorkspaceOpen(true)}
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
                  startMissionAction(
                    { action: "start_retention", skill },
                    true
                  )
                }
                onStartChallenge={(skill) =>
                  startMissionAction(
                    { action: "start_challenge", skill },
                    true
                  )
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
                  message="Scout is choosing the best work for today…"
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
          {learning ? (
            <AdaptivePlanStudio
              plan={plan}
              learning={learning}
              busy={submitting}
              onLaunchTask={launchPlanTask}
            />
          ) : (
            <main className="mx-auto max-w-3xl px-5 py-20">
              <ScoutCoach
                mood="thinking"
                message="Scout is matching your study days to your test date."
              />
            </main>
          )}
        </TabsContent>
        <TabsContent value="calibrate">
          {learning ? (
            <AdaptiveCalibrationLab
              representativeDemo={representativeDemo}
              learning={learning}
              onLearningTwinUpdated={refreshLearningSession}
              onInspectLearningTwin={() => setActiveTab("progress")}
              onReturnToToday={() => setActiveTab("today")}
              onStartFullDiagnostic={onStartFullDiagnostic}
              adaptiveBaselineRequired={plan.adaptiveBaselineRequired === true}
              onUseAdaptiveBaseline={onUseAdaptiveBaseline}
            />
          ) : (
            <main className="mx-auto max-w-3xl px-5 py-20">
              <ScoutCoach
                mood="thinking"
                message="Scout is getting your Quick Check ready."
              />
            </main>
          )}
        </TabsContent>
        <TabsContent value="progress">
          <LearningTwinLab
            plan={plan}
            learning={learning}
            onOpenLesson={() => {
              setWorkspaceOpen(true)
              setActiveTab("today")
            }}
          />
        </TabsContent>
        <TabsContent value="lab">
          <AccessibleTestDayLab />
        </TabsContent>
        <TabsContent value="control">
          {learning ? (
            <ScoutOperationsLab
              plan={plan}
              learning={learning}
              busy={submitting}
              onCorrectModel={correctLearnerModel}
              onTutorOverride={saveTutorOverride}
              onStartChallenge={(skill) =>
                startMissionAction(
                  { action: "start_challenge", skill },
                  true
                ).then(() => setActiveTab("today"))
              }
              onStartRecovery={() =>
                startMissionAction({ action: "start_recovery" }, true).then(
                  () => setActiveTab("today")
                )
              }
              onDeleteData={deleteLearnerData}
              onContentDecision={decideLessonContent}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </ScoutProvider>
  )
}
