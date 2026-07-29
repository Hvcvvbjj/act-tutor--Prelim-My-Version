"use client"

import { useEffect, useRef, useState } from "react"
import type {
  AdaptiveCalibrationPayload,
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
import {
  RadioGroup,
  VisuallyHiddenRadioGroupItem,
} from "@/components/ui/radio-group"
import {
  RapidAnswerCoachDialog,
  useRapidAnswerCoach,
} from "@/components/tutor/rapid-answer-coach"
import { cn } from "@/lib/utils"

interface AdaptiveCalibrationLabProps {
  representativeDemo: boolean
  learning: LearningSessionPayload
  onLearningTwinUpdated: () => Promise<LearningSessionPayload | null>
  onInspectLearningTwin: () => void
  onReturnToToday: () => void
  onStartFullDiagnostic: () => void
  adaptiveBaselineRequired: boolean
  preserveReportedScore?: boolean
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
const DEFAULT_ANSWER_CONFIDENCE = "unreported" as const

function focusedSentence(stimulus: string, lineReference?: string | null) {
  const sentenceNumber = lineReference?.match(/^Sentence (\d+)$/i)?.[1]
  if (!sentenceNumber) return null
  const nextNumber = String(Number(sentenceNumber) + 1)
  const match = stimulus.match(
    new RegExp(
      `\\[${sentenceNumber}\\]\\s*([\\s\\S]*?)(?=\\s*\\[${nextNumber}\\]|$)`
    )
  )
  return match ? `[${sentenceNumber}] ${match[1].trim()}` : null
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
  representativeDemo,
  adaptiveBaselineRequired,
}: {
  proof: AdaptiveProof
  onInspectLearningTwin: () => void
  onReturnToToday: () => void
  canViewTechnicalDetails: boolean
  representativeDemo: boolean
  adaptiveBaselineRequired: boolean
}) {
  const laterPriority = proof.learning.recommendationAfter
  const previousPriority = proof.learning.recommendationBefore
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      headingRef.current?.focus({ preventScroll: true })
      headingRef.current?.scrollIntoView({ block: "start", behavior: "auto" })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  if (!canViewTechnicalDetails) {
    return (
      <section className="mx-auto max-w-2xl py-14 text-center">
        <CheckCircle2Icon
          className="mx-auto size-10 text-primary"
          aria-hidden="true"
        />
        <p
          className="ink-label mt-4 text-primary"
          role="status"
          aria-live="polite"
        >
          {proof.correct ? "Correct." : "Not quite."}
        </p>
        <h1
          ref={headingRef}
          id="adaptive-proof-heading"
          tabIndex={-1}
          className="mt-3 scroll-mt-20 font-heading text-4xl leading-tight font-black tracking-[-0.03em] outline-none sm:text-5xl"
        >
          Scout updated your skill estimates.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-muted-foreground">
          {proof.learning.skillLabel} was updated. Later-round priority:{" "}
          {laterPriority.label}.
        </p>
        {!adaptiveBaselineRequired ? (
          <Button
            type="button"
            size="lg"
            className="mt-7"
            onClick={onReturnToToday}
          >
            Back to Lessons
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        ) : null}
      </section>
    )
  }

  return (
    <section
      className="mt-8 border-y-2 border-foreground"
      aria-labelledby="adaptive-proof-heading"
    >
      <div className="grid gap-8 py-9 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)] lg:items-end">
        <div>
          <div className="flex items-center gap-3 text-primary">
            <CheckCircle2Icon className="size-5" aria-hidden="true" />
            <p className="ink-label" role="status" aria-live="polite">
              {proof.correct ? "Correct." : "Not quite."}
            </p>
          </div>
          <h1
            ref={headingRef}
            id="adaptive-proof-heading"
            tabIndex={-1}
            className="mt-3 max-w-4xl scroll-mt-20 font-heading text-4xl leading-[1.02] font-black tracking-[-0.03em] outline-none sm:text-5xl"
          >
            Scout updated your skill estimates.
          </h1>
        </div>
        <p className="border-l-2 border-primary pl-5 text-lg leading-7 text-muted-foreground">
          {proof.correct
            ? `Your answer strengthened Scout’s estimate for ${proof.learning.skillLabel}. Scout then updated your later-round priorities.`
            : `Your answer gave Scout more information about ${proof.learning.skillLabel}. Scout then updated your later-round priorities.`}
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
            Only this skill estimate changed.
          </p>
        </article>

        <article className="border-t-2 border-foreground py-7 lg:border-t-0 lg:pl-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="ink-label text-muted-foreground">
              {canViewTechnicalDetails ? "3" : "2"} · After Round 1
            </p>
            <span className="bg-foreground px-2 py-1 font-mono text-[0.62rem] font-black text-background uppercase">
              {proof.learning.recommendationChanged
                ? "New priority"
                : "Priority unchanged"}
            </span>
          </div>
          <p className="mt-4 font-heading text-4xl leading-none font-black text-primary sm:text-5xl">
            {laterPriority.label}
          </p>
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
            {proof.learning.recommendationChanged
              ? `${laterPriority.label} moved ahead of ${previousPriority.label} as a later-round priority.`
              : `${laterPriority.label} remains the leading later-round priority. This answer updated ${proof.learning.skillLabel} without changing that priority.`}
          </p>
        </article>
      </div>

      <div className="grid gap-6 border-t-2 border-foreground py-7 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="font-heading text-2xl font-black">
            {representativeDemo
              ? "Scout updated the sample learner from one answer."
              : "Scout updated this check and the skill you just practiced."}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {representativeDemo
              ? "The sample My week calendar stays fixed so you can compare what changed: the skill estimate and later-round priority."
              : adaptiveBaselineRequired
                ? "This was your starting check. Use “Build my study plan” below to turn these answers into a dated calendar."
                : "Your dated My week calendar stays as it is. Scout will use this update when setting later-round priorities."}
          </p>
        </div>
        {!adaptiveBaselineRequired ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="outline" onClick={onReturnToToday}>
              {representativeDemo ? "Back to sample day" : "Back to Lessons"}
            </Button>
            <Button type="button" onClick={onInspectLearningTwin}>
              <BrainCircuitIcon />
              {representativeDemo ? "View sample skills" : "View my skills"}
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
        ) : null}
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
  adaptiveBaselineRequired,
  preserveReportedScore = false,
  onUseAdaptiveBaseline,
  canViewTechnicalDetails,
}: AdaptiveCalibrationLabProps) {
  const [payload, setPayload] = useState<AdaptiveCalibrationPayload | null>(
    null
  )
  const [selectedChoice, setSelectedChoice] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLatestAnswer, setShowLatestAnswer] = useState(false)
  const [proof, setProof] = useState<AdaptiveProof | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const initialLoad = useRef<Promise<AdaptiveCalibrationPayload> | null>(null)
  const questionHeadingRef = useRef<HTMLHeadingElement>(null)
  const completionHeadingRef = useRef<HTMLHeadingElement>(null)
  const previousQuestionIdRef = useRef<string | null>(null)
  const rapidAnswerCoach = useRapidAnswerCoach(
    payload?.sessionId ?? "quick-check-loading",
    payload?.answeredQuestionIds ?? []
  )
  const showAdaptiveProofReplay =
    payload?.status === "complete" &&
    proof !== null &&
    (canViewTechnicalDetails || payload.representativeDemo)

  useEffect(() => {
    if (payload?.status !== "complete" || showAdaptiveProofReplay) return

    const frame = window.requestAnimationFrame(() => {
      completionHeadingRef.current?.focus({ preventScroll: true })
      completionHeadingRef.current?.scrollIntoView({
        block: "start",
        behavior: "auto",
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [payload?.status, showAdaptiveProofReplay])

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
  }, [loadAttempt, onLearningTwinUpdated, representativeDemo])

  function retryInitialLoad() {
    initialLoad.current = null
    setError(null)
    setLoadAttempt((current) => current + 1)
  }

  const shortcutChoiceKey =
    payload?.currentQuestion?.choices.map((choice) => choice.id).join("|") ?? ""
  const currentQuestionId = payload?.currentQuestion?.id ?? null

  useEffect(() => {
    if (!currentQuestionId || busy) return

    const previousQuestionId = previousQuestionIdRef.current
    previousQuestionIdRef.current = currentQuestionId
    if (previousQuestionId && previousQuestionId !== currentQuestionId) {
      setShowLatestAnswer(false)
    }
    if (
      previousQuestionId === currentQuestionId ||
      (!previousQuestionId && !payload?.representativeDemo)
    ) {
      return
    }

    setSelectedChoice("")
    const frame = window.requestAnimationFrame(() => {
      questionHeadingRef.current?.focus({ preventScroll: true })
      questionHeadingRef.current?.scrollIntoView({
        block: "start",
        behavior: "auto",
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [busy, currentQuestionId, payload?.representativeDemo])

  useEffect(() => {
    if (!shortcutChoiceKey || busy) return
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
  }, [busy, shortcutChoiceKey])

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
        confidence: DEFAULT_ANSWER_CONFIDENCE,
      })
      rapidAnswerCoach.recordAnswer(question.id)
      setPayload(next)
      setSelectedChoice("")
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
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-3xl px-5 py-20"
      >
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
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={retryInitialLoad}
            >
              Try Quick Check again
            </Button>
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
  const minimumRemainingQuestions = Math.max(0, 8 - payload.responseCount)
  const maximumRemainingQuestions = Math.max(
    0,
    payload.maximumItems - payload.responseCount
  )
  const minimumRemainingMinutes = Math.ceil(minimumRemainingQuestions * 1.5)
  const maximumRemainingMinutes = Math.ceil(maximumRemainingQuestions * 1.5)
  const timeRemainingLabel =
    payload.status === "complete"
      ? "Complete"
      : minimumRemainingMinutes === 0
        ? `Up to ${maximumRemainingMinutes} min`
        : `About ${minimumRemainingMinutes}–${maximumRemainingMinutes} min`
  const focusedStimulus =
    question?.stimulus && question.lineReference
      ? focusedSentence(question.stimulus, question.lineReference)
      : null

  return (
    <>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-[100rem] px-3 py-5 sm:px-7 sm:py-7 lg:py-8"
        data-representative-demo={representativeDemo ? "true" : "false"}
      >
        {payload.status === "complete" ? null : question ? (
          <section
            className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-1 py-1"
            aria-labelledby="quick-check-heading"
          >
            <h1
              id="quick-check-heading"
              className="font-heading text-xl font-black tracking-[-0.02em] sm:text-2xl"
            >
              Quick Check
            </h1>
            <p
              className="text-right text-xs text-muted-foreground sm:text-sm"
              role="status"
              aria-live="polite"
              aria-label={`${timeRemainingLabel}. Question ${payload.responseCount + 1} of up to ${payload.maximumItems}.`}
            >
              {timeRemainingLabel} · {payload.responseCount + 1}/
              {payload.maximumItems}
            </p>
          </section>
        ) : (
          <section
            className="paper-panel mx-auto max-w-3xl rounded-2xl border border-border/80 bg-card p-4 sm:p-6"
            aria-labelledby="quick-check-heading"
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-center">
              <div>
                <div className="hidden items-center gap-3 text-primary sm:flex">
                  <CrosshairIcon className="size-5" aria-hidden="true" />
                  <p className="ink-label">Adaptive starting point</p>
                </div>
                <h1
                  id="quick-check-heading"
                  className="font-heading text-3xl leading-tight font-black tracking-[-0.025em] sm:mt-2 sm:text-4xl"
                >
                  Quick Check
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-5 text-muted-foreground sm:text-base sm:leading-6">
                  Answer 8–12 questions. Scout may stop after eight once
                  English, Math, and Reading are covered. The answers refine
                  your starting skill estimates. Round 1 still teaches all 12
                  question types.
                </p>
              </div>

              <div className="rounded-xl bg-muted/75 px-4 py-2.5 sm:py-3">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="ink-label hidden text-muted-foreground sm:block">
                      Time remaining
                    </p>
                    <p className="text-lg font-black sm:mt-1 sm:text-xl">
                      {timeRemainingLabel}
                    </p>
                  </div>
                  <p
                    className="text-right text-xs whitespace-nowrap text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    Question {payload.responseCount + 1} of up to{" "}
                    {payload.maximumItems}
                  </p>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-border sm:mt-3"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.min(
                        100,
                        (payload.responseCount / payload.maximumItems) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {payload.representativeDemo && payload.status !== "complete" ? (
          <Alert className="mx-auto mt-3 max-w-3xl border-primary/50 bg-secondary px-4 py-3">
            <ScanSearchIcon />
            <AlertTitle>Seven sample answers are loaded</AlertTitle>
            <AlertDescription>
              Answer once to watch Scout react.
            </AlertDescription>
          </Alert>
        ) : null}

        {latestEvent && showLatestAnswer && payload.status !== "complete" ? (
          <div
            className={cn(
              "mx-auto mt-6 grid max-w-3xl grid-cols-[auto_1fr] gap-3 border-l-4 px-5 py-4",
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
              <p className="font-bold">
                {latestEvent.correct ? "Correct." : "Not quite."}
              </p>
              <p className="text-sm text-muted-foreground">
                {payload.learningTwinUpdated
                  ? "Scout adjusted the next question."
                  : "The answer saved, but the skill update will retry."}
              </p>
            </div>
          </div>
        ) : null}

        {showAdaptiveProofReplay && proof ? (
          <>
            <AdaptiveProofReplay
              proof={proof}
              onInspectLearningTwin={onInspectLearningTwin}
              onReturnToToday={onReturnToToday}
              canViewTechnicalDetails={canViewTechnicalDetails}
              representativeDemo={payload.representativeDemo}
              adaptiveBaselineRequired={adaptiveBaselineRequired}
            />
            {adaptiveBaselineRequired ? (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-5 border-y-2 border-foreground bg-[var(--coach-surface)] px-5 py-5">
                <div>
                  <p className="font-heading text-2xl font-black">
                    Build my plan from these answers
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {preserveReportedScore
                      ? "Your reported ACT score stays as the planning baseline. These answers refine your question-type estimates for later rounds; Round 1 still covers all 12 types."
                      : "Scout will turn these answers into a temporary planning baseline for your schedule."}
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
          <section className="mx-auto max-w-2xl py-14 text-center">
            <CheckCircle2Icon
              className="mx-auto size-10 text-primary"
              aria-hidden="true"
            />
            <p className="ink-label mt-4 text-primary">Quick Check complete</p>
            <h1
              ref={completionHeadingRef}
              tabIndex={-1}
              className="mt-3 scroll-mt-20 font-heading text-4xl font-black outline-none sm:text-5xl"
            >
              Starting point saved.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-muted-foreground">
              Scout used {payload.responseCount} answers to build your starting
              skill profile.
            </p>
            {canViewTechnicalDetails ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Internal placement index: {payload.estimate.readinessIndex}/100
              </p>
            ) : null}
            <div className="mx-auto mt-7 flex max-w-sm flex-col gap-3">
              {adaptiveBaselineRequired ? (
                <Button
                  type="button"
                  size="lg"
                  disabled={busy}
                  onClick={() => void applyAdaptiveBaseline()}
                >
                  {busy ? "Building my plan…" : "Build my plan from this check"}
                </Button>
              ) : (
                <Button type="button" size="lg" onClick={onReturnToToday}>
                  Back to Lessons
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              )}
            </div>
            {error ? (
              <p
                className="mt-3 text-sm font-semibold text-destructive"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </section>
        ) : (
          <div
            className="mx-auto mt-5 max-w-3xl"
            data-testid="quick-check-question-card"
          >
            <section className="px-1 py-3 sm:py-5">
              <p className="font-mono text-xs font-black text-primary uppercase">
                {SECTION_LABELS[question.section]}
                {canViewTechnicalDetails ? ` · ${question.difficulty}` : ""}
              </p>
              {question.stimulus ? (
                <article
                  data-testid="quick-check-stimulus"
                  className="mt-4 border-l-4 border-primary bg-muted/55 px-4 py-4 text-sm leading-7 sm:px-5"
                >
                  {question.passageTitle ? (
                    <p className="mb-3 font-heading text-xl font-black sm:text-2xl">
                      {question.passageTitle}
                    </p>
                  ) : null}
                  <p>{focusedStimulus ?? question.stimulus}</p>
                  {focusedStimulus ? (
                    <details className="mt-3 border-t border-foreground/15 pt-2">
                      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                        Full passage
                      </summary>
                      <p className="pb-2 text-muted-foreground">
                        {question.stimulus}
                      </p>
                    </details>
                  ) : null}
                </article>
              ) : null}
              {question.lineReference ? (
                <p className="mt-5 font-mono text-xs font-black text-muted-foreground uppercase">
                  {question.lineReference}
                </p>
              ) : null}
              <h2
                ref={questionHeadingRef}
                tabIndex={-1}
                className="mt-5 scroll-mt-20 text-lg leading-7 font-bold outline-none sm:text-xl sm:leading-8"
              >
                {question.prompt}
              </h2>
              <RadioGroup
                value={selectedChoice}
                onValueChange={setSelectedChoice}
                aria-label={`Answer choices for Quick Check question ${payload.responseCount + 1}`}
                className="mt-5 gap-2.5"
              >
                {question.choices.map((choice, index) => (
                  <label
                    key={choice.id}
                    data-testid="quick-check-choice"
                    className={cn(
                      "grid cursor-pointer grid-cols-[2.25rem_minmax(0,1fr)] items-start rounded-xl border border-border bg-background px-4 py-3 text-sm leading-6 transition-[background-color,border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 focus-within:outline-none hover:border-primary hover:bg-muted/50",
                      selectedChoice === choice.id &&
                        "border-primary bg-secondary ring-1 ring-primary/20"
                    )}
                  >
                    <VisuallyHiddenRadioGroupItem value={choice.id} />
                    <strong className="font-mono text-base text-primary">
                      {String.fromCharCode(65 + index)}
                    </strong>
                    <span className="min-w-0">{choice.text}</span>
                  </label>
                ))}
              </RadioGroup>
              <p className="sr-only">Keyboard: 1–4 or A–D chooses an answer.</p>
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
                className="mt-4 w-full"
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
            </section>
          </div>
        )}

        {canViewTechnicalDetails ? (
          <details className="group mx-auto mt-6 max-w-3xl border-y-2 border-foreground bg-[var(--rail)]">
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
                Scout uses a two-parameter Item Response Theory-shaped model
                (2PL IRT). Easy, medium, and hard questions use preset
                difficulty and discrimination constants assigned in this app;
                they are not calibrated from a national sample. Unanswered items
                are ranked by Fisher information at the current theta, plus
                +1.35 for an unseen section, +0.24 for the least-covered
                section, and +0.12 for an unseen skill. Current theta:{" "}
                {signed(payload.estimate.theta)}. Model version:{" "}
                {payload.model.version}.
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
                        detail="Calculated from theta and preset item parameters"
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
                        coverage bonuses. It is not a probability. Exact ties
                        use higher unbonused item information, then the
                        question-bank item ID. Displayed scores are rounded to
                        two decimals.
                      </p>
                      <ol className="mt-4">
                        {payload.selection?.candidates.map(
                          (candidate, index) => (
                            <CandidateRow
                              key={candidate.id}
                              candidate={candidate}
                              rank={index + 1}
                              selected={
                                candidate.id ===
                                payload.selection?.selectedItemId
                              }
                            />
                          )
                        )}
                      </ol>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </details>
        ) : null}
      </main>
      <RapidAnswerCoachDialog
        open={rapidAnswerCoach.open}
        onDismiss={rapidAnswerCoach.dismiss}
      />
    </>
  )
}
