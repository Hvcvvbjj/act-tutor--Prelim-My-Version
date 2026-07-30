"use client"

import { useEffect, useRef, useState } from "react"

import { ScoutMark } from "@/components/tutor/scout"
import { cn } from "@/lib/utils"

const TRANSITION_COPY = {
  preparing: [
    "Choosing a balanced set of questions.",
    "Checking section coverage and timing.",
    "Keeping answer keys hidden for test conditions.",
  ],
  scoring: [
    "Checking every saved response.",
    "Building your section and composite scores.",
    "Organizing missed questions for History.",
  ],
} as const

export interface AlexActTransitionFrame {
  elapsedMs: number
  delayed: boolean
  motionActive: boolean
  messageIndex: number
  progress: number
  completionDelayMs: number | null
}

export function alexActTransitionFrame(input: {
  elapsedMs: number
  ready: boolean
  reducedMotion: boolean
  maximumMs: number
  copyLength: number
}): AlexActTransitionFrame {
  const maximumMs = Math.max(1, input.maximumMs)
  const elapsedMs = Math.min(
    maximumMs,
    Math.max(0, Number.isFinite(input.elapsedMs) ? input.elapsedMs : 0)
  )
  const reachedMaximum = elapsedMs >= maximumMs
  const delayed = reachedMaximum && !input.ready
  const motionActive = !input.reducedMotion && !reachedMaximum
  const messageIndex = input.reducedMotion
    ? 0
    : delayed
      ? Math.max(0, input.copyLength - 1)
      : Math.min(Math.max(0, input.copyLength - 1), Math.floor(elapsedMs / 900))
  const progress = input.reducedMotion
    ? input.ready
      ? 100
      : 36
    : input.ready
      ? 100
      : Math.min(94, Math.max(8, (elapsedMs / maximumMs) * 100))

  return {
    elapsedMs,
    delayed,
    motionActive,
    messageIndex,
    progress,
    completionDelayMs: input.ready
      ? motionActive
        ? Math.max(0, Math.min(220, maximumMs - elapsedMs))
        : 0
      : null,
  }
}

export function AlexActTransition({
  kind,
  ready,
  onComplete,
  minimumMs = 850,
  maximumMs = 7_000,
}: {
  kind: keyof typeof TRANSITION_COPY
  ready: boolean
  onComplete: () => void
  minimumMs?: number
  maximumMs?: number
}) {
  const [elapsed, setElapsed] = useState(0)
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
  const startedAt = useRef(0)
  const finished = useRef(false)
  const completionTimeout = useRef<number | null>(null)

  useEffect(() => {
    startedAt.current = performance.now()
    let interval: number | null = null
    const deadline = window.setTimeout(() => {
      if (interval !== null) {
        window.clearInterval(interval)
        interval = null
      }
      setElapsed(maximumMs)
    }, maximumMs)
    if (!reducedMotion) {
      interval = window.setInterval(() => {
        const nextElapsed = Math.min(
          maximumMs,
          performance.now() - startedAt.current
        )
        setElapsed(nextElapsed)
        if (nextElapsed >= maximumMs && interval !== null) {
          window.clearInterval(interval)
          interval = null
        }
      }, 120)
    }
    return () => {
      window.clearTimeout(deadline)
      if (interval !== null) window.clearInterval(interval)
      if (completionTimeout.current !== null) {
        window.clearTimeout(completionTimeout.current)
      }
    }
  }, [maximumMs, reducedMotion])

  const copy = TRANSITION_COPY[kind]
  const frame = alexActTransitionFrame({
    elapsedMs: elapsed,
    ready,
    reducedMotion,
    maximumMs,
    copyLength: copy.length,
  })

  useEffect(() => {
    const effectiveMinimum = reducedMotion ? 0 : Math.min(minimumMs, maximumMs)
    if (
      !ready ||
      frame.elapsedMs < effectiveMinimum ||
      finished.current ||
      frame.completionDelayMs === null
    ) {
      return
    }
    finished.current = true
    completionTimeout.current = window.setTimeout(
      () => onComplete(),
      frame.completionDelayMs
    )
  }, [
    frame.completionDelayMs,
    frame.elapsedMs,
    maximumMs,
    minimumMs,
    onComplete,
    ready,
    reducedMotion,
  ])

  return (
    <main
      data-hide-global-footer
      id="main-content"
      tabIndex={-1}
      className="flex min-h-svh items-center justify-center bg-white px-5 text-foreground"
      role="status"
      aria-live="polite"
      aria-busy={!ready}
      aria-label={
        frame.delayed
          ? "AlexACT is still waiting safely for the assessment"
          : kind === "preparing"
            ? "AlexACT is preparing the assessment"
            : "AlexACT is scoring the assessment"
      }
    >
      <section className="w-full max-w-2xl text-center">
        <div className="mx-auto flex w-fit items-center gap-3">
          <ScoutMark className="size-12" />
          <span className="font-brand text-2xl font-black tracking-[-0.03em]">
            Alex<span className="text-primary">ACT</span>
          </span>
        </div>
        <p className="ink-label mt-10 text-primary">
          {frame.delayed
            ? "Still working"
            : kind === "preparing"
              ? "Preparing your set"
              : "Building your results"}
        </p>
        <h1 className="mx-auto mt-3 max-w-xl font-heading text-4xl leading-tight font-black tracking-[-0.03em] sm:text-5xl">
          {frame.delayed
            ? "This is taking longer than usual."
            : kind === "preparing"
              ? "Your next questions are almost ready."
              : "Turning your answers into a useful next step."}
        </h1>
        <p className="mx-auto mt-5 min-h-7 max-w-lg text-base leading-7 text-muted-foreground">
          {frame.delayed
            ? "Your saved answers are safe. AlexACT is still waiting for the result, so you do not need to restart."
            : copy[frame.messageIndex]}
        </p>
        <div
          className="mx-auto mt-10 h-2 max-w-lg overflow-hidden rounded-full bg-[var(--secondary)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(frame.progress)}
          aria-valuetext={
            frame.delayed
              ? "Waiting for the saved assessment result"
              : undefined
          }
          aria-label={
            kind === "preparing"
              ? "Question preparation progress"
              : "Assessment scoring progress"
          }
        >
          <div
            className={cn(
              "h-full rounded-full bg-primary transition-[width] duration-300 ease-out",
              !frame.motionActive && "transition-none"
            )}
            data-motion-active={frame.motionActive}
            style={{ width: `${frame.progress}%` }}
          />
        </div>
        <p className="mt-4 text-xs font-semibold text-muted-foreground">
          {ready
            ? "Ready."
            : frame.delayed
              ? "Waiting safely for the result."
              : "This usually takes only a moment."}
        </p>
      </section>
    </main>
  )
}
