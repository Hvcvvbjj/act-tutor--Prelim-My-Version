import { describe, expect, it } from "vitest"

import {
  describeMasteryEvidenceOrigin,
  describeMasteryStartingEvidence,
} from "./mastery-evidence-copy"

describe("mastery evidence copy", () => {
  it("identifies diagnostic answers as the source of an unchanged estimate", () => {
    const state = {
      baselineEvidence: 4,
      evidenceCount: 4,
      observations: 0,
      priorSource: "diagnostic" as const,
    }

    expect(describeMasteryEvidenceOrigin(state)).toBe(
      "All 4 came from your diagnostic."
    )
    expect(describeMasteryStartingEvidence(state)).toBe(
      "Your diagnostic set this estimate from 4 scored answers. No later lesson or Quick Check answer has changed it yet."
    )
  })

  it("separates diagnostic evidence from later skill answers", () => {
    expect(
      describeMasteryEvidenceOrigin({
        baselineEvidence: 4,
        evidenceCount: 6,
        observations: 2,
        priorSource: "diagnostic",
      })
    ).toBe("4 from your diagnostic · 2 from later lessons or Quick Check")
  })

  it("labels score-based and neutral starting points honestly", () => {
    expect(
      describeMasteryEvidenceOrigin({
        baselineEvidence: 0,
        evidenceCount: 0,
        observations: 0,
        priorSource: "score-estimate",
      })
    ).toBe(
      "Starting point comes from the score you entered; no skill-specific answers yet."
    )
    expect(
      describeMasteryStartingEvidence({
        baselineEvidence: 0,
        evidenceCount: 0,
        observations: 0,
        priorSource: "neutral-prior",
      })
    ).toBe(
      "This is a neutral starting estimate until you answer a scored lesson or Quick Check question in this skill."
    )
  })
})
