import { describe, expect, it } from "vitest"

import {
  diagnosticPurposeForStorage,
  restoreDiagnosticPurpose,
} from "@/lib/tutor-resume"

describe("diagnostic resume state", () => {
  it("restores a sequential-round diagnostic after refresh", () => {
    const storedPurpose = diagnosticPurposeForStorage(
      "diagnostic-runner",
      "round"
    )

    expect(
      restoreDiagnosticPurpose({
        storageVersion: 6,
        resumeSurface: "diagnostic-runner",
        diagnosticPurpose: storedPurpose,
      })
    ).toBe("round")
  })

  it("defaults older or malformed resume data to the baseline flow", () => {
    expect(
      restoreDiagnosticPurpose({
        storageVersion: 5,
        resumeSurface: "diagnostic-runner",
        diagnosticPurpose: "round",
      })
    ).toBe("baseline")
    expect(
      restoreDiagnosticPurpose({
        storageVersion: 6,
        resumeSurface: "dashboard",
        diagnosticPurpose: "round",
      })
    ).toBe("baseline")
    expect(
      restoreDiagnosticPurpose({
        storageVersion: 6,
        resumeSurface: "diagnostic",
        diagnosticPurpose: "unexpected",
      })
    ).toBe("baseline")
  })

  it("does not retain a round marker after leaving diagnostic surfaces", () => {
    expect(diagnosticPurposeForStorage("dashboard", "round")).toBeNull()
  })
})
