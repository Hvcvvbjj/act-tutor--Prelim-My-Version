"use client"

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Clock3Icon,
  ShieldCheckIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { formatCalendarDate } from "@/lib/dates"

interface DiagnosticIntroProps {
  goal: number
  testDate: string
  onBack: () => void
  onStart: () => void
}

const SECTION_BLUEPRINT = [
  ["English", "4 reviewed questions", "Boundaries + concision"],
  ["Math", "4 reviewed questions", "Equations + functions"],
  ["Reading", "4 reviewed questions", "Central ideas + inference"],
] as const

export function DiagnosticIntro({
  goal,
  testDate,
  onBack,
  onStart,
}: DiagnosticIntroProps) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="flex h-20 items-center border-b px-5 sm:px-8 lg:px-12">
        <p className="text-lg font-bold tracking-tight sm:text-xl">
          AI ACT Tutor
        </p>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-12 sm:px-10 sm:py-16">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          Back to setup
        </Button>
        <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
          <section>
            <h1 className="text-4xl font-bold tracking-[-0.035em] sm:text-5xl">
              Let&apos;s find your baseline.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-7 text-muted-foreground">
              You&apos;re aiming for {goal} by {formatCalendarDate(testDate)}.
              This working diagnostic uses direct skill evidence instead of
              asking you to guess a current score.
            </p>

            <div className="mt-10 border-y py-7">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xl font-bold">
                    Reviewed starter diagnostic
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    12 original questions · about 12 minutes
                  </p>
                </div>
                <span className="mt-3 flex items-center gap-2 text-sm font-semibold text-primary sm:mt-0">
                  <Clock3Icon aria-hidden="true" />
                  Autosaves as you go
                </span>
              </div>
            </div>

            <Button type="button" size="xl" className="mt-8" onClick={onStart}>
              Start diagnostic
              <ArrowRightIcon data-icon="inline-end" />
            </Button>

            <Alert className="mt-8 max-w-2xl bg-[var(--info-surface)]">
              <ShieldCheckIcon />
              <AlertTitle>Real evidence, intentionally wide range</AlertTitle>
              <AlertDescription>
                This is the first reviewed content slice, not the finished
                half-length form. Its result is an estimated practice range and
                feeds the same planner without claiming official ACT precision.
              </AlertDescription>
            </Alert>
          </section>

          <aside className="border-t pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
            <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
              Current blueprint
            </p>
            <dl className="mt-6 flex flex-col">
              {SECTION_BLUEPRINT.map(([section, questions, skills], index) => (
                <div key={section}>
                  {index > 0 ? <Separator /> : null}
                  <div className="py-5">
                    <dt className="font-semibold">{section}</dt>
                    <dd className="mt-1 text-sm text-muted-foreground">
                      {questions}
                    </dd>
                    <dd className="mt-1 text-sm text-muted-foreground">
                      {skills}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </main>
    </div>
  )
}
