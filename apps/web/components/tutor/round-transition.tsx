"use client"

import {
  ArrowRightIcon,
  ClipboardCheckIcon,
  Clock3Icon,
  RouteIcon,
} from "lucide-react"

import { ScoutCoach, ScoutMark } from "@/components/tutor/scout"
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
  completedSkills,
  totalSkills,
  busy = false,
  onDiagnostic,
  onFullTest,
}: RoundTransitionProps) {
  const foundationComplete = roundNumber === 1
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-svh bg-[var(--canvas)] px-5 py-10 text-foreground sm:px-8 lg:py-16"
    >
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center gap-3">
          <ScoutMark className="size-11" />
          <div>
            <p className="font-brand text-lg font-black">Scout ACT</p>
            <p className="text-xs text-muted-foreground">
              Mr. Kim is a fictional AI study coach.
            </p>
          </div>
        </header>

        <section className="mt-10 grid gap-10 border-y-2 border-foreground py-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:gap-16">
          <div>
            <p className="ink-label text-primary">
              {foundationComplete
                ? "Foundation round complete"
                : `Targeted round ${roundNumber} complete`}
            </p>
            <h1 className="mt-4 max-w-3xl font-heading text-5xl leading-[0.98] font-black tracking-[-0.04em] sm:text-6xl">
              Nice work. Let’s measure what changed.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              You finished {completedSkills} of {totalSkills} required question
              types in round {roundNumber}. Your next result will decide which
              skills lead the next lesson round.
            </p>
          </div>
          <ScoutCoach
            mood="correct"
            message={
              foundationComplete
                ? "You learned the map before I asked you to race through it. Now choose how much evidence you want for the next route."
                : `You finished the skills selected for round ${roundNumber}. Now choose how much new evidence should shape round ${roundNumber + 1}.`
            }
            detail="Both choices update later lesson priorities. The diagnostic is shorter. The full-length practice test also lets you rehearse pacing."
          />
        </section>

        <section
          className="mt-10 grid gap-5 md:grid-cols-2"
          aria-labelledby="assessment-choice-title"
        >
          <h2 id="assessment-choice-title" className="sr-only">
            Choose your next assessment
          </h2>
          <article className="paper-panel flex flex-col border-2 border-foreground bg-background p-6 sm:p-8">
            <span className="flex size-12 items-center justify-center border-2 border-foreground bg-[var(--coach-surface)]">
              <ClipboardCheckIcon aria-hidden="true" />
            </span>
            <p className="ink-label mt-7 text-primary">Shorter route</p>
            <h3 className="mt-2 font-heading text-4xl font-bold">
              Take another diagnostic
            </h3>
            <p className="mt-4 flex-1 text-sm leading-6 text-muted-foreground">
              66 questions across English, Math, and Reading. Best when you want
              a fresh skill profile without a full test-day rehearsal.
            </p>
            <p className="mt-5 flex items-center gap-2 text-sm font-semibold">
              <Clock3Icon aria-hidden="true" /> About 63 minutes
            </p>
            <Button
              type="button"
              size="xl"
              className="mt-7"
              disabled={busy}
              onClick={onDiagnostic}
            >
              Choose diagnostic
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </article>

          <article className="paper-panel flex flex-col border-2 border-primary bg-[var(--info-surface)] p-6 sm:p-8">
            <span className="flex size-12 items-center justify-center border-2 border-foreground bg-primary text-primary-foreground">
              <RouteIcon aria-hidden="true" />
            </span>
            <p className="ink-label mt-7 text-primary">Full rehearsal</p>
            <h3 className="mt-2 font-heading text-4xl font-bold">
              Take a full-length practice test
            </h3>
            <p className="mt-4 flex-1 text-sm leading-6 text-muted-foreground">
              131 original core questions with full English, Math, and Reading
              timing. Best when pacing is part of what you want to practice.
            </p>
            <p className="mt-5 flex items-center gap-2 text-sm font-semibold">
              <Clock3Icon aria-hidden="true" /> 125 minutes
            </p>
            <Button
              type="button"
              size="xl"
              className="mt-7"
              disabled={busy}
              onClick={onFullTest}
            >
              Choose full-length test
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </article>
        </section>
      </div>
    </main>
  )
}
