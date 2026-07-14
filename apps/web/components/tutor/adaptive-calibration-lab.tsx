"use client"

import { useEffect, useRef, useState } from "react"
import type {
  AdaptiveCalibrationPayload,
  AnswerConfidence,
  CalibrationCandidateScore,
  CoreSection,
  LearningSessionPayload,
  LearningTwinImpactComparison,
  SkillSlug,
} from "@act-tutor/core"
import { compareLearningTwinSnapshots } from "@act-tutor/core"
import {
  ArrowRightIcon,
  BrainCircuitIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  CrosshairIcon,
  GaugeIcon,
  LoaderCircleIcon,
  ScanSearchIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { ScoutCoach } from "@/components/tutor/scout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

interface AdaptiveCalibrationLabProps {
  representativeDemo: boolean
  learning: LearningSessionPayload
  onLearningTwinUpdated: () => Promise<LearningSessionPayload | null>
  onInspectLearningTwin: () => void
  onReturnToToday: () => void
  onStartFullDiagnostic: () => void
  adaptiveBaselineRequired: boolean
  onUseAdaptiveBaseline: (payload: AdaptiveCalibrationPayload) => void
}

interface AdaptiveProof {
  correct: boolean
  readinessBefore: number
  readinessAfter: number
  marginBefore: number
  marginAfter: number
  learning: LearningTwinImpactComparison
}

const SECTION_LABELS: Record<CoreSection, string> = {
  english: "English",
  math: "Math",
  reading: "Reading",
}

async function calibrationRequest(
  method: "GET" | "POST",
  body?: Record<string, unknown>
) {
  const response = await fetch("/api/calibration", {
    method,
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  })
  const payload = (await response.json()) as
    AdaptiveCalibrationPayload | { error: string }
  if (!response.ok || "error" in payload) {
    throw new Error(
      "error" in payload ? payload.error : "Quick Check request failed."
    )
  }
  return payload
}

function signed(value: number) {
  if (Math.abs(value) < 0.005) return "0.00"
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}`
}

function thetaPosition(theta: number) {
  return `${Math.max(0, Math.min(100, ((theta + 3) / 6) * 100))}%`
}

function MetricRow({
  label,
  detail,
  value,
  accent = false,
}: {
  label: string
  detail: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b-2 border-border py-5 last:border-b-0">
      <div>
        <p className="font-heading text-xl font-black">{label}</p>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
      </div>
      <p
        className={cn(
          "font-heading text-3xl leading-none font-black tabular-nums",
          accent && "text-primary"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function CandidateRow({
  candidate,
  rank,
  selected,
}: {
  candidate: CalibrationCandidateScore
  rank: number
  selected: boolean
}) {
  return (
    <li
      className={cn(
        "grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-3 last:border-b-0",
        selected && "text-primary"
      )}
    >
      <span className="font-mono text-xs font-black">{rank}</span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">
          {selected ? "Current question" : candidate.skillLabel}
        </p>
        <p className="mt-0.5 truncate font-mono text-[0.62rem] text-muted-foreground uppercase">
          {SECTION_LABELS[candidate.section]} · {candidate.difficulty} question
        </p>
        <div className="mt-1 h-1.5 bg-muted">
          <div
            className={cn("h-full bg-border", selected && "bg-primary")}
            style={{
              width: `${Math.min(100, (candidate.selectionScore / 2.6) * 100)}%`,
            }}
          />
        </div>
      </div>
      <span className="text-right">
        <span className="block font-mono text-[0.55rem] font-bold text-muted-foreground uppercase">
          Usefulness
        </span>
        <span className="font-mono text-xs font-black tabular-nums">
          {candidate.selectionScore.toFixed(2)}
        </span>
      </span>
    </li>
  )
}

function percentage(value: number) {
  return `${Math.round(value * 100)}%`
}

function ChangeValue({ before, after }: { before: string; after: string }) {
  return (
    <p className="mt-4 flex flex-wrap items-baseline gap-2 font-heading text-4xl leading-none font-black tabular-nums sm:text-5xl">
      <span className="text-muted-foreground line-through decoration-2">
        {before}
      </span>
      <ArrowRightIcon className="size-6 text-primary" aria-hidden="true" />
      <span className="text-primary">{after}</span>
    </p>
  )
}

function AdaptiveProofReplay({
  proof,
  onInspectLearningTwin,
  onReturnToToday,
}: {
  proof: AdaptiveProof
  onInspectLearningTwin: () => void
  onReturnToToday: () => void
}) {
  const nextLesson = proof.learning.recommendationAfter
  const previousLesson = proof.learning.recommendationBefore

  return (
    <section
      className="mt-8 border-y-2 border-foreground"
      aria-labelledby="adaptive-proof-heading"
    >
      <div className="grid gap-8 py-9 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)] lg:items-end">
        <div>
          <div className="flex items-center gap-3 text-primary">
            <CheckCircle2Icon className="size-5" aria-hidden="true" />
            <p className="ink-label">Live proof · answer recorded</p>
          </div>
          <h2
            id="adaptive-proof-heading"
            className="mt-3 max-w-4xl font-heading text-5xl leading-[0.92] font-black tracking-[-0.035em] sm:text-7xl"
          >
            One answer changed what Scout knows about you.
          </h2>
        </div>
        <p className="border-l-2 border-primary pl-5 text-lg leading-7 text-muted-foreground">
          {proof.correct
            ? "You got it right. Here is exactly what moved."
            : "You missed it. Scout used the mistake to choose better practice."}
        </p>
      </div>

      <div className="grid border-t-2 border-foreground lg:grid-cols-3 lg:divide-x-2 lg:divide-foreground">
        <article className="py-7 lg:pr-7">
          <p className="ink-label text-muted-foreground">1 · Practice level</p>
          <ChangeValue
            before={`${proof.readinessBefore}/100`}
            after={`${proof.readinessAfter}/100`}
          />
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
            Scout&apos;s overall estimate moved. Its margin of error tightened
            from ±{proof.marginBefore.toFixed(2)} to ±
            {proof.marginAfter.toFixed(2)}.
          </p>
        </article>

        <article className="border-t-2 border-foreground py-7 lg:border-t-0 lg:px-7">
          <p className="ink-label text-muted-foreground">
            2 · {proof.learning.skillLabel}
          </p>
          <ChangeValue
            before={percentage(proof.learning.learnedBefore)}
            after={percentage(proof.learning.learnedAfter)}
          />
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
            This is Scout&apos;s estimate that you know this skill. It comes
            only from your scored answers.
          </p>
        </article>

        <article className="border-t-2 border-foreground py-7 lg:border-t-0 lg:pl-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="ink-label text-muted-foreground">3 · Next lesson</p>
            <span className="bg-foreground px-2 py-1 font-mono text-[0.62rem] font-black text-background uppercase">
              {proof.learning.recommendationChanged ? "Changed" : "Held steady"}
            </span>
          </div>
          <p className="mt-4 font-heading text-4xl leading-none font-black text-primary sm:text-5xl">
            {nextLesson.label}
          </p>
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
            {proof.learning.recommendationChanged
              ? `${nextLesson.label} moved ahead of ${previousLesson.label} because it now needs the most attention.`
              : `${previousLesson.label} stayed first because it still needs more work than ${proof.learning.skillLabel}. One answer should not make your plan jump around for no reason.`}
          </p>
        </article>
      </div>

      <div className="grid gap-6 border-t-2 border-foreground py-7 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="font-heading text-2xl font-black">
            Scout chose a question at your level. Your answer updated the skill.
            The skill ranking chose the next lesson.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Open My Skills to inspect every number and every answer behind this
            decision.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant="outline" onClick={onReturnToToday}>
            Back to today&apos;s work
          </Button>
          <Button type="button" onClick={onInspectLearningTwin}>
            <BrainCircuitIcon />
            Open My Skills
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </section>
  )
}

function ModelBand({ payload }: { payload: AdaptiveCalibrationPayload }) {
  const estimate = payload.estimate
  const previous = payload.lastFeedback?.event
  const beforeLow = previous
    ? previous.thetaBefore - 1.281552 * previous.standardErrorBefore
    : estimate.interval80.low
  const beforeHigh = previous
    ? previous.thetaBefore + 1.281552 * previous.standardErrorBefore
    : estimate.interval80.high
  const currentWidth =
    ((estimate.interval80.high - estimate.interval80.low) / 6) * 100
  const beforeWidth = ((beforeHigh - beforeLow) / 6) * 100

  return (
    <section aria-labelledby="ability-estimate-heading">
      <div className="grid grid-cols-2 divide-x-2 divide-foreground border-y-2 border-foreground">
        <div className="px-4 py-5 sm:px-6">
          <p className="ink-label text-muted-foreground">Starting level</p>
          <p className="mt-2 font-heading text-4xl font-black tabular-nums sm:text-5xl">
            {estimate.readinessIndex}/100
          </p>
        </div>
        <div className="px-4 py-5 sm:px-6">
          <p className="ink-label text-muted-foreground">Margin of error</p>
          <p className="mt-2 font-heading text-4xl font-black tabular-nums sm:text-5xl">
            ±{estimate.standardError.toFixed(2)}
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              smaller is better
            </span>
          </p>
        </div>
      </div>

      <div className="mt-8 border-y-2 border-foreground py-8">
        <div className="relative h-44 overflow-hidden bg-[var(--rail)]">
          <div className="absolute inset-x-0 top-1/2 h-px bg-foreground" />
          {["Low", "Below average", "Middle", "Above average", "High"].map(
            (label, index) => (
              <div
                key={label}
                className="absolute inset-y-0 border-l border-border"
                style={{ left: `${index * 25}%` }}
              >
                <span className="absolute top-1 font-mono text-[0.62rem] text-muted-foreground">
                  {label}
                </span>
              </div>
            )
          )}
          {previous ? (
            <div
              className="absolute top-7 h-10 border-2 border-dashed border-muted-foreground/50 bg-background/50"
              style={{
                left: thetaPosition(beforeLow),
                width: `${Math.min(100, beforeWidth)}%`,
              }}
            >
              <span className="absolute -top-6 font-mono text-[0.6rem] font-bold text-muted-foreground uppercase">
                Before answer
              </span>
            </div>
          ) : null}
          <div
            className="absolute top-[5.25rem] h-12 border-2 border-primary bg-primary/15"
            style={{
              left: thetaPosition(estimate.interval80.low),
              width: `${Math.min(100, currentWidth)}%`,
            }}
          >
            <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 font-mono text-[0.62rem] font-black whitespace-nowrap text-primary uppercase">
              Likely range
            </span>
          </div>
          <div
            className="absolute top-[4.55rem] h-16 w-0.5 bg-foreground"
            style={{ left: thetaPosition(estimate.theta) }}
          >
            <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-foreground px-2 py-1 font-mono text-[0.62rem] font-black whitespace-nowrap text-background">
              Level {estimate.readinessIndex}
            </span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p
            id="ability-estimate-heading"
            className="text-sm text-muted-foreground"
          >
            Smaller margin = Scout is more sure
          </p>
          <p className="font-mono text-xs font-black text-primary uppercase">
            {estimate.precision === "precise"
              ? "Enough information"
              : estimate.precision === "stabilizing"
                ? "Getting clearer"
                : "Still learning"}
          </p>
        </div>
      </div>
    </section>
  )
}

export function AdaptiveCalibrationLab({
  representativeDemo,
  learning,
  onLearningTwinUpdated,
  onInspectLearningTwin,
  onReturnToToday,
  onStartFullDiagnostic,
  adaptiveBaselineRequired,
  onUseAdaptiveBaseline,
}: AdaptiveCalibrationLabProps) {
  const [payload, setPayload] = useState<AdaptiveCalibrationPayload | null>(
    null
  )
  const [selectedChoice, setSelectedChoice] = useState("")
  const [confidence, setConfidence] = useState<AnswerConfidence>("sure")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLatestAnswer, setShowLatestAnswer] = useState(false)
  const [proof, setProof] = useState<AdaptiveProof | null>(null)
  const initialLoad = useRef<Promise<AdaptiveCalibrationPayload> | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        initialLoad.current ??= (async () => {
          let next = await calibrationRequest("GET")
          if (representativeDemo && next.responseCount === 0) {
            next = await calibrationRequest("POST", { action: "seed_demo" })
            if (next.learningTwinUpdated) await onLearningTwinUpdated()
          }
          return next
        })()
        const next = await initialLoad.current
        if (!active) return
        setPayload(next)
        setError(null)
      } catch (caught) {
        if (!active) return
        setError(
          caught instanceof Error
            ? caught.message
            : "Quick Check could not load."
        )
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [onLearningTwinUpdated, representativeDemo])

  async function submitAnswer() {
    const question = payload?.currentQuestion
    if (!question || !selectedChoice) return
    const learningBefore = learning.learningTwin
    setBusy(true)
    try {
      const next = await calibrationRequest("POST", {
        action: "answer",
        questionId: question.id,
        choiceId: selectedChoice,
        confidence,
      })
      setPayload(next)
      setSelectedChoice("")
      setConfidence("sure")
      setError(null)
      setShowLatestAnswer(true)
      if (next.learningTwinUpdated) {
        const learningAfter = await onLearningTwinUpdated()
        const event = next.lastFeedback?.event
        const comparison = learningAfter
          ? compareLearningTwinSnapshots({
              before: learningBefore,
              after: learningAfter.learningTwin,
              skill: question.primarySkill as SkillSlug,
              questionId: question.id,
            })
          : null
        if (event && comparison) {
          setProof({
            correct: event.correct,
            readinessBefore: Math.round(((event.thetaBefore + 3) / 6) * 100),
            readinessAfter: Math.round(((event.thetaAfter + 3) / 6) * 100),
            marginBefore: event.standardErrorBefore,
            marginAfter: event.standardErrorAfter,
            learning: comparison,
          })
        }
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Scout could not check that answer."
      )
    } finally {
      setBusy(false)
    }
  }

  if (!payload) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-20">
        <ScoutCoach
          mood={error ? "repair" : "thinking"}
          message={
            error
              ? "Scout could not load your quick check."
              : "Scout is choosing your next question…"
          }
        />
        {error ? (
          <Alert variant="destructive" className="mt-6 bg-background">
            <CircleAlertIcon />
            <AlertTitle>Quick Check unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </main>
    )
  }

  const question = payload.currentQuestion
  const selectedCandidate = payload.selection?.candidates.find(
    (candidate) => candidate.id === payload.selection?.selectedItemId
  )
  const latestEvent = payload.lastFeedback?.event

  return (
    <main
      className="mx-auto w-full max-w-[100rem] px-4 py-8 sm:px-7 lg:py-10"
      data-representative-demo={representativeDemo ? "true" : "false"}
    >
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-foreground pb-6">
        <div>
          <div className="flex items-center gap-3 text-primary">
            <CrosshairIcon className="size-5" aria-hidden="true" />
            <p className="ink-label">Quick Check</p>
          </div>
          <h1 className="mt-3 font-heading text-5xl leading-[0.9] font-black tracking-[-0.035em] sm:text-6xl">
            Let’s get a clearer starting point.
          </h1>
        </div>
        <div className="min-w-64 border-l-2 border-foreground pl-5">
          <p className="ink-label text-muted-foreground">How it works</p>
          <p className="mt-1 font-heading text-3xl font-black">
            Questions adjust to you
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {payload.responseCount} answered · {payload.maximumItems} at most
          </p>
        </div>
      </div>

      {payload.representativeDemo ? (
        <Alert className="mt-6 border-2 border-primary bg-secondary">
          <ScanSearchIcon />
          <AlertTitle>Seven example answers are ready</AlertTitle>
          <AlertDescription>
            Answer this last question. Scout will show what changed in your
            level estimate, this skill, and your next lesson. The first seven
            answers are examples, not a real student&apos;s work.
          </AlertDescription>
        </Alert>
      ) : null}

      {latestEvent && showLatestAnswer && payload.status !== "complete" ? (
        <div
          className={cn(
            "mt-6 grid gap-3 border-l-4 px-5 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center",
            latestEvent.correct
              ? "border-primary bg-secondary"
              : "border-destructive bg-destructive/10"
          )}
          role="status"
        >
          {latestEvent.correct ? (
            <CheckCircle2Icon className="text-primary" />
          ) : (
            <CircleAlertIcon className="text-destructive" />
          )}
          <div>
            <p className="font-bold">Answer recorded</p>
            <p className="text-sm text-muted-foreground">
              Starting level{" "}
              {Math.round(((latestEvent.thetaBefore + 3) / 6) * 100)} →{" "}
              {Math.round(((latestEvent.thetaAfter + 3) / 6) * 100)} · margin ±
              {latestEvent.standardErrorBefore.toFixed(2)} → ±
              {latestEvent.standardErrorAfter.toFixed(2)}
            </p>
          </div>
          {payload.learningTwinUpdated ? (
            <span className="font-mono text-xs font-black text-primary uppercase">
              Skill model updated
            </span>
          ) : null}
        </div>
      ) : null}

      {payload.status === "complete" && proof ? (
        <>
          <AdaptiveProofReplay
            proof={proof}
            onInspectLearningTwin={onInspectLearningTwin}
            onReturnToToday={onReturnToToday}
          />
          {adaptiveBaselineRequired ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-5 border-y-2 border-foreground bg-[var(--coach-surface)] px-5 py-5">
              <div>
                <p className="font-heading text-2xl font-black">Use this as my starting point</p>
                <p className="mt-1 text-sm text-muted-foreground">This replaces the temporary starting score and rebuilds the study plan from your own Quick Check.</p>
              </div>
              <Button type="button" onClick={() => onUseAdaptiveBaseline(payload)}>
                Build my real plan
              </Button>
            </div>
          ) : null}
        </>
      ) : payload.status === "complete" || !question ? (
        <section className="mt-8 grid gap-8 border-y-2 border-foreground py-10 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <p className="ink-label text-primary">Quick Check complete</p>
            <h2 className="mt-3 font-heading text-5xl font-black sm:text-6xl">
              Scout has enough to choose what comes next.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              Scout reached enough confidence after {payload.responseCount}{" "}
              questions. It checked English, math, and reading, then stopped
              because another short-check question was unlikely to change the
              first mission.
            </p>
            <div className="mt-6 border-l-4 border-primary bg-[var(--info-surface)] p-5">
              <p className="ink-label text-primary">Why Scout stopped</p>
              <p className="mt-2 font-bold">
                {payload.stopReason ??
                  "The estimate was stable enough to make the next study decision."}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The full diagnostic is still available if you want a narrower
                score range before planning.
              </p>
            </div>
          </div>
          <div className="border-l-2 border-primary pl-6">
            <p className="ink-label text-muted-foreground">
              Estimated ACT range
            </p>
            <p className="mt-2 font-heading text-7xl font-black text-primary tabular-nums">
              {Math.max(
                1,
                Math.round(
                  1 + (payload.estimate.interval80.low / 6) * 35 + 17.5
                )
              )}
              –
              {Math.min(
                36,
                Math.round(
                  1 + (payload.estimate.interval80.high / 6) * 35 + 17.5
                )
              )}
            </p>
            <p className="mt-4 font-mono text-xs font-bold text-muted-foreground uppercase">
              Practice estimate · not an official ACT score
            </p>
            <Button
              type="button"
              size="lg"
              className="mt-7 w-full"
              onClick={onInspectLearningTwin}
            >
              <BrainCircuitIcon />
              See what Scout recommends
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            {adaptiveBaselineRequired ? (
              <Button
                type="button"
                size="lg"
                className="mt-3 w-full"
                onClick={() => onUseAdaptiveBaseline(payload)}
              >
                Build my plan from this baseline
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="mt-3 w-full"
              onClick={onStartFullDiagnostic}
            >
              Take the full 66-question diagnostic
            </Button>
          </div>
        </section>
      ) : (
        <div className="mt-8 grid border-y-2 border-foreground lg:grid-cols-[minmax(0,0.98fr)_minmax(0,1.08fr)_minmax(19rem,0.74fr)]">
          <section className="py-8 lg:border-r-2 lg:border-foreground lg:pr-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="ink-label text-primary">
                Question {payload.responseCount + 1} of {payload.maximumItems}
              </p>
              <p className="font-mono text-xs font-black text-muted-foreground uppercase">
                {SECTION_LABELS[question.section]} · {question.difficulty}
              </p>
            </div>
            <h2 className="mt-4 font-heading text-4xl leading-none font-black sm:text-5xl">
              Your next question
            </h2>
            {question.stimulus ? (
              <article className="mt-6 max-h-72 overflow-y-auto border-y-2 border-foreground bg-[var(--rail)] px-5 py-5 text-sm leading-7">
                {question.passageTitle ? (
                  <p className="mb-3 font-heading text-2xl font-black">
                    {question.passageTitle}
                  </p>
                ) : null}
                <p>{question.stimulus}</p>
              </article>
            ) : null}
            {question.lineReference ? (
              <p className="mt-5 font-mono text-xs font-black text-muted-foreground uppercase">
                {question.lineReference}
              </p>
            ) : null}
            <p className="mt-6 text-xl leading-8 font-bold">
              {question.prompt}
            </p>
            <RadioGroup
              value={selectedChoice}
              onValueChange={setSelectedChoice}
              aria-label={`Answer choices for Quick Check question ${payload.responseCount + 1}`}
              className="mt-6 gap-3"
            >
              {question.choices.map((choice, index) => (
                <label
                  key={choice.id}
                  className={cn(
                    "grid cursor-pointer grid-cols-[2.4rem_minmax(0,1fr)] items-start border-2 border-border bg-background p-4 text-sm leading-6 transition-[transform,background-color,border-color] hover:-translate-y-0.5 hover:border-foreground",
                    selectedChoice === choice.id &&
                      "border-primary bg-secondary"
                  )}
                >
                  <RadioGroupItem value={choice.id} className="sr-only" />
                  <strong className="font-mono text-lg text-primary">
                    {String.fromCharCode(65 + index)}
                  </strong>
                  <span className="min-w-0">{choice.text}</span>
                </label>
              ))}
            </RadioGroup>
            <div className="mt-5 border-y-2 border-foreground py-4">
              <p className="ink-label text-muted-foreground">How sure are you?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    ["sure", "Sure"],
                    ["unsure", "Unsure"],
                    ["guessing", "Guessing"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={confidence === value ? "secondary" : "outline"}
                    onClick={() => setConfidence(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Confidence changes the skill-model weight, not whether the answer is marked right or wrong.
              </p>
            </div>
            {error ? (
              <Alert variant="destructive" className="mt-5">
                <CircleAlertIcon />
                <AlertTitle>Answer not recorded</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Button
              type="button"
              size="xl"
              className="mt-6 w-full"
              disabled={!selectedChoice || busy}
              onClick={() => void submitAnswer()}
            >
              {busy ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : (
                <ShieldCheckIcon />
              )}
              {busy ? "Updating your plan…" : "Check my answer"}
              {!busy ? <ArrowRightIcon data-icon="inline-end" /> : null}
            </Button>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              ACT-style practice · not an official ACT score
            </p>
          </section>

          <div className="py-8 lg:px-7">
            <div className="flex items-center gap-3 text-primary">
              <BrainCircuitIcon className="size-5" />
              <p className="ink-label">Your starting estimate</p>
            </div>
            <div className="mt-5">
              <ModelBand payload={payload} />
            </div>
            <section className="mt-8 border-t-2 border-foreground pt-6">
              <p className="ink-label text-muted-foreground">
                What happens after you answer
              </p>
              <ol className="mt-5 grid gap-4 sm:grid-cols-3">
                {[
                  [
                    "1",
                    "Pick a question",
                    "Choose what will tell Scout the most",
                  ],
                  ["2", "Update the skill", "Use your scored answer"],
                  ["3", "Change the plan", "Choose your next lesson"],
                ].map(([number, title, detail]) => (
                  <li key={number} className="border-l-2 border-primary pl-3">
                    <span className="font-mono text-xs font-black">
                      {number}
                    </span>
                    <p className="mt-2 font-heading text-xl font-black">
                      {title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {detail}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <aside className="py-8 lg:border-l-2 lg:border-foreground lg:pl-7">
            <div className="flex items-center gap-3 text-primary">
              <GaugeIcon className="size-5" />
              <p className="ink-label">Why this question?</p>
            </div>
            <div className="mt-5">
              <MetricRow
                label="How useful it is"
                detail="How much this answer can teach Scout about your level"
                value={
                  selectedCandidate
                    ? selectedCandidate.itemInformation >= 0.9
                      ? "High"
                      : "Medium"
                    : "—"
                }
                accent
              />
              <MetricRow
                label="Your chance of getting it right"
                detail="Scout's best guess before you answer"
                value={
                  selectedCandidate
                    ? `${Math.round(selectedCandidate.probabilityCorrect * 100)}%`
                    : "—"
                }
              />
              <MetricRow
                label="Difficulty"
                detail="Based on the reviewed question bank"
                value={question.difficulty}
              />
              <MetricRow
                label="Matches your level"
                detail="This question is close to your current estimate"
                value="Yes"
              />
              <MetricRow
                label="Balances your check"
                detail={`${SECTION_LABELS[question.section]} · ${question.skillLabel}`}
                value={SECTION_LABELS[question.section]}
              />
            </div>
            <div className="mt-7 border-t-2 border-foreground pt-6">
              <h3 className="font-heading text-2xl font-black">
                Other questions Scout considered
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Scout compares useful questions, then makes sure English, math,
                and reading all get checked.
              </p>
              <ol className="mt-4">
                {payload.selection?.candidates.map((candidate, index) => (
                  <CandidateRow
                    key={candidate.id}
                    candidate={candidate}
                    rank={index + 1}
                    selected={
                      candidate.id === payload.selection?.selectedItemId
                    }
                  />
                ))}
              </ol>
            </div>
          </aside>
        </div>
      )}

      <div className="mt-8 grid gap-5 border-t-2 border-foreground pt-6 text-sm text-muted-foreground sm:grid-cols-[1fr_auto] sm:items-center">
        <p>
          Scout asks at least {payload.minimumItems} questions and no more than{" "}
          {payload.maximumItems}. It checks English, math, and reading before
          stopping.
        </p>
        <p className="font-mono text-xs font-black uppercase">
          {payload.responseCount} answers used
        </p>
      </div>

      <details className="mt-6 border-t pt-5 text-sm text-muted-foreground">
        <summary className="cursor-pointer font-bold text-foreground">
          Technical details for judges
        </summary>
        <p className="mt-3 max-w-3xl leading-6">
          Scout uses a two-parameter Item Response Theory model (2PL IRT). It
          estimates a level called theta, measures its margin of error, and
          chooses the unanswered question expected to reduce that margin the
          most. Current theta: {signed(payload.estimate.theta)}. Model version:{" "}
          {payload.model.version}.
        </p>
      </details>
    </main>
  )
}
