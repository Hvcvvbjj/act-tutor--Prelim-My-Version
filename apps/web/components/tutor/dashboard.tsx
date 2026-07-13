"use client"

import { useEffect, useState, type ReactNode } from "react"
import type { LearningSessionPayload } from "@act-tutor/core"
import {
  ArrowRightIcon,
  BookOpenCheckIcon,
  BrainCircuitIcon,
  CheckCircle2Icon,
  InfoIcon,
  ListChecksIcon,
  PencilLineIcon,
  RefreshCwIcon,
  SparklesIcon,
  TargetIcon,
} from "lucide-react"

import { LessonWorkspace } from "@/components/tutor/lesson-workspace"
import { ScoutCoach, ScoutMark } from "@/components/tutor/scout"
import type { GeneratedPlan } from "@/components/tutor/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCalendarDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

interface DashboardProps {
  plan: GeneratedPlan
  onEditPlan: () => void
}

const SECTION_FALLBACK_SKILLS = {
  english: "sentence-boundaries",
  math: "linear-equations",
  reading: "supported-inference",
} as const

const PHASE_LABELS = {
  foundation: "Build the base",
  balanced: "Build + transfer",
  focused: "Focused score push",
  triage: "Test-ready triage",
} as const

const STUDY_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const
const SESSION_FOCUSES = [
  "Teach + focused set",
  "Repair + spaced review",
  "Teach + focused set",
  "Timed transfer",
  "Cumulative review",
  "Weak-skill sprint",
  "Mixed section set",
] as const

async function learningRequest(body: Record<string, unknown>) {
  const response = await fetch("/api/learning", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const payload = (await response.json()) as LearningSessionPayload | { error: string }
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "Learning request failed.")
  }
  return payload
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <ScoutMark className="size-10" />
      <div>
        <p className="font-heading text-xl leading-none font-black tracking-[-0.02em]">SCOUT ACT</p>
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
        <p className="font-heading text-3xl leading-none font-black tabular-nums">{plan.currentComposite}</p>
      </div>
      <ArrowRightIcon className="text-primary" aria-hidden="true" />
      <div>
        <p className="ink-label text-muted-foreground">Goal</p>
        <p className="font-heading text-3xl leading-none font-black text-primary tabular-nums">{plan.draft.goal}</p>
      </div>
    </div>
  )
}

function MissionStep({
  number,
  icon,
  title,
  meta,
  state,
  action,
}: {
  number: string
  icon: ReactNode
  title: string
  meta: string
  state: "done" | "current" | "queued"
  action?: ReactNode
}) {
  return (
    <li
      className={cn(
        "relative grid min-w-0 grid-cols-[3.25rem_minmax(0,1fr)] gap-x-4 pb-9 last:pb-0",
        state === "queued" && "text-muted-foreground"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-12 bottom-0 left-[1.6rem] border-l-2",
          state === "done" ? "border-primary" : "border-dashed border-border",
          "last:hidden"
        )}
      />
      <span
        className={cn(
          "relative flex size-13 items-center justify-center border-2 border-foreground bg-background shadow-[3px_3px_0_var(--foreground)]",
          state === "done" && "border-primary bg-primary text-primary-foreground shadow-none",
          state === "current" && "bg-[var(--coach-surface)]"
        )}
      >
        {state === "done" ? <CheckCircle2Icon /> : icon}
      </span>
      <div className="min-w-0 pt-1">
        <p className="ink-label">{number}</p>
        <h3 className="mt-1 font-heading text-2xl leading-tight font-bold tracking-[-0.015em]">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{meta}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </li>
  )
}

function ScoreTable({ plan }: { plan: GeneratedPlan }) {
  const scores = plan.evidence.reportedSections ?? plan.evidence.planningBaseline
  if (!scores) return null
  const estimated = plan.evidence.reportedSections === null
  return (
    <dl className="divide-y-2 divide-foreground border-y-2 border-foreground">
      {[
        [estimated ? "English estimate" : "English", scores.english, plan.target.scores.english],
        [estimated ? "Math estimate" : "Math", scores.math, plan.target.scores.math],
        [estimated ? "Reading estimate" : "Reading", scores.reading, plan.target.scores.reading],
      ].map(([label, current, target]) => (
        <div key={label} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3">
          <dt className="text-sm font-semibold">{label}</dt>
          <dd className="font-mono text-sm text-muted-foreground tabular-nums">{current}</dd>
          <dd className="font-heading text-2xl font-black text-primary tabular-nums">→ {target}</dd>
        </div>
      ))}
    </dl>
  )
}

function PlanView({ plan }: { plan: GeneratedPlan }) {
  const schedule = STUDY_DAYS.slice(0, plan.intensity.studyDaysPerWeek).map((day, index) => ({
    day,
    task: SESSION_FOCUSES[index],
  }))
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
      <p className="ink-label text-primary">Plan logic</p>
      <h1 className="mt-3 max-w-3xl font-heading text-5xl leading-[0.94] font-black tracking-[-0.035em] sm:text-7xl">
        {PHASE_LABELS[plan.intensity.phase]}
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
        {plan.intensity.studyDaysPerWeek} sessions per week · {plan.intensity.minutesPerSession} minutes each · evidence checkpoint every {plan.intensity.checkpointEveryDays} days.
      </p>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
        <section>
          <h2 className="font-heading text-3xl font-bold">Weekly rhythm</h2>
          <ol className="mt-5 border-t-2 border-foreground">
            {schedule.map(({ day, task }) => (
              <li key={day} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-border py-4">
                <span className="font-mono text-sm font-bold text-primary">{day}</span>
                <span className="font-semibold">{task}</span>
                <span className="text-sm text-muted-foreground">{plan.intensity.minutesPerSession}m</span>
              </li>
            ))}
          </ol>
        </section>
        <aside>
          <h2 className="font-heading text-3xl font-bold">Score route</h2>
          <div className="mt-5"><ScoreTable plan={plan} /></div>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            Targets are planning vectors, not guarantees. Checkpoints can move time toward skills that produce stronger evidence.
          </p>
        </aside>
      </div>
    </main>
  )
}

function ProgressView({ plan, learning }: { plan: GeneratedPlan; learning: LearningSessionPayload | null }) {
  const diagnostic = plan.diagnosticResult
  const focusSkills = diagnostic?.focusSkills.slice(0, 5) ?? []
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
      <p className="ink-label text-primary">Evidence, not vibes</p>
      <h1 className="mt-3 max-w-4xl font-heading text-5xl leading-[0.94] font-black tracking-[-0.035em] sm:text-7xl">
        Your skill map changes when you prove something.
      </h1>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
        <section>
          <h2 className="font-heading text-3xl font-bold">Current focus evidence</h2>
          {focusSkills.length ? (
            <ol className="mt-5 border-t-2 border-foreground">
              {focusSkills.map((skill) => (
                <li key={skill.skill} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-border py-4">
                  <div>
                    <p className="font-semibold">{skill.label}</p>
                    <p className="mt-1 text-sm capitalize text-muted-foreground">{skill.section} · {skill.correct}/{skill.total} correct</p>
                  </div>
                  <span className="font-heading text-3xl font-black tabular-nums">{Math.round(skill.accuracy * 100)}%</span>
                </li>
              ))}
            </ol>
          ) : (
            <ScoutCoach className="mt-6" message="Your submitted scores set the first route. Early skill probes will replace assumptions with direct evidence." />
          )}
        </section>
        <aside>
          <h2 className="font-heading text-3xl font-bold">Live mastery</h2>
          {learning ? (
            <div className="mt-5 border-y-2 border-foreground py-5">
              <p className="text-sm font-semibold">{learning.mastery.label}</p>
              <p className="mt-2 font-heading text-6xl font-black text-primary tabular-nums">
                {Math.round(learning.mastery.mastery * 100)}%
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {learning.mastery.evidence} evidence points · {learning.mastery.band}
              </p>
            </div>
          ) : null}
          <Alert className="mt-6 bg-[var(--info-surface)]">
            <InfoIcon />
            <AlertTitle>How adaptation works</AlertTitle>
            <AlertDescription>
              Difficulty-weighted attempts update mastery and review spacing. AI can personalize the explanation, but it cannot alter keys, scoring, or mastery math.
            </AlertDescription>
          </Alert>
        </aside>
      </div>
    </main>
  )
}

export function Dashboard({ plan, onEditPlan }: DashboardProps) {
  const diagnostic = plan.diagnosticResult
  const startingSkill = diagnostic?.focusSkills[0]?.skill ?? SECTION_FALLBACK_SKILLS[plan.weakestSection]
  const [learning, setLearning] = useState<LearningSessionPayload | null>(null)
  const [learningError, setLearningError] = useState<string | null>(null)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [activeSection, setActiveSection] = useState(0)
  const [selectedChoice, setSelectedChoice] = useState("")
  const [submitting, setSubmitting] = useState(false)

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
        setLearningError(error instanceof Error ? error.message : "The learning session could not load.")
      })
    return () => { active = false }
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
      setLearningError(error instanceof Error ? error.message : "Could not complete the lesson.")
    } finally {
      setSubmitting(false)
    }
  }

  async function submitAnswer() {
    const question = learning?.questions[learning.currentQuestionIndex]
    if (!question || !selectedChoice) return
    setSubmitting(true)
    try {
      setLearning(await learningRequest({ action: "answer", questionId: question.id, choiceId: selectedChoice }))
      setSelectedChoice("")
      setLearningError(null)
    } catch (error) {
      setLearningError(error instanceof Error ? error.message : "Could not check the answer.")
    } finally {
      setSubmitting(false)
    }
  }

  const lessonDone = learning?.lessonComplete ?? false
  const practiceDone = learning?.status === "complete"
  const answered = learning?.answeredQuestionIds.length ?? 0
  const practiceTotal = learning?.questions.length ?? 5

  return (
    <Tabs defaultValue="today" className="min-h-svh gap-0 bg-transparent">
      <header className="sticky top-0 z-20 border-b-2 border-foreground bg-background">
        <div className="mx-auto grid min-h-20 max-w-[96rem] grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-7 lg:grid-cols-[1fr_auto_1fr]">
          <Brand />
          <TabsList variant="line" className="order-3 col-span-2 justify-self-center lg:order-none lg:col-span-1" aria-label="Study navigation">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
          </TabsList>
          <div className="flex items-center justify-self-end gap-3">
            <div className="hidden sm:block"><ScoreRoute plan={plan} /></div>
            <Button type="button" variant="ghost" size="icon" onClick={onEditPlan} aria-label="Edit score plan">
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
          ) : (
            <div className="grid gap-10 xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,0.65fr)] xl:gap-16">
              <section className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                  <p className="ink-label text-primary">Today’s mission</p>
                  <span className="font-mono text-xs font-bold text-muted-foreground">
                    {plan.intensity.daysUntilTest} days to test day
                  </span>
                </div>
                <h1 className="mt-4 max-w-5xl font-heading text-5xl leading-[0.92] font-black tracking-[-0.04em] sm:text-7xl lg:text-8xl">
                  {learning?.lesson.title ?? "Building today’s lesson…"}
                </h1>
                <p className="marker-underline mt-6 max-w-3xl text-lg leading-8 font-semibold sm:text-xl">
                  {learning?.lesson.whyAssigned ?? "Scout is reading your plan and diagnostic evidence."}
                </p>

                {learningError ? (
                  <Alert className="mt-7 max-w-3xl bg-background">
                    <InfoIcon />
                    <AlertTitle>Lesson engine issue</AlertTitle>
                    <AlertDescription>{learningError}</AlertDescription>
                  </Alert>
                ) : null}

                <ol className="mt-10 max-w-3xl">
                  <MissionStep
                    number="01 · Learn"
                    icon={<BookOpenCheckIcon />}
                    title={learning?.lesson.objective ?? "Personalized teaching sequence"}
                    meta={learning ? `${learning.lesson.minutes} minutes · ${learning.lesson.depth} depth` : "Loading reviewed lesson content"}
                    state={lessonDone ? "done" : "current"}
                    action={!lessonDone ? (
                      <Button type="button" size="xl" onClick={() => setWorkspaceOpen(true)} disabled={!learning}>
                        <SparklesIcon data-icon="inline-start" />
                        Open teaching workspace
                      </Button>
                    ) : undefined}
                  />
                  <MissionStep
                    number="02 · Prove"
                    icon={<ListChecksIcon />}
                    title="5-question focused set"
                    meta={`${answered} of ${practiceTotal} answered · keys remain server-side`}
                    state={practiceDone ? "done" : lessonDone ? "current" : "queued"}
                    action={lessonDone && !practiceDone ? (
                      <Button type="button" size="lg" onClick={() => setWorkspaceOpen(true)}>
                        Continue focused set
                        <ArrowRightIcon data-icon="inline-end" />
                      </Button>
                    ) : undefined}
                  />
                  <MissionStep
                    number="03 · Remember"
                    icon={<RefreshCwIcon />}
                    title="Spaced repair review"
                    meta={learning?.mastery.nextReviewAt
                      ? `Scheduled ${formatCalendarDate(learning.mastery.nextReviewAt.slice(0, 10))}`
                      : "Scheduled from today’s answer evidence"}
                    state={practiceDone ? "current" : "queued"}
                  />
                </ol>
              </section>

              <aside className="min-w-0 xl:pt-6">
                <ScoutCoach
                  mood={practiceDone ? "correct" : learning ? "ready" : "thinking"}
                  message={learning?.lesson.tutorOpening}
                  detail={learning?.lesson.evidenceSummary}
                />

                <section className="mt-8 border-t-2 border-foreground pt-6">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-heading text-3xl font-bold">Plan snapshot</h2>
                    <TargetIcon className="text-primary" aria-hidden="true" />
                  </div>
                  <div className="mt-5"><ScoreTable plan={plan} /></div>
                </section>

                <section className="mt-8 border-t-2 border-foreground pt-6">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-heading text-3xl font-bold">Lesson engine</h2>
                    <BrainCircuitIcon className="text-primary" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {learning?.lesson.generation.mode === "ai"
                      ? `Generated with ${learning.lesson.generation.model}; checked against a reviewed lesson shell.`
                      : "Using the reviewed deterministic fallback. Connect an OpenAI-compatible model to generate the teaching sequence live."}
                  </p>
                </section>
              </aside>
            </div>
          )}
        </main>
      </TabsContent>

      <TabsContent value="plan"><PlanView plan={plan} /></TabsContent>
      <TabsContent value="progress"><ProgressView plan={plan} learning={learning} /></TabsContent>
    </Tabs>
  )
}
