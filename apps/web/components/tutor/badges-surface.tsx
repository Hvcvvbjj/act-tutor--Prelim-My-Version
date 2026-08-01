"use client"

import type {
  MotivationBadge,
  MotivationBadgeCategory,
  MotivationBadgeIcon,
  MotivationBadgeTier,
  MotivationSectionProgress,
  MotivationSkillProgress,
} from "@act-tutor/core"
import {
  POINTS_PER_MOMENTUM_LEVEL,
  buildMotivationBadges,
  pointsProgressToNextMomentumLevel,
} from "@act-tutor/core"
import {
  ArrowRightIcon,
  AwardIcon,
  BookOpenCheckIcon,
  BrainCircuitIcon,
  CalendarCheck2Icon,
  CheckIcon,
  CircleDotIcon,
  FlameIcon,
  GaugeIcon,
  LanguagesIcon,
  Layers3Icon,
  LockKeyholeIcon,
  MedalIcon,
  SigmaIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TargetIcon,
  TrendingUpIcon,
  TrophyIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const CATEGORY_COPY: Record<
  MotivationBadgeCategory,
  { label: string; icon: typeof AwardIcon }
> = {
  streak: { label: "Streaks", icon: FlameIcon },
  mastery: { label: "Skill mastery", icon: BrainCircuitIcon },
  section: { label: "Section mastery", icon: ShieldCheckIcon },
  improvement: { label: "Score and momentum", icon: TrendingUpIcon },
  consistency: { label: "Consistency", icon: CalendarCheck2Icon },
  volume: { label: "Practice volume", icon: CircleDotIcon },
  round: { label: "Learning rounds", icon: TrophyIcon },
}

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

const TIER_LABELS: Record<MotivationBadgeTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  single: "Achievement",
}

const TIER_CLASSES: Record<MotivationBadgeTier, string> = {
  bronze:
    "border-[var(--scout-coral)] bg-[color-mix(in_srgb,var(--scout-coral),white_88%)] text-[var(--scout-coral-text)]",
  silver: "border-[#7f8b9c] bg-muted text-foreground",
  gold: "border-[var(--scout-sun)] bg-accent text-accent-foreground",
  platinum:
    "border-primary bg-[var(--scout-mint)] text-secondary-foreground ring-2 ring-primary/20 ring-offset-2",
  single: "border-primary bg-secondary text-primary",
}

const TONE_CLASSES: Record<MotivationBadge["tone"], string> = {
  primary: "border-primary/35 bg-secondary text-primary",
  coral:
    "border-[var(--scout-coral)] bg-[color-mix(in_srgb,var(--scout-coral),white_90%)] text-[var(--scout-coral-text)]",
  sun: "border-[var(--scout-sun)] bg-accent text-accent-foreground",
  mint: "border-primary/30 bg-[var(--info-surface)] text-primary",
  ink: "border-foreground bg-foreground text-background",
}

function formatScore(value: number) {
  return Number(value.toFixed(2)).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })
}

function formatBadgeProgress(badge: MotivationBadge) {
  if (badge.target <= 1) {
    return `${Math.round(badge.progress * 100)}% / ${Math.round(
      badge.target * 100
    )}%`
  }
  return `${formatScore(badge.progress)} / ${formatScore(badge.target)}`
}

function formatCount(value: number, singular: string) {
  return `${value.toLocaleString("en-US")} ${
    value === 1 ? singular : `${singular}s`
  }`
}

interface BadgeFamily {
  id: string
  badges: MotivationBadge[]
  earned: MotivationBadge | null
  next: MotivationBadge | null
}

function badgeFamilies(badges: ReadonlyArray<MotivationBadge>) {
  const grouped = new Map<string, MotivationBadge[]>()
  for (const badge of badges) {
    const family = grouped.get(badge.familyId) ?? []
    family.push(badge)
    grouped.set(badge.familyId, family)
  }
  return [...grouped.entries()].map(([id, familyBadges]): BadgeFamily => {
    const sorted = familyBadges.toSorted(
      (left, right) => left.tierIndex - right.tierIndex
    )
    return {
      id,
      badges: sorted,
      earned: sorted.filter((badge) => badge.earned).at(-1) ?? null,
      next: sorted.find((badge) => !badge.earned) ?? null,
    }
  })
}

function TierRail({ family }: { family: BadgeFamily }) {
  return (
    <ol
      className="mt-3 flex flex-wrap gap-2"
      aria-label={`${family.earned?.scopeLabel ?? family.next?.scopeLabel ?? "Badge"} evolution tiers`}
    >
      {family.badges.map((badge) => (
        <li
          key={badge.id}
          className={cn(
            "flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-black",
            badge.earned
              ? TIER_CLASSES[badge.tier]
              : "border-border bg-background text-muted-foreground"
          )}
          title={badge.description}
        >
          {badge.earned ? (
            <CheckIcon className="size-3" aria-hidden="true" />
          ) : (
            <LockKeyholeIcon className="size-3" aria-hidden="true" />
          )}
          {TIER_LABELS[badge.tier]}
        </li>
      ))}
    </ol>
  )
}

function BadgeFamilyRow({ family }: { family: BadgeFamily }) {
  const display = family.next ?? family.earned ?? family.badges[0]
  if (!display) return null
  const Icon = BADGE_ICONS[display.icon]
  const progress = Math.min(100, (display.progress / display.target) * 100)
  return (
    <li
      className="grid gap-4 border-b border-border py-5 last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_minmax(10rem,0.42fr)] sm:items-center"
      data-earned={family.earned ? "true" : "false"}
    >
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-full border",
          TONE_CLASSES[display.tone]
        )}
      >
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-heading text-lg leading-tight font-black">
            {family.earned?.title ?? display.title}
          </h3>
          {family.earned ? (
            <span className="ink-label text-primary">
              {TIER_LABELS[family.earned.tier]}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          {family.next
            ? `Next: ${family.next.title}. ${family.next.description}`
            : "Every tier in this badge family is complete."}
        </p>
        <TierRail family={family} />
      </div>
      <div className="min-w-0">
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={`${display.title} badge progress`}
          aria-valuemin={0}
          aria-valuemax={display.target}
          aria-valuenow={display.progress}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 font-mono text-xs font-bold text-muted-foreground">
          {family.next ? formatBadgeProgress(family.next) : "Complete"}
        </p>
      </div>
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
  consistentWeeks?: number
  estimatedActImprovement?: number
  skillProgress?: ReadonlyArray<MotivationSkillProgress>
  sectionProgress?: ReadonlyArray<MotivationSectionProgress>
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
  consistentWeeks = 0,
  estimatedActImprovement = 0,
  skillProgress,
  sectionProgress,
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
    consistentWeeks,
    estimatedActImprovement,
    skillProgress,
    sectionProgress,
  })
  const pointProgress = pointsProgressToNextMomentumLevel(points)
  const earned = badges.filter((badge) => badge.earned)
  const families = badgeFamilies(badges)
  const nextFamily = families
    .filter((family) => family.next)
    .toSorted((left, right) => {
      const leftNext = left.next
      const rightNext = right.next
      if (!leftNext || !rightNext) return 0
      return (
        rightNext.progress / rightNext.target -
        leftNext.progress / leftNext.target
      )
    })[0]
  const nextBadge = nextFamily?.next ?? null
  const nextMomentumLevel = pointProgress.completedLevels + 1
  const familiesByCategory = (
    Object.keys(CATEGORY_COPY) as MotivationBadgeCategory[]
  ).map((category) => ({
    category,
    families: families.filter(
      (family) => family.badges[0]?.category === category
    ),
  }))

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
            <p className="ink-label">Earned through real work</p>
          </div>
          <h1 className="mt-2 font-heading text-3xl leading-tight font-black tracking-[-0.035em] sm:text-4xl">
            Badges
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Each family evolves from Bronze to Platinum as your scored work,
            mastery, and consistency grow.
          </p>
        </div>
        <p className="font-mono text-sm font-bold text-muted-foreground">
          {earned.length} of {badges.length} tiers earned
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
              Toward momentum level {nextMomentumLevel}
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
              points to momentum level {nextMomentumLevel}
            </p>
            <p className="font-bold text-primary">
              1,000 study points = one momentum level
            </p>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Points track completed study and unlock momentum levels. They do not
            change skill or assessment estimates; those come from scored
            answers.
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
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="flex items-center gap-2 text-sm font-semibold">
                <CalendarCheck2Icon
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
                Weeks on plan
              </dt>
              <dd className="font-mono font-black tabular-nums">
                {consistentWeeks}
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
            <p className="ink-label text-muted-foreground">Closest evolution</p>
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
            Every current badge tier is earned.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep practicing to protect your streak and your secure skills.
          </p>
        </section>
      )}

      <div className="py-3">
        {familiesByCategory.map(({ category, families: categoryFamilies }) => {
          if (categoryFamilies.length === 0) return null
          const categoryCopy = CATEGORY_COPY[category]
          const CategoryIcon = categoryCopy.icon
          return (
            <section
              key={category}
              className="border-b border-border py-6 last:border-b-0"
              aria-labelledby={`badge-category-${category}`}
            >
              <div className="flex items-center gap-2 text-primary">
                <CategoryIcon className="size-5" aria-hidden="true" />
                <h2
                  id={`badge-category-${category}`}
                  className="font-heading text-2xl font-black"
                >
                  {categoryCopy.label}
                </h2>
              </div>
              <ol className="mt-2">
                {categoryFamilies.map((family) => (
                  <BadgeFamilyRow key={family.id} family={family} />
                ))}
              </ol>
            </section>
          )
        })}
      </div>
    </main>
  )
}
