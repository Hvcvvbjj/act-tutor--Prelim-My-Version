import type { DiagnosticResult, DiagnosticSkillResult } from "@act-tutor/core"

export function learningBaselineSkillResults(input: {
  profileSkillResults: ReadonlyArray<DiagnosticSkillResult>
  diagnosticResult?: Pick<DiagnosticResult, "skillResults">
}) {
  const persisted = input.profileSkillResults
  const source =
    persisted.length > 0
      ? persisted
      : (input.diagnosticResult?.skillResults ?? [])
  return source.map((result) => ({ ...result }))
}
