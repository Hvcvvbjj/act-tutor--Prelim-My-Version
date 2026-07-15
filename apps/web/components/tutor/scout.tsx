"use client"

import { useState } from "react"
import { MessageCircleMoreIcon, SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ScoutMood = "ready" | "thinking" | "correct" | "repair"

const MOOD_COPY: Record<ScoutMood, string> = {
  ready: "I’ll show you the rule, then you’ll try it on a new question.",
  thinking: "Slow down and ask what the question is really testing.",
  correct: "Correct. Now explain why the other close answer is wrong.",
  repair: "Not quite. Find the first step where your reasoning went off track.",
}

export function ScoutMark({
  mood = "ready",
  className,
}: {
  mood?: ScoutMood
  className?: string
}) {
  return (
    <div
      className={cn(
        "scout-float relative flex size-20 shrink-0 items-center justify-center",
        mood === "thinking" && "scout-thinking",
        mood === "correct" && "scout-celebrate",
        className
      )}
      role="img"
      aria-label={`Scout tutor is ${mood}`}
    >
      <svg
        viewBox="0 0 120 120"
        className="size-full drop-shadow-sm"
        aria-hidden="true"
      >
        <path d="M15 27 43 39 31 67Z" fill="var(--scout-coral)" />
        <path d="m105 27-28 12 12 28Z" fill="var(--scout-coral)" />
        <path d="m15 27 22 5 6 7Z" fill="var(--scout-sun)" />
        <path d="m105 27-22 5-6 7Z" fill="var(--scout-sun)" />
        <path d="m60 24 35 23-8 45-27 18-27-18-8-45Z" fill="var(--primary)" />
        <path
          d="m25 47 35 12-27 33Z"
          fill="color-mix(in srgb, var(--primary), #ffffff 18%)"
        />
        <path
          d="m95 47-35 12 27 33Z"
          fill="color-mix(in srgb, var(--primary), #000000 12%)"
        />
        <path d="m60 59 27 33-27 18-27-18Z" fill="var(--scout-paper)" />
        <path d="m51 66 9 8-9 5-7-6Z" fill="var(--foreground)" />
        <path d="m69 66-9 8 9 5 7-6Z" fill="var(--foreground)" />
        <circle cx="51" cy="71" r="2.5" fill="var(--scout-mint)" />
        <circle cx="69" cy="71" r="2.5" fill="var(--scout-mint)" />
        <path d="m54 89 6 5 6-5-6-4Z" fill="var(--scout-coral)" />
        <path d="m83 25 5-14 5 2-7 15Z" fill="var(--scout-sun)" />
        <path d="m88 11 2-5 5 2-2 5Z" fill="var(--foreground)" />
      </svg>
      {mood === "correct" ? (
        <SparklesIcon
          className="absolute -top-1 -right-1 text-[var(--scout-sun)]"
          aria-hidden="true"
        />
      ) : null}
    </div>
  )
}

export function ScoutCoach({
  mood = "ready",
  message,
  detail,
  className,
}: {
  mood?: ScoutMood
  message?: string
  detail?: string
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <aside
      className={cn(
        "scout-coach grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3",
        className
      )}
    >
      <ScoutMark mood={mood} className="size-12" />
      <div className="relative rounded-lg border border-primary/25 bg-[var(--info-surface)] px-4 py-3">
        <p className="text-xs font-black tracking-[0.1em] text-primary uppercase">
          Scout says
        </p>
        <p className="mt-1.5 text-sm leading-6">
          {message ?? MOOD_COPY[mood]}
        </p>
        {detail ? (
          <>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="mt-2 h-auto p-0"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
            >
              <MessageCircleMoreIcon data-icon="inline-start" />
              {expanded ? "Hide coaching note" : "Why this matters"}
            </Button>
            {expanded ? (
              <p className="mt-3 border-t pt-3 text-sm leading-6 text-muted-foreground">
                {detail}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </aside>
  )
}
