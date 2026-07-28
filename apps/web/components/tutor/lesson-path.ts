import type { CoreSection } from "@act-tutor/core"

export type LessonPathStatus = "completed" | "current" | "available" | "locked"

export interface LessonPathItem {
  id: string
  title: string
  section?: CoreSection
  description?: string
  minutes?: number
  status: LessonPathStatus
}

export interface LessonPathSkill {
  skill: string
  label: string
  section: CoreSection
}

interface BuildLessonPathItemsInput {
  requiredSkills: ReadonlyArray<string>
  completedSkills: ReadonlyArray<string>
  currentSkill?: string | null
  skills: ReadonlyArray<LessonPathSkill>
  currentLessonMinutes?: number
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ")
}

export function buildLessonPathItems({
  requiredSkills,
  completedSkills,
  currentSkill,
  skills,
  currentLessonMinutes,
}: BuildLessonPathItemsInput): LessonPathItem[] {
  const completed = new Set(completedSkills)
  const skillById = new Map(skills.map((skill) => [skill.skill, skill]))
  const firstIncomplete =
    requiredSkills.find((skill) => !completed.has(skill)) ?? null
  const activeSkill =
    currentSkill && requiredSkills.includes(currentSkill)
      ? currentSkill
      : firstIncomplete
  let activeSeen = false

  return requiredSkills.map((skill) => {
    const definition = skillById.get(skill)
    const isComplete = completed.has(skill)
    const isCurrent = !isComplete && skill === activeSkill
    const status: LessonPathStatus = isComplete
      ? "completed"
      : isCurrent
        ? "current"
        : activeSeen
          ? "locked"
          : "available"

    if (isCurrent) activeSeen = true

    return {
      id: skill,
      title: definition?.label ?? titleFromSlug(skill),
      section: definition?.section,
      minutes: isCurrent ? currentLessonMinutes : undefined,
      status,
    }
  })
}
