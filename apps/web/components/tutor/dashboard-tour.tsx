"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeftIcon, ArrowRightIcon, XIcon } from "lucide-react"

import {
  spotlightRect,
  type TourSpotlightRect,
} from "@/components/tutor/dashboard-tour-geometry"
import { ScoutMark } from "@/components/tutor/scout"
import { Button } from "@/components/ui/button"

export const DASHBOARD_TOUR_STORAGE_KEY = "scout-dashboard-tour-v2"

const TOUR_STEPS = [
  {
    target: "lesson-path",
    eyebrow: "Your lesson path",
    title: "Your path through this round.",
    copy: "The highlighted lesson is next. Finished lessons stay marked as you move down the path.",
  },
  {
    target: "lesson-action",
    eyebrow: "Next action",
    title: "Continue from here.",
    copy: "This button opens the lesson, practice, or review step that is ready now.",
  },
  {
    target: "nav-week",
    eyebrow: "My Week",
    title: "See when the work fits.",
    copy: "See your spaced study plan and change its days or minutes.",
  },
  {
    target: "nav-diagnostic",
    eyebrow: "Full Diagnostic",
    title: "Build a new baseline.",
    copy: "Take the timed 66-question diagnostic now or use it to shape a later round.",
  },
  {
    target: "nav-practice",
    eyebrow: "Timed Practice",
    title: "Practice under section conditions.",
    copy: "Run a full English, Math, or Reading section with a countdown, or take a full-length core test.",
  },
  {
    target: "nav-progress",
    eyebrow: "Progress",
    title: "See what your answers changed.",
    copy: "Review skill estimates, scored evidence, and the priorities Scout sees next.",
  },
  {
    target: "nav-badges",
    eyebrow: "Badges",
    title: "Track your study momentum.",
    copy: "See streak, mastery, consistency, and milestone badges in one place.",
  },
  {
    target: "mr-kim",
    eyebrow: "Mr. Kim",
    title: "Ask for help without leaving the page.",
    copy: "Mr. Kim uses the question, lesson, and plan context on this screen. During a timed test, he protects test conditions.",
  },
  {
    target: "settings",
    eyebrow: "Settings",
    title: "Make Scout fit how you learn.",
    copy: "Change explanation style, accessibility, goal and schedule, or open Data & privacy. You can replay this tour here too.",
  },
] as const

interface TourRect extends TourSpotlightRect {
  radius: number
}

function tourTarget(target: string) {
  return document.querySelector<HTMLElement>(`[data-tour-id="${target}"]`)
}

function boundedRect(element: HTMLElement): TourRect | null {
  const targetRect = element.getBoundingClientRect()
  const rect = spotlightRect(targetRect, {
    width: window.innerWidth,
    height: window.innerHeight,
  })
  if (!rect) return null
  const targetRadius = Number.parseFloat(
    window.getComputedStyle(element).borderTopLeftRadius
  )
  return {
    ...rect,
    radius: Math.max(
      12,
      Math.min(28, (Number.isFinite(targetRadius) ? targetRadius : 4) + 8)
    ),
  }
}

export function replayDashboardTour() {
  window.localStorage.removeItem(DASHBOARD_TOUR_STORAGE_KEY)
  window.dispatchEvent(new Event("scout:replay-tour"))
}

export function DashboardTour() {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<TourRect | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const step = TOUR_STEPS[index]

  const measure = useCallback(() => {
    const target = tourTarget(step.target)
    setRect(target ? boundedRect(target) : null)
  }, [step.target])

  const revealTarget = useCallback(() => {
    const target = tourTarget(step.target)
    if (!target) {
      setRect(null)
      return
    }
    const targetBounds = target.getBoundingClientRect()
    const fullyVisible =
      targetBounds.top >= 6 &&
      targetBounds.left >= 6 &&
      targetBounds.bottom <= window.innerHeight - 6 &&
      targetBounds.right <= window.innerWidth - 6
    if (!fullyVisible) {
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block:
          targetBounds.height > window.innerHeight - 48 ? "start" : "center",
        inline: "center",
      })
    }
    setRect(boundedRect(target))
  }, [step.target])

  useEffect(() => {
    const openTour = () => {
      if (!window.matchMedia("(min-width: 1024px)").matches) return
      setIndex(0)
      setOpen(true)
    }
    const alreadySeen =
      window.localStorage.getItem(DASHBOARD_TOUR_STORAGE_KEY) === "done"
    if (!alreadySeen) {
      const timer = window.setTimeout(openTour, 550)
      window.addEventListener("scout:replay-tour", openTour)
      return () => {
        window.clearTimeout(timer)
        window.removeEventListener("scout:replay-tour", openTour)
      }
    }
    window.addEventListener("scout:replay-tour", openTour)
    return () => window.removeEventListener("scout:replay-tour", openTour)
  }, [])

  useEffect(() => {
    if (!open) return
    const target = tourTarget(step.target)
    const frame = window.requestAnimationFrame(revealTarget)
    const delayed = window.setTimeout(revealTarget, 120)
    const settled = window.setTimeout(revealTarget, 520)
    const poll = window.setInterval(revealTarget, 300)
    const resizeObserver = new ResizeObserver(measure)
    if (target) resizeObserver.observe(target)
    window.addEventListener("resize", revealTarget)
    window.addEventListener("scroll", measure, true)
    dialogRef.current?.focus({ preventScroll: true })
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(delayed)
      window.clearTimeout(settled)
      window.clearInterval(poll)
      resizeObserver.disconnect()
      window.removeEventListener("resize", revealTarget)
      window.removeEventListener("scroll", measure, true)
    }
  }, [measure, open, revealTarget, step.target])

  const close = useCallback(() => {
    window.localStorage.setItem(DASHBOARD_TOUR_STORAGE_KEY, "done")
    window.dispatchEvent(new Event("scout:tour-complete"))
    setOpen(false)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
      if (event.key === "ArrowRight") {
        setIndex((current) => Math.min(TOUR_STEPS.length - 1, current + 1))
      }
      if (event.key === "ArrowLeft") {
        setIndex((current) => Math.max(0, current - 1))
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [close, open])

  const dialogStyle = useMemo(() => {
    if (!rect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }
    }
    const width = Math.min(420, window.innerWidth - 32)
    const below = window.innerHeight - rect.bottom
    const top = below >= 310 ? rect.bottom + 18 : Math.max(16, rect.top - 286)
    const left = Math.min(
      window.innerWidth - width - 16,
      Math.max(16, rect.left + rect.width / 2 - width / 2)
    )
    return { top, left, width, transform: "none" }
  }, [rect])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90]" aria-live="polite">
      {rect ? (
        <>
          <div
            className="absolute inset-x-0 top-0 bg-[#020918]/78 backdrop-blur-[2px] transition-[height] duration-300 ease-out motion-reduce:transition-none"
            style={{ height: rect.top }}
          />
          <div
            className="absolute left-0 bg-[#020918]/78 backdrop-blur-[2px] transition-[top,width,height] duration-300 ease-out motion-reduce:transition-none"
            style={{
              top: rect.top,
              width: rect.left,
              height: rect.height,
            }}
          />
          <div
            className="absolute right-0 bg-[#020918]/78 backdrop-blur-[2px] transition-[top,width,height] duration-300 ease-out motion-reduce:transition-none"
            style={{
              top: rect.top,
              width: window.innerWidth - rect.right,
              height: rect.height,
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 bg-[#020918]/78 backdrop-blur-[2px] transition-[top] duration-300 ease-out motion-reduce:transition-none"
            style={{ top: rect.bottom }}
          />
          <div
            data-tour-spotlight={step.target}
            className="pointer-events-auto absolute border-2 border-[var(--scout-coral)] shadow-[0_0_0_6px_rgb(242_138_59_/_0.2),0_0_42px_rgb(242_138_59_/_0.42)] ring-2 ring-background transition-[top,left,width,height,border-radius] duration-300 ease-out motion-reduce:transition-none"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              borderRadius: rect.radius,
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-[#020918]/78 backdrop-blur-[2px]" />
      )}

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Scout dashboard tour, step ${index + 1} of ${TOUR_STEPS.length}`}
        tabIndex={-1}
        className="fixed max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-foreground/25 bg-background text-foreground shadow-[0_26px_80px_rgb(0_0_0_/_0.38)] transition-[top,left] duration-300 ease-out outline-none motion-reduce:transition-none"
        style={dialogStyle}
      >
        <div className="h-1 bg-border" aria-hidden="true">
          <div
            className="h-full bg-[var(--scout-coral)] transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${((index + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>
        <div className="p-5">
          <div className="flex items-start gap-3">
            <ScoutMark className="size-11" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-[0.65rem] font-black tracking-[0.12em] text-primary uppercase">
                  {step.eyebrow}
                </p>
                <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[0.6rem] font-black tracking-[0.08em] text-muted-foreground uppercase">
                  Step {index + 1} of {TOUR_STEPS.length}
                </span>
              </div>
              <h2 className="mt-2 font-heading text-2xl leading-tight font-black">
                {step.title}
              </h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-mt-2 -mr-2"
              aria-label="Skip website tour"
              onClick={close}
            >
              <XIcon />
            </Button>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {step.copy}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border bg-secondary/55 px-5 py-4">
          <Button
            type="button"
            variant="ghost"
            disabled={index === 0}
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Back
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (index === TOUR_STEPS.length - 1) {
                close()
                return
              }
              setIndex((current) => current + 1)
            }}
          >
            {index === TOUR_STEPS.length - 1 ? "Finish tour" : "Next"}
            {index < TOUR_STEPS.length - 1 ? (
              <ArrowRightIcon data-icon="inline-end" />
            ) : null}
          </Button>
        </div>
      </div>
    </div>
  )
}
