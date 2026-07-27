export type DiagnosticPurpose = "baseline" | "round"

const DIAGNOSTIC_SURFACES = new Set(["diagnostic", "diagnostic-runner"])

export function isResumableDiagnosticSurface(
  value: unknown
): value is "diagnostic" | "diagnostic-runner" {
  return typeof value === "string" && DIAGNOSTIC_SURFACES.has(value)
}

export function diagnosticPurposeForStorage(
  surface: unknown,
  purpose: DiagnosticPurpose
): DiagnosticPurpose | null {
  return isResumableDiagnosticSurface(surface) ? purpose : null
}

export function restoreDiagnosticPurpose(input: {
  storageVersion: unknown
  resumeSurface: unknown
  diagnosticPurpose: unknown
}): DiagnosticPurpose {
  if (
    input.storageVersion !== 6 ||
    !isResumableDiagnosticSurface(input.resumeSurface)
  ) {
    return "baseline"
  }
  return input.diagnosticPurpose === "round" ? "round" : "baseline"
}
