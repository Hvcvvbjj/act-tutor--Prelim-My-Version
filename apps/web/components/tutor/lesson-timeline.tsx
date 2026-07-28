"use client"

import {
  ArrowRightIcon,
  CheckIcon,
  CircleIcon,
  LockKeyholeIcon,
  MapIcon,
  PlayIcon,
} from "lucide-react"

import type {
  LessonPathItem,
  LessonPathStatus,
} from "@/components/tutor/lesson-path"
import { cn } from "@/lib/utils"

const SECTION_LABEL = {
  english: "English",
  math: "Math",
  reading: "Reading",
} as const

const STATUS_COPY: Record<LessonPathStatus, string> = {
  completed: "Complete",
  current: "Up next",
  available: "Available",
  locked: "Later",
}

const NODE_STYLE: Record<LessonPathStatus, string> = {
  completed: "border-primary bg-primary text-primary-foreground",
  current:
    "border-primary bg-background text-primary ring-4 ring-primary/15 shadow-sm",
  available:
    "border-[var(--scout-coral)] bg-background text-[var(--scout-coral-text)]",
  locked: "border-border bg-muted text-muted-foreground",
}

function StatusIcon({ status }: { status: LessonPathStatus }) {
  if (status === "completed") {
    return <CheckIcon className="size-5" aria-hidden="true" />
  }
  if (status === "current") {
    return <PlayIcon className="size-4 fill-current" aria-hidden="true" />
  }
  if (status === "locked") {
    return <LockKeyholeIcon className="size-4" aria-hidden="true" />
  }
  return <CircleIcon className="size-4 fill-current" aria-hidden="true" />
}

function LessonContent({
  lesson,
  index,
  interactive,
  expanded,
}: {
  lesson: LessonPathItem
  index: number
  interactive: boolean
  expanded: boolean
}) {
  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold tracking-[0.1em] uppercase",
          lesson.status === "current" ? "text-primary" : "text-muted-foreground"
        )}
      >
        <span>Lesson {index + 1}</span>
        {lesson.section ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{SECTION_LABEL[lesson.section]}</span>
          </>
        ) : null}
        {lesson.minutes ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{lesson.minutes} min</span>
          </>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3
            className={cn(
              "font-heading leading-tight font-black tracking-[-0.02em]",
              expanded ? "text-lg sm:text-xl" : "text-base"
            )}
          >
            {lesson.title}
          </h3>
          {expanded && lesson.description ? (
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              {lesson.description}
            </p>
          ) : null}
        </div>
        {interactive ? (
          <ArrowRightIcon
            className="mt-1 size-4 shrink-0 transition-transform group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none"
            aria-hidden="true"
          />
        ) : null}
      </div>
      <p
        className={cn(
          "text-xs font-bold text-muted-foreground",
          expanded ? "mt-3" : "mt-1.5"
        )}
      >
        {STATUS_COPY[lesson.status]}
      </p>
    </>
  )
}

export interface LessonTimelineProps {
  lessons: ReadonlyArray<LessonPathItem>
  roundNumber: number
  roundLabel?: string
  title?: string
  description?: string
  busy?: boolean
  className?: string
  onSelectLesson?: (lesson: LessonPathItem) => void
}

export function LessonTimeline({
  lessons,
  roundNumber,
  roundLabel,
  title = "Your lesson path",
  description = "Follow the path in order. Completed lessons stay marked as you move forward.",
  busy = false,
  className,
  onSelectLesson,
}: LessonTimelineProps) {
  const completed = lessons.filter(
    (lesson) => lesson.status === "completed"
  ).length
  const progress = lessons.length ? (completed / lessons.length) * 100 : 0

  return (
    <section
      className={cn(
        "mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-6",
        className
      )}
      aria-labelledby="lesson-path-title"
      data-testid="lesson-timeline"
    >
      <header className="grid gap-5 border-b pb-5 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-end">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-primary">
            <MapIcon className="size-4" aria-hidden="true" />
            <p className="ink-label">{roundLabel ?? `Round ${roundNumber}`}</p>
          </div>
          <h2
            id="lesson-path-title"
            className="mt-2 font-heading text-2xl leading-tight font-black tracking-[-0.03em] sm:text-3xl"
          >
            {title}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-bold">Round progress</p>
            <p className="font-mono text-xs font-bold text-muted-foreground">
              {completed} / {lessons.length}
            </p>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={`Round ${roundNumber} lesson progress`}
            aria-valuemin={0}
            aria-valuemax={lessons.length}
            aria-valuenow={completed}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {lessons.length ? (
        <ol className="mx-auto mt-6 max-w-4xl">
          {lessons.map((lesson, index) => {
            const interactive =
              lesson.status !== "locked" &&
              lesson.status !== "completed" &&
              Boolean(onSelectLesson)
            const expanded = lesson.status === "current"
            const content = (
              <LessonContent
                lesson={lesson}
                index={index}
                interactive={interactive}
                expanded={expanded}
              />
            )

            return (
              <li
                key={lesson.id}
                className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3 pb-3 last:pb-0"
                data-status={lesson.status}
              >
                <div className="relative col-start-1 row-start-1 flex justify-center">
                  {index < lessons.length - 1 ? (
                    <span
                      className="absolute top-10 bottom-[-0.75rem] left-1/2 w-px -translate-x-1/2 bg-border"
                      aria-hidden="true"
                    />
                  ) : null}
                  <span
                    className={cn(
                      "relative z-10 flex size-10 items-center justify-center rounded-full border-2",
                      NODE_STYLE[lesson.status]
                    )}
                    aria-hidden="true"
                  >
                    <StatusIcon status={lesson.status} />
                  </span>
                </div>

                {interactive ? (
                  <button
                    type="button"
                    className={cn(
                      "group col-start-2 row-start-1 w-full self-start rounded-xl text-left transition duration-200 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none motion-reduce:transition-none",
                      lesson.status === "current"
                        ? "border-2 border-primary bg-secondary px-5 py-4 shadow-[0_10px_24px_rgb(16_33_63_/_0.07)] hover:-translate-y-0.5"
                        : "border border-border bg-background px-4 py-3 hover:border-primary/50 hover:bg-secondary/40"
                    )}
                    onClick={() => onSelectLesson?.(lesson)}
                    disabled={busy}
                    aria-label={`${STATUS_COPY[lesson.status]} lesson: ${lesson.title}`}
                  >
                    {content}
                  </button>
                ) : (
                  <div
                    className={cn(
                      "col-start-2 row-start-1 w-full self-start rounded-xl border",
                      expanded ? "px-5 py-4" : "px-4 py-3",
                      lesson.status === "locked"
                        ? "border-transparent bg-muted/45 text-muted-foreground"
                        : "border-border bg-background"
                    )}
                  >
                    {content}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="py-16 text-center">
          <p className="font-heading text-xl font-black">
            Your next lesson round is being prepared.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            The full lesson path will appear here when it is ready.
          </p>
        </div>
      )}
    </section>
  )
}
