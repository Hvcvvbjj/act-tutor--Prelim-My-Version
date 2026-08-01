import {
  tasksForStudyWeek,
  type LessonCheckResult,
  type StudyPlanTask,
} from "@act-tutor/core"

interface LearningTaskReconciliationInput {
  tasks: ReadonlyArray<StudyPlanTask>
  today: string
  roundNumber: number
  completedSkills: ReadonlyArray<string>
  lessonHistory?: ReadonlyArray<
    Pick<LessonCheckResult, "roundNumber" | "skill" | "completedAt">
  >
  completedAtFallback: string
}

export interface StudyTaskStatusSummary {
  scheduledDays: number
  scheduledMinutes: number
  completedDays: number
  completedMinutes: number
  missedDays: number
  missedMinutes: number
}

export function learningAwareStudyTasks({
  tasks,
  today,
  roundNumber,
  completedSkills,
  lessonHistory = [],
  completedAtFallback,
}: LearningTaskReconciliationInput) {
  const completedSkillSet = new Set(completedSkills)
  const completedAtBySkill = new Map(
    lessonHistory
      .filter((result) => result.roundNumber === roundNumber)
      .map((result) => [result.skill, result.completedAt])
  )
  const verifiedTaskIds = new Set<string>()
  const reconciled = tasks.map((task) => {
    const taskSkill = task.skill
    const verifiedComplete =
      task.date === today &&
      (task.kind === "lesson" || task.kind === "focus") &&
      taskSkill !== null &&
      completedSkillSet.has(taskSkill)
    if (!verifiedComplete) return task
    verifiedTaskIds.add(task.id)
    if (task.status === "complete") return task
    return {
      ...task,
      status: "complete" as const,
      completedAt: completedAtBySkill.get(taskSkill) ?? completedAtFallback,
    }
  })

  return { tasks: reconciled, verifiedTaskIds }
}

export function summarizeStudyTaskStatuses(
  tasks: ReadonlyArray<StudyPlanTask>
): StudyTaskStatusSummary {
  const scheduledDates = new Set<string>()
  const completedDates = new Set<string>()
  const missedDates = new Set<string>()
  let scheduledMinutes = 0
  let completedMinutes = 0
  let missedMinutes = 0

  for (const task of tasks) {
    if (task.status === "complete") {
      completedDates.add(task.date)
      completedMinutes += task.minutes
    } else if (task.status === "skipped") {
      missedDates.add(task.date)
      missedMinutes += task.minutes
    } else {
      scheduledDates.add(task.date)
      scheduledMinutes += task.minutes
    }
  }

  return {
    scheduledDays: scheduledDates.size,
    scheduledMinutes,
    completedDays: completedDates.size,
    completedMinutes,
    missedDays: missedDates.size,
    missedMinutes,
  }
}

export function summarizeStudyWeekStatuses(
  tasks: ReadonlyArray<StudyPlanTask>,
  weekStart: string
) {
  return summarizeStudyTaskStatuses(tasksForStudyWeek(tasks, weekStart))
}
