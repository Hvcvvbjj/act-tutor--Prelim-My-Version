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
  ChevronRightIcon,
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
import {
  RadioGroup,
  VisuallyHiddenRadioGroupItem,
} from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

interface AdaptiveCalibrationLabProps {
  representativeDemo: boolean
  learning: LearningSessionPayload
  onLearningTwinUpdated: () => Promise<LearningSessionPayload | null>
  onInspectLearningTwin: () => void
  onReturnToToday: () => void
  onStartFullDiagnostic: () => void
  adaptiveBaselineRequired: boolean
  onUseAdaptiveBaseline: () => Promise<void>
  canViewTechnicalDetails: boolean
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

const ANSWER_SHORTCUTS = ["a", "b", "c", "d"] as const

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
          Ranking score
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
  canViewTechnicalDetails,
}: {
  proof: AdaptiveProof
  onInspectLearningTwin: () => void
  onReturnToToday: () => void
  canViewTechnicalDetails: boolean
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
            <p className="ink-label">Answer recorded</p>
          </div>
          <h2
            id="adaptive-proof-heading"
            className="mt-3 max-w-4xl font-heading text-4xl leading-[0.92] font-black tracking-[-0.035em] sm:text-7xl"
          >
            {proof.correct
              ? "Correct—Scout adjusted your next steps."
              : "Not quite—Scout adjusted your next steps."}
          </h2>
        </div>
        <p className="border-l-2 border-primary pl-5 text-lg leading-7 text-muted-foreground">
          {proof.correct
            ? `Your answer strengthened Scout’s estimate for ${proof.learning.skillLabel}. Scout then checked whether your next lesson should change.`
            : `Your answer gave Scout more information about ${proof.learning.skillLabel}. Scout then checked whether your next lesson should change.`}
        </p>
      </div>

      <div
        className={cn(
          "grid border-t-2 border-foreground lg:divide-x-2 lg:divide-foreground",
          canViewTechnicalDetails ? "lg:grid-cols-3" : "lg:grid-cols-2"
        )}
      >
        {canViewTechnicalDetails ? (
          <article className="py-7 lg:pr-7">
            <p className="ink-label text-muted-foreground">
              1 · Question match
            </p>
            <ChangeValue
              before={`${proof.readinessBefore}/100`}
              after={`${proof.readinessAfter}/100`}
            />
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
              This internal index helps Scout choose a question that is neither
              too easy nor too hard. It is not an ACT score.
            </p>
          </article>
        ) : null}

        <article
          className={cn(
            "border-t-2 border-foreground py-7 lg:border-t-0",
            canViewTechnicalDetails ? "lg:px-7" : "lg:pr-7"
          )}
        >
          <p className="ink-label text-muted-foreground">
            {canViewTechnicalDetails ? "2" : "1"} · {proof.learning.skillLabel}{" "}
            estimate
          </p>
          <ChangeValue
            before={percentage(proof.learning.learnedBefore)}
            after={percentage(proof.learning.learnedAfter)}
          />
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
            Only this skill estimate changed. Your confidence affects how much
            Scout adjusts it, but never changes whether the answer is correct.
          </p>
        </article>

        <article className="border-t-2 border-foreground py-7 lg:border-t-0 lg:pl-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="ink-label text-muted-foreground">
              {canViewTechnicalDetails ? "3" : "2"} · Study next
            </p>
            <span className="bg-foreground px-2 py-1 font-mono text-[0.62rem] font-black text-background uppercase">
              {proof.learning.recommendationChanged
                ? "New next lesson"
                : "Still next"}
            </span>
          </div>
          <p className="mt-4 font-heading text-4xl leading-none font-black text-primary sm:text-5xl">
            {nextLesson.label}
          </p>
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
            {proof.learning.recommendationChanged
              ? `${nextLesson.label} moved ahead of ${previousLesson.label} after this answer.`
              : `${nextLesson.label} is still your next lesson. This answer updated ${proof.learning.skillLabel}, but did not change what should come first.`}
          </p>
        </article>
      </div>

      <div className="grid gap-6 border-t-2 border-foreground py-7 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="font-heading text-2xl font-black">
            Scout updated this check and the skill you just practiced.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your dated My week calendar stays as it is. If this was your
            starting check, use “Build my study plan” when you finish to create
            a new calendar.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant="outline" onClick={onReturnToToday}>
            Back to today
          </Button>
          <Button type="button" onClick={onInspectLearningTwin}>
            <BrainCircuitIcon />
            View my skills
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
          <p className="ink-label text-muted-foreground">
            Theta display · not ACT readiness
          </p>
          <p className="mt-2 font-heading text-4xl font-black tabular-nums sm:text-5xl">
            {estimate.readinessIndex}/100
          </p>
        </div>
        <div className="px-4 py-5 sm:px-6">
          <p className="ink-label text-muted-foreground">
            Standard error · theta units
          </p>
          <p className="mt-2 font-heading text-4xl font-black tabular-nums sm:text-5xl">
            ±{estimate.standardError.toFixed(2)}{" "}
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              lower means a narrower model interval
            </span>
          </p>
        </div>
      </div>

      <div className="mt-8 border-y-2 border-foreground py-8">
        <div className="relative h-44 overflow-hidden bg-[var(--rail)]">
          <div className="absolute inset-x-0 top-1/2 h-px bg-foreground" />
          {["−3", "−1.5", "0", "+1.5", "+3"].map((label, index) => (
            <div
              key={label}
              className="absolute inset-y-0 border-l border-border"
              style={{ left: `${index * 25}%` }}
            >
              <span className="absolute top-1 font-mono text-[0.62rem] text-muted-foreground">
                {label}
              </span>
            </div>
          ))}
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
              80% model interval
            </span>
          </div>
          <div
            className="absolute top-[4.55rem] h-16 w-0.5 bg-foreground"
            style={{ left: thetaPosition(estimate.theta) }}
          >
            <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-foreground px-2 py-1 font-mono text-[0.62rem] font-black whitespace-nowrap text-background">
              Theta {signed(estimate.theta)}
            </span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p
            id="ability-estimate-heading"
            className="text-sm text-muted-foreground"
          >
            The ± value is one standard error. The shaded band is an 80% model
            interval. Neither is an ACT score range.
          </p>
          <p className="font-mono text-xs font-black text-primary uppercase">
            {estimate.standardError <= 0.56
              ? "SE ≤ 0.56 · early-stop threshold met"
              : estimate.standardError <= 0.82
                ? "SE 0.57–0.82"
                : "SE > 0.82"}
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
  canViewTechnicalDetails,
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
          if (!representativeDemo && next.representativeDemo) {
            const reset = await fetch("/api/calibration", { method: "DELETE" })
            if (!reset.ok) {
              throw new Error("Could not clear the sample Quick Check.")
            }
            next = await calibrationRequest("GET")
          }
          if (representativeDemo && next.responseCount === 0) {
            next = await calibrationRequest("POST", { action: "seed_preview" })
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

  const shortcutChoiceKey =
    payload?.currentQuestion?.choices.map((choice) => choice.id).join("|") ?? ""

  useEffect(() => {
    if (!shortcutChoiceKey || busy || showLatestAnswer) return
    const choiceIds = shortcutChoiceKey.split("|")

    function chooseWithKeyboard(event: KeyboardEvent) {
      if (
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return
      }
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return
      }

      const numberIndex = ["1", "2", "3", "4"].indexOf(event.key)
      const letterIndex = ANSWER_SHORTCUTS.indexOf(
        event.key.toLowerCase() as (typeof ANSWER_SHORTCUTS)[number]
      )
      const choiceIndex = numberIndex >= 0 ? numberIndex : letterIndex
      const choiceId = choiceIds[choiceIndex]
      if (!choiceId) return

      event.preventDefault()
      setSelectedChoice(choiceId)
    }

    window.addEventListener("keydown", chooseWithKeyboard)
    return () => window.removeEventListener("keydown", chooseWithKeyboard)
  }, [busy, shortcutChoiceKey, showLatestAnswer])

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

  async function applyAdaptiveBaseline() {
    setBusy(true)
    try {
      await onUseAdaptiveBaseline()
      setError(null)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Scout could not save the Quick Check plan."
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
          <h1 className="mt-3 font-heading text-4xl leading-[0.9] font-black tracking-[-0.035em] sm:text-6xl">
            A short check to choose your first lessons.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Answer 8–12 questions across English, Math, and Reading. Scout may
            finish after eight once it has enough information from every
            section; otherwise it asks up to 12. The result chooses your first
            lessons—it is not an ACT score.
          </p>
        </div>
        <div className="min-w-64 border-l-2 border-foreground pl-5">
          <p className="ink-label text-muted-foreground">Time and progress</p>
          <p className="mt-1 font-heading text-3xl font-black">
            About{" "}
            {Math.max(
              1,
              Math.ceil((payload.maximumItems - payload.responseCount) * 1.5)
            )}{" "}
            min left
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {payload.responseCount} of up to {payload.maximumItems} answered
          </p>
        </div>
      </div>

      {payload.representativeDemo ? (
        <Alert className="mt-6 border-2 border-primary bg-secondary">
          <ScanSearchIcon />
          <AlertTitle>Seven sample answers are loaded</AlertTitle>
          <AlertDescription>
            Answer this last question to see how Scout responds. The first seven
            answers are preview data, not a real student&apos;s work.
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
              {payload.learningTwinUpdated
                ? "Your answer updated this check and the skill it tested. Scout used the new information to choose the next question."
                : "Your answer updated this check, but the skill update did not sync. You can continue; Scout will keep the previous skill ranking until it syncs."}
            </p>
          </div>
          {payload.learningTwinUpdated ? (
            <span className="font-mono text-xs font-black text-primary uppercase">
              Skill estimate updated
            </span>
          ) : (
            <span className="font-mono text-xs font-black text-destructive uppercase">
              Skill update paused
            </span>
          )}
        </div>
      ) : null}

      {payload.status === "complete" && proof ? (
        <>
          <AdaptiveProofReplay
            proof={proof}
            onInspectLearningTwin={onInspectLearningTwin}
            onReturnToToday={onReturnToToday}
            canViewTechnicalDetails={canViewTechnicalDetails}
          />
          {adaptiveBaselineRequired ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-5 border-y-2 border-foreground bg-[var(--coach-surface)] px-5 py-5">
              <div>
                <p className="font-heading text-2xl font-black">
                  Build my plan from these answers
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Scout will turn these answers into a temporary planning
                  baseline for your schedule. It is not an official ACT score or
                  score prediction.
                </p>
              </div>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void applyAdaptiveBaseline()}
              >
                {busy ? "Saving your plan…" : "Build my study plan"}
              </Button>
            </div>
          ) : null}
        </>
      ) : payload.status === "complete" || !question ? (
        <section className="mt-8 grid gap-8 border-y-2 border-foreground py-10 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <p className="ink-label text-primary">Quick Check complete</p>
            <h2 className="mt-3 font-heading text-5xl font-black sm:text-6xl">
              You’re ready for your first lessons.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              You answered {payload.responseCount} questions across English,
              Math, and Reading. Scout now has enough information to choose a
              starting point for your plan.
            </p>
            <div className="mt-6 border-l-4 border-primary bg-[var(--info-surface)] p-5">
              <p className="ink-label text-primary">Why the check ended</p>
              <p className="mt-2 font-bold">
                {payload.responseCount >= payload.maximumItems
                  ? `Stopped at ${payload.maximumItems}, the maximum for Quick Check.`
                  : "Scout had enough information from all three sections after at least eight answers."}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Scout uses a fixed in-app rule. This does not prove the estimate
                is exact or that your goal is reachable.
              </p>
            </div>
          </div>
          <div className="border-l-2 border-primary pl-6">
            {canViewTechnicalDetails ? (
              <>
                <p className="ink-label text-muted-foreground">
                  Scout placement index · not an ACT score
                </p>
                <p className="mt-2 font-heading text-7xl font-black text-primary tabular-nums">
                  {payload.estimate.readinessIndex}
                  <span className="text-3xl text-muted-foreground">/100</span>
                </p>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  This internal 0–100 index helps Scout order the first lessons.
                  It is not an ACT score, percentile, or score prediction.
                </p>
              </>
            ) : (
              <>
                <CheckCircle2Icon
                  className="size-10 text-primary"
                  aria-hidden="true"
                />
                <p className="mt-3 font-heading text-4xl font-black">
                  Starting point saved.
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Scout used your answers to choose the skills and practice
                  level that come next.
                </p>
              </>
            )}
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
                disabled={busy}
                onClick={() => void applyAdaptiveBaseline()}
              >
                {busy ? "Building my plan…" : "Build my plan from this check"}
              </Button>
            ) : null}
            {error ? (
              <p
                className="mt-3 text-sm font-semibold text-destructive"
                role="alert"
              >
                {error}
              </p>
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
        <div className="mt-8 grid border-y-2 border-foreground lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.55fr)]">
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
              <article
                data-testid="quick-check-stimulus"
                className="mt-6 border-y-2 border-foreground bg-[var(--rail)] px-5 py-5 text-sm leading-7 lg:max-h-72 lg:overflow-y-auto"
              >
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
                  data-testid="quick-check-choice"
                  className={cn(
                    "grid cursor-pointer grid-cols-[2.4rem_minmax(0,1fr)] items-start border-2 border-border bg-background p-4 text-sm leading-6 transition-[transform,background-color,border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 focus-within:outline-none hover:-translate-y-0.5 hover:border-foreground",
                    selectedChoice === choice.id &&
                      "border-primary bg-secondary"
                  )}
                >
                  <VisuallyHiddenRadioGroupItem value={choice.id} />
                  <strong className="font-mono text-lg text-primary">
                    {String.fromCharCode(65 + index)}
                  </strong>
                  <span className="min-w-0">{choice.text}</span>
                </label>
              ))}
            </RadioGroup>
            <p className="mt-3 hidden text-xs font-semibold text-muted-foreground sm:block">
              Keyboard: 1–4 or A–D chooses an answer.
            </p>
            <div className="mt-5 border-y-2 border-foreground py-4">
              <p
                id="quick-check-confidence-label"
                className="ink-label text-muted-foreground"
              >
                How sure are you?{" "}
                <span className="normal-case">(optional)</span>
              </p>
              <div
                className="mt-3 flex flex-wrap gap-2"
                role="group"
                aria-labelledby="quick-check-confidence-label"
                aria-describedby="quick-check-confidence-help"
              >
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
                    aria-pressed={confidence === value}
                    onClick={() => setConfidence(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <p
                id="quick-check-confidence-help"
                className="mt-2 text-xs text-muted-foreground"
              >
                Confidence never changes whether your answer is right. It only
                changes how strongly Scout adjusts this skill estimate.
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
              {busy ? "Recording my answer…" : "Check my answer"}
              {!busy ? <ArrowRightIcon data-icon="inline-end" /> : null}
            </Button>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              ACT-style practice · not an official ACT score
            </p>
          </section>

          <aside className="border-t-2 border-foreground py-8 lg:border-t-0 lg:pl-7">
            <div className="flex items-center gap-3 text-primary">
              <CrosshairIcon className="size-5" aria-hidden="true" />
              <p className="ink-label">Why this question?</p>
            </div>
            <p className="mt-4 font-heading text-3xl leading-tight font-black">
              This {question.skillLabel} question gives Scout the clearest next
              signal.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              It helps Scout learn what to teach next while keeping section
              coverage balanced. Your ACT goal does not affect this choice.
            </p>

            <details className="group mt-8 border-t-2 border-foreground pt-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                What happens after I answer?
                <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" />
              </summary>
              <ol className="mt-5 grid gap-5">
                {[
                  [
                    "1",
                    "Your answer is scored",
                    "You will see whether it was right.",
                  ],
                  [
                    "2",
                    "Scout checks your progress",
                    "After eight answers, Scout checks whether it has enough information from every section.",
                  ],
                  [
                    "3",
                    "Your study plan gets sharper",
                    "This skill estimate updates and helps Scout choose what to teach next.",
                  ],
                ].map(([number, title, detail]) => (
                  <li
                    key={number}
                    className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3"
                  >
                    <span className="flex size-8 items-center justify-center bg-foreground font-mono text-xs font-black text-background">
                      {number}
                    </span>
                    <div>
                      <p className="font-heading text-xl font-black">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </details>

            <div className="mt-8 border-l-4 border-primary bg-[var(--info-surface)] p-4">
              <p className="font-bold">
                {payload.maximumItems - payload.responseCount} questions left at
                most
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                This is practice guidance, not an official ACT score.
              </p>
            </div>
          </aside>
        </div>
      )}

      <div className="mt-8 grid gap-5 border-t-2 border-foreground pt-6 text-sm text-muted-foreground sm:grid-cols-[1fr_auto] sm:items-center">
        <p>
          Quick Check asks no more than {payload.maximumItems} questions. It may
          finish after {payload.minimumItems} once Scout has enough information
          from English, Math, and Reading.
        </p>
        <p className="font-mono text-xs font-black uppercase">
          {payload.responseCount} answers used
        </p>
      </div>

      {canViewTechnicalDetails ? (
        <details className="group mt-6 border-y-2 border-foreground bg-[var(--rail)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-5 font-bold text-foreground marker:content-none sm:px-6">
            <span className="flex items-center gap-3">
              <GaugeIcon className="size-5 text-primary" aria-hidden="true" />
              How Scout chose this question
              <span className="font-normal text-muted-foreground">
                (technical details)
              </span>
            </span>
            <span className="font-mono text-xs font-black uppercase group-open:hidden">
              Show
            </span>
            <span className="hidden font-mono text-xs font-black uppercase group-open:inline">
              Hide
            </span>
          </summary>
          <div className="border-t-2 border-foreground bg-background px-4 py-7 sm:px-6">
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Scout uses a two-parameter Item Response Theory-shaped model (2PL
              IRT). Easy, medium, and hard questions use preset difficulty and
              discrimination constants assigned in this app; they are not
              calibrated from a national sample. Unanswered items are ranked by
              Fisher information at the current theta, plus +1.35 for an unseen
              section, +0.24 for the least-covered section, and +0.12 for an
              unseen skill. Current theta: {signed(payload.estimate.theta)}.
              Model version: {payload.model.version}.
            </p>

            {question ? (
              <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
                <div>
                  <div className="flex items-center gap-3 text-primary">
                    <BrainCircuitIcon className="size-5" aria-hidden="true" />
                    <p className="ink-label">Current model estimate</p>
                  </div>
                  <div className="mt-5">
                    <ModelBand payload={payload} />
                  </div>
                </div>

                <div>
                  <p className="ink-label text-primary">Selection data</p>
                  <div className="mt-3">
                    <MetricRow
                      label="Item information"
                      detail="How informative the item is at current theta before coverage bonuses"
                      value={
                        selectedCandidate
                          ? selectedCandidate.itemInformation.toFixed(2)
                          : "—"
                      }
                      accent
                    />
                    <MetricRow
                      label="Predicted correct"
                      detail="Calculated from theta and preset item parameters; confidence and ACT goal are ignored"
                      value={
                        selectedCandidate
                          ? `${Math.round(selectedCandidate.probabilityCorrect * 100)}%`
                          : "—"
                      }
                    />
                    <MetricRow
                      label="Difficulty"
                      detail="Question-bank category mapped to fixed constants in code"
                      value={question.difficulty}
                    />
                  </div>
                  <div className="mt-7 border-t-2 border-foreground pt-6">
                    <h3 className="font-heading text-2xl font-black">
                      Candidate ranking
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ranking score = item information + section and skill
                      coverage bonuses. It is not a probability. Exact ties use
                      higher unbonused item information, then the question-bank
                      item ID. Displayed scores are rounded to two decimals.
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
                </div>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </main>
  )
}
