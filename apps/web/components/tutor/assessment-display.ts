import type { DiagnosticDifficulty } from "@act-tutor/core"

export const PRACTICE_DIFFICULTY_LABELS: Record<DiagnosticDifficulty, string> =
  {
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
  }

export const PRACTICE_DIFFICULTY_STYLES: Record<DiagnosticDifficulty, string> =
  {
    easy: "border-emerald-700/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
    medium:
      "border-amber-700/30 bg-amber-500/10 text-amber-900 dark:text-amber-100",
    hard: "border-rose-700/30 bg-rose-500/10 text-rose-900 dark:text-rose-100",
  }

export function shouldShowExamLabDifficulty(assessmentLabel: string) {
  return assessmentLabel === "Progress check"
}

export function formatAssessmentTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const remainder = safeSeconds % 60

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
}

export function diagnosticTimerStorageKey(attemptId: string) {
  return `scout:diagnostic-deadline:v1:${attemptId}`
}

export function resolveAssessmentDeadline(
  storedValue: string | null,
  now: number,
  durationSeconds: number
) {
  const storedDeadline = Number(storedValue)
  if (Number.isFinite(storedDeadline) && storedDeadline > 0) {
    return storedDeadline
  }
  return now + Math.max(1, Math.floor(durationSeconds)) * 1000
}

export function assessmentSecondsRemaining(deadline: number, now: number) {
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}
