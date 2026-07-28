"use client"

import type { MotivationBadge, MotivationBadgeCategory } from "@act-tutor/core"
import {
  POINTS_PER_ACT_POINT,
  actScoreEquivalentFromPoints,
  buildMotivationBadges,
  pointsProgressToNextActPoint,
} from "@act-tutor/core"
import {
  ArrowRightIcon,
  AwardIcon,
  CalendarCheck2Icon,
  CheckIcon,
  FlameIcon,
  GaugeIcon,
  LockKeyholeIcon,
  MedalIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TargetIcon,
  TrophyIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const CATEGORY_COPY: Record<
  MotivationBadgeCategory,
  { label: string; icon: typeof AwardIcon }
> = {
  streak: { label: "Streak", icon: FlameIcon },
  mastery: { label: "Mastery", icon: ShieldCheckIcon },
  improvement: { label: "Improvement", icon: GaugeIcon },
  consistency: { label: "Consistency", icon: CalendarCheck2Icon },
  milestone: { label: "Milestone", icon: TrophyIcon },
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function formatBadgeProgress(badge: MotivationBadge) {
  const progress = Number.isInteger(badge.progress)
    ? String(badge.progress)
    : badge.progress.toFixed(1)
  return `${progress} / ${badge.target}`
}

function BadgeItem({ badge }: { badge: MotivationBadge }) {
  const category = CATEGORY_COPY[badge.category]
  const Icon = category.icon
  const progress = Math.min(100, (badge.progress / badge.target) * 100)

  return (
    <li
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5",
        badge.earned
          ? "border-primary/35 bg-secondary/70"
          : "border-border bg-background"
      )}
      data-earned={badge.earned ? "true" : "false"}
    >
      <div className="flex items-start justify-between gap-4">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full border",
            badge.earned
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-muted text-muted-foreground"
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5 text-xs font-bold",
            badge.earned ? "text-primary" : "text-muted-foreground"
          )}
        >
          {badge.earned ? (
            <CheckIcon className="size-3.5" aria-hidden="true" />
          ) : (
            <LockKeyholeIcon className="size-3.5" aria-hidden="true" />
          )}
          {badge.earned ? "Earned" : "In progress"}
        </span>
      </div>
      <p className="mt-5 text-xs font-bold tracking-[0.1em] text-muted-foreground uppercase">
        {category.label}
      </p>
      <h3 className="mt-1 font-heading text-lg leading-tight font-black">
        {badge.title}
      </h3>
      <p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">
        {badge.description}
      </p>
      <div
        className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={`${badge.title} badge progress`}
        aria-valuemin={0}
        aria-valuemax={badge.target}
        aria-valuenow={badge.progress}
      >
        <div
          className={cn(
            "h-full rounded-full",
            badge.earned ? "bg-primary" : "bg-[var(--scout-coral)]"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 font-mono text-xs font-bold text-muted-foreground">
        {formatBadgeProgress(badge)}
      </p>
    </li>
  )
}

export interface BadgesSurfaceProps {
  points: number
  currentStreak: number
  longestStreak: number
  completedLessons: number
  completedSets: number
  totalAnswered: number
  secureSkills: number
  totalSkills: number
  startingScore: number
  goalScore: number
  className?: string
  onContinueStudying?: () => void
}

export function BadgesSurface({
  points,
  currentStreak,
  longestStreak,
  completedLessons,
  completedSets,
  totalAnswered,
  secureSkills,
  totalSkills,
  startingScore,
  goalScore,
  className,
  onContinueStudying,
}: BadgesSurfaceProps) {
  const badges = buildMotivationBadges({
    points,
    currentStreak,
    longestStreak,
    completedLessons,
    completedSets,
    totalAnswered,
    secureSkills,
    totalSkills,
  })
  const pointProgress = pointsProgressToNextActPoint(points)
  const scoreEquivalent = actScoreEquivalentFromPoints(startingScore, points)
  const earned = badges.filter((badge) => badge.earned)
  const nextBadge = badges
    .filter((badge) => !badge.earned)
    .sort(
      (left, right) =>
        right.progress / right.target - left.progress / left.target
    )[0]
  const scoreGap = Math.max(0, goalScore - scoreEquivalent)

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cn(
        "mx-auto w-full max-w-6xl px-4 py-8 sm:px-7 lg:py-10",
        className
      )}
      data-testid="badges-surface"
    >
      <header className="flex flex-col gap-5 border-b-2 border-foreground pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 text-primary">
            <MedalIcon className="size-6" aria-hidden="true" />
            <p className="ink-label">Your momentum</p>
          </div>
          <h1 className="mt-3 font-heading text-4xl leading-none font-black tracking-[-0.04em] sm:text-5xl">
            Badges
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Earn badges by returning, practicing, improving, and securing ACT
            question types.
          </p>
        </div>
        <p className="font-mono text-sm font-bold text-muted-foreground">
          {earned.length} of {badges.length} earned
        </p>
      </header>

      <section
        className="grid gap-8 border-b py-9 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:gap-12"
        aria-labelledby="points-title"
      >
        <div>
          <div className="flex items-center gap-2 text-primary">
            <SparklesIcon className="size-5" aria-hidden="true" />
            <h2 id="points-title" className="text-sm font-black">
              Points toward your next ACT point
            </h2>
          </div>
          <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="font-heading text-5xl font-black tracking-[-0.05em] tabular-nums sm:text-6xl">
              {pointProgress.pointsInCurrentActPoint.toLocaleString("en-US")}
            </p>
            <p className="text-lg font-bold text-muted-foreground">
              / {POINTS_PER_ACT_POINT.toLocaleString("en-US")} pts
            </p>
          </div>
          <div
            className="mt-5 h-3 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Points toward the next ACT score point"
            aria-valuemin={0}
            aria-valuemax={POINTS_PER_ACT_POINT}
            aria-valuenow={pointProgress.pointsInCurrentActPoint}
          >
            <div
              className="h-full rounded-full bg-[var(--scout-coral)] transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${pointProgress.progress * 100}%` }}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="font-semibold">
              {pointProgress.pointsUntilNextActPoint.toLocaleString("en-US")}{" "}
              points to the next point
            </p>
            <p className="text-muted-foreground">
              {POINTS_PER_ACT_POINT.toLocaleString("en-US")} points = +1 ACT
              point
            </p>
          </div>
          <p className="mt-5 text-xs leading-5 text-muted-foreground">
            Point-based score equivalent:{" "}
            <strong className="text-foreground">
              {formatScore(scoreEquivalent)}
            </strong>{" "}
            from a {formatScore(startingScore)} baseline. This is a motivation
            marker, not a new diagnostic result.
          </p>
        </div>

        <aside className="border-l-0 lg:border-l lg:pl-9" aria-label="Momentum">
          <h2 className="font-heading text-xl font-black">Momentum</h2>
          <dl className="mt-4 divide-y border-y">
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="flex items-center gap-2 text-sm font-semibold">
                <FlameIcon
                  className="size-4 text-[var(--scout-coral-text)]"
                  aria-hidden="true"
                />
                Current streak
              </dt>
              <dd className="font-mono text-lg font-black tabular-nums">
                {currentStreak}d
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheckIcon
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
                Secure skills
              </dt>
              <dd className="font-mono text-lg font-black tabular-nums">
                {secureSkills}/{totalSkills}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="flex items-center gap-2 text-sm font-semibold">
                <TargetIcon
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
                To goal score
              </dt>
              <dd className="font-mono text-lg font-black tabular-nums">
                {scoreGap > 0 ? `${formatScore(scoreGap)} pts` : "Reached"}
              </dd>
            </div>
          </dl>
          {onContinueStudying ? (
            <Button
              type="button"
              variant="outline"
              className="mt-5 w-full"
              onClick={onContinueStudying}
            >
              Continue studying
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          ) : null}
        </aside>
      </section>

      {nextBadge ? (
        <section
          className="grid gap-4 border-b py-7 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
          aria-labelledby="next-milestone-title"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-[var(--coach-surface)] text-[var(--scout-coral-text)]">
            <AwardIcon className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="ink-label text-muted-foreground">Next milestone</p>
            <h2
              id="next-milestone-title"
              className="mt-1 font-heading text-xl font-black"
            >
              {nextBadge.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {nextBadge.description}
            </p>
          </div>
          <p className="font-mono text-sm font-bold text-muted-foreground">
            {formatBadgeProgress(nextBadge)}
          </p>
        </section>
      ) : (
        <section className="border-b py-7" aria-label="All badges earned">
          <p className="font-heading text-xl font-black">
            Every current badge is earned.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep practicing to protect your streak and your secure skills.
          </p>
        </section>
      )}

      <section className="py-9" aria-labelledby="collection-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="ink-label text-muted-foreground">Collection</p>
            <h2
              id="collection-title"
              className="mt-1 font-heading text-2xl font-black"
            >
              Badge progress
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Best streak: {longestStreak} days · {completedSets} sessions
          </p>
        </div>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((badge) => (
            <BadgeItem key={badge.id} badge={badge} />
          ))}
        </ol>
      </section>
    </main>
  )
}
