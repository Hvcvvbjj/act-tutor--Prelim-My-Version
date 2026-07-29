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
  const dialogRef = useRef<HTMLDialogElement>(null)
  const actionRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return

    if (!dialog.open) dialog.showModal()
    const frame = window.requestAnimationFrame(() => actionRef.current?.focus())

    return () => {
      window.cancelAnimationFrame(frame)
      if (dialog.open) dialog.close()
    }
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="rapid-answer-coach-title"
      aria-describedby="rapid-answer-coach-description"
      onCancel={(event) => {
        event.preventDefault()
        onDismiss()
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return

        const focusable = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        )
        const first = focusable.at(0)
        const last = focusable.at(-1)
        if (!first || !last) return

        const active = document.activeElement
        if (
          first === last ||
          (event.shiftKey &&
            (active === first || !event.currentTarget.contains(active))) ||
          (!event.shiftKey && active === last)
        ) {
          event.preventDefault()
          const nextFocus = event.shiftKey ? last : first
          nextFocus.focus()
        }
      }}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect()
        const clickedBackdrop =
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        if (clickedBackdrop) onDismiss()
      }}
      className="m-auto max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-auto rounded-2xl border border-foreground/20 bg-background p-0 text-foreground shadow-[0_26px_80px_rgb(0_0_0_/_0.38)] backdrop:bg-[#020918]/72 backdrop:backdrop-blur-[2px]"
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
        <p
          id="rapid-answer-coach-description"
          className="mt-5 text-sm leading-6 text-muted-foreground"
        >
          You answered 10 questions in under 30 seconds. Take a breath and read
          every choice before you move on.
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
    </dialog>
  )
}
