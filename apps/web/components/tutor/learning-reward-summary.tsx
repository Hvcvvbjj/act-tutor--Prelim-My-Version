"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type {
  BadgeEvolutionEvent,
  LearningRoundRewardSummary as LearningRoundReward,
  LessonRewardSummary,
  MotivationBadge,
  MotivationBadgeIcon,
  MotivationBadgeTier,
  RewardGrowthAxis,
} from "@act-tutor/core"
import { buildLessonRewardNarrationPrompt } from "@act-tutor/core"
import {
  AwardIcon,
  BookOpenCheckIcon,
  BrainCircuitIcon,
  CalendarCheck2Icon,
  ChevronRightIcon,
  CircleDotIcon,
  FlameIcon,
  GaugeIcon,
  LanguagesIcon,
  Layers3Icon,
  MedalIcon,
  SigmaIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TargetIcon,
  TrendingUpIcon,
  TrophyIcon,
  Volume2Icon,
  VolumeXIcon,
  XIcon,
} from "lucide-react"

import { ScoutMark } from "@/components/tutor/scout"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const DISMISSED_ROUND_REWARDS_KEY = "scout-dismissed-round-rewards-v1"
const DISMISSED_CELEBRATIONS_KEY = "scout-dismissed-celebrations-v2"
const CELEBRATION_AUDIO_KEY = "scout-celebration-audio-v1"

const BADGE_ICONS: Record<MotivationBadgeIcon, typeof AwardIcon> = {
  award: AwardIcon,
  "book-open": BookOpenCheckIcon,
  brain: BrainCircuitIcon,
  "calendar-check": CalendarCheck2Icon,
  "circle-dot": CircleDotIcon,
  flame: FlameIcon,
  gauge: GaugeIcon,
  languages: LanguagesIcon,
  layers: Layers3Icon,
  medal: MedalIcon,
  sigma: SigmaIcon,
  "shield-check": ShieldCheckIcon,
  sparkles: SparklesIcon,
  target: TargetIcon,
  "trending-up": TrendingUpIcon,
  trophy: TrophyIcon,
}

const TIER_LABEL: Record<MotivationBadgeTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  single: "Achievement",
}

const TIER_STYLE: Record<MotivationBadgeTier, string> = {
  bronze:
    "border-[var(--scout-coral)] bg-[color-mix(in_srgb,var(--scout-coral),white_88%)] text-[var(--scout-coral-text)]",
  silver: "border-[#7f8b9c] bg-muted text-foreground",
  gold: "border-[var(--scout-sun)] bg-accent text-accent-foreground",
  platinum:
    "border-primary bg-[var(--scout-mint)] text-secondary-foreground ring-4 ring-primary/15 ring-offset-4",
  single: "border-primary bg-secondary text-primary",
}

export type LessonRewardNarrationProvider = (input: {
  prompt: string
  reward: LessonRewardSummary
}) => Promise<string | null>

function formatSigned(value: number) {
  if (value > 0) return `+${value}`
  return String(value)
}

function formatEquivalent(value: number) {
  return Number(value.toFixed(3)).toLocaleString("en-US", {
    maximumFractionDigits: 3,
  })
}

function readStringArray(key: string, storage: Storage) {
  try {
    const value = JSON.parse(storage.getItem(key) ?? "[]") as unknown
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : []
  } catch {
    return []
  }
}

function rememberString(key: string, value: string, storage: Storage) {
  const next = Array.from(
    new Set([...readStringArray(key, storage), value])
  ).slice(-40)
  storage.setItem(key, JSON.stringify(next))
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return reduced
}

function useAnimatedNumber(target: number, duration = 700) {
  const reducedMotion = useReducedMotion()
  const [value, setValue] = useState(reducedMotion ? target : 0)
  useEffect(() => {
    if (reducedMotion) {
      const frame = window.requestAnimationFrame(() => setValue(target))
      return () => window.cancelAnimationFrame(frame)
    }
    let frame = 0
    const startedAt = performance.now()
    const tick = (now: number) => {
      const elapsed = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - (1 - elapsed) ** 3
      setValue(target * eased)
      if (elapsed < 1) frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [duration, reducedMotion, target])
  return value
}

function polygonClip(values: ReadonlyArray<number>) {
  if (values.length < 3) {
    return "polygon(50% 10%, 90% 80%, 10% 80%)"
  }
  return `polygon(${values
    .map((value, index) => {
      const angle = -Math.PI / 2 + (index / values.length) * Math.PI * 2
      const radius = 42 * Math.max(0.12, Math.min(1, value))
      return `${50 + Math.cos(angle) * radius}% ${
        50 + Math.sin(angle) * radius
      }%`
    })
    .join(",")})`
}

function GrowthPolygon({
  axes,
  className,
}: {
  axes: ReadonlyArray<RewardGrowthAxis>
  className?: string
}) {
  const reducedMotion = useReducedMotion()
  const [revealed, setRevealed] = useState(reducedMotion)
  useEffect(() => {
    if (reducedMotion) {
      const frame = window.requestAnimationFrame(() => setRevealed(true))
      return () => window.cancelAnimationFrame(frame)
    }
    const frame = window.requestAnimationFrame(() => setRevealed(true))
    return () => window.cancelAnimationFrame(frame)
  }, [axes, reducedMotion])
  const safeAxes =
    axes.length >= 3
      ? axes
      : [
          { id: "one", label: "Skill", before: 0.25, after: 0.25 },
          { id: "two", label: "Practice", before: 0.25, after: 0.25 },
          { id: "three", label: "Momentum", before: 0.25, after: 0.25 },
        ]
  const beforeClip = polygonClip(safeAxes.map((axis) => axis.before))
  const afterClip = polygonClip(
    safeAxes.map((axis) => (revealed ? axis.after : axis.before))
  )
  return (
    <figure
      className={cn("min-w-0", className)}
      aria-label={`Growth map: ${safeAxes
        .map(
          (axis) =>
            `${axis.label} ${Math.round(axis.before * 100)} to ${Math.round(
              axis.after * 100
            )} percent`
        )
        .join(", ")}`}
    >
      <div
        className="relative mx-auto aspect-square w-40 rounded-full border border-border bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] bg-[size:16px_16px] sm:w-48"
        aria-hidden="true"
      >
        <div
          className="absolute inset-3 bg-muted-foreground/20"
          style={{ clipPath: beforeClip }}
        />
        <div
          className="absolute inset-3 bg-primary/80 transition-[clip-path] duration-700 ease-out motion-reduce:transition-none"
          style={{ clipPath: afterClip }}
        />
        <div className="absolute inset-[48%] rounded-full bg-foreground" />
      </div>
      <figcaption className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[0.68rem] font-bold text-muted-foreground">
        {safeAxes.map((axis) => (
          <span key={axis.id}>
            {axis.label} +
            {Math.max(0, Math.round((axis.after - axis.before) * 100))}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}

function BadgeSeal({
  badge,
  className,
}: {
  badge: MotivationBadge
  className?: string
}) {
  const Icon = BADGE_ICONS[badge.icon]
  return (
    <div
      className={cn(
        "relative flex aspect-square w-32 flex-col items-center justify-center rounded-full border-2 text-center shadow-[0_14px_36px_rgb(16_33_63_/_0.16)]",
        TIER_STYLE[badge.tier],
        className
      )}
    >
      <Icon className="size-10" aria-hidden="true" />
      <span className="mt-2 max-w-24 text-xs leading-tight font-black">
        {badge.title}
      </span>
      <span className="mt-1 font-mono text-[0.6rem] font-black tracking-[0.12em] uppercase">
        {TIER_LABEL[badge.tier]}
      </span>
    </div>
  )
}

function BadgeEventPill({ event }: { event: BadgeEvolutionEvent }) {
  const Icon = BADGE_ICONS[event.badge.icon]
  const evolutionLabel =
    event.kind === "evolved"
      ? `${event.previousBadge ? TIER_LABEL[event.previousBadge.tier] : "Earlier tier"} → ${TIER_LABEL[event.badge.tier]}`
      : `${TIER_LABEL[event.badge.tier]} earned`
  return (
    <li
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-full border px-3 py-2",
        TIER_STYLE[event.badge.tier]
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="truncate text-sm font-black">
        {evolutionLabel}: {event.badge.title}
      </span>
    </li>
  )
}

function playCelebrationSound() {
  try {
    const context = new AudioContext()
    const startedAt = context.currentTime
    const notes = [523.25, 659.25, 783.99]
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const noteStart = startedAt + index * 0.08
      oscillator.type = "sine"
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, noteStart)
      gain.gain.exponentialRampToValueAtTime(0.045, noteStart + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.18)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(noteStart)
      oscillator.stop(noteStart + 0.2)
    })
    window.setTimeout(() => void context.close(), 650)
  } catch {
    // Browsers may block audio until the next user gesture. The reward remains
    // fully visible and usable without sound.
  }
}

function RewardCelebrationOverlay({
  rewardId,
  events,
  growth,
  headline,
  support,
}: {
  rewardId: string
  events: ReadonlyArray<BadgeEvolutionEvent>
  growth: ReadonlyArray<RewardGrowthAxis>
  headline: string
  support: string
}) {
  const [visible, setVisible] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const playedRef = useRef(false)
  const primaryEvent = events[0] ?? null

  useEffect(() => {
    if (!primaryEvent) return
    const dismissed = readStringArray(
      DISMISSED_CELEBRATIONS_KEY,
      window.sessionStorage
    ).includes(rewardId)
    const frame = window.requestAnimationFrame(() => {
      setAudioEnabled(
        window.localStorage.getItem(CELEBRATION_AUDIO_KEY) !== "off"
      )
      setVisible(!dismissed)
      playedRef.current = false
    })
    return () => window.cancelAnimationFrame(frame)
  }, [primaryEvent, rewardId])

  useEffect(() => {
    if (!visible) return
    closeRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        rememberString(
          DISMISSED_CELEBRATIONS_KEY,
          rewardId,
          window.sessionStorage
        )
        setVisible(false)
      }
      if (event.key === "Tab") {
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
          ) ?? []
        )
        const first = focusable[0]
        const last = focusable.at(-1)
        if (!first || !last) return
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [rewardId, visible])

  useEffect(() => {
    if (!visible || !audioEnabled || playedRef.current || !primaryEvent) return
    playedRef.current = true
    playCelebrationSound()
  }, [audioEnabled, primaryEvent, visible])

  if (!visible || !primaryEvent) return null

  const dismiss = () => {
    rememberString(DISMISSED_CELEBRATIONS_KEY, rewardId, window.sessionStorage)
    setVisible(false)
  }

  return (
    <div
      className="fixed inset-0 z-[100] grid overflow-y-auto bg-foreground/78 p-4 backdrop-blur-sm sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${rewardId}-celebration-title`}
      data-testid="badge-celebration"
    >
      <section
        ref={dialogRef}
        className="relative m-auto w-full max-w-4xl overflow-hidden rounded-3xl bg-background shadow-2xl"
      >
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={
              audioEnabled
                ? "Turn celebration sound off"
                : "Turn celebration sound on"
            }
            onClick={() => {
              const next = !audioEnabled
              setAudioEnabled(next)
              window.localStorage.setItem(
                CELEBRATION_AUDIO_KEY,
                next ? "on" : "off"
              )
            }}
          >
            {audioEnabled ? <Volume2Icon /> : <VolumeXIcon />}
          </Button>
          <Button
            ref={closeRef}
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Close badge celebration"
            onClick={dismiss}
          >
            <XIcon />
          </Button>
        </div>

        <div className="grid min-h-[34rem] lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)]">
          <div className="flex flex-col justify-center px-6 py-16 text-center sm:px-12 lg:text-left">
            <div className="mx-auto flex items-center gap-3 lg:mx-0">
              <ScoutMark mood="correct" className="size-16" />
              <p className="ink-label text-primary">Mr. Kim says</p>
            </div>
            <p className="ink-label mt-8 text-[var(--scout-coral-text)]">
              {primaryEvent.kind === "evolved"
                ? "Badge evolved"
                : "New badge earned"}
            </p>
            <h2
              id={`${rewardId}-celebration-title`}
              className="mt-2 font-heading text-4xl leading-[1.02] font-black tracking-[-0.045em] sm:text-6xl"
            >
              {headline}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-muted-foreground lg:mx-0">
              {support}
            </p>
            {events.length > 1 ? (
              <ul className="mt-6 flex flex-wrap justify-center gap-2 lg:justify-start">
                {events.slice(1, 5).map((event) => (
                  <BadgeEventPill key={event.familyId} event={event} />
                ))}
              </ul>
            ) : null}
            <Button
              type="button"
              size="lg"
              className="mt-8 self-center lg:self-start"
              onClick={dismiss}
            >
              Keep going
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </div>
          <div className="flex flex-col items-center justify-center gap-7 border-t bg-secondary/55 px-6 py-12 lg:border-t-0 lg:border-l">
            <BadgeSeal
              badge={primaryEvent.badge}
              className="w-44 motion-safe:animate-in motion-safe:duration-500 motion-safe:zoom-in-75"
            />
            <GrowthPolygon axes={growth} />
          </div>
        </div>
      </section>
    </div>
  )
}

function legacyLessonBadgeEvents(
  reward: LessonRewardSummary
): ReadonlyArray<BadgeEvolutionEvent> {
  if (reward.badgeEvents?.length) return reward.badgeEvents
  return (reward.newlyEarnedBadges ?? []).map((badge) => {
    const normalized: MotivationBadge = {
      ...badge,
      familyId: badge.familyId ?? badge.id,
      tier: badge.tier ?? "single",
      tierIndex: badge.tierIndex ?? 0,
      icon: badge.icon ?? "award",
      tone: badge.tone ?? "primary",
      scopeLabel: badge.scopeLabel ?? null,
    }
    return {
      familyId: normalized.familyId,
      kind: "earned" as const,
      badge: normalized,
      previousBadge: null,
    }
  })
}

function lessonGrowth(reward: LessonRewardSummary) {
  return reward.growth?.length
    ? reward.growth
    : [
        { id: "skill", label: "Skill", before: 0.35, after: 0.45 },
        { id: "practice", label: "Practice", before: 0.35, after: 0.45 },
        { id: "momentum", label: "Momentum", before: 0.35, after: 0.45 },
      ]
}

export function LessonRewardSummaryCard({
  reward,
  roundComplete,
  onContinue,
  loadNarration,
}: {
  reward: LessonRewardSummary
  roundComplete: boolean
  onContinue: () => void
  loadNarration?: LessonRewardNarrationProvider
}) {
  const progressPercent = Math.round(
    reward.progressToNextEstimatedActPoint * 100
  )
  const badgeEvents = useMemo(() => legacyLessonBadgeEvents(reward), [reward])
  const growth = useMemo(() => lessonGrowth(reward), [reward])
  const [narration, setNarration] = useState<string | null>(null)

  useEffect(() => {
    if (!loadNarration) return
    let active = true
    void loadNarration({
      prompt: buildLessonRewardNarrationPrompt(reward),
      reward,
    })
      .then((message) => {
        if (active && message?.trim()) setNarration(message.trim())
      })
      .catch(() => {
        // The deterministic summary remains available when AI narration fails.
      })
    return () => {
      active = false
    }
  }, [loadNarration, reward])

  const fallbackNarration = badgeEvents.length
    ? `You earned ${reward.pointsGained.toLocaleString("en-US")} points and ${badgeEvents.length === 1 ? "a new badge" : `${badgeEvents.length} badge upgrades`}. That came from scored work in ${reward.skillLabel}.`
    : `You earned ${reward.pointsGained.toLocaleString("en-US")} points in ${reward.skillLabel}. Your progress is saved even without a new badge this time.`

  return (
    <>
      <RewardCelebrationOverlay
        rewardId={reward.id}
        events={badgeEvents}
        growth={growth}
        headline={
          badgeEvents[0]?.badge.title ?? `${reward.skillLabel} complete`
        }
        support={
          badgeEvents[0]?.kind === "evolved"
            ? `Your ${badgeEvents[0].previousBadge?.title ?? "badge"} evolved to ${TIER_LABEL[badgeEvents[0].badge.tier]}. ${reward.pointsGained.toLocaleString("en-US")} lesson points moved the skill map, too.`
            : `You earned ${TIER_LABEL[badgeEvents[0]?.badge.tier ?? "single"]} through scored work in ${reward.skillLabel}.`
        }
      />
      <section
        className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-4xl flex-col justify-center px-5 py-12 sm:px-8"
        aria-labelledby="lesson-reward-title"
        data-testid="lesson-reward-summary"
      >
        <div className="grid gap-6 border-y border-border py-7 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
          <ScoutMark mood="correct" className="mx-auto size-20 sm:mx-0" />
          <div className="min-w-0 text-center sm:text-left">
            <p className="ink-label text-primary">Mr. Kim says</p>
            <h2
              id="lesson-reward-title"
              className="mt-2 font-heading text-4xl leading-tight font-black tracking-[-0.035em] sm:text-5xl"
            >
              {reward.skillLabel} is complete.
            </h2>
            <p
              className="mt-3 text-lg leading-8 text-muted-foreground"
              aria-live="polite"
            >
              {narration ?? fallbackNarration}
            </p>
          </div>
          <GrowthPolygon axes={growth} className="sm:max-w-44" />
        </div>

        <div className="grid gap-7 py-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="ink-label text-muted-foreground">
                  Toward the next estimated ACT point
                </p>
                <p className="mt-2 font-heading text-3xl font-black tracking-[-0.03em] tabular-nums">
                  {reward.pointsTowardNextEstimatedActPoint.toLocaleString(
                    "en-US"
                  )}
                  <span className="ml-2 text-base text-muted-foreground">
                    / 1,000
                  </span>
                </p>
              </div>
              <p className="font-mono text-sm font-bold text-primary tabular-nums">
                {progressPercent}%
              </p>
            </div>
            <div
              className="mt-3 h-3 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Study points toward the next estimated ACT point"
              aria-valuemin={0}
              aria-valuemax={1_000}
              aria-valuenow={reward.pointsTowardNextEstimatedActPoint}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-700 motion-reduce:transition-none"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              1,000 study points equals one estimated ACT composite point in
              AlexACT&apos;s motivational system. Scored diagnostics and full
              tests set the separate assessment estimate.
            </p>
          </div>
          <div className="text-left lg:text-right">
            <p className="ink-label text-muted-foreground">This lesson</p>
            <p className="mt-1 font-heading text-4xl font-black text-primary tabular-nums">
              +{reward.pointsGained.toLocaleString("en-US")}
            </p>
            <p className="text-sm font-bold text-muted-foreground">
              study points
            </p>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <div className="flex items-center gap-2">
            <AwardIcon className="size-5 text-primary" aria-hidden="true" />
            <h3 className="font-heading text-lg font-black">
              {badgeEvents.length
                ? "Badges earned or evolved this lesson"
                : "Badge progress saved"}
            </h3>
          </div>
          {badgeEvents.length ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {badgeEvents.map((event) => (
                <BadgeEventPill key={event.familyId} event={event} />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              No new badge this time. These points still moved every related
              milestone forward.
            </p>
          )}
        </div>

        <Button
          type="button"
          size="lg"
          className="mt-8 self-center sm:self-end"
          onClick={onContinue}
        >
          {roundComplete ? "Choose next assessment" : "Back to Lessons"}
          <ChevronRightIcon data-icon="inline-end" />
        </Button>
      </section>
    </>
  )
}

function readDismissedRewardIds() {
  return readStringArray(DISMISSED_ROUND_REWARDS_KEY, window.sessionStorage)
}

export function LearningRoundRewardSummary({
  reward,
  className,
}: {
  reward: LearningRoundReward
  className?: string
}) {
  const [dismissed, setDismissed] = useState(true)
  const pointsCounter = useAnimatedNumber(reward.pointsGained)
  const scoreCounter = useAnimatedNumber(
    Math.abs(reward.estimatedActScoreDelta),
    600
  )
  const badgeEvents = reward.badgeEvents ?? []
  const growth =
    reward.growth?.length > 0
      ? reward.growth
      : [
          { id: "score", label: "ACT estimate", before: 0.4, after: 0.45 },
          { id: "points", label: "Points", before: 0.35, after: 0.45 },
          { id: "round", label: "Rounds", before: 0.3, after: 0.4 },
        ]

  useEffect(() => {
    const frame = window.requestAnimationFrame(() =>
      setDismissed(readDismissedRewardIds().includes(reward.id))
    )
    return () => window.cancelAnimationFrame(frame)
  }, [reward.id])

  if (dismissed) return null

  const scoreMovedUp = reward.estimatedActScoreDelta > 0
  const scoreHeld = reward.estimatedActScoreDelta === 0
  const headline = scoreMovedUp
    ? `Up ${reward.estimatedActScoreDelta} estimated ACT point${reward.estimatedActScoreDelta === 1 ? "" : "s"}`
    : scoreHeld
      ? "Round complete"
      : "The next round is adjusted"

  return (
    <>
      <RewardCelebrationOverlay
        rewardId={reward.id}
        events={badgeEvents}
        growth={growth}
        headline={badgeEvents[0]?.badge.title ?? headline}
        support={`Round ${reward.completedRoundNumber} added exactly ${reward.pointsGained.toLocaleString("en-US")} study points. Your scored assessment estimate moved from ${reward.estimatedActScoreBefore} to ${reward.estimatedActScoreAfter}.`}
      />
      <section
        className={cn(
          "relative grid gap-5 border-y border-primary/25 bg-secondary/55 px-4 py-6 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-5",
          className
        )}
        aria-labelledby="round-reward-title"
        data-testid="round-reward-summary"
      >
        <ScoutMark
          mood={scoreMovedUp ? "correct" : scoreHeld ? "ready" : "thinking"}
          className="size-14"
        />
        <div className="min-w-0 pr-8">
          <p className="ink-label text-primary">Mr. Kim says</p>
          <h2
            id="round-reward-title"
            className="mt-1 font-heading text-2xl leading-tight font-black tracking-[-0.025em]"
          >
            {scoreMovedUp
              ? `Your assessment estimate moved up ${Math.round(scoreCounter)}.`
              : scoreHeld
                ? "Your assessment estimate held steady."
                : `This estimate moved ${Math.round(scoreCounter)} point${Math.round(scoreCounter) === 1 ? "" : "s"} down. That’s okay—we’ll adjust the next round.`}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase">
                Round {reward.completedRoundNumber}
              </p>
              <p
                className="mt-1 font-heading text-xl font-black tabular-nums"
                aria-label={`${reward.pointsGained} study points gained`}
              >
                +{Math.round(pointsCounter).toLocaleString("en-US")} pts
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase">
                Assessment estimate
              </p>
              <p className="mt-1 font-heading text-xl font-black tabular-nums">
                {reward.estimatedActScoreBefore} →{" "}
                {reward.estimatedActScoreAfter}{" "}
                <span className="text-sm text-primary">
                  ({formatSigned(reward.estimatedActScoreDelta)})
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase">
                1,000-to-1 point equivalent
              </p>
              <p className="mt-1 font-heading text-xl font-black tabular-nums">
                +{formatEquivalent(reward.studyPointActEquivalent)}
              </p>
            </div>
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <SparklesIcon
              className="mt-0.5 size-3.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            The assessment change comes from scored answers. Exactly 1,000 study
            points equals one motivational ACT-point estimate; neither is an
            official ACT score.
          </p>
          {badgeEvents.length ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {badgeEvents.map((event) => (
                <BadgeEventPill key={event.familyId} event={event} />
              ))}
            </ul>
          ) : null}
        </div>
        <GrowthPolygon axes={growth} className="hidden max-w-40 lg:block" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-3 right-3"
          aria-label="Dismiss round reward summary"
          onClick={() => {
            rememberString(
              DISMISSED_ROUND_REWARDS_KEY,
              reward.id,
              window.sessionStorage
            )
            setDismissed(true)
          }}
        >
          <XIcon />
        </Button>
      </section>
    </>
  )
}
