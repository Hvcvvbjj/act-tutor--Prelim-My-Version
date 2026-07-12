import { calculateEmrComposite } from "./scoring"
import {
  CORE_SECTIONS,
  type ActScore,
  type CoreSection,
  type CoreSectionScores,
} from "./types"

export interface TargetVectorInput {
  current: CoreSectionScores
  goalComposite: ActScore
  opportunityWeights?: Partial<Record<CoreSection, number>>
}

export interface TargetVector {
  mode: "growth" | "retention"
  scores: CoreSectionScores
  composite: ActScore
  movement: CoreSectionScores
  totalMovement: number
  squaredMovement: number
}

export type PlanPhase = "foundation" | "balanced" | "focused" | "triage"

export interface PlanIntensityInput {
  daysUntilTest: number
  current: CoreSectionScores
  target: CoreSectionScores
  studyDaysPerWeek?: number
  minutesPerSession?: number
}

export interface PlanIntensity {
  mode: "growth" | "retention"
  phase: PlanPhase
  daysUntilTest: number
  totalSectionMovement: number
  studyDaysPerWeek: number
  minutesPerSession: number
  weeklyMinutes: number
  checkpointEveryDays: number
  mix: Readonly<{
    review: number
    lesson: number
    focusedPractice: number
    timedMixed: number
  }>
}

const PHASE_POLICY = {
  foundation: {
    checkpointEveryDays: 14,
    mix: {
      review: 0.15,
      lesson: 0.4,
      focusedPractice: 0.35,
      timedMixed: 0.1,
    },
  },
  balanced: {
    checkpointEveryDays: 7,
    mix: {
      review: 0.15,
      lesson: 0.3,
      focusedPractice: 0.35,
      timedMixed: 0.2,
    },
  },
  focused: {
    checkpointEveryDays: 7,
    mix: {
      review: 0.2,
      lesson: 0.2,
      focusedPractice: 0.35,
      timedMixed: 0.25,
    },
  },
  triage: {
    checkpointEveryDays: 3,
    mix: {
      review: 0.25,
      lesson: 0.1,
      focusedPractice: 0.25,
      timedMixed: 0.4,
    },
  },
} as const

const RETENTION_MIX = {
  review: 0.4,
  lesson: 0.1,
  focusedPractice: 0.2,
  timedMixed: 0.3,
} as const

function movementBetween(
  current: CoreSectionScores,
  target: CoreSectionScores
): CoreSectionScores {
  return {
    english: target.english - current.english,
    math: target.math - current.math,
    reading: target.reading - current.reading,
  }
}

function summarizeMovement(movement: CoreSectionScores) {
  const values = CORE_SECTIONS.map((section) => movement[section])
  return {
    totalMovement: values.reduce((sum, value) => sum + value, 0),
    squaredMovement: values.reduce(
      (sum, value) => sum + value * value,
      0
    ),
  }
}

function opportunityScore(
  movement: CoreSectionScores,
  weights: Partial<Record<CoreSection, number>>
) {
  return CORE_SECTIONS.reduce(
    (sum, section) => sum + movement[section] * (weights[section] ?? 0),
    0
  )
}

function lexicographicMovementCompare(
  left: CoreSectionScores,
  right: CoreSectionScores
) {
  for (const section of CORE_SECTIONS) {
    if (left[section] !== right[section]) {
      return right[section] - left[section]
    }
  }
  return 0
}

export function selectTargetVector(input: TargetVectorInput): TargetVector {
  const currentComposite = calculateEmrComposite(input.current)
  if (
    !Number.isInteger(input.goalComposite) ||
    input.goalComposite < 1 ||
    input.goalComposite > 36
  ) {
    throw new RangeError("Goal Composite must be an integer from 1 to 36.")
  }

  const opportunityWeights = input.opportunityWeights ?? {}
  for (const [section, weight] of Object.entries(opportunityWeights)) {
    if (!Number.isFinite(weight) || weight < 0) {
      throw new RangeError(
        `${section} opportunity weight must be finite and non-negative.`
      )
    }
  }

  if (input.goalComposite <= currentComposite) {
    const movement = movementBetween(input.current, input.current)
    return {
      mode: "retention",
      scores: input.current,
      composite: currentComposite,
      movement,
      ...summarizeMovement(movement),
    }
  }

  const candidates: TargetVector[] = []

  for (let english = input.current.english; english <= 36; english += 1) {
    for (let math = input.current.math; math <= 36; math += 1) {
      for (let reading = input.current.reading; reading <= 36; reading += 1) {
        const scores = { english, math, reading }
        const composite = calculateEmrComposite(scores)
        if (composite < input.goalComposite) continue

        const movement = movementBetween(input.current, scores)
        candidates.push({
          mode: "growth",
          scores,
          composite,
          movement,
          ...summarizeMovement(movement),
        })
      }
    }
  }

  const [best] = [...candidates].sort((left, right) => {
    if (left.squaredMovement !== right.squaredMovement) {
      return left.squaredMovement - right.squaredMovement
    }

    const opportunityDifference =
      opportunityScore(right.movement, opportunityWeights) -
      opportunityScore(left.movement, opportunityWeights)
    if (opportunityDifference !== 0) return opportunityDifference

    if (left.totalMovement !== right.totalMovement) {
      return left.totalMovement - right.totalMovement
    }

    return lexicographicMovementCompare(left.movement, right.movement)
  })

  if (!best) {
    throw new RangeError("The requested goal cannot be reached from these scores.")
  }

  return best
}

const STRICT_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function parseCalendarDate(value: string): number {
  const match = STRICT_DATE.exec(value)
  if (!match) {
    throw new RangeError("Dates must use the YYYY-MM-DD format.")
  }

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError("Date is not a valid calendar day.")
  }

  return timestamp
}

export function calendarDaysUntil(today: string, testDate: string): number {
  const difference = parseCalendarDate(testDate) - parseCalendarDate(today)
  return difference / 86_400_000
}

function phaseForDays(daysUntilTest: number): PlanPhase {
  if (daysUntilTest >= 85) return "foundation"
  if (daysUntilTest >= 35) return "balanced"
  if (daysUntilTest >= 7) return "focused"
  return "triage"
}

export function buildPlanIntensity(
  input: PlanIntensityInput
): PlanIntensity {
  if (!Number.isInteger(input.daysUntilTest) || input.daysUntilTest <= 0) {
    throw new RangeError("Days until the test must be a positive integer.")
  }

  const studyDaysPerWeek = input.studyDaysPerWeek ?? 5
  const minutesPerSession = input.minutesPerSession ?? 30
  if (
    !Number.isInteger(studyDaysPerWeek) ||
    studyDaysPerWeek < 1 ||
    studyDaysPerWeek > 7
  ) {
    throw new RangeError("Study days per week must be an integer from 1 to 7.")
  }
  if (!Number.isInteger(minutesPerSession) || minutesPerSession <= 0) {
    throw new RangeError("Minutes per session must be a positive integer.")
  }

  const movement = movementBetween(input.current, input.target)
  for (const section of CORE_SECTIONS) {
    if (movement[section] < 0) {
      throw new RangeError("Target section scores cannot be below current scores.")
    }
  }

  const { totalMovement } = summarizeMovement(movement)
  const phase = phaseForDays(input.daysUntilTest)
  const mode = totalMovement === 0 ? "retention" : "growth"
  const policy = PHASE_POLICY[phase]

  return {
    mode,
    phase,
    daysUntilTest: input.daysUntilTest,
    totalSectionMovement: totalMovement,
    studyDaysPerWeek,
    minutesPerSession,
    weeklyMinutes: studyDaysPerWeek * minutesPerSession,
    checkpointEveryDays: policy.checkpointEveryDays,
    mix: mode === "retention" ? RETENTION_MIX : policy.mix,
  }
}
