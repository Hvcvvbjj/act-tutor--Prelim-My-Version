import { describe, expect, it } from "vitest"

import { describeLearnerEvidence } from "./learner-model-evidence"

describe("learner evidence descriptions", () => {
  it("does not present an unmeasured starting value as scored evidence", () => {
    expect(describeLearnerEvidence("exploring", 0)).toEqual({
      label: "Starting estimate",
      description:
        "No skill-specific scored answers support this yet. Use it only as a starting point until you practice this skill.",
    })
  })

  it.each([
    ["exploring", 2, "Early estimate", "Fewer than 3"],
    ["forming", 5, "Developing estimate", "more practice"],
    ["stable", 7, "Steadier estimate", "At least 7"],
  ] as const)(
    "translates %s evidence into plain learner language",
    (confidence, evidenceCount, label, descriptionFragment) => {
      const status = describeLearnerEvidence(confidence, evidenceCount)

      expect(status.label).toBe(label)
      expect(status.description).toContain(descriptionFragment)
    }
  )
})
