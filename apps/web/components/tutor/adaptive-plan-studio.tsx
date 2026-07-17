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

const SECTION_LABELS = {
  english: "English",
  math: "Math",
  reading: "Reading",
} as const

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
    label: "At least 95%",
    title: "Scheduled minutes meet Scout’s rough internal time target.",
    className: "text-primary",
  },
  tight: {
    label: "72–94%",
    title: "Scheduled minutes cover part of Scout’s rough internal target.",
    className: "text-[var(--scout-coral-text)]",
  },
  "under-capacity": {
    label: "Below 72%",
    title: "Scheduled minutes are below Scout’s rough internal target.",
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
            Calendar capacity
          </span>
          <span
            id="availability-title"
            className="mt-1 block font-heading text-2xl font-bold"
          >
            {adaptivePlan.availability.entries.length}{" "}
            {adaptivePlan.availability.entries.length === 1
              ? "allowed weekday"
              : "allowed weekdays"}{" "}
            · {adaptivePlan.forecast.weeklyCapacity} min/week
          </span>
          <span className="mt-1 block text-xs font-semibold text-muted-foreground">
            Edit calendar capacity
          </span>
        </span>
        <PencilRulerIcon className="text-primary" aria-hidden="true" />
      </button>

      {open ? (
        <div className="mt-5">
          <p className="text-sm leading-6 text-muted-foreground">
            These are the only weekdays and minutes the generator may use.
            Saving rebuilds future dates; tasks dated today and tasks already
            marked complete are kept.
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
              "min-w-0 border-b px-3 py-4 last:border-b-0 xl:min-h-[22rem] xl:border-r xl:border-b-0 xl:last:border-r-0",
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
        message="Choose an assignment in the week to see its purpose and start it."
      />
    )
  }
  const meta = TASK_META[task.kind]
  const Icon = meta.icon
  const sameMission = task.skill !== null && task.skill === learning.todaySkill
  const canSwitch =
    learning.status === "complete" ||
    sameMission ||
    task.kind === "rehearsal" ||
    task.kind === "timed"
  const launchLabel =
    task.kind === "rehearsal" || task.kind === "timed"
      ? "Open timed practice"
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
        className="mt-5 font-heading text-3xl leading-none font-black"
      >
        {task.title}
      </h2>

      <Button
        type="button"
        size="xl"
        className="mt-6 w-full"
        onClick={() => onLaunch(task)}
        disabled={busy || !canSwitch}
      >
        {busy ? (
          <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
        ) : task.kind === "rehearsal" || task.kind === "timed" ? (
          <TimerResetIcon data-icon="inline-start" />
        ) : (
          <ArrowRightIcon data-icon="inline-start" />
        )}
        {launchLabel}
      </Button>

      <details className="mt-5 border-y py-4">
        <summary className="cursor-pointer text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          Why this assignment is here
        </summary>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {task.reason}
        </p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          This sentence was stored when the task was scheduled. It names the
          displayed skill inputs and phase rule, but it does not preserve a
          numeric trace of every ranking weight or tie-break. Those fixed rules
          are listed at the bottom of this page.
        </p>
      </details>

      <div className="mt-6 border-b-2 border-foreground pb-5">
        <p className="ink-label text-primary">What you’ll do</p>
        <ol className="mt-4 space-y-3 text-sm leading-6">
          {(task.kind === "rehearsal"
            ? [
                "Open the 66-question half-length English, Math, and Reading rehearsal.",
                "Answer under the section timers; explanations stay locked until submission.",
                "Review raw accuracy and pacing. The result stays in Timed practice and does not update Today or My week.",
              ]
            : task.kind === "timed"
              ? [
                  `Open one-section Timed practice for ${task.section ? SECTION_LABELS[task.section] : "the stored section"}.`,
                  "Answer under that section’s timer; explanations stay locked until submission.",
                  "Review raw accuracy and pacing. The result stays in Timed practice and does not update Today or My week.",
                ]
              : task.kind === "checkpoint"
                ? [
                    "Answer three questions from currently prioritized skills.",
                    "Each submitted answer updates only the skill it tests.",
                    "After question three, Scout reranks all 12 skills; it does not recalculate an ACT score.",
                  ]
                : task.kind === "review"
                  ? [
                      `Answer two review questions for ${task.skillLabel ?? "the stored skill"}.`,
                      "Each submitted answer updates only that tested skill.",
                      "After the second answer, Scout reranks all 12 skills; the dated calendar does not change.",
                    ]
                  : [
                      `Read the ${task.skillLabel ?? "skill"} rule and one worked example.`,
                      "Answer five scored questions for that skill.",
                      "Each answer updates only that skill; after the set, Scout reranks all 12 skills.",
                    ]
          ).map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="font-mono font-bold">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        This is a rule-generated schedule. It does not predict an ACT score or
        guarantee that the goal is reachable.
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
          <h1 className="mt-3 max-w-4xl font-heading text-4xl leading-[0.96] font-black tracking-[-0.025em] sm:text-5xl">
            Your study plan, week by week.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            This calendar fills only the weekdays and minutes you allow.
            Assignments are ranked from the 12 BKT skill estimates,
            scored-answer counts, stored review dates, and planned
            English/Math/Reading score movement. Choose an assignment to see the
            input values stored in its explanation; the complete fixed weights
            and tie-break rules are listed below the calendar.
          </p>
        </div>
        <dl className="grid grid-cols-3 divide-x-2 divide-foreground border-y-2 border-foreground py-4 text-center lg:min-w-[30rem]">
          <div className="px-3">
            <dt className="ink-label text-muted-foreground">Until test day</dt>
            <dd className="mt-2 font-heading text-4xl font-black tabular-nums">
              {daysToTest}d
            </dd>
          </div>
          <div className="px-3">
            <dt className="ink-label text-muted-foreground">Study days</dt>
            <dd className="mt-2 font-heading text-4xl font-black tabular-nums">
              {adaptivePlan.availability.entries.length}
            </dd>
          </div>
          <div className="px-3">
            <dt className="ink-label text-muted-foreground">Weekly time</dt>
            <dd className="mt-2 font-heading text-4xl font-black tabular-nums">
              {adaptivePlan.forecast.weeklyCapacity}m
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 border-l-4 border-primary bg-[var(--info-surface)] p-5">
        <p className="ink-label text-primary">
          Rough time-rule check ·{" "}
          {Math.round(adaptivePlan.forecast.capacityRatio * 100)}%
        </p>
        <h2 className="mt-2 font-heading text-2xl font-bold">{health.title}</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
          Scout’s rough target is {adaptivePlan.forecast.recommendedMinutes}{" "}
          total minutes before test day. The calendar currently contains{" "}
          {adaptivePlan.forecast.scheduledMinutes} minutes. This comparison is a
          product rule, not evidence that the ACT goal is reachable.
        </p>
        <details className="mt-4 max-w-4xl border-t border-foreground/25 pt-4">
          <summary className="cursor-pointer text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            Show the exact rough-time formula
          </summary>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            120 base minutes + 25 minutes for every planned section-score point
            across English, Math, and Reading + 15 minutes for every skill
            estimate below 65%. Current result:{" "}
            {adaptivePlan.forecast.recommendedMinutes} minutes. These weights
            are fixed in code and are not a research-based time-to-score
            conversion.
          </p>
        </details>
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
              <p className="ink-label text-muted-foreground">
                Weekly assignments
              </p>
              <h2
                id="weekly-plan-title"
                className="mt-2 font-heading text-3xl font-bold sm:text-4xl"
              >
                {shortDate(weekStart)}–{shortDate(weekEnd)}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose an assignment to see details and start it.
              </p>
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
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4 border-b pb-5">
            <details className="max-w-2xl text-sm leading-6 text-muted-foreground">
              <summary className="cursor-pointer font-semibold text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
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

      <footer className="mt-10 border-t-2 border-foreground pt-6">
        <details>
          <summary className="cursor-pointer font-heading text-xl font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
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
                {adaptivePlan.forecast.scheduledMinutes} minutes are split only
                across the allowed weekdays before test day. A day with more
                than 35 minutes is split into two or three assignments.
              </p>
            </div>
            <div className="flex gap-3">
              <SparklesIcon
                className="mt-1 shrink-0 text-[var(--scout-coral)]"
                aria-hidden="true"
              />
              <p className="text-sm leading-6">
                <strong>Skill score:</strong> (1 − BKT estimate) × 0.48 for a
                lesson or × 0.40 otherwise; evidence scarcity × 0.28 for a
                lesson or × 0.12 otherwise; section movement ÷ 35 × 0.30; a due
                review × 0.42 for review or × 0.08 otherwise; and the stored
                Today/Next flag × 0.35. Evidence scarcity is 1 − min(1, scored
                answers ÷ 6). Equal totals sort by skill name.
              </p>
            </div>
            <div className="flex gap-3">
              <LockKeyholeIcon className="mt-1 shrink-0" aria-hidden="true" />
              <p className="text-sm leading-6">
                <strong>Assignment choice:</strong> the first slot uses the
                stored Today/Next skill when its flag is above zero. Later slots
                rotate through sections in this order: largest target movement,
                second-largest, largest again, then third-largest. Within that
                section, the generator alternates between the top two ranked
                skills. AI lesson text does not choose dates or tasks.
              </p>
            </div>
          </div>
        </details>
      </footer>
    </main>
  )
}
