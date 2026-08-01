"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  preferredTaskForStudyWeek,
  shiftStudyWeek,
  studyWeekStart,
  tasksForStudyWeek,
  type AdaptiveStudyPlan,
  type LearningSessionPayload,
  type StudyAvailabilityEntry,
  type StudyPlanTask,
  type StudyPlanTaskKind,
  type StudyWeekday,
} from "@act-tutor/core"
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BookOpenCheckIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleIcon,
  Clock3Icon,
  DumbbellIcon,
  GaugeIcon,
  HistoryIcon,
  LoaderCircleIcon,
  LockKeyholeIcon,
  PencilRulerIcon,
  RefreshCwIcon,
  RouteIcon,
  SaveIcon,
  SparklesIcon,
  TimerResetIcon,
} from "lucide-react"

import {
  loadInitialStudyPlan,
  studyPlanRequest,
} from "@/components/tutor/adaptive-plan-studio-client"
import {
  learningAwareStudyTasks,
  summarizeStudyTaskStatuses,
  summarizeStudyWeekStatuses,
} from "@/components/tutor/adaptive-plan-studio-logic"
import { ScoutCoach } from "@/components/tutor/scout"
import type { GeneratedPlan } from "@/components/tutor/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { addCalendarDaysFrom, formatCalendarDate } from "@/lib/dates"
import { studyTaskLaunchDecision } from "@/lib/study-task-routing"
import { cn } from "@/lib/utils"

interface AdaptivePlanStudioProps {
  plan: GeneratedPlan
  learning: LearningSessionPayload
  busy: boolean
  onLaunchTask: (task: StudyPlanTask) => void
  onOpenLessons: () => void
  canViewTechnicalDetails: boolean
}

const WEEKDAYS: ReadonlyArray<{
  value: StudyWeekday
  short: string
  label: string
}> = [
  { value: "mon", short: "Mon", label: "Monday" },
  { value: "tue", short: "Tue", label: "Tuesday" },
  { value: "wed", short: "Wed", label: "Wednesday" },
  { value: "thu", short: "Thu", label: "Thursday" },
  { value: "fri", short: "Fri", label: "Friday" },
  { value: "sat", short: "Sat", label: "Saturday" },
  { value: "sun", short: "Sun", label: "Sunday" },
]

const TASK_META: Record<
  StudyPlanTaskKind,
  { label: string; icon: typeof BookOpenCheckIcon; tone: string }
> = {
  lesson: {
    label: "Learn",
    icon: BookOpenCheckIcon,
    tone: "border-primary bg-[var(--info-surface)]",
  },
  focus: {
    label: "Focus",
    icon: DumbbellIcon,
    tone: "border-[var(--scout-coral)] bg-[color-mix(in_srgb,var(--scout-coral),transparent_91%)]",
  },
  review: {
    label: "Review",
    icon: HistoryIcon,
    tone: "border-foreground bg-muted/50",
  },
  timed: {
    label: "Timed",
    icon: Clock3Icon,
    tone: "border-[var(--scout-sun)] bg-[var(--coach-surface)]",
  },
  checkpoint: {
    label: "Progress check",
    icon: GaugeIcon,
    tone: "border-foreground bg-secondary",
  },
  rehearsal: {
    label: "Practice test",
    icon: TimerResetIcon,
    tone: "border-[var(--scout-coral)] bg-[var(--scout-coral)]/10",
  },
}

const HEALTH_COPY = {
  "on-track": {
    label: "Time target met",
    title: "Your schedule meets AlexACT’s rough time target.",
    className: "text-primary",
  },
  tight: {
    label: "More time may help",
    title: "Your schedule covers most of AlexACT’s rough time target.",
    className: "text-[var(--scout-coral-text)]",
  },
  "under-capacity": {
    label: "Add study time",
    title: "Your schedule may be too light for this plan.",
    className: "text-destructive",
  },
} as const

const MINUTE_OPTIONS = [15, 20, 30, 45, 60, 75, 90, 120] as const
const EMPTY_STUDY_TASKS: ReadonlyArray<StudyPlanTask> = []
const EMPTY_VERIFIED_TASK_IDS: ReadonlySet<string> = new Set()

function shortDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day, 12))
}

function longWeekday(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    new Date(year, month - 1, day, 12)
  )
}

function AvailabilityEditor({
  adaptivePlan,
  saving,
  onSave,
}: {
  adaptivePlan: AdaptiveStudyPlan
  saving: boolean
  onSave: (entries: ReadonlyArray<StudyAvailabilityEntry>) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Record<StudyWeekday, number | null>>(
    () =>
      Object.fromEntries(
        WEEKDAYS.map(({ value }) => [
          value,
          adaptivePlan.availability.entries.find(
            (entry) => entry.weekday === value
          )?.minutes ?? null,
        ])
      ) as Record<StudyWeekday, number | null>
  )

  const entries = WEEKDAYS.flatMap(({ value }) => {
    const minutes = draft[value]
    return minutes === null ? [] : [{ weekday: value, minutes }]
  })
  const capacity = entries.reduce((sum, entry) => sum + entry.minutes, 0)

  return (
    <section
      className="border-t-2 border-foreground pt-5"
      aria-labelledby="availability-title"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span>
          <span className="ink-label text-muted-foreground">
            Study schedule
          </span>
          <span
            id="availability-title"
            className="mt-1 block font-heading text-2xl font-bold"
          >
            {adaptivePlan.availability.entries.length}{" "}
            {adaptivePlan.availability.entries.length === 1
              ? "study day"
              : "study days"}{" "}
            · {adaptivePlan.forecast.weeklyCapacity} min/week
          </span>
        </span>
        <PencilRulerIcon className="text-primary" aria-hidden="true" />
      </button>

      {open ? (
        <div className="mt-5">
          <p className="text-sm leading-6 text-muted-foreground">
            Choose the days and minutes AlexACT may schedule. Saving updates
            future work but keeps today and completed tasks.
          </p>
          <div
            className="mt-4 divide-y border-y"
            role="group"
            aria-label="Study days and minutes"
          >
            {WEEKDAYS.map((day) => {
              const selected = draft[day.value] !== null
              return (
                <div
                  key={day.value}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"
                >
                  <label className="flex min-h-10 items-center gap-3 font-semibold">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          [day.value]: event.target.checked
                            ? (current[day.value] ?? 30)
                            : null,
                        }))
                      }
                      className="size-5 accent-[var(--primary)]"
                    />
                    {day.label}
                  </label>
                  <select
                    value={draft[day.value] ?? 30}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [day.value]: Number(event.target.value),
                      }))
                    }
                    disabled={!selected}
                    aria-label={`${day.label} minutes`}
                    className="h-10 rounded-md border bg-background px-3 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40"
                  >
                    {MINUTE_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} min
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-sm">
              Preview: <strong>{capacity} min/week</strong>
            </p>
            <Button
              type="button"
              onClick={() => onSave(entries)}
              disabled={saving || entries.length === 0}
            >
              {saving ? (
                <LoaderCircleIcon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <SaveIcon data-icon="inline-start" />
              )}
              Save schedule
            </Button>
          </div>
          {entries.length === 0 ? (
            <p
              className="mt-3 text-sm font-semibold text-destructive"
              role="alert"
            >
              Keep at least one study day selected.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function MilestoneRail({ plan }: { plan: AdaptiveStudyPlan }) {
  return (
    <section className="mt-7" aria-labelledby="important-dates-title">
      <p id="important-dates-title" className="ink-label text-muted-foreground">
        Important dates
      </p>
      <ol className="mt-3 grid gap-3 border-y-2 border-foreground py-4 sm:grid-cols-2 xl:grid-cols-4">
        {plan.milestones.map((milestone, index) => (
          <li
            key={milestone.id}
            className="relative flex items-center gap-3 sm:px-2"
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center border-2 border-foreground bg-background",
                milestone.status === "complete" &&
                  "border-primary bg-primary text-primary-foreground",
                milestone.status === "current" && "bg-[var(--coach-surface)]",
                milestone.status === "at-risk" &&
                  "border-destructive text-destructive"
              )}
            >
              {milestone.status === "complete" ? (
                <CheckIcon className="size-4" aria-hidden="true" />
              ) : milestone.status === "at-risk" ? (
                <AlertTriangleIcon className="size-4" aria-hidden="true" />
              ) : (
                <span className="font-mono text-xs font-bold">{index + 1}</span>
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold">{milestone.label}</span>
              <span className="block text-xs text-muted-foreground">
                {shortDate(milestone.date)}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function TaskBlock({
  task,
  selected,
  changing,
  verifiedComplete,
  onSelect,
  onToggle,
}: {
  task: StudyPlanTask
  selected: boolean
  changing: boolean
  verifiedComplete: boolean
  onSelect: () => void
  onToggle: () => void
}) {
  const meta = TASK_META[task.kind]
  const Icon = meta.icon
  const statusLabel =
    task.status === "complete"
      ? "Done"
      : task.status === "skipped"
        ? "Missed"
        : null
  return (
    <article
      className={cn(
        "relative border-l-4 border-border bg-transparent p-3 transition-colors",
        selected &&
          "border-primary bg-[var(--info-surface)] outline-2 outline-offset-2 outline-foreground",
        task.status === "complete" && "border-primary bg-secondary",
        task.status === "skipped" && "opacity-55"
      )}
    >
      <div className="flex items-start gap-2">
        {verifiedComplete ? (
          <span
            className="flex size-11 shrink-0 items-center justify-center"
            role="img"
            aria-label={`${task.title} completed in Lessons`}
          >
            <span className="flex size-6 items-center justify-center border-2 border-primary bg-background text-primary">
              <CheckIcon className="size-4" aria-hidden="true" />
            </span>
          </span>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            disabled={changing}
            className="flex size-11 shrink-0 items-center justify-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            aria-label={
              task.status === "complete"
                ? `Mark ${task.title} incomplete`
                : `Mark ${task.title} complete`
            }
          >
            <span className="flex size-6 items-center justify-center border-2 border-foreground bg-background">
              {task.status === "complete" ? (
                <CheckIcon className="size-4" aria-hidden="true" />
              ) : (
                <CircleIcon className="size-3" aria-hidden="true" />
              )}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={onSelect}
          className="min-h-11 min-w-0 flex-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-pressed={selected}
        >
          <span className="flex items-center gap-1.5 font-mono text-[0.62rem] font-bold tracking-[0.08em] uppercase">
            <Icon className="size-3.5" aria-hidden="true" />
            {meta.label} · {task.minutes}m
            {statusLabel ? ` · ${statusLabel}` : null}
          </span>
          <span
            className={cn(
              "mt-1.5 block text-sm leading-5 font-bold",
              task.status === "complete" && "line-through decoration-2"
            )}
          >
            {task.title}
          </span>
        </button>
      </div>
    </article>
  )
}

function WeekPlanner({
  plan,
  tasks: allTasks,
  weekStart,
  selectedTaskId,
  changingTaskId,
  verifiedTaskIds,
  onSelect,
  onToggle,
}: {
  plan: AdaptiveStudyPlan
  tasks: ReadonlyArray<StudyPlanTask>
  weekStart: string
  selectedTaskId: string | null
  changingTaskId: string | null
  verifiedTaskIds: ReadonlySet<string>
  onSelect: (taskId: string) => void
  onToggle: (task: StudyPlanTask) => void
}) {
  const weekTasks = tasksForStudyWeek(allTasks, weekStart)
  const dates = Array.from({ length: 7 }, (_, index) =>
    addCalendarDaysFrom(weekStart, index)
  )
  return (
    <div
      className="divide-y-2 divide-foreground/15 border-y-2 border-foreground"
      data-testid="week-planner"
    >
      {dates.map((date) => {
        const tasks = weekTasks.filter((task) => task.date === date)
        const daySummary = summarizeStudyTaskStatuses(tasks)
        const minuteStatus = [
          daySummary.scheduledMinutes
            ? `${daySummary.scheduledMinutes} min left`
            : null,
          daySummary.completedMinutes
            ? `${daySummary.completedMinutes} min done`
            : null,
          daySummary.missedMinutes
            ? `${daySummary.missedMinutes} min missed`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
        const isToday = date === plan.today
        const afterTest = date >= plan.testDate
        return (
          <section
            key={date}
            className={cn(
              "grid min-w-0 gap-3 px-3 sm:grid-cols-[8rem_minmax(0,1fr)]",
              tasks.length ? "py-4 sm:items-start" : "py-2 sm:items-center",
              isToday &&
                "bg-[color-mix(in_srgb,var(--scout-sun),transparent_90%)]",
              afterTest && "bg-muted/35 text-muted-foreground"
            )}
            aria-labelledby={`day-${date}`}
            aria-current={isToday ? "date" : undefined}
            data-testid="week-day"
          >
            <header
              className={cn(
                "flex items-end justify-between gap-3",
                tasks.length && "sm:block"
              )}
            >
              <div
                className={cn(
                  !tasks.length && "flex items-baseline gap-3 sm:block"
                )}
              >
                <p
                  className={cn(
                    "ink-label",
                    isToday ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {isToday ? "Today" : longWeekday(date)}
                </p>
                <h3
                  id={`day-${date}`}
                  className={cn(
                    "font-heading font-black",
                    tasks.length
                      ? "mt-1 text-xl"
                      : "font-mono text-xs text-muted-foreground sm:mt-1"
                  )}
                >
                  {shortDate(date)}
                </h3>
              </div>
              {tasks.length ? (
                <p className="shrink-0 font-mono text-xs font-bold text-muted-foreground">
                  {minuteStatus}
                </p>
              ) : null}
            </header>
            {tasks.length ? (
              <div className="grid gap-2">
                {tasks.map((task) => (
                  <TaskBlock
                    key={task.id}
                    task={task}
                    selected={task.id === selectedTaskId}
                    changing={task.id === changingTaskId}
                    verifiedComplete={verifiedTaskIds.has(task.id)}
                    onSelect={() => onSelect(task.id)}
                    onToggle={() => onToggle(task)}
                  />
                ))}
              </div>
            ) : (
              <p className="self-center text-sm leading-6 text-muted-foreground">
                {afterTest ? "After test day" : "No study planned"}
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}

function TaskInspector({
  task,
  learning,
  busy,
  verifiedComplete,
  onLaunch,
  onOpenLessons,
  canViewTechnicalDetails,
}: {
  task: StudyPlanTask | null
  learning: LearningSessionPayload
  busy: boolean
  verifiedComplete: boolean
  onLaunch: (task: StudyPlanTask) => void
  onOpenLessons: () => void
  canViewTechnicalDetails: boolean
}) {
  if (!task) {
    return (
      <ScoutCoach
        mood="thinking"
        message="Choose an assignment in the week to see its purpose and start it."
      />
    )
  }
  const meta = TASK_META[task.kind]
  const Icon = meta.icon
  const launchDecision = studyTaskLaunchDecision(task, learning)
  const canSwitch =
    task.status !== "complete" &&
    launchDecision.type !== "blocked" &&
    launchDecision.type !== "unavailable"
  const launchLabel =
    launchDecision.type === "timed-practice"
      ? "Open timed practice"
      : launchDecision.type === "blocked"
        ? "Finish your current task first"
        : launchDecision.type === "unavailable"
          ? "Task unavailable"
          : launchDecision.type === "continue-current"
            ? "Continue this task"
            : launchDecision.type === "start-checkpoint"
              ? "Start progress check"
              : "Start this task"
  return (
    <section aria-labelledby="task-inspector-title">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-11 items-center justify-center border-2",
            meta.tone
          )}
        >
          <Icon aria-hidden="true" />
        </span>
        <div>
          <p className="ink-label text-muted-foreground">
            {meta.label} · {task.minutes} minutes
          </p>
          <p className="mt-1 text-sm font-semibold">
            {formatCalendarDate(task.date)}
          </p>
        </div>
      </div>
      <h2
        id="task-inspector-title"
        className="mt-4 font-heading text-2xl leading-tight font-black"
      >
        {task.title}
      </h2>

      {task.status === "complete" ? (
        <div className="mt-6">
          <p
            className="flex min-h-12 items-center gap-2 border-y border-primary bg-secondary px-4 py-3 text-sm font-bold text-primary"
            role="status"
          >
            <CheckIcon className="size-5" aria-hidden="true" />
            {verifiedComplete ? "Completed in Lessons" : "Task completed"}
          </p>
          {verifiedComplete ? (
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="mt-3 w-full"
              onClick={onOpenLessons}
            >
              <ArrowRightIcon data-icon="inline-start" />
              {learning.cycle.status === "assessment-choice"
                ? "Choose next assessment"
                : "Open next lesson"}
            </Button>
          ) : null}
        </div>
      ) : (
        <Button
          type="button"
          size="xl"
          className="mt-6 w-full"
          onClick={() => onLaunch(task)}
          disabled={busy || !canSwitch}
        >
          {busy ? (
            <LoaderCircleIcon
              className="animate-spin"
              data-icon="inline-start"
            />
          ) : task.kind === "rehearsal" || task.kind === "timed" ? (
            <TimerResetIcon data-icon="inline-start" />
          ) : (
            <ArrowRightIcon data-icon="inline-start" />
          )}
          {launchLabel}
        </Button>
      )}

      <details className="mt-5 border-y py-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          Why this is scheduled
        </summary>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {task.reason}
        </p>
        {canViewTechnicalDetails ? (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            This sentence was stored when the task was scheduled. It names the
            displayed skill inputs and phase rule, but it does not preserve a
            numeric trace of every ranking weight or tie-break. Those fixed
            rules are listed at the bottom of this page.
          </p>
        ) : null}
      </details>
    </section>
  )
}

export function AdaptivePlanStudio({
  plan,
  learning,
  busy: parentBusy,
  onLaunchTask,
  onOpenLessons,
  canViewTechnicalDetails,
}: AdaptivePlanStudioProps) {
  const [adaptivePlan, setAdaptivePlan] = useState<AdaptiveStudyPlan | null>(
    null
  )
  const [weekStart, setWeekStart] = useState(() => studyWeekStart(plan.today))
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [changingTaskId, setChangingTaskId] = useState<string | null>(null)
  const initializedKey = `${plan.today}:${plan.draft.testDate}:${plan.currentComposite}:${plan.draft.goal}:${plan.intensity.studyDaysPerWeek}:${plan.intensity.minutesPerSession}`
  const initializedRef = useRef<string | null>(null)
  const syncedSkillsRef = useRef<string | null>(null)
  const pendingRequestRef = useRef<{
    key: string
    promise: Promise<AdaptiveStudyPlan>
  } | null>(null)
  const skills = useMemo(
    () =>
      learning.learningTwin.skills.map((skill) => ({
        skill: skill.skill,
        label: skill.label,
        section: skill.section,
        mastery: skill.learnedProbability,
        evidence: skill.evidenceCount,
        nextReviewAt:
          learning.mission.skillMap.find((item) => item.skill === skill.skill)
            ?.nextReviewAt ?? null,
        priority:
          skill.skill === learning.todaySkill
            ? 1
            : skill.skill === learning.nextSkill
              ? 0.5
              : 0,
      })),
    [
      learning.learningTwin.skills,
      learning.mission.skillMap,
      learning.nextSkill,
      learning.todaySkill,
    ]
  )
  const skillsKey = useMemo(() => JSON.stringify(skills), [skills])
  const current = plan.evidence.planningBaseline
  const learningTasks = useMemo(
    () =>
      adaptivePlan
        ? learningAwareStudyTasks({
            tasks: adaptivePlan.tasks,
            today: adaptivePlan.today,
            roundNumber: learning.cycle.roundNumber,
            completedSkills: learning.cycle.completedSkills,
            lessonHistory: learning.lessonHistory,
            completedAtFallback: learning.updatedAt,
          })
        : {
            tasks: EMPTY_STUDY_TASKS,
            verifiedTaskIds: EMPTY_VERIFIED_TASK_IDS,
          },
    [
      adaptivePlan,
      learning.cycle.completedSkills,
      learning.cycle.roundNumber,
      learning.lessonHistory,
      learning.updatedAt,
    ]
  )

  useEffect(() => {
    if (!current) return
    const requestKey = `${initializedKey}:${skillsKey}`
    if (
      initializedRef.current === initializedKey &&
      syncedSkillsRef.current === requestKey
    ) {
      return
    }
    let active = true
    setSaving(true)
    const firstLoad = initializedRef.current !== initializedKey
    const pending =
      pendingRequestRef.current?.key === requestKey
        ? pendingRequestRef.current.promise
        : firstLoad
          ? loadInitialStudyPlan({
              today: plan.today,
              testDate: plan.draft.testDate,
              current,
              target: plan.target.scores,
              skills,
              studyDaysPerWeek: plan.intensity.studyDaysPerWeek,
              minutesPerSession: plan.intensity.minutesPerSession,
            })
          : studyPlanRequest({ action: "sync_evidence", skills })
    pendingRequestRef.current = { key: requestKey, promise: pending }
    pending
      .then((nextPlan) => {
        if (!active) return
        initializedRef.current = initializedKey
        syncedSkillsRef.current = requestKey
        setAdaptivePlan(nextPlan)
        setSelectedTaskId((selected) =>
          selected && nextPlan.tasks.some((task) => task.id === selected)
            ? selected
            : (nextPlan.tasks.find((task) => task.date === nextPlan.today)
                ?.id ??
              nextPlan.tasks[0]?.id ??
              null)
        )
        setError(null)
      })
      .catch((caught: unknown) => {
        if (!active) return
        setError(
          caught instanceof Error
            ? caught.message
            : "The study plan could not load."
        )
      })
      .finally(() => {
        if (pendingRequestRef.current?.promise === pending) {
          pendingRequestRef.current = null
        }
        if (active) setSaving(false)
      })
    return () => {
      active = false
    }
  }, [
    current,
    initializedKey,
    plan.draft.testDate,
    plan.intensity.minutesPerSession,
    plan.intensity.studyDaysPerWeek,
    plan.target.scores,
    plan.today,
    skills,
    skillsKey,
  ])

  const selectedTask =
    learningTasks.tasks.find((task) => task.id === selectedTaskId) ?? null

  function showWeek(
    nextWeek: string,
    sourceTasks: ReadonlyArray<StudyPlanTask> = learningTasks.tasks
  ) {
    setWeekStart(nextWeek)
    setSelectedTaskId(
      preferredTaskForStudyWeek(sourceTasks, nextWeek)?.id ?? null
    )
  }

  async function updateAvailability(
    entries: ReadonlyArray<StudyAvailabilityEntry>
  ) {
    setSaving(true)
    try {
      const nextPlan = await studyPlanRequest({
        action: "update_availability",
        availability: { entries },
      })
      setAdaptivePlan(nextPlan)
      setError(null)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Availability could not be saved."
      )
    } finally {
      setSaving(false)
    }
  }

  async function toggleTask(task: StudyPlanTask) {
    setChangingTaskId(task.id)
    try {
      const nextPlan = await studyPlanRequest({
        action: "set_task_status",
        taskId: task.id,
        status: task.status === "complete" ? "scheduled" : "complete",
      })
      setAdaptivePlan(nextPlan)
      setError(null)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Task status could not be saved."
      )
    } finally {
      setChangingTaskId(null)
    }
  }

  async function catchUp() {
    setSaving(true)
    try {
      const nextPlan = await studyPlanRequest({
        action: "catch_up",
        today: plan.today,
      })
      setAdaptivePlan(nextPlan)
      const nextLearningTasks = learningAwareStudyTasks({
        tasks: nextPlan.tasks,
        today: nextPlan.today,
        roundNumber: learning.cycle.roundNumber,
        completedSkills: learning.cycle.completedSkills,
        lessonHistory: learning.lessonHistory,
        completedAtFallback: learning.updatedAt,
      })
      showWeek(studyWeekStart(nextPlan.today), nextLearningTasks.tasks)
      setError(null)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Catch-up could not run."
      )
    } finally {
      setSaving(false)
    }
  }

  if (!current) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-3xl px-5 py-16"
      >
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>Finish setup first</AlertTitle>
          <AlertDescription>
            AlexACT needs your starting scores before it can build a dated plan.
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  if (!adaptivePlan) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-3xl px-5 py-20"
      >
        <ScoutCoach
          mood="thinking"
          message="Building your study weeks from your goal, test date, and available time."
        />
        {error ? (
          <Alert className="mt-7" variant="destructive">
            <AlertTriangleIcon />
            <AlertTitle>Study plan could not load</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </main>
    )
  }

  const health = HEALTH_COPY[adaptivePlan.forecast.health]
  const firstWeek = studyWeekStart(adaptivePlan.today)
  const finalWeek = studyWeekStart(adaptivePlan.testDate)
  const weekEnd = addCalendarDaysFrom(weekStart, 6)
  const weekSummary = summarizeStudyWeekStatuses(learningTasks.tasks, weekStart)
  const weekStatus = [
    weekSummary.scheduledDays
      ? `${weekSummary.scheduledDays} planned ${
          weekSummary.scheduledDays === 1 ? "day" : "days"
        } · ${weekSummary.scheduledMinutes} min scheduled`
      : null,
    weekSummary.completedDays
      ? `${weekSummary.completedDays} completed ${
          weekSummary.completedDays === 1 ? "day" : "days"
        } · ${weekSummary.completedMinutes} min done`
      : null,
    weekSummary.missedMinutes
      ? `${weekSummary.missedMinutes} min missed`
      : null,
  ]
    .filter(Boolean)
    .join(" · ")
  const canGoBack = weekStart > firstWeek
  const canGoForward = weekStart < finalWeek
  const busy = parentBusy || saving || changingTaskId !== null

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-7 lg:py-9"
    >
      <section
        className="border-b-2 border-foreground pb-5"
        aria-labelledby="weekly-plan-title"
      >
        <p className="ink-label text-primary">My schedule</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1
              id="weekly-plan-title"
              className="font-heading text-4xl leading-none font-black tracking-[-0.025em] sm:text-5xl"
            >
              {shortDate(weekStart)}–{shortDate(weekEnd)}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              {weekStatus || "No active study days this week"} · Test{" "}
              {shortDate(adaptivePlan.testDate)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => showWeek(shiftStudyWeek(weekStart, -1))}
              disabled={!canGoBack}
              aria-label="Previous study week"
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => showWeek(firstWeek)}
              disabled={weekStart === firstWeek}
            >
              This week
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => showWeek(shiftStudyWeek(weekStart, 1))}
              disabled={!canGoForward}
              aria-label="Next study week"
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <Alert className="mt-6" variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>Plan update paused</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="min-w-0" aria-label="Weekly assignments">
          <WeekPlanner
            plan={adaptivePlan}
            tasks={learningTasks.tasks}
            weekStart={weekStart}
            selectedTaskId={selectedTaskId}
            changingTaskId={changingTaskId}
            verifiedTaskIds={learningTasks.verifiedTaskIds}
            onSelect={setSelectedTaskId}
            onToggle={toggleTask}
          />
        </section>

        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          {selectedTask ? (
            <TaskInspector
              task={selectedTask}
              learning={learning}
              busy={busy}
              verifiedComplete={learningTasks.verifiedTaskIds.has(
                selectedTask.id
              )}
              onLaunch={onLaunchTask}
              onOpenLessons={onOpenLessons}
              canViewTechnicalDetails={canViewTechnicalDetails}
            />
          ) : (
            <TaskInspector
              task={null}
              learning={learning}
              busy={busy}
              verifiedComplete={false}
              onLaunch={onLaunchTask}
              onOpenLessons={onOpenLessons}
              canViewTechnicalDetails={canViewTechnicalDetails}
            />
          )}
          <div className="mt-6">
            <AvailabilityEditor
              key={adaptivePlan.updatedAt}
              adaptivePlan={adaptivePlan}
              saving={saving}
              onSave={updateAvailability}
            />
          </div>
        </aside>
      </div>

      <details className="mt-8 border-y-2 border-foreground py-2">
        <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-4 font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          Plan details
          <span className={cn("text-sm", health.className)}>
            {health.label}
          </span>
        </summary>
        <div className="border-t pt-5">
          <h2 className="font-heading text-2xl font-black">{health.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {adaptivePlan.forecast.scheduledMinutes} minutes are scheduled
            before test day; AlexACT&apos;s planning target is{" "}
            {adaptivePlan.forecast.recommendedMinutes} minutes.
          </p>
          <MilestoneRail plan={adaptivePlan} />
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t pt-4">
            <details className="max-w-2xl text-sm leading-6 text-muted-foreground">
              <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                Latest schedule update
              </summary>
              <p className="mt-2">{adaptivePlan.revisionReason}</p>
            </details>
            <Button
              type="button"
              variant="outline"
              onClick={catchUp}
              disabled={busy}
            >
              <RefreshCwIcon data-icon="inline-start" />
              Move missed work
            </Button>
          </div>
        </div>
      </details>

      {canViewTechnicalDetails ? (
        <footer className="mt-10 border-t-2 border-foreground pt-6">
          <details>
            <summary className="flex min-h-11 cursor-pointer items-center font-heading text-xl font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              Calendar generator rules
            </summary>
            <div className="mt-5 grid gap-5 md:grid-cols-3">
              <div className="flex gap-3">
                <RouteIcon
                  className="mt-1 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <p className="text-sm leading-6">
                  <strong>Calendar:</strong>{" "}
                  {adaptivePlan.forecast.scheduledMinutes} minutes are split
                  only across the allowed weekdays before test day. A day with
                  more than 35 minutes is split into two or three assignments.
                </p>
              </div>
              <div className="flex gap-3">
                <SparklesIcon
                  className="mt-1 shrink-0 text-[var(--scout-coral)]"
                  aria-hidden="true"
                />
                <p className="text-sm leading-6">
                  <strong>Skill score:</strong> (1 − skill estimate) × 0.48 for
                  a lesson or × 0.40 otherwise; evidence scarcity × 0.28 for a
                  lesson or × 0.12 otherwise; section movement ÷ 35 × 0.30; a
                  due review × 0.42 for review or × 0.08 otherwise; and the
                  stored Today/Next flag × 0.35. Evidence scarcity is 1 − min(1,
                  scored answers ÷ 6). Equal totals sort by skill name.
                </p>
              </div>
              <div className="flex gap-3">
                <LockKeyholeIcon className="mt-1 shrink-0" aria-hidden="true" />
                <p className="text-sm leading-6">
                  <strong>Assignment choice:</strong> the first slot uses the
                  stored Today/Next skill when its flag is above zero. Later
                  slots rotate through sections in this order: largest target
                  movement, second-largest, largest again, then third-largest.
                  Within that section, the generator alternates between the top
                  two ranked skills. AI lesson text does not choose dates or
                  tasks.
                </p>
              </div>
            </div>
          </details>
        </footer>
      ) : null}
    </main>
  )
}
