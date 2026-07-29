import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

async function source(relativePath: string) {
  return readFile(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8")
}

describe("assessment completion focus", () => {
  it("gives every Quick Check result a focused level-one heading", async () => {
    const quickCheck = await source("./adaptive-calibration-lab.tsx")
    const proofReplay = quickCheck.slice(
      quickCheck.indexOf("function AdaptiveProofReplay"),
      quickCheck.indexOf("export function AdaptiveCalibrationLab")
    )
    const genericCompletion = quickCheck.slice(
      quickCheck.indexOf("showAdaptiveProofReplay && proof"),
      quickCheck.indexOf('data-testid="quick-check-question-card"')
    )

    expect(proofReplay).toContain("<h1")
    expect(proofReplay).not.toContain("<h2")
    expect(quickCheck).toContain("completionHeadingRef.current?.focus")
    expect(genericCompletion).toContain("ref={completionHeadingRef}")
    expect(genericCompletion).toContain("tabIndex={-1}")
  })

  it("focuses both completed and unavailable missed-question states", async () => {
    const remediation = await source("./assessment-remediation.tsx")
    const completed = remediation.slice(
      remediation.indexOf('progress.status === "complete"'),
      remediation.indexOf("if (!current)")
    )
    const unavailable = remediation.slice(
      remediation.indexOf("if (!current)"),
      remediation.indexOf("const activeItem")
    )

    expect(completed).toContain("ref={headingRef}")
    expect(completed).toContain("tabIndex={-1}")
    expect(unavailable).toContain("ref={headingRef}")
    expect(unavailable).toContain("tabIndex={-1}")
  })
})
