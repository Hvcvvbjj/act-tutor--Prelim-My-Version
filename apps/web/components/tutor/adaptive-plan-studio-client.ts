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

const DEFAULT_STUDY_DAY_ORDER: ReadonlyArray<StudyWeekday> = [
  "mon",
  "wed",
  "fri",
  "tue",
  "thu",
  "sat",
  "sun",
]

const WEEKDAY_BY_UTC_DAY: ReadonlyArray<StudyWeekday> = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
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
  return (
    existing.copyVersion === 2 &&
    existing.testDate === input.testDate &&
    sameScores(existing.current, input.current) &&
    sameScores(existing.target, input.target)
  )
}

export function defaultStudyAvailability(
  today: string,
  studyDaysPerWeek: number,
  minutesPerSession: number
): StudyAvailability {
  const utcDay = new Date(`${today}T00:00:00.000Z`).getUTCDay()
  const todayWeekday = WEEKDAY_BY_UTC_DAY[utcDay]
  const weekdays = [
    todayWeekday,
    ...DEFAULT_STUDY_DAY_ORDER.filter((weekday) => weekday !== todayWeekday),
  ].slice(0, studyDaysPerWeek)

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
    return studyPlanRequest({
      action: "start",
      today: input.today,
      testDate: input.testDate,
      current: input.current,
      target: input.target,
      skills: input.skills,
      availability: defaultStudyAvailability(
        input.today,
        input.studyDaysPerWeek,
        input.minutesPerSession
      ),
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
