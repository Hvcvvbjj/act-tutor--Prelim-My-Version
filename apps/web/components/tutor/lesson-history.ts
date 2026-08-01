import type {
  CoreSection,
  KnowledgeState,
  LessonCheckResult,
  MotivationSectionProgress,
} from "@act-tutor/core"

const CORE_SECTIONS = ["english", "math", "reading"] as const

export interface HistoricalLessonRound {
  roundNumber: number
  cycleKind: LessonCheckResult["cycleKind"]
  lessons: ReadonlyArray<LessonCheckResult>
}

export function currentRoundLessonCheck(
  history: ReadonlyArray<LessonCheckResult>,
  roundNumber: number,
  skill: string
) {
  return [...history]
    .reverse()
    .find((check) => check.roundNumber === roundNumber && check.skill === skill)
}

export function historicalLessonRounds(
  history: ReadonlyArray<LessonCheckResult>,
  currentRoundNumber: number
): HistoricalLessonRound[] {
  const grouped = new Map<number, LessonCheckResult[]>()
  for (const check of history) {
    if (check.roundNumber >= currentRoundNumber) continue
    const lessons = grouped.get(check.roundNumber) ?? []
    lessons.push(check)
    grouped.set(check.roundNumber, lessons)
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => right - left)
    .map(([roundNumber, lessons]) => ({
      roundNumber,
      cycleKind: lessons[0]?.cycleKind ?? "adaptive",
      lessons: [...lessons].sort((left, right) =>
        left.completedAt.localeCompare(right.completedAt)
      ),
    }))
}

export function lessonReviewById(
  history: ReadonlyArray<LessonCheckResult>,
  lessonCheckId: string
) {
  return history.find((check) => check.id === lessonCheckId) ?? null
}

export function lessonBadgeSectionProgress(
  history: ReadonlyArray<LessonCheckResult>,
  skills: ReadonlyArray<
    Pick<
      KnowledgeState,
      "skill" | "section" | "learnedProbability" | "evidenceCount"
    >
  >
): MotivationSectionProgress[] {
  const sectionBySkill = new Map<string, CoreSection>(
    skills.map((skill) => [skill.skill, skill.section])
  )
  const answeredBySection: Record<CoreSection, number> = {
    english: 0,
    math: 0,
    reading: 0,
  }

  for (const check of history) {
    const section = sectionBySkill.get(check.skill)
    if (section) answeredBySection[section] += check.total
  }

  return CORE_SECTIONS.map((section) => {
    const sectionSkills = skills.filter((skill) => skill.section === section)
    return {
      section,
      secureSkills: sectionSkills.filter(
        (skill) => skill.learnedProbability >= 0.82 && skill.evidenceCount >= 6
      ).length,
      totalSkills: sectionSkills.length,
      averageReadiness:
        sectionSkills.length > 0
          ? sectionSkills.reduce(
              (total, skill) => total + skill.learnedProbability,
              0
            ) / sectionSkills.length
          : 0,
      answered: answeredBySection[section],
    }
  })
}
