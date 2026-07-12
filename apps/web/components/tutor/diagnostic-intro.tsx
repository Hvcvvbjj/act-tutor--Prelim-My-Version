"use client"

import { useState } from "react"
import { ArrowLeftIcon, CheckCircle2Icon, Clock3Icon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { formatCalendarDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

interface DiagnosticIntroProps {
  goal: number
  testDate: string
  onBack: () => void
}

const DIAGNOSTIC_MODES = {
  half: {
    title: "Half-length diagnostic",
    action: "half diagnostic",
    detail: "66 questions · about 63 minutes · strongest baseline",
    blueprintLabel: "Half-length blueprint",
    sections: [
      ["English", "25 questions", "18 min"],
      ["Math", "23 questions", "25 min"],
      ["Reading", "18 questions", "20 min"],
    ],
  },
  rapid: {
    title: "Rapid estimate",
    action: "rapid estimate",
    detail: "24 questions · about 25 minutes · wider score range",
    blueprintLabel: "Rapid-estimate blueprint",
    sections: [
      ["English", "9 questions", "8 min"],
      ["Math", "8 questions", "9 min"],
      ["Reading", "7 questions", "8 min"],
    ],
  },
} as const

type DiagnosticMode = keyof typeof DIAGNOSTIC_MODES

export function DiagnosticIntro({
  goal,
  testDate,
  onBack,
}: DiagnosticIntroProps) {
  const [mode, setMode] = useState<DiagnosticMode>("half")
  const [configured, setConfigured] = useState(false)
  const selectedMode = DIAGNOSTIC_MODES[mode]

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
              You&apos;re aiming for {goal} by {formatCalendarDate(testDate)}. A
              diagnostic gives the plan real skill evidence instead of guessing
              from an overall score.
            </p>

            <RadioGroup
              value={mode}
              onValueChange={(value) => {
                setMode(value as DiagnosticMode)
                setConfigured(false)
              }}
              className="mt-10 gap-3"
            >
              {(
                Object.entries(DIAGNOSTIC_MODES) as Array<
                  [DiagnosticMode, (typeof DIAGNOSTIC_MODES)[DiagnosticMode]]
                >
              ).map(([value, option]) => (
                <FieldLabel
                  key={value}
                  className={cn(
                    "cursor-pointer border p-5",
                    mode === value && "border-primary bg-primary/5"
                  )}
                >
                  <Field orientation="horizontal">
                    <RadioGroupItem value={value} />
                    <FieldContent>
                      <span className="font-semibold">{option.title}</span>
                      <FieldDescription>{option.detail}</FieldDescription>
                    </FieldContent>
                  </Field>
                </FieldLabel>
              ))}
            </RadioGroup>

            <Button
              type="button"
              size="xl"
              className="mt-8"
              onClick={() => setConfigured(true)}
            >
              Configure {selectedMode.action}
            </Button>

            {configured ? (
              <Alert className="mt-6 max-w-2xl bg-[var(--info-surface)]">
                <CheckCircle2Icon />
                <AlertTitle>{selectedMode.title} route configured</AlertTitle>
                <AlertDescription>
                  This mode and its section timing are ready. Original reviewed
                  questions and scoring are the next content milestone in the
                  36-day roadmap.
                </AlertDescription>
              </Alert>
            ) : null}
          </section>

          <aside
            aria-live="polite"
            className="border-t pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10"
          >
            <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
              {selectedMode.blueprintLabel}
            </p>
            <dl className="mt-6 flex flex-col">
              {selectedMode.sections.map(
                ([section, questions, time], index) => (
                  <div key={section}>
                    {index > 0 ? <Separator /> : null}
                    <div className="grid grid-cols-[1fr_auto] gap-2 py-5">
                      <dt className="font-semibold">{section}</dt>
                      <dd className="text-right text-sm text-muted-foreground">
                        {questions}
                        <span className="mt-1 flex items-center justify-end gap-1">
                          <Clock3Icon aria-hidden="true" />
                          {time}
                        </span>
                      </dd>
                    </div>
                  </div>
                )
              )}
            </dl>
            <p className="mt-6 text-sm leading-6 text-muted-foreground">
              Results will be labeled an estimated practice range—not an
              official ACT score.
            </p>
          </aside>
        </div>
      </main>
    </div>
  )
}
