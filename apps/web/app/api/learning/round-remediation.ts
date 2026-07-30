import type { AssessmentRemediationProgress } from "@act-tutor/core"

export function assertRoundRemediationComplete(
  source: "diagnostic" | "full-test",
  remediation: AssessmentRemediationProgress | null
) {
  if (remediation?.status === "complete") return
  throw new RangeError(
    source === "diagnostic"
      ? "Correct every missed diagnostic question with Mr. Kim before starting the next lesson round."
      : "Correct every missed full-test question with Mr. Kim before starting the next lesson round."
  )
}
