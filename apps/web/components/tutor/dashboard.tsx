"use client"

import { useEffect, useState } from "react"
import type { LearningSessionPayload, StudyPlanTask } from "@act-tutor/core"
import { ArrowRightIcon, InfoIcon, PencilLineIcon } from "lucide-react"

import { AdaptivePlanStudio } from "@/components/tutor/adaptive-plan-studio"
import { DailyMissionHub } from "@/components/tutor/daily-mission-hub"
import { LessonWorkspace } from "@/components/tutor/lesson-workspace"
import { LearningTwinLab } from "@/components/tutor/learning-twin-lab"
import { ScoutCoach, ScoutMark } from "@/components/tutor/scout"
import { TestDayLab } from "@/components/tutor/test-day-lab"
import type { GeneratedPlan } from "@/components/tutor/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface DashboardProps {
  plan: GeneratedPlan
  onEditPlan: () => void
}

const SECTION_FALLBACK_SKILLS = {
  english: "sentence-boundaries",
  math: "linear-equations",
  reading: "supported-inference",
} as const

async function learningRequest(body: Record<string, unknown>) {
  const response = await fetch("/api/learning", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const payload = (await response.json()) as
    LearningSessionPayload | { error: string }
  if (!response.ok || "error" in payload) {
    throw new Error(
      "error" in payload ? payload.error : "Learning request failed."
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
          Every answer teaches the plan
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

export function Dashboard({ plan, onEditPlan }: DashboardProps) {
  const diagnostic = plan.diagnosticResult
  const startingSkill =
    diagnostic?.focusSkills[0]?.skill ??
    SECTION_FALLBACK_SKILLS[plan.weakestSection]
  const [learning, setLearning] = useState<LearningSessionPayload | null>(null)
  const [learningError, setLearningError] = useState<string | null>(null)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [activeSection, setActiveSection] = useState(0)
  const [selectedChoice, setSelectedChoice] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState("today")

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
    })
      .then((payload) => {
        if (!active) return
        setLearning(payload)
        setLearningError(null)
      })
      .catch((error: unknown) => {
        if (!active) return
        setLearningError(
          error instanceof Error
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
    plan.intensity.daysUntilTest,
    plan.intensity.minutesPerSession,
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

  async function submitAnswer() {
    const question = learning?.questions[learning.currentQuestionIndex]
    if (!question || !selectedChoice) return
    setSubmitting(true)
    try {
      setLearning(
        await learningRequest({
          action: "answer",
          questionId: question.id,
          choiceId: selectedChoice,
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
        error instanceof Error ? error.message : "Could not start that mission."
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
        "Finish the current mission before switching to a different planned assignment."
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
            <TabsTrigger value="progress">Progress</TabsTrigger>
            <TabsTrigger value="lab">Test Lab</TabsTrigger>
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
                startMissionAction({ action: "start_repair", mistakeId }, true)
              }
              onStartCheckpoint={() =>
                startMissionAction({ action: "start_checkpoint" }, true)
              }
            />
          ) : (
            <div className="mx-auto max-w-2xl py-20">
              <ScoutCoach
                mood="thinking"
                message="Scout is building today’s adaptive mission…"
              />
              {learningError ? (
                <Alert className="mt-7 bg-background">
                  <InfoIcon />
                  <AlertTitle>Mission engine issue</AlertTitle>
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
              message="Scout is collecting the evidence needed to date your plan."
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
        <TestDayLab />
      </TabsContent>
    </Tabs>
  )
}
