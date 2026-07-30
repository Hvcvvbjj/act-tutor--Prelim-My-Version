"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeftIcon, ArrowRightIcon, XIcon } from "lucide-react"

import {
  spotlightRect,
  tourDialogPlacement,
  type TourSpotlightRect,
} from "@/components/tutor/dashboard-tour-geometry"
import { ScoutMark } from "@/components/tutor/scout"
import { Button } from "@/components/ui/button"

export const DASHBOARD_TOUR_STORAGE_KEY = "scout-dashboard-tour-v3"

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
    eyebrow: "My Schedule",
    title: "See when the work fits.",
    copy: "See your spaced study plan and change its days or minutes.",
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
    copy: "Review skill estimates, scored evidence, and the priorities AlexACT sees next.",
  },
  {
    target: "nav-history",
    eyebrow: "History",
    title: "Return to every missed question.",
    copy: "See your exact answer, the correct answer, reviewed reasoning, and an Ask Mr. Kim action in one place.",
  },
  {
    target: "nav-needs-work",
    eyebrow: "Needs Work",
    title: "Turn weak skills into actions.",
    copy: "See the question types below your goal threshold, ask Mr. Kim for a worked example, or open a free video explanation.",
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
    title: "Make AlexACT fit how you learn.",
    copy: "Change explanation style, accessibility, goal and schedule, or open Data & privacy. You can replay this tour here too.",
  },
] as const

type DashboardTourStep = (typeof TOUR_STEPS)[number]

function availableTourSteps(includeNeedsWork: boolean) {
  return TOUR_STEPS.filter(
    (step) => includeNeedsWork || step.target !== "nav-needs-work"
  ) as ReadonlyArray<DashboardTourStep>
}

interface TourRect extends TourSpotlightRect {
  radius: number
}

function tourTarget(target: string) {
  return document.querySelector<HTMLElement>(`[data-tour-id="${target}"]`)
}

function viewportSize() {
  return {
    width: document.documentElement.clientWidth || window.innerWidth,
    height: document.documentElement.clientHeight || window.innerHeight,
  }
}

function boundedRect(element: HTMLElement): TourRect | null {
  const targetRect = element.getBoundingClientRect()
  const rect = spotlightRect(targetRect, viewportSize())
  if (!rect) return null
  const targetRadius = Number.parseFloat(
    window.getComputedStyle(element).borderTopLeftRadius
  )
  return {
    ...rect,
    radius: Math.max(
      10,
      Math.min(24, (Number.isFinite(targetRadius) ? targetRadius : 4) + 4)
    ),
  }
}

export function replayDashboardTour() {
  window.localStorage.removeItem(DASHBOARD_TOUR_STORAGE_KEY)
  window.dispatchEvent(new Event("scout:replay-tour"))
}

export function DashboardTour({
  includeNeedsWork = false,
}: {
  includeNeedsWork?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<TourRect | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const steps = useMemo(
    () => availableTourSteps(includeNeedsWork),
    [includeNeedsWork]
  )
  const activeIndex = Math.min(index, steps.length - 1)
  const step = steps[activeIndex]!

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
    const viewport = viewportSize()
    const targetIsInHeader = Boolean(target.closest("header"))
    const fullyVisible =
      targetBounds.top >= (targetIsInHeader ? 6 : 72) &&
      targetBounds.left >= 16 &&
      targetBounds.bottom <= viewport.height - 40 &&
      targetBounds.right <= viewport.width - 16
    if (!fullyVisible) {
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block:
          targetBounds.height > viewport.height - 48 ? "start" : "center",
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
        setIndex((current) => Math.min(steps.length - 1, current + 1))
      }
      if (event.key === "ArrowLeft") {
        setIndex((current) => Math.max(0, current - 1))
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [close, open, steps.length])

  const dialogStyle = useMemo(() => {
    const currentRect =
      rect ??
      (open && typeof document !== "undefined"
        ? (() => {
            const target = tourTarget(step.target)
            return target ? boundedRect(target) : null
          })()
        : null)
    if (!currentRect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }
    }
    const placement = tourDialogPlacement(
      currentRect,
      viewportSize(),
      { width: 420, height: 252 }
    )
    return {
      top: placement.top,
      left: placement.left,
      width: placement.width,
      transform: "none",
    }
  }, [open, rect, step.target])

  if (!open) return null
  const visibleRect =
    rect ??
    (() => {
      const target = tourTarget(step.target)
      return target ? boundedRect(target) : null
    })()

  return (
    <div className="fixed inset-0 z-[90]" aria-live="polite">
      {visibleRect ? (
        <>
          <div
            className="absolute inset-x-0 top-0 bg-[#020918]/78 backdrop-blur-[2px] transition-[height] duration-300 ease-out motion-reduce:transition-none"
            style={{ height: visibleRect.top }}
          />
          <div
            className="absolute left-0 bg-[#020918]/78 backdrop-blur-[2px] transition-[top,width,height] duration-300 ease-out motion-reduce:transition-none"
            style={{
              top: visibleRect.top,
              width: visibleRect.left,
              height: visibleRect.height,
            }}
          />
          <div
            className="absolute right-0 bg-[#020918]/78 backdrop-blur-[2px] transition-[top,width,height] duration-300 ease-out motion-reduce:transition-none"
            style={{
              top: visibleRect.top,
              width: viewportSize().width - visibleRect.right,
              height: visibleRect.height,
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 bg-[#020918]/78 backdrop-blur-[2px] transition-[top] duration-300 ease-out motion-reduce:transition-none"
            style={{ top: visibleRect.bottom }}
          />
          <div
            data-tour-spotlight={step.target}
            className="pointer-events-auto absolute shadow-[0_0_0_2px_rgb(255_255_255_/_0.92),0_0_0_6px_rgb(26_148_136_/_0.28),0_0_34px_rgb(26_148_136_/_0.34)] transition-[top,left,width,height,border-radius] duration-300 ease-out motion-reduce:transition-none"
            style={{
              top: visibleRect.top,
              left: visibleRect.left,
              width: visibleRect.width,
              height: visibleRect.height,
              borderRadius: visibleRect.radius,
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
        aria-label={`AlexACT dashboard tour, step ${activeIndex + 1} of ${steps.length}`}
        tabIndex={-1}
        className="fixed max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-foreground/25 bg-background text-foreground shadow-[0_26px_80px_rgb(0_0_0_/_0.38)] transition-[top,left] duration-300 ease-out outline-none motion-reduce:transition-none"
        style={dialogStyle}
      >
        <div className="h-1 bg-border" aria-hidden="true">
          <div
            className="h-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${((activeIndex + 1) / steps.length) * 100}%` }}
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
                  Step {activeIndex + 1} of {steps.length}
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
            disabled={activeIndex === 0}
            onClick={() => setIndex(Math.max(0, activeIndex - 1))}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Back
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (activeIndex === steps.length - 1) {
                close()
                return
              }
              setIndex(activeIndex + 1)
            }}
          >
            {activeIndex === steps.length - 1 ? "Finish tour" : "Next"}
            {activeIndex < steps.length - 1 ? (
              <ArrowRightIcon data-icon="inline-end" />
            ) : null}
          </Button>
        </div>
      </div>
    </div>
  )
}
