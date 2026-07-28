"use client"

import type { MotivationBadge, MotivationBadgeCategory } from "@act-tutor/core"
import {
  POINTS_PER_MOMENTUM_LEVEL,
  buildMotivationBadges,
  pointsProgressToNextMomentumLevel,
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
  improvement: { label: "Momentum", icon: GaugeIcon },
  consistency: { label: "Consistency", icon: CalendarCheck2Icon },
  milestone: { label: "Milestone", icon: TrophyIcon },
}

function formatScore(value: number) {
  return Number(value.toFixed(2)).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })
}

function formatBadgeProgress(badge: MotivationBadge) {
  return `${formatScore(badge.progress)} / ${formatScore(badge.target)}`
}

function formatCount(value: number, singular: string) {
  return `${value.toLocaleString("en-US")} ${
    value === 1 ? singular : `${singular}s`
  }`
}

function BadgeItem({ badge }: { badge: MotivationBadge }) {
  const category = CATEGORY_COPY[badge.category]
  const Icon = category.icon
  const progress = Math.min(100, (badge.progress / badge.target) * 100)

  return (
    <li
      className={cn(
        "relative overflow-hidden rounded-xl border p-4",
        badge.earned
          ? "border-primary/35 bg-secondary/70"
          : "border-border bg-background"
      )}
      data-earned={badge.earned ? "true" : "false"}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full border",
            badge.earned
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-muted text-muted-foreground"
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="sr-only">{category.label}</p>
          <h3 className="font-heading text-base leading-tight font-black">
            {badge.title}
          </h3>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {badge.description}
          </p>
        </div>
        <span
          className={cn(
            "mt-0.5 shrink-0",
            badge.earned ? "text-primary" : "text-muted-foreground"
          )}
        >
          {badge.earned ? (
            <CheckIcon className="size-3.5" aria-hidden="true" />
          ) : (
            <LockKeyholeIcon className="size-3.5" aria-hidden="true" />
          )}
          <span className="sr-only">
            {badge.earned ? "Earned" : "In progress"}
          </span>
        </span>
      </div>
      <div
        className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"
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
  completedRounds: number
  completedSets: number
  totalAnswered: number
  secureSkills: number
  totalSkills: number
  className?: string
  onContinueStudying?: () => void
}

export function BadgesSurface({
  points,
  currentStreak,
  longestStreak,
  completedLessons,
  completedRounds,
  completedSets,
  totalAnswered,
  secureSkills,
  totalSkills,
  className,
  onContinueStudying,
}: BadgesSurfaceProps) {
  const badges = buildMotivationBadges({
    points,
    currentStreak,
    longestStreak,
    completedLessons,
    completedRounds,
    completedSets,
    totalAnswered,
    secureSkills,
    totalSkills,
  })
  const pointProgress = pointsProgressToNextMomentumLevel(points)
  const earned = badges.filter((badge) => badge.earned)
  const nextBadge = badges
    .filter((badge) => !badge.earned)
    .sort(
      (left, right) =>
        right.progress / right.target - left.progress / left.target
    )[0]
  const nextMomentumLevel = pointProgress.completedLevels + 1

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cn(
        "mx-auto w-full max-w-6xl px-4 py-7 sm:px-7 lg:py-8",
        className
      )}
      data-testid="badges-surface"
    >
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-primary">
            <MedalIcon className="size-5" aria-hidden="true" />
            <p className="ink-label">Your momentum</p>
          </div>
          <h1 className="mt-2 font-heading text-3xl leading-tight font-black tracking-[-0.035em] sm:text-4xl">
            Badges
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Earn them through streaks, practice, mastery, and milestones.
          </p>
        </div>
        <p className="font-mono text-sm font-bold text-muted-foreground">
          {earned.length} of {badges.length} earned
        </p>
      </header>

      <section
        className="mt-6 grid overflow-hidden rounded-2xl border bg-background lg:grid-cols-[minmax(0,1.4fr)_minmax(17rem,0.6fr)]"
        aria-labelledby="points-title"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-2 text-primary">
            <SparklesIcon className="size-5" aria-hidden="true" />
            <h2 id="points-title" className="text-sm font-black">
              Momentum level {nextMomentumLevel}
            </h2>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="font-heading text-4xl font-black tracking-[-0.045em] tabular-nums sm:text-5xl">
              {pointProgress.pointsInCurrentLevel.toLocaleString("en-US")}
            </p>
            <p className="font-bold text-muted-foreground">
              / {POINTS_PER_MOMENTUM_LEVEL.toLocaleString("en-US")} pts
            </p>
          </div>
          <div
            className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={`Points toward momentum level ${nextMomentumLevel}`}
            aria-valuemin={0}
            aria-valuemax={POINTS_PER_MOMENTUM_LEVEL}
            aria-valuenow={pointProgress.pointsInCurrentLevel}
          >
            <div
              className="h-full rounded-full bg-[var(--scout-coral)] transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${pointProgress.progress * 100}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="font-semibold">
              {pointProgress.pointsUntilNextLevel.toLocaleString("en-US")}{" "}
              points to the next level
            </p>
            <p className="text-muted-foreground">1,000 points per level</p>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Points track completed study. Scored answers update ACT estimates.
          </p>
        </div>

        <aside
          className="border-t px-5 py-4 lg:border-t-0 lg:border-l"
          aria-label="Momentum"
        >
          <dl className="divide-y">
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="flex items-center gap-2 text-sm font-semibold">
                <FlameIcon
                  className="size-4 text-[var(--scout-coral-text)]"
                  aria-hidden="true"
                />
                Current streak
              </dt>
              <dd className="font-mono font-black tabular-nums">
                {formatCount(currentStreak, "day")}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheckIcon
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
                Secure skills
              </dt>
              <dd className="font-mono font-black tabular-nums">
                {secureSkills}/{totalSkills}
              </dd>
            </div>
          </dl>
          {onContinueStudying ? (
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full"
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
          className="mt-6 grid gap-4 border-y py-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
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

      <section className="py-6" aria-labelledby="collection-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2
            id="collection-title"
            className="font-heading text-2xl font-black"
          >
            All badges
          </h2>
        </div>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((badge) => (
            <BadgeItem key={badge.id} badge={badge} />
          ))}
        </ol>
      </section>
    </main>
  )
}
