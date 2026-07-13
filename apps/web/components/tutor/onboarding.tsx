"use client"

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  LockKeyholeIcon,
  MinusIcon,
  PlayCircleIcon,
  PlusIcon,
} from "lucide-react"

import { ScoutCoach, ScoutMark } from "@/components/tutor/scout"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import type { PlacementDraft } from "@/components/tutor/types"
import { addCalendarDaysFrom, formatCalendarDate } from "@/lib/dates"
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

const STEP_LABELS = [
  "What score are you aiming for?",
  "Current score",
  "Test date",
] as const

interface ScoreFieldProps {
  id: string
  label: string
  value: number
  error?: string | null
  onChange: (value: number) => void
}

function ScoreField({ id, label, value, error, onChange }: ScoreFieldProps) {
  return (
    <Field
      orientation="responsive"
      data-invalid={Boolean(error)}
      className="border-b py-3 last:border-0"
    >
      <FieldLabel htmlFor={id} className="text-base">
        {label}
      </FieldLabel>
      <div className="w-full max-w-64">
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
          className="h-12 max-w-40 text-lg font-semibold tabular-nums"
        />
        <FieldError className="mt-2">{error}</FieldError>
      </div>
    </Field>
  )
}

function errorForScore(error: string | null, label: string) {
  return error?.startsWith(`${label} score`) ? error : null
}

function StepRail({ step }: { step: number }) {
  return (
    <aside className="hidden border-l bg-[var(--rail)] px-12 py-24 lg:block">
      <p className="mb-10 text-sm font-semibold text-foreground">
        Your plan in 3 steps
      </p>
      <ol className="flex flex-col">
        {STEP_LABELS.map((label, index) => {
          const number = index + 1
          const active = number === step
          const complete = number < step
          return (
            <li
              key={label}
              className="relative flex min-h-36 gap-4 last:min-h-0"
            >
              {number < STEP_LABELS.length ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-9 left-[17px] h-[calc(100%-2rem)] border-l-2",
                    complete ? "border-primary" : "border-dashed border-border"
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border-2 bg-background text-sm font-semibold",
                  active && "border-primary bg-primary text-primary-foreground",
                  complete && "border-primary text-primary",
                  !active && !complete && "border-border text-muted-foreground"
                )}
              >
                {number}
              </span>
              <span
                className={cn(
                  "pt-2 text-sm",
                  active
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>
      <div aria-hidden="true" className="mt-14 px-8">
        <div className="h-20 w-full rounded-[50%] border-b-2 border-l border-border" />
        <div className="ml-auto size-3 -translate-y-1 rounded-full bg-[var(--reward)]" />
      </div>
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
  const progress = (step / 3) * 100

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="flex h-20 items-center gap-3 border-b-2 border-foreground px-5 sm:px-8 lg:px-12">
        <ScoutMark className="size-11" />
        <p className="font-heading text-2xl font-black tracking-tight">
          SCOUT ACT
        </p>
      </header>

      <main className="grid min-h-[calc(100svh-5rem)] lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <section className="px-5 py-8 sm:px-10 sm:py-10 lg:px-[max(4rem,10vw)] lg:py-12">
          <div className="mx-auto max-w-3xl">
            <h1 className="max-w-3xl font-heading text-5xl leading-[0.94] font-black tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              Tell us your goal. We’ll build your study plan.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Answer three quick questions. Then Scout will show you what to
              study.
            </p>

            <div className="mt-8 sm:mt-10">
              <div className="mb-3 flex items-center justify-between text-sm font-semibold text-primary">
                <span>{step} of 3</span>
                <span className="sr-only">
                  {Math.round(progress)}% complete
                </span>
              </div>
              <Progress
                value={progress}
                aria-label={`Onboarding step ${step} of 3`}
              />
            </div>

            <div
              key={step}
              className="mt-8 animate-in duration-300 fade-in slide-in-from-right-3 motion-reduce:animate-none sm:mt-10"
            >
              {step === 1 ? (
                <FieldSet>
                  <FieldLegend className="text-xl font-bold sm:text-2xl">
                    What score are you aiming for?
                  </FieldLegend>
                  <div className="mt-7 flex max-w-xl items-center justify-between gap-5 sm:gap-10">
                    <Button
                      type="button"
                      size="score"
                      variant="outline"
                      aria-label="Decrease goal score"
                      disabled={draft.goal <= 1}
                      onClick={() => onUpdate({ goal: draft.goal - 1 })}
                    >
                      <MinusIcon />
                    </Button>
                    <div className="min-w-28 text-center" aria-live="polite">
                      <p className="text-7xl font-bold tracking-[-0.06em] text-primary tabular-nums sm:text-8xl">
                        {draft.goal}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">1–36</p>
                    </div>
                    <Button
                      type="button"
                      size="score"
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
                    What&apos;s your current score?
                  </FieldLegend>
                  <FieldDescription className="mt-2 max-w-2xl">
                    Section scores help us balance your plan. Short skill checks
                    will teach us the details.
                  </FieldDescription>
                  <RadioGroup
                    value={draft.priorScoreChoice}
                    onValueChange={(value) =>
                      onUpdate({
                        priorScoreChoice:
                          value as PlacementDraft["priorScoreChoice"],
                      })
                    }
                    className="mt-6 gap-3"
                  >
                    <FieldLabel
                      className={cn(
                        "cursor-pointer border p-4 text-base transition-colors",
                        draft.priorScoreChoice === "scores" &&
                          "border-primary bg-primary/5"
                      )}
                    >
                      <Field orientation="horizontal">
                        <RadioGroupItem value="scores" />
                        <FieldContent>
                          <span className="font-semibold">
                            I have ACT scores
                          </span>
                        </FieldContent>
                      </Field>
                    </FieldLabel>
                    <FieldLabel
                      className={cn(
                        "cursor-pointer border p-4 text-base transition-colors",
                        draft.priorScoreChoice === "composite_only" &&
                          "border-primary bg-primary/5"
                      )}
                    >
                      <Field orientation="horizontal">
                        <RadioGroupItem value="composite_only" />
                        <FieldContent>
                          <span className="font-semibold">
                            I only know my Composite
                          </span>
                        </FieldContent>
                      </Field>
                    </FieldLabel>
                    <FieldLabel
                      className={cn(
                        "cursor-pointer border p-4 text-base transition-colors",
                        draft.priorScoreChoice === "never" &&
                          "border-primary bg-primary/5"
                      )}
                    >
                      <Field orientation="horizontal">
                        <RadioGroupItem value="never" />
                        <FieldContent>
                          <span className="font-semibold">
                            I haven&apos;t taken the ACT yet
                          </span>
                        </FieldContent>
                      </Field>
                    </FieldLabel>
                  </RadioGroup>

                  {draft.priorScoreChoice !== "never" ? (
                    <FieldGroup className="mt-6 gap-0 border-y">
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
                      ) : (
                        <p className="border-b py-4 text-sm leading-6 text-muted-foreground">
                          We&apos;ll use your Composite as a rough starting
                          point, then ask a few questions to learn which skills
                          need the most work.
                        </p>
                      )}
                      <Field orientation="horizontal" className="py-4">
                        <FieldContent>
                          <FieldLabel
                            htmlFor="science-toggle"
                            className="text-base"
                          >
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
                    </FieldGroup>
                  ) : (
                    <ScoutCoach
                      className="mt-6 max-w-2xl"
                      mood="ready"
                      message="No score is fine. You'll take a 66-question half-length diagnostic: 25 English, 23 Math, and 18 Reading."
                      detail="It autosaves, uses original ACT-style passage and four-choice questions, and produces an estimated practice range rather than an official score."
                    />
                  )}
                </FieldSet>
              ) : null}

              {step === 3 ? (
                <FieldSet>
                  <FieldLegend className="text-xl font-bold sm:text-2xl">
                    When is your next ACT?
                  </FieldLegend>
                  <FieldDescription className="mt-2">
                    The date controls how quickly your plan moves from lessons
                    into timed practice.
                  </FieldDescription>
                  <FieldGroup className="mt-7">
                    <Field data-invalid={Boolean(error)}>
                      <FieldLabel htmlFor="test-date">Test date</FieldLabel>
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
                      <FieldLabel>Try a timeline</FieldLabel>
                      <div className="flex flex-wrap gap-2">
                        {[36, 56, 84].map((days) => {
                          const date = addCalendarDaysFrom(today, days)
                          return (
                            <Button
                              key={days}
                              type="button"
                              variant={
                                draft.testDate === date
                                  ? "secondary"
                                  : "outline"
                              }
                              size="lg"
                              onClick={() => onUpdate({ testDate: date })}
                            >
                              {days} days · {formatCalendarDate(date)}
                            </Button>
                          )
                        })}
                      </div>
                    </Field>
                  </FieldGroup>
                </FieldSet>
              ) : null}
            </div>

            <div className="mt-8 flex max-w-2xl gap-3 sm:mt-9">
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
                    ? "Continue to diagnostic"
                    : "Build my plan"
                  : "Continue"}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </div>
            {step === 1 ? (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LockKeyholeIcon aria-hidden="true" />
                  No account needed to begin.
                </p>
                <Button
                  type="button"
                  variant="link"
                  size="lg"
                  onClick={onJudgeDemo}
                  className="h-auto px-0 font-bold"
                >
                  <PlayCircleIcon data-icon="inline-start" />
                  Try the one-minute demo
                </Button>
              </div>
            ) : null}
          </div>
        </section>
        <StepRail step={step} />
      </main>
    </div>
  )
}
