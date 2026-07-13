"use client"

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Clock3Icon,
  ShieldCheckIcon,
} from "lucide-react"

import { ScoutCoach, ScoutMark } from "@/components/tutor/scout"
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
  [
    "English",
    "25 questions · 18-minute target",
    "Half of the enhanced ACT's 50-question section",
  ],
  [
    "Math",
    "23 questions · 25-minute target",
    "Half of the enhanced ACT's 45-question section, rounded up",
  ],
  [
    "Reading",
    "18 questions · 20-minute target",
    "Half of the enhanced ACT's 36-question section",
  ],
] as const

export function DiagnosticIntro({
  goal,
  testDate,
  onBack,
  onStart,
}: DiagnosticIntroProps) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="flex h-20 items-center gap-3 border-b-2 border-foreground px-5 sm:px-8 lg:px-12">
        <ScoutMark className="size-11" />
        <p className="font-heading text-2xl font-black tracking-tight">
          SCOUT ACT
        </p>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-12 sm:px-10 sm:py-16">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          Back to setup
        </Button>
        <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
          <section>
            <p className="ink-label text-primary">No ACT score yet</p>
            <h1 className="mt-3 font-heading text-5xl leading-[0.95] font-black tracking-[-0.035em] sm:text-7xl">
              Let’s find your starting score.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-7 text-muted-foreground">
              You&apos;re aiming for {goal} by {formatCalendarDate(testDate)}.
              You do not need to guess where you stand. Your answers will show
              Scout which skills are strong and which need work.
            </p>

            <div className="mt-10 border-y-2 border-foreground py-7">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-heading text-3xl font-bold">
                    Half-length ACT-style diagnostic
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    66 original questions · about 63 minutes
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

            <ScoutCoach
              className="mt-8 max-w-2xl"
              mood="ready"
              message="This is long enough to expose patterns, not just lucky guesses. You can save and return at any point."
              detail="Questions remain original and are organized in ACT-style passage and four-choice formats. Results are still estimated practice ranges, not official ACT scores."
            />

            <Alert className="mt-8 max-w-2xl bg-[var(--info-surface)]">
              <ShieldCheckIcon />
              <AlertTitle>Practice test, not an official ACT</AlertTitle>
              <AlertDescription>
                The 25/23/18 split is half the current English, Math, and
                Reading test. The questions are original, and your score is an
                estimate that gets better as you practice.
              </AlertDescription>
            </Alert>
          </section>

          <aside className="border-t-2 border-foreground pt-8 lg:border-t-0 lg:border-l-2 lg:pt-0 lg:pl-10">
            <p className="ink-label text-muted-foreground">
              What you&apos;ll answer
            </p>
            <dl className="mt-6 flex flex-col">
              {SECTION_BLUEPRINT.map(([section, questions, skills], index) => (
                <div key={section}>
                  {index > 0 ? <Separator /> : null}
                  <div className="py-5">
                    <dt className="font-heading text-2xl font-bold">
                      {section}
                    </dt>
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
