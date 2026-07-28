"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeftIcon, ArrowRightIcon, XIcon } from "lucide-react"

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

interface TourRect {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

function boundedRect(element: Element): TourRect {
  const rect = element.getBoundingClientRect()
  const padding = 8
  const top = Math.max(6, rect.top - padding)
  const left = Math.max(6, rect.left - padding)
  const right = Math.min(window.innerWidth - 6, rect.right + padding)
  const bottom = Math.min(window.innerHeight - 6, rect.bottom + padding)
  return {
    top,
    left,
    right,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
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
    const target = document.querySelector(`[data-tour-id="${step.target}"]`)
    setRect(target ? boundedRect(target) : null)
  }, [step.target])

  useEffect(() => {
    const openTour = () => {
      if (!window.matchMedia("(min-width: 900px)").matches) return
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
    const frame = window.requestAnimationFrame(measure)
    const delayed = window.setTimeout(measure, 120)
    const poll = window.setInterval(measure, 300)
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", measure, true)
    dialogRef.current?.focus({ preventScroll: true })
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(delayed)
      window.clearInterval(poll)
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", measure, true)
    }
  }, [measure, open])

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
            className="absolute inset-x-0 top-0 bg-[#020918]/82 backdrop-blur-[1px]"
            style={{ height: rect.top }}
          />
          <div
            className="absolute left-0 bg-[#020918]/82 backdrop-blur-[1px]"
            style={{
              top: rect.top,
              width: rect.left,
              height: rect.height,
            }}
          />
          <div
            className="absolute right-0 bg-[#020918]/82 backdrop-blur-[1px]"
            style={{
              top: rect.top,
              width: window.innerWidth - rect.right,
              height: rect.height,
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 bg-[#020918]/82 backdrop-blur-[1px]"
            style={{ top: rect.bottom }}
          />
          <div
            className="pointer-events-auto absolute rounded-xl border-2 border-primary shadow-[0_0_0_4px_rgb(242_138_59_/_0.22),0_0_32px_rgb(242_138_59_/_0.3)]"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-[#020918]/82 backdrop-blur-[1px]" />
      )}

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Scout dashboard tour, step ${index + 1} of ${TOUR_STEPS.length}`}
        tabIndex={-1}
        className="fixed max-w-[calc(100vw-2rem)] rounded-2xl border-2 border-foreground bg-background p-5 text-foreground shadow-[0_22px_70px_rgb(0_0_0_/_0.32)] outline-none"
        style={dialogStyle}
      >
        <div className="flex items-start gap-3">
          <ScoutMark className="size-12" />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[0.65rem] font-black tracking-[0.12em] text-primary uppercase">
              {step.eyebrow} · {index + 1} of {TOUR_STEPS.length}
            </p>
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
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
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
            {index === TOUR_STEPS.length - 1 ? "Start studying" : "Next"}
            {index < TOUR_STEPS.length - 1 ? (
              <ArrowRightIcon data-icon="inline-end" />
            ) : null}
          </Button>
        </div>
      </div>
    </div>
  )
}
