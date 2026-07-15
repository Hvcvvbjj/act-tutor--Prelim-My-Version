"use client"

import { calendarDaysUntil } from "@act-tutor/core"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  LockKeyholeIcon,
  MinusIcon,
  PlayCircleIcon,
  PlusIcon,
  TargetIcon,
  TrendingUpIcon,
} from "lucide-react"

import { ScoutCoach, ScoutMark } from "@/components/tutor/scout"
import type { PlacementDraft } from "@/components/tutor/types"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { formatCalendarDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

interface OnboardingProps {
  draft: PlacementDraft
  error: string | null
  step: number
  today: string
  onBack: () => void
  onContinue: () => void
  onJudgeDemo: () => void
  onUpdate: (update: Partial<PlacementDraft>) => void
}

const STEP_LABELS = ["Goal", "Scores", "Schedule"] as const

interface ScoreFieldProps {
  id: string
  label: string
  value: number
  error?: string | null
  onChange: (value: number) => void
}

function ScoreField({ id, label, value, error, onChange }: ScoreFieldProps) {
  return (
    <Field data-invalid={Boolean(error)} className="gap-2">
      <FieldLabel htmlFor={id} className="text-sm font-semibold">
        {label}
      </FieldLabel>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={36}
        value={value || ""}
        aria-label={`${label} ACT score`}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-12 w-full text-lg font-semibold tabular-nums"
      />
      <FieldError>{error}</FieldError>
    </Field>
  )
}

function errorForScore(error: string | null, label: string) {
  return error?.startsWith(`${label} score`) ? error : null
}

function StepTracker({ step }: { step: number }) {
  return (
    <nav aria-label="Setup progress" className="mx-auto max-w-3xl">
      <ol className="grid grid-cols-3">
        {STEP_LABELS.map((label, index) => {
          const number = index + 1
          const active = number === step
          const complete = number < step
          return (
            <li
              key={label}
              className="relative flex items-center justify-center gap-2 px-1 text-sm sm:gap-3 sm:text-base"
            >
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-1/2 right-[calc(50%+3.25rem)] left-0 h-px -translate-y-1/2",
                    complete || active ? "bg-primary" : "bg-border"
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex size-8 items-center justify-center rounded-full border bg-background text-sm font-bold",
                  active && "border-primary bg-primary text-primary-foreground",
                  complete && "border-primary text-primary",
                  !active && !complete && "text-muted-foreground"
                )}
              >
                {number}
              </span>
              <span
                className={cn(
                  "relative z-10 hidden bg-background px-1 font-semibold sm:inline",
                  active ? "text-primary" : "text-foreground"
                )}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function PlanSummary({
  draft,
  today,
}: {
  draft: PlacementDraft
  today: string
}) {
  let daysToTest = 0
  try {
    daysToTest = Math.max(0, calendarDaysUntil(today, draft.testDate))
  } catch {
    daysToTest = 0
  }

  return (
    <aside className="hidden rounded-xl border bg-background p-5 lg:sticky lg:top-24 lg:block">
      <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
        Your starting plan
      </p>
      <dl className="mt-5 divide-y">
        <div className="flex items-center gap-4 py-4 first:pt-0">
          <TargetIcon className="size-6 text-primary" aria-hidden="true" />
          <div>
            <dt className="text-sm text-muted-foreground">Goal</dt>
            <dd className="text-2xl font-bold tabular-nums">{draft.goal}</dd>
          </div>
        </div>
        <div className="flex items-center gap-4 py-4">
          <TrendingUpIcon
            className="size-6 text-[var(--scout-coral)]"
            aria-hidden="true"
          />
          <div>
            <dt className="text-sm text-muted-foreground">Current</dt>
            <dd className="text-lg font-bold">
              {draft.priorScoreChoice === "never"
                ? "Quick Check"
                : draft.composite}
            </dd>
          </div>
        </div>
        <div className="flex items-center gap-4 py-4 last:pb-0">
          <CalendarDaysIcon
            className="size-6 text-primary"
            aria-hidden="true"
          />
          <div>
            <dt className="text-sm text-muted-foreground">Next ACT</dt>
            <dd className="font-bold">
              {daysToTest ? `${daysToTest} days` : "Choose a date"}
            </dd>
            {draft.testDate ? (
              <dd className="mt-0.5 text-xs text-muted-foreground">
                {formatCalendarDate(draft.testDate)}
              </dd>
            ) : null}
          </div>
        </div>
      </dl>
    </aside>
  )
}

export function Onboarding({
  draft,
  error,
  step,
  today,
  onBack,
  onContinue,
  onJudgeDemo,
  onUpdate,
}: OnboardingProps) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="flex h-16 items-center gap-2.5 border-b px-5 sm:px-8">
        <ScoutMark className="size-9" />
        <p className="font-heading text-xl font-black tracking-tight">
          SCOUT <span className="text-primary">ACT</span>
        </p>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 sm:py-10">
        <StepTracker step={step} />

        <div className="mt-9 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-14">
          <section className="min-w-0">
            <h1 className="font-heading text-4xl leading-tight font-black tracking-[-0.025em] sm:text-5xl">
              Build your study plan
            </h1>
            <p className="mt-2 text-base leading-7 text-muted-foreground">
              Three quick steps, then Scout gives you today&apos;s first lesson.
            </p>

            <div
              key={step}
              className="mt-8 animate-in duration-200 fade-in slide-in-from-right-2 motion-reduce:animate-none"
            >
              {step === 1 ? (
                <FieldSet>
                  <FieldLegend className="text-xl font-bold sm:text-2xl">
                    What score are you aiming for?
                  </FieldLegend>
                  <FieldDescription className="mt-2">
                    ACT Composite scores run from 1 to 36.
                  </FieldDescription>
                  <div className="mt-7 flex max-w-lg items-center gap-5 sm:gap-8">
                    <Button
                      type="button"
                      size="icon-lg"
                      variant="outline"
                      aria-label="Decrease goal score"
                      disabled={draft.goal <= 1}
                      onClick={() => onUpdate({ goal: draft.goal - 1 })}
                    >
                      <MinusIcon />
                    </Button>
                    <div className="min-w-28 text-center" aria-live="polite">
                      <p className="text-6xl font-black tracking-[-0.05em] text-primary tabular-nums">
                        {draft.goal}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Goal Composite
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon-lg"
                      variant="outline"
                      aria-label="Increase goal score"
                      disabled={draft.goal >= 36}
                      onClick={() => onUpdate({ goal: draft.goal + 1 })}
                    >
                      <PlusIcon />
                    </Button>
                  </div>
                </FieldSet>
              ) : null}

              {step === 2 ? (
                <FieldSet>
                  <FieldLegend className="text-xl font-bold sm:text-2xl">
                    What scores do you have now?
                  </FieldLegend>
                  <FieldDescription className="mt-2">
                    Use what you know. Scout can fill the gaps with a short
                    Quick Check.
                  </FieldDescription>
                  <RadioGroup
                    value={draft.priorScoreChoice}
                    onValueChange={(value) =>
                      onUpdate({
                        priorScoreChoice:
                          value as PlacementDraft["priorScoreChoice"],
                      })
                    }
                    className="mt-6 grid gap-3 md:grid-cols-3"
                  >
                    {[
                      ["scores", "I have section scores"],
                      ["composite_only", "I only know my Composite"],
                      ["never", "I haven’t taken the ACT"],
                    ].map(([value, label]) => (
                      <FieldLabel
                        key={value}
                        className={cn(
                          "cursor-pointer rounded-lg border p-4 text-sm transition-colors",
                          draft.priorScoreChoice === value &&
                            "border-primary bg-secondary"
                        )}
                      >
                        <Field orientation="horizontal">
                          <RadioGroupItem value={value} />
                          <FieldContent>
                            <span className="font-semibold">{label}</span>
                          </FieldContent>
                        </Field>
                      </FieldLabel>
                    ))}
                  </RadioGroup>

                  {draft.priorScoreChoice !== "never" ? (
                    <div className="mt-6 grid gap-4 rounded-xl border p-5 sm:grid-cols-2">
                      <ScoreField
                        id="composite"
                        label="Composite"
                        value={draft.composite}
                        error={errorForScore(error, "Composite")}
                        onChange={(composite) => onUpdate({ composite })}
                      />
                      {draft.priorScoreChoice === "scores" ? (
                        <>
                          <ScoreField
                            id="english"
                            label="English"
                            value={draft.english}
                            error={errorForScore(error, "English")}
                            onChange={(english) => onUpdate({ english })}
                          />
                          <ScoreField
                            id="math"
                            label="Math"
                            value={draft.math}
                            error={errorForScore(error, "Math")}
                            onChange={(math) => onUpdate({ math })}
                          />
                          <ScoreField
                            id="reading"
                            label="Reading"
                            value={draft.reading}
                            error={errorForScore(error, "Reading")}
                            onChange={(reading) => onUpdate({ reading })}
                          />
                        </>
                      ) : null}
                      <Field
                        orientation="horizontal"
                        className="rounded-lg border px-4 py-3 sm:col-span-2"
                      >
                        <FieldContent>
                          <FieldLabel htmlFor="science-toggle">
                            Taking Science?
                          </FieldLabel>
                          <FieldDescription>Optional</FieldDescription>
                        </FieldContent>
                        <Switch
                          id="science-toggle"
                          checked={draft.scienceEnabled}
                          onCheckedChange={(scienceEnabled) =>
                            onUpdate({ scienceEnabled })
                          }
                        />
                      </Field>
                      {draft.scienceEnabled ? (
                        <ScoreField
                          id="science"
                          label="Science"
                          value={draft.science}
                          error={errorForScore(error, "Science")}
                          onChange={(science) => onUpdate({ science })}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <ScoutCoach
                      className="mt-6 max-w-2xl"
                      mood="ready"
                      message="No score is fine. Scout will start with an 8–12 question Quick Check."
                      detail="It stops when it has enough evidence to choose a useful first lesson."
                    />
                  )}
                </FieldSet>
              ) : null}

              {step === 3 ? (
                <FieldSet>
                  <FieldLegend className="text-xl font-bold sm:text-2xl">
                    When can you study?
                  </FieldLegend>
                  <FieldDescription className="mt-2">
                    Scout uses this to keep your plan realistic.
                  </FieldDescription>

                  <div className="mt-6 grid gap-6">
                    <Field data-invalid={Boolean(error)}>
                      <FieldLabel htmlFor="test-date">Next ACT date</FieldLabel>
                      <Input
                        id="test-date"
                        type="date"
                        min={today}
                        value={draft.testDate}
                        aria-invalid={Boolean(error)}
                        onChange={(event) =>
                          onUpdate({ testDate: event.target.value })
                        }
                        className="h-12 max-w-sm text-base"
                      />
                      <FieldError>{error}</FieldError>
                    </Field>

                    <Field>
                      <FieldLabel>Study days each week</FieldLabel>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {[2, 3, 4, 5, 6].map((days) => (
                          <Button
                            key={days}
                            type="button"
                            variant={
                              draft.studyDaysPerWeek === days
                                ? "secondary"
                                : "outline"
                            }
                            className="h-12"
                            onClick={() => onUpdate({ studyDaysPerWeek: days })}
                          >
                            {days} days
                          </Button>
                        ))}
                      </div>
                    </Field>

                    <Field>
                      <FieldLabel>Minutes each study day</FieldLabel>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[15, 30, 45, 60].map((minutes) => (
                          <Button
                            key={minutes}
                            type="button"
                            variant={
                              draft.minutesPerSession === minutes
                                ? "secondary"
                                : "outline"
                            }
                            className="h-12"
                            onClick={() =>
                              onUpdate({ minutesPerSession: minutes })
                            }
                          >
                            {minutes} min
                          </Button>
                        ))}
                      </div>
                    </Field>

                    <Field>
                      <FieldLabel>Main focus</FieldLabel>
                      <RadioGroup
                        value={draft.preferredSection}
                        onValueChange={(preferredSection) =>
                          onUpdate({
                            preferredSection:
                              preferredSection as PlacementDraft["preferredSection"],
                          })
                        }
                        className="grid gap-2 sm:grid-cols-4"
                      >
                        {[
                          ["balanced", "Best score gain"],
                          ["english", "English"],
                          ["math", "Math"],
                          ["reading", "Reading"],
                        ].map(([value, label]) => (
                          <FieldLabel
                            key={value}
                            className={cn(
                              "cursor-pointer rounded-lg border p-3",
                              draft.preferredSection === value &&
                                "border-primary bg-secondary"
                            )}
                          >
                            <Field orientation="horizontal">
                              <RadioGroupItem value={value} />
                              <FieldContent>
                                <span className="font-semibold">{label}</span>
                              </FieldContent>
                            </Field>
                          </FieldLabel>
                        ))}
                      </RadioGroup>
                    </Field>
                  </div>
                </FieldSet>
              ) : null}
            </div>

            <div className="mt-8 flex max-w-2xl gap-3">
              {step > 1 ? (
                <Button
                  type="button"
                  size="xl"
                  variant="outline"
                  onClick={onBack}
                  className="min-w-28"
                >
                  <ArrowLeftIcon data-icon="inline-start" />
                  Back
                </Button>
              ) : null}
              <Button
                type="button"
                size="xl"
                onClick={onContinue}
                className="flex-1"
              >
                {step === 3
                  ? draft.priorScoreChoice === "never"
                    ? "Start Quick Check"
                    : "Build my plan"
                  : "Continue"}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </div>

            {step === 3 ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <LockKeyholeIcon className="size-4" aria-hidden="true" />
                You can change your schedule and learning settings later.
              </p>
            ) : null}

            {step === 1 ? (
              <div className="mt-5 flex max-w-2xl flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LockKeyholeIcon className="size-4" aria-hidden="true" />
                  No account needed.
                </p>
                <Button
                  type="button"
                  variant="link"
                  onClick={onJudgeDemo}
                  className="h-auto px-0 font-bold"
                >
                  <PlayCircleIcon data-icon="inline-start" />
                  See one answer change the plan
                </Button>
              </div>
            ) : null}
          </section>

          <PlanSummary draft={draft} today={today} />
        </div>
      </main>
    </div>
  )
}
