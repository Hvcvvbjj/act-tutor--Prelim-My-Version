"use client"

import { useEffect, useState } from "react"
import type { CoreSection } from "@act-tutor/core"
import { ExternalLinkIcon, XIcon } from "lucide-react"

import { ScoutMark } from "@/components/tutor/scout"
import { Button } from "@/components/ui/button"

const SECTION_LABELS: Record<CoreSection, string> = {
  english: "English",
  math: "Math",
  reading: "Reading",
}

const VIDEO_SEARCHES: Record<
  CoreSection,
  ReadonlyArray<{ label: string; href: string }>
> = {
  english: [
    {
      label: "Official ACT English sample class",
      href: "https://www.youtube.com/watch?v=_20T1ChRC3c",
    },
  ],
  math: [
    {
      label: "Official ACT Math sample class",
      href: "https://www.youtube.com/watch?v=DZcQjK-j48c",
    },
  ],
  reading: [
    {
      label: "Official ACT Reading sample class",
      href: "https://www.youtube.com/watch?v=1ch7hkuR8tQ",
    },
  ],
}

interface GoalSupportPromptProps {
  currentScore: number
  goalScore: number
  weakestSection: CoreSection
  focusSkill?: string
  assessmentRound: number
  onAskMrKim: () => void
}

export function GoalSupportPrompt({
  currentScore,
  goalScore,
  weakestSection,
  focusSkill,
  assessmentRound,
  onAskMrKim,
}: GoalSupportPromptProps) {
  const [open, setOpen] = useState(false)
  const storageKey = `scout-goal-support-${assessmentRound}-${currentScore}-${goalScore}-${weakestSection}`
  const gap = goalScore - currentScore
  const showAfterAssessment = assessmentRound > 1

  useEffect(() => {
    if (
      !showAfterAssessment ||
      gap < 2 ||
      window.localStorage.getItem(storageKey) === "seen"
    )
      return
    const show = () => setOpen(true)
    if (window.localStorage.getItem("scout-dashboard-tour-v2") === "done") {
      const timer = window.setTimeout(show, 1_200)
      return () => window.clearTimeout(timer)
    }
    window.addEventListener("scout:tour-complete", show, { once: true })
    return () => window.removeEventListener("scout:tour-complete", show)
  }, [gap, showAfterAssessment, storageKey])

  if (!open || !showAfterAssessment || gap < 2) return null

  const close = () => {
    window.localStorage.setItem(storageKey, "seen")
    setOpen(false)
  }

  return (
    <aside
      role="dialog"
      aria-label="Mr. Kim goal-score support"
      className="fixed right-5 bottom-5 z-[60] w-[min(25rem,calc(100vw-2.5rem))] rounded-2xl border-2 border-foreground bg-background p-5 shadow-[8px_8px_0_rgb(16_33_63_/_0.18)]"
    >
      <div className="flex items-start gap-3">
        <ScoutMark className="size-14" mood="ready" />
        <div className="min-w-0 flex-1">
          <p className="ink-label text-primary">Mr. Kim check-in</p>
          <h2 className="mt-2 font-heading text-xl leading-tight font-black">
            You&apos;re not at {goalScore} yet. That&apos;s okay.
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mt-2 -mr-2"
          aria-label="Dismiss score support"
          onClick={close}
        >
          <XIcon />
        </Button>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Your latest assessment estimate is {currentScore}. Start with{" "}
        {focusSkill ? `${focusSkill} in ` : ""}
        {SECTION_LABELS[weakestSection]}, then come back for a short practice
        set.
      </p>
      <ul className="mt-4 grid gap-2">
        {VIDEO_SEARCHES[weakestSection].map((video) => (
          <li key={video.label}>
            <a
              href={video.href}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm font-bold transition-colors hover:border-primary hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              {video.label}
              <ExternalLinkIcon className="size-4 shrink-0" />
            </a>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        className="mt-4 w-full"
        onClick={() => {
          close()
          onAskMrKim()
        }}
      >
        Ask Mr. Kim what to study
      </Button>
    </aside>
  )
}
