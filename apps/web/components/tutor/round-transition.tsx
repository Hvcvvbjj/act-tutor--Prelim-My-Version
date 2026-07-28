"use client"

import { ArrowRightIcon, Clock3Icon } from "lucide-react"

import { ScoutMark } from "@/components/tutor/scout"
import { Button } from "@/components/ui/button"

interface RoundTransitionProps {
  roundNumber: number
  completedSkills: number
  totalSkills: number
  busy?: boolean
  onDiagnostic: () => void
  onFullTest: () => void
}

export function RoundTransition({
  roundNumber,
  busy = false,
  onDiagnostic,
  onFullTest,
}: RoundTransitionProps) {
  return (
    <main
      data-hide-global-footer
      id="main-content"
      tabIndex={-1}
      className="min-h-svh bg-[var(--canvas)] px-5 py-10 text-foreground sm:px-8 lg:py-16"
    >
      <div className="mx-auto max-w-4xl">
        <section className="mx-auto max-w-3xl text-center">
          <ScoutMark mood="correct" className="mx-auto size-16" />
          <p className="ink-label mt-5 text-primary">Mr. Kim</p>
          <h1 className="mt-4 font-heading text-5xl leading-[1.02] font-black tracking-[-0.04em] sm:text-6xl">
            Round {roundNumber} complete.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
            Choose your next assessment.
          </p>
        </section>

        <section
          className="mt-12 grid gap-5 md:grid-cols-2"
          aria-labelledby="assessment-choice-title"
        >
          <h2 id="assessment-choice-title" className="sr-only">
            Choose your next assessment
          </h2>
          <article className="flex flex-col border border-border bg-background p-6 sm:p-8">
            <h3 className="font-heading text-3xl font-bold">
              Take another diagnostic
            </h3>
            <p className="mt-3 flex-1 leading-7 text-muted-foreground">
              66 questions for a fresh skill profile.
            </p>
            <p className="mt-5 flex items-center gap-2 text-sm">
              <Clock3Icon aria-hidden="true" /> About 63 minutes
            </p>
            <Button
              type="button"
              size="xl"
              className="mt-7"
              disabled={busy}
              onClick={onDiagnostic}
            >
              Take diagnostic
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </article>

          <article className="flex flex-col border border-border bg-background p-6 sm:p-8">
            <h3 className="font-heading text-3xl font-bold">
              Take a full-length practice test
            </h3>
            <p className="mt-3 flex-1 leading-7 text-muted-foreground">
              131 questions with full test timing.
            </p>
            <p className="mt-5 flex items-center gap-2 text-sm">
              <Clock3Icon aria-hidden="true" /> 125 minutes
            </p>
            <Button
              type="button"
              size="xl"
              className="mt-7"
              disabled={busy}
              onClick={onFullTest}
            >
              Take full-length test
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </article>
        </section>
      </div>
    </main>
  )
}
