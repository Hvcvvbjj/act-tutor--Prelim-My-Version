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
      aria-label={`Mr. Kim tutor is ${mood}`}
    >
      <svg
        viewBox="0 0 120 120"
        className="size-full drop-shadow-sm"
        aria-hidden="true"
      >
        <path d="M21 53 29 48v23l-6-3Z" fill="var(--scout-coral)" />
        <path d="m99 53-8-5v23l6-3Z" fill="var(--scout-coral)" />
        <path d="m60 22 34 22-7 43-27 16-27-16-7-43Z" fill="var(--scout-sun)" />
        <path
          d="m26 44 34 14-27 29Z"
          fill="color-mix(in srgb, var(--scout-sun), var(--scout-coral) 11%)"
        />
        <path
          d="m94 44-34 14 27 29Z"
          fill="color-mix(in srgb, var(--scout-sun), var(--foreground) 6%)"
        />
        <path
          d="m26 44 7-18 27-10 29 8 5 20-17-9-9-10-20 10-12 9Z"
          fill="var(--foreground)"
        />
        <path d="m77 35 17 9-5 21-6-15Z" fill="var(--foreground)" />

        <path
          d="m33 59 6-5h13l5 5-4 13-14 1-6-7Zm54 0-6-5H68l-5 5 4 13 14 1 6-7Z"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="4.5"
          strokeLinejoin="round"
        />
        <path
          d="M57 61h6"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="4.5"
          strokeLinecap="round"
        />

        {mood === "thinking" ? (
          <>
            <path d="m37 48 13-3 4 3-16 3Z" fill="var(--foreground)" />
            <path d="m67 47 14 1 2 4-16-2Z" fill="var(--foreground)" />
            <circle cx="46" cy="64" r="4" fill="var(--foreground)" />
            <circle cx="74" cy="64" r="4" fill="var(--foreground)" />
            <circle cx="47.5" cy="62.5" r="1.5" fill="var(--scout-mint)" />
            <circle cx="75.5" cy="62.5" r="1.5" fill="var(--scout-mint)" />
            <path d="m54 91 6-2 6 2-6 3Z" fill="var(--scout-coral)" />
          </>
        ) : mood === "correct" ? (
          <>
            <path d="m37 47 15-2 3 4-17 2Z" fill="var(--foreground)" />
            <path d="m65 49 3-4 15 2-1 4Z" fill="var(--foreground)" />
            <path
              d="m40 64 6 4 7-4m14 0 7 4 6-4"
              fill="none"
              stroke="var(--foreground)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="m51 89 9 8 10-9-10 4Z" fill="var(--scout-coral)" />
          </>
        ) : mood === "repair" ? (
          <>
            <path d="m37 46 16 4-2 4-15-5Z" fill="var(--foreground)" />
            <path d="m67 50 16-4 1 3-15 5Z" fill="var(--foreground)" />
            <circle cx="46" cy="65" r="4" fill="var(--foreground)" />
            <circle cx="74" cy="65" r="4" fill="var(--foreground)" />
            <circle cx="47" cy="63.5" r="1.5" fill="var(--scout-mint)" />
            <circle cx="75" cy="63.5" r="1.5" fill="var(--scout-mint)" />
            <path d="m52 94 8-5 8 5-8-2Z" fill="var(--scout-coral)" />
          </>
        ) : (
          <>
            <path d="m37 48 15-2 3 4-17 2Z" fill="var(--foreground)" />
            <path d="m65 50 3-4 15 2-1 4Z" fill="var(--foreground)" />
            <circle cx="46" cy="64" r="4" fill="var(--foreground)" />
            <circle cx="74" cy="64" r="4" fill="var(--foreground)" />
            <circle cx="47.5" cy="62.5" r="1.5" fill="var(--scout-mint)" />
            <circle cx="75.5" cy="62.5" r="1.5" fill="var(--scout-mint)" />
            <path d="m51 89 9 6 10-7-10 3Z" fill="var(--scout-coral)" />
          </>
        )}

        <path d="m56 72 4 8 5-2-5 6Z" fill="var(--scout-coral)" />
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
          Mr. Kim says
        </p>
        <p className="mt-1.5 text-sm leading-6">{message ?? MOOD_COPY[mood]}</p>
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
