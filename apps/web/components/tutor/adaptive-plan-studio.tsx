"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
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

import { ScoutCoach } from "@/components/tutor/scout"
import type { GeneratedPlan } from "@/components/tutor/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { addCalendarDaysFrom, formatCalendarDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

interface AdaptivePlanStudioProps {
  plan: GeneratedPlan
  learning: LearningSessionPayload
  busy: boolean
  onLaunchTask: (task: StudyPlanTask) => void
}

type PlanResponse = { plan: AdaptiveStudyPlan } | { error: string }

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
  "on-track": { label: "On track", className: "text-primary" },
  tight: {
    label: "Little room to miss",
    className: "text-[var(--scout-coral)]",
  },
  "under-capacity": {
    label: "Needs more time",
    className: "text-destructive",
  },
} as const

const MINUTE_OPTIONS = [15, 20, 30, 45, 60, 75, 90, 120] as const
const DEFAULT_STUDY_DAY_ORDER: ReadonlyArray<StudyWeekday> = [
  "mon",
  "wed",
  "fri",
  "tue",
  "thu",
  "sat",
  "sun",
]

async function studyPlanRequest(body: Record<string, unknown>) {
  const response = await fetch("/api/study-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const payload = (await response.json()) as PlanResponse
  if (!response.ok || "error" in payload) {
    throw new Error(
      "error" in payload ? payload.error : "Study plan request failed."
    )
  }
  return payload.plan
}

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

function daysBetween(start: string, end: string) {
  return Math.round(
    (new Date(`${end}T00:00:00.000Z`).getTime() -
      new Date(`${start}T00:00:00.000Z`).getTime()) /
      86_400_000
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
            Weekly capacity
          </span>
          <span
            id="availability-title"
            className="mt-1 block font-heading text-2xl font-bold"
          >
            {adaptivePlan.forecast.weeklyCapacity} minutes
          </span>
        </span>
        <PencilRulerIcon className="text-primary" aria-hidden="true" />
      </button>

      {open ? (
        <div className="mt-5">
          <p className="text-sm leading-6 text-muted-foreground">
            Choose your study days. Scout can move future work, but it will not
            change today’s work or anything you already finished.
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
    <ol
      className="mt-7 grid gap-3 border-y-2 border-foreground py-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Plan milestones"
    >
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
  )
}

function TaskBlock({
  task,
  selected,
  changing,
  onSelect,
  onToggle,
}: {
  task: StudyPlanTask
  selected: boolean
  changing: boolean
  onSelect: () => void
  onToggle: () => void
}) {
  const meta = TASK_META[task.kind]
  const Icon = meta.icon
  return (
    <article
      className={cn(
        "relative border-l-4 p-3 transition-colors",
        meta.tone,
        selected && "outline-2 outline-offset-2 outline-foreground",
        task.status === "complete" && "border-primary bg-secondary",
        task.status === "skipped" && "opacity-55"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onToggle}
          disabled={changing}
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center border-2 border-foreground bg-background outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          aria-label={
            task.status === "complete"
              ? `Mark ${task.title} incomplete`
              : `Mark ${task.title} complete`
          }
        >
          {task.status === "complete" ? (
            <CheckIcon className="size-4" aria-hidden="true" />
          ) : (
            <CircleIcon className="size-3" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-pressed={selected}
        >
          <span className="flex items-center gap-1.5 font-mono text-[0.62rem] font-bold tracking-[0.08em] uppercase">
            <Icon className="size-3.5" aria-hidden="true" />
            {meta.label} · {task.minutes}m
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
  weekStart,
  selectedTaskId,
  changingTaskId,
  onSelect,
  onToggle,
}: {
  plan: AdaptiveStudyPlan
  weekStart: string
  selectedTaskId: string | null
  changingTaskId: string | null
  onSelect: (taskId: string) => void
  onToggle: (task: StudyPlanTask) => void
}) {
  const weekTasks = tasksForStudyWeek(plan.tasks, weekStart)
  const dates = Array.from({ length: 7 }, (_, index) =>
    addCalendarDaysFrom(weekStart, index)
  )
  return (
    <div className="grid border-y-2 border-foreground xl:grid-cols-7">
      {dates.map((date) => {
        const tasks = weekTasks.filter((task) => task.date === date)
        const isToday = date === plan.today
        const afterTest = date >= plan.testDate
        return (
          <section
            key={date}
            className={cn(
              "min-w-0 border-b px-3 py-4 last:border-b-0 xl:min-h-[30rem] xl:border-r xl:border-b-0 xl:last:border-r-0",
              isToday &&
                "bg-[color-mix(in_srgb,var(--scout-sun),transparent_88%)]",
              afterTest && "bg-muted/35 text-muted-foreground"
            )}
            aria-labelledby={`day-${date}`}
          >
            <header className="flex items-end justify-between gap-3 border-b pb-3 xl:block">
              <div>
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
                  className="mt-1 font-heading text-2xl font-black"
                >
                  {shortDate(date)}
                </h3>
              </div>
              <p className="font-mono text-xs font-bold text-muted-foreground xl:mt-2">
                {tasks.reduce((sum, task) => sum + task.minutes, 0) || "—"}{" "}
                {tasks.length ? "min" : ""}
              </p>
            </header>
            {tasks.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {tasks.map((task) => (
                  <TaskBlock
                    key={task.id}
                    task={task}
                    selected={task.id === selectedTaskId}
                    changing={task.id === changingTaskId}
                    onSelect={() => onSelect(task.id)}
                    onToggle={() => onToggle(task)}
                  />
                ))}
              </div>
            ) : (
              <p className="py-6 text-sm leading-6 text-muted-foreground xl:py-5">
                {afterTest ? "After test day" : "No study scheduled"}
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
  onLaunch,
}: {
  task: StudyPlanTask | null
  learning: LearningSessionPayload
  busy: boolean
  onLaunch: (task: StudyPlanTask) => void
}) {
  if (!task) {
    return (
      <ScoutCoach
        mood="thinking"
        message="Choose an assignment to see why Scout scheduled it and what to do next."
      />
    )
  }
  const meta = TASK_META[task.kind]
  const Icon = meta.icon
  const sameMission = task.skill !== null && task.skill === learning.todaySkill
  const canSwitch =
    learning.status === "complete" || sameMission || task.kind === "rehearsal"
  const launchLabel =
    task.kind === "rehearsal"
      ? "Open Test Day Lab"
      : !canSwitch
        ? "Finish your current task first"
        : sameMission && learning.status !== "complete"
          ? "Continue this task"
          : task.kind === "checkpoint"
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
        className="mt-5 font-heading text-4xl leading-none font-black"
      >
        {task.title}
      </h2>
      <p className="mt-5 text-sm leading-6 text-muted-foreground">
        {task.reason}
      </p>

      <div className="mt-6 border-y-2 border-foreground py-5">
        <p className="ink-label text-primary">How to finish this assignment</p>
        <ol className="mt-4 space-y-3 text-sm leading-6">
          <li className="flex gap-3">
            <span className="font-mono font-bold">01</span>
            <span>Answer the ACT-style questions on your own.</span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono font-bold">02</span>
            <span>If you miss one, read the explanation and try it again.</span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono font-bold">03</span>
            <span>Only your scored answers change your skill progress.</span>
          </li>
        </ol>
      </div>

      <Button
        type="button"
        size="xl"
        className="mt-6 w-full"
        onClick={() => onLaunch(task)}
        disabled={busy || !canSwitch}
      >
        {busy ? (
          <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
        ) : task.kind === "rehearsal" ? (
          <TimerResetIcon data-icon="inline-start" />
        ) : (
          <ArrowRightIcon data-icon="inline-start" />
        )}
        {launchLabel}
      </Button>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        This plan is an estimate, not an official score prediction or guarantee.
      </p>
    </section>
  )
}

export function AdaptivePlanStudio({
  plan,
  learning,
  busy: parentBusy,
  onLaunchTask,
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
      learning.mission.skillMap.map((skill) => ({
        skill: skill.skill,
        label: skill.label,
        section: skill.section,
        mastery: skill.mastery,
        evidence: skill.evidence,
        nextReviewAt: skill.nextReviewAt,
        priority:
          skill.skill === learning.todaySkill
            ? 1
            : skill.skill === learning.nextSkill
              ? 0.5
              : 0,
      })),
    [learning.mission.skillMap, learning.nextSkill, learning.todaySkill]
  )
  const skillsKey = useMemo(() => JSON.stringify(skills), [skills])
  const current = plan.evidence.planningBaseline

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
        : studyPlanRequest(
            firstLoad
              ? {
                  action: "start",
                  today: plan.today,
                  testDate: plan.draft.testDate,
                  current,
                  target: plan.target.scores,
                  skills,
                  availability: {
                    entries: DEFAULT_STUDY_DAY_ORDER.slice(
                      0,
                      plan.intensity.studyDaysPerWeek
                    ).map((weekday) => ({
                      weekday,
                      minutes: plan.intensity.minutesPerSession,
                    })),
                  },
                }
              : { action: "sync_evidence", skills }
          )
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
    adaptivePlan?.tasks.find((task) => task.id === selectedTaskId) ?? null

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
      setWeekStart(studyWeekStart(nextPlan.today))
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
      <main className="mx-auto w-full max-w-3xl px-5 py-16">
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>Finish setup first</AlertTitle>
          <AlertDescription>
            Scout needs your starting scores before it can build a dated plan.
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  if (!adaptivePlan) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-20">
        <ScoutCoach
          mood="thinking"
          message="Scout is fitting the most useful lessons into the time before your test."
        />
        {error ? (
          <Alert className="mt-7" variant="destructive">
            <AlertTriangleIcon />
            <AlertTitle>Plan Studio could not load</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </main>
    )
  }

  const daysToTest = daysBetween(adaptivePlan.today, adaptivePlan.testDate)
  const health = HEALTH_COPY[adaptivePlan.forecast.health]
  const firstWeek = studyWeekStart(adaptivePlan.today)
  const finalWeek = studyWeekStart(adaptivePlan.testDate)
  const weekEnd = addCalendarDaysFrom(weekStart, 6)
  const canGoBack = weekStart > firstWeek
  const canGoForward = weekStart < finalWeek
  const busy = parentBusy || saving || changingTaskId !== null

  return (
    <main className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-7 lg:py-10">
      <section className="grid gap-7 border-b-2 border-foreground pb-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="ink-label text-primary">Your study plan</p>
            <span
              className={cn(
                "font-mono text-xs font-bold uppercase",
                health.className
              )}
            >
              {health.label}
            </span>
          </div>
          <h1 className="mt-3 max-w-4xl font-heading text-5xl leading-[0.92] font-black tracking-[-0.035em] sm:text-7xl">
            {plan.evidence.source === "rapid_diagnostic"
              ? `Planning from a provisional baseline toward ${plan.draft.goal}.`
              : `From ${plan.currentComposite} toward ${plan.draft.goal}.`}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            {adaptivePlan.forecast.message}
          </p>
        </div>
        <dl className="grid grid-cols-3 divide-x-2 divide-foreground border-y-2 border-foreground py-4 text-center lg:min-w-[30rem]">
          <div className="px-3">
            <dt className="ink-label text-muted-foreground">To test day</dt>
            <dd className="mt-2 font-heading text-4xl font-black tabular-nums">
              {daysToTest}d
            </dd>
          </div>
          <div className="px-3">
            <dt className="ink-label text-muted-foreground">Per week</dt>
            <dd className="mt-2 font-heading text-4xl font-black tabular-nums">
              {adaptivePlan.forecast.weeklyCapacity}m
            </dd>
          </div>
          <div className="px-3">
            <dt className="ink-label text-muted-foreground">Plan progress</dt>
            <dd className="mt-2 font-heading text-4xl font-black text-primary tabular-nums">
              {adaptivePlan.forecast.readiness}%
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 grid gap-5 border-l-4 border-primary bg-[var(--info-surface)] p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div>
          <p className="ink-label text-primary">The tradeoff Scout chose</p>
          <p className="mt-2 max-w-4xl text-base leading-7 font-semibold">
            With {plan.intensity.studyDaysPerWeek} study days each week and{" "}
            {plan.intensity.minutesPerSession} minutes each day, Scout is
            putting the most time into{" "}
            {plan.draft.preferredSection === "balanced"
              ? `${plan.weakestSection} because it offers the clearest score gain`
              : `${plan.draft.preferredSection} because you named it as your priority`}
            . Spreading the same time evenly across every section would leave
            less time to repair the skills most likely to move your score.
          </p>
        </div>
        <span className="font-mono text-xs font-black text-muted-foreground uppercase">
          {plan.intensity.weeklyMinutes} min/week
        </span>
      </section>

      <MilestoneRail plan={adaptivePlan} />

      {error ? (
        <Alert className="mt-6" variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>Plan update paused</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-9 grid gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0" aria-labelledby="weekly-plan-title">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="ink-label text-muted-foreground">Study week</p>
              <h2
                id="weekly-plan-title"
                className="mt-2 font-heading text-4xl font-bold"
              >
                {shortDate(weekStart)}–{shortDate(weekEnd)}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setWeekStart(shiftStudyWeek(weekStart, -1))}
                disabled={!canGoBack}
                aria-label="Previous study week"
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setWeekStart(firstWeek)}
                disabled={weekStart === firstWeek}
              >
                This week
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setWeekStart(shiftStudyWeek(weekStart, 1))}
                disabled={!canGoForward}
                aria-label="Next study week"
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
          <WeekPlanner
            plan={adaptivePlan}
            weekStart={weekStart}
            selectedTaskId={selectedTaskId}
            changingTaskId={changingTaskId}
            onSelect={setSelectedTaskId}
            onToggle={toggleTask}
          />
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-b pb-5">
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Plan update {adaptivePlan.revision}: {adaptivePlan.revisionReason}
            </p>
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
        </section>

        <aside className="min-w-0 xl:sticky xl:top-28 xl:self-start">
          {selectedTask ? (
            <>
              <TaskInspector
                task={selectedTask}
                learning={learning}
                busy={busy}
                onLaunch={onLaunchTask}
              />
              <div className="mt-7">
                <AvailabilityEditor
                  key={adaptivePlan.updatedAt}
                  adaptivePlan={adaptivePlan}
                  saving={saving}
                  onSave={updateAvailability}
                />
              </div>
            </>
          ) : (
            <TaskInspector
              task={null}
              learning={learning}
              busy={busy}
              onLaunch={onLaunchTask}
            />
          )}
        </aside>
      </div>

      <footer className="mt-10 grid gap-5 border-t-2 border-foreground pt-6 md:grid-cols-3">
        <div className="flex gap-3">
          <RouteIcon
            className="mt-1 shrink-0 text-primary"
            aria-hidden="true"
          />
          <p className="text-sm leading-6">
            <strong>{adaptivePlan.forecast.scheduledMinutes} minutes</strong>{" "}
            are scheduled before test day.
          </p>
        </div>
        <div className="flex gap-3">
          <SparklesIcon
            className="mt-1 shrink-0 text-[var(--scout-coral)]"
            aria-hidden="true"
          />
          <p className="text-sm leading-6">
            <strong>
              {Math.round(adaptivePlan.forecast.evidenceCoverage * 100)}% of
              skills
            </strong>{" "}
            have at least one scored answer.
          </p>
        </div>
        <div className="flex gap-3">
          <LockKeyholeIcon className="mt-1 shrink-0" aria-hidden="true" />
          <p className="text-sm leading-6">
            AI may explain a lesson, but your scored answers decide how the plan
            changes.
          </p>
        </div>
      </footer>
    </main>
  )
}
