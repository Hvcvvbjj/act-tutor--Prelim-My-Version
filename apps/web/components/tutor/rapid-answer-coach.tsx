"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  emptyRapidAnswerTracker,
  recordRapidAnswer,
} from "@/components/tutor/rapid-answer-pace"
import { ScoutMark } from "@/components/tutor/scout"
import { Button } from "@/components/ui/button"

export function useRapidAnswerCoach(
  scopeKey: string,
  answeredQuestionIds: ReadonlyArray<string> = []
) {
  const trackerRef = useRef({
    scopeKey,
    tracker: emptyRapidAnswerTracker(answeredQuestionIds),
  })
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [promptScope, setPromptScope] = useState<string | null>(null)

  const recordAnswer = useCallback(
    (questionId: string) => {
      if (trackerRef.current.scopeKey !== scopeKey) {
        trackerRef.current = {
          scopeKey,
          tracker: emptyRapidAnswerTracker(answeredQuestionIds),
        }
      }
      const update = recordRapidAnswer(
        trackerRef.current.tracker,
        questionId,
        performance.now()
      )
      trackerRef.current.tracker = update.tracker
      if (!update.shouldPrompt) return
      previousFocusRef.current = document.activeElement as HTMLElement | null
      setPromptScope(scopeKey)
    },
    [answeredQuestionIds, scopeKey]
  )

  const dismiss = useCallback(() => {
    setPromptScope(null)
    window.requestAnimationFrame(() => previousFocusRef.current?.focus())
  }, [])

  return {
    dismiss,
    open: promptScope === scopeKey,
    recordAnswer,
  }
}

export function RapidAnswerCoachDialog({
  open,
  onDismiss,
}: {
  open: boolean
  onDismiss: () => void
}) {
  const actionRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => actionRef.current?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [onDismiss, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[85] grid place-items-center bg-[#020918]/72 px-4 backdrop-blur-[2px]">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="rapid-answer-coach-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-foreground/20 bg-background shadow-[0_26px_80px_rgb(0_0_0_/_0.38)]"
      >
        <div className="h-1 bg-[var(--scout-coral)]" aria-hidden="true" />
        <div className="p-6 sm:p-7">
          <div className="flex items-center gap-4">
            <ScoutMark className="size-14 shrink-0" mood="ready" />
            <div>
              <p className="ink-label text-primary">Mr. Kim pace check</p>
              <h2
                id="rapid-answer-coach-title"
                className="mt-2 font-heading text-2xl leading-tight font-black"
              >
                Slow down for the next one.
              </h2>
            </div>
          </div>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            You answered 10 questions in under 30 seconds. Take a breath and
            read every choice before you move on.
          </p>
          <Button
            ref={actionRef}
            type="button"
            size="lg"
            className="mt-6 w-full"
            onClick={onDismiss}
          >
            I&apos;ll slow down
          </Button>
        </div>
      </section>
    </div>
  )
}
