import type {
  AdaptiveStudyPlan,
  CoreSectionScores,
  StudyAvailability,
  StudySkillSignal,
  StudyWeekday,
} from "@act-tutor/core"

type PlanResponse = { plan: AdaptiveStudyPlan | null } | { error: string }

export interface InitialStudyPlanInput {
  today: string
  testDate: string
  current: CoreSectionScores
  target: CoreSectionScores
  skills: ReadonlyArray<StudySkillSignal>
  studyDaysPerWeek: number
  minutesPerSession: number
}

const WEEKDAY_BY_UTC_DAY: ReadonlyArray<StudyWeekday> = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
]

const LEGACY_DEFAULT_STUDY_DAY_ORDER: ReadonlyArray<StudyWeekday> = [
  "mon",
  "wed",
  "fri",
  "tue",
  "thu",
  "sat",
  "sun",
]

function responseError(payload: PlanResponse, fallback: string) {
  return "error" in payload ? payload.error : fallback
}

async function existingStudyPlan() {
  const response = await fetch("/api/study-plan", {
    method: "GET",
    cache: "no-store",
  })
  const payload = (await response.json()) as PlanResponse
  if (!response.ok || "error" in payload) {
    throw new Error(responseError(payload, "Study plan request failed."))
  }
  return payload.plan
}

export async function studyPlanRequest(body: Record<string, unknown>) {
  const response = await fetch("/api/study-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const payload = (await response.json()) as PlanResponse
  if (!response.ok || "error" in payload || payload.plan === null) {
    throw new Error(responseError(payload, "Study plan request failed."))
  }
  return payload.plan
}

function sameScores(left: CoreSectionScores, right: CoreSectionScores) {
  return (
    left.english === right.english &&
    left.math === right.math &&
    left.reading === right.reading
  )
}

function sameAvailability(left: StudyAvailability, right: StudyAvailability) {
  if (left.entries.length !== right.entries.length) return false
  const rightByDay = new Map(
    right.entries.map((entry) => [entry.weekday, entry.minutes])
  )
  return left.entries.every(
    (entry) => rightByDay.get(entry.weekday) === entry.minutes
  )
}

function isDefaultAvailability(plan: AdaptiveStudyPlan) {
  const firstMinutes = plan.availability.entries[0]?.minutes
  if (!firstMinutes) return false
  if (
    plan.availability.entries.some((entry) => entry.minutes !== firstMinutes)
  ) {
    return false
  }
  return [
    "2026-07-20",
    "2026-07-21",
    "2026-07-22",
    "2026-07-23",
    "2026-07-24",
    "2026-07-25",
    "2026-07-26",
  ].some((representativeDate) => {
    const utcDay = new Date(`${representativeDate}T00:00:00.000Z`).getUTCDay()
    const todayWeekday = WEEKDAY_BY_UTC_DAY[utcDay]
    const legacyAvailability: StudyAvailability = {
      entries: [
        todayWeekday,
        ...LEGACY_DEFAULT_STUDY_DAY_ORDER.filter(
          (weekday) => weekday !== todayWeekday
        ),
      ]
        .slice(0, plan.availability.entries.length)
        .map((weekday) => ({ weekday, minutes: firstMinutes })),
    }
    return (
      sameAvailability(
        plan.availability,
        defaultStudyAvailability(
          representativeDate,
          plan.availability.entries.length,
          firstMinutes
        )
      ) || sameAvailability(plan.availability, legacyAvailability)
    )
  })
}

function sameSkills(
  left: ReadonlyArray<StudySkillSignal>,
  right: ReadonlyArray<StudySkillSignal>
) {
  if (left.length !== right.length) return false
  const rightBySkill = new Map(right.map((skill) => [skill.skill, skill]))
  return left.every((skill) => {
    const candidate = rightBySkill.get(skill.skill)
    return (
      candidate?.label === skill.label &&
      candidate.section === skill.section &&
      candidate.mastery === skill.mastery &&
      candidate.evidence === skill.evidence &&
      candidate.nextReviewAt === skill.nextReviewAt &&
      candidate.priority === skill.priority
    )
  })
}

function canResumePlan(
  existing: AdaptiveStudyPlan,
  input: InitialStudyPlanInput
) {
  const requestedAvailability = defaultStudyAvailability(
    input.today,
    input.studyDaysPerWeek,
    input.minutesPerSession
  )
  return (
    existing.copyVersion === 2 &&
    existing.testDate === input.testDate &&
    sameScores(existing.current, input.current) &&
    sameScores(existing.target, input.target) &&
    (!isDefaultAvailability(existing) ||
      (existing.today === input.today
        ? sameAvailability(existing.availability, requestedAvailability)
        : existing.availability.entries.length === input.studyDaysPerWeek &&
          existing.availability.entries.every(
            (entry) => entry.minutes === input.minutesPerSession
          )))
  )
}

export function defaultStudyAvailability(
  today: string,
  studyDaysPerWeek: number,
  minutesPerSession: number
): StudyAvailability {
  const utcDay = new Date(`${today}T00:00:00.000Z`).getUTCDay()
  const offsets = Array.from({ length: studyDaysPerWeek }, (_, index) =>
    Math.floor((index * WEEKDAY_BY_UTC_DAY.length) / studyDaysPerWeek)
  )
  const weekdays = offsets.map(
    (offset) =>
      WEEKDAY_BY_UTC_DAY[(utcDay + offset) % WEEKDAY_BY_UTC_DAY.length]
  )

  return {
    entries: weekdays.map((weekday) => ({
      weekday,
      minutes: minutesPerSession,
    })),
  }
}

export async function loadInitialStudyPlan(input: InitialStudyPlanInput) {
  const existing = await existingStudyPlan()
  if (!existing || !canResumePlan(existing, input)) {
    const requestedAvailability = defaultStudyAvailability(
      input.today,
      input.studyDaysPerWeek,
      input.minutesPerSession
    )
    return studyPlanRequest({
      action: "start",
      today: input.today,
      testDate: input.testDate,
      current: input.current,
      target: input.target,
      skills: input.skills,
      availability:
        existing && !isDefaultAvailability(existing)
          ? existing.availability
          : requestedAvailability,
    })
  }

  const resumed =
    existing.today === input.today
      ? existing
      : await studyPlanRequest({ action: "catch_up", today: input.today })

  return sameSkills(resumed.skills, input.skills)
    ? resumed
    : studyPlanRequest({ action: "sync_evidence", skills: input.skills })
}
