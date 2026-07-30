import type { ExamLabSessionPayload } from "@act-tutor/core"

type RoundFullTestSession = Pick<
  ExamLabSessionPayload,
  "id" | "mode" | "status"
>

export function shouldResumeRoundFullTest(
  session: RoundFullTestSession | null | undefined,
  latestRoundRewardId: string | null | undefined
) {
  if (!session || session.mode !== "core") return false
  if (session.status === "in_progress") return true
  return latestRoundRewardId !== `round-reward:full-test:${session.id}`
}
