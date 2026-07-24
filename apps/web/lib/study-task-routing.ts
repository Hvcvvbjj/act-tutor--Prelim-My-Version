import type {
  CoreSection,
  LearningSessionPayload,
  StudyPlanTask,
} from "@act-tutor/core"

type TaskRoutingInput = Pick<StudyPlanTask, "kind" | "section" | "skill">
type LearningRoutingInput = Pick<
  LearningSessionPayload,
  "mode" | "status" | "todaySkill"
>

export type StudyTaskLaunchDecision =
  | {
      type: "timed-practice"
      mode: "core" | "section"
      section: CoreSection
    }
  | { type: "continue-current" }
  | { type: "blocked" }
  | { type: "start-checkpoint" }
  | { type: "start-retention"; skill: string }
  | { type: "start-skill"; skill: string }
  | { type: "unavailable" }

function matchesCurrentMission(
  task: TaskRoutingInput,
  learning: LearningRoutingInput
) {
  if (learning.status === "complete") return false
  if (task.kind === "checkpoint") return learning.mode === "checkpoint"
  if (task.skill === null || task.skill !== learning.todaySkill) return false
  if (task.kind === "review") return learning.mode === "retention"
  if (task.kind === "lesson" || task.kind === "focus") {
    return learning.mode === "focus"
  }
  return false
}

export function studyTaskLaunchDecision(
  task: TaskRoutingInput,
  learning: LearningRoutingInput
): StudyTaskLaunchDecision {
  if (task.kind === "rehearsal") {
    return { type: "timed-practice", mode: "core", section: "english" }
  }
  if (task.kind === "timed") {
    return {
      type: "timed-practice",
      mode: "section",
      section: task.section ?? "english",
    }
  }
  if (learning.status !== "complete") {
    return matchesCurrentMission(task, learning)
      ? { type: "continue-current" }
      : { type: "blocked" }
  }
  if (task.kind === "checkpoint") return { type: "start-checkpoint" }
  if (task.kind === "review" && task.skill) {
    return { type: "start-retention", skill: task.skill }
  }
  if (task.skill) return { type: "start-skill", skill: task.skill }
  return { type: "unavailable" }
}
