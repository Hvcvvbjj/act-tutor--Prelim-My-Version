"use client"

import { useState } from "react"
import Image from "next/image"
import { MessageCircleMoreIcon, SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ScoutMood = "ready" | "thinking" | "correct" | "repair"

const MOOD_COPY: Record<ScoutMood, string> = {
  ready: "Here’s the key idea.",
  thinking: "Take another look at the question.",
  correct: "Correct. Keep going.",
  repair: "Not quite. Check the first step and try again.",
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
        "scout-float relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--scout-sun)] bg-[#071832] shadow-[0_5px_18px_rgb(2_13_31_/_0.26)]",
        mood === "thinking" && "scout-thinking",
        mood === "correct" && "scout-celebrate",
        className
      )}
      role="img"
      aria-label={`Mr. Kim, Scout's AI tutor, is ${mood}`}
    >
      <Image
        src="/images/mr-kim.png"
        alt=""
        fill
        sizes="144px"
        className="scale-[1.42] object-cover object-[50%_19%]"
        priority={false}
      />
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
  speakerName = "Mr. Kim",
  className,
}: {
  mood?: ScoutMood
  message?: string
  detail?: string
  speakerName?: string
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
          {speakerName} says
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
              {expanded ? "Hide detail" : "More detail"}
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
