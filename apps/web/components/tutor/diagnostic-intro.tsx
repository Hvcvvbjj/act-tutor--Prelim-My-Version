"use client"

import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react"

import { ScoutMark } from "@/components/tutor/scout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { formatCalendarDate } from "@/lib/dates"

interface DiagnosticIntroProps {
  backLabel?: string
  error?: string | null
  goal: number
  purpose?: "baseline" | "round"
  testDate: string
  onBack: () => void
  onStart: () => void
}

const SECTION_BLUEPRINT = [
  ["English", "25 questions · 18-minute target"],
  ["Math", "23 questions · 25-minute target"],
  ["Reading", "18 questions · 20-minute target"],
] as const

export function DiagnosticIntro({
  backLabel,
  error,
  goal,
  purpose = "baseline",
  testDate,
  onBack,
  onStart,
}: DiagnosticIntroProps) {
  return (
    <div
      data-hide-global-footer
      className="min-h-svh bg-background text-foreground"
    >
      <header className="flex h-20 items-center gap-3 border-b-2 border-foreground px-5 sm:px-8 lg:px-12">
        <ScoutMark className="size-11" />
        <p className="font-brand text-2xl font-black tracking-tight">
          SCOUT ACT
        </p>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-5xl px-5 py-12 sm:px-10 sm:py-16"
      >
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          {backLabel ??
            (purpose === "round"
              ? "Return to assessment choice"
              : "Change my starting information")}
        </Button>
        <section className="mx-auto mt-10 max-w-3xl">
          <p className="ink-label text-primary">
            {purpose === "round" ? "Next lesson round" : "Starting diagnostic"}
          </p>
          <h1 className="mt-3 font-heading text-4xl leading-[1.02] font-black tracking-[-0.03em] sm:text-6xl">
            {purpose === "round"
              ? "Find what to study next."
              : "Find your starting point."}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            66 original questions across English, Math, and Reading · about 63
            minutes · autosaves as you go.
          </p>

          <div className="mt-9 flex items-center gap-4 border-y-2 border-foreground py-7">
            <Button type="button" size="xl" onClick={onStart}>
              Start diagnostic
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              I&apos;ll use this result to build a plan for your {goal} goal on{" "}
              {formatCalendarDate(testDate)}.
            </p>
          </div>

          {error ? (
            <Alert role="alert" className="mt-6">
              <AlertTitle>Couldn&apos;t start the diagnostic</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <details className="group mt-7">
            <summary className="cursor-pointer text-sm font-bold text-primary">
              What&apos;s included
            </summary>
            <dl className="mt-4 grid border-y sm:grid-cols-3 sm:divide-x">
              {SECTION_BLUEPRINT.map(([section, questions]) => (
                <div key={section} className="p-4">
                  <dt className="font-heading text-xl font-bold">{section}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">
                    {questions}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </section>
      </main>
    </div>
  )
}
