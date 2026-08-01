import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { BadgesSurface } from "./badges-surface"

describe("badge evolution surface", () => {
  it("renders tier evolution, per-skill mastery, and the exact point conversion", () => {
    const markup = renderToStaticMarkup(
      <BadgesSurface
        points={5_250}
        currentStreak={8}
        longestStreak={14}
        completedLessons={18}
        completedRounds={2}
        completedSets={26}
        totalAnswered={520}
        secureSkills={2}
        totalSkills={3}
        consistentWeeks={4}
        estimatedActImprovement={5}
        skillProgress={[
          {
            skill: "linear-equations",
            label: "Linear equations",
            section: "math",
            readiness: 0.84,
            evidenceCount: 12,
          },
          {
            skill: "sentence-boundaries",
            label: "Sentence boundaries",
            section: "english",
            readiness: 0.66,
            evidenceCount: 10,
          },
          {
            skill: "supported-inference",
            label: "Supported inference",
            section: "reading",
            readiness: 0.48,
            evidenceCount: 8,
          },
        ]}
      />
    )

    expect(markup).toContain("Bronze")
    expect(markup).toContain("Silver")
    expect(markup).toContain("Gold")
    expect(markup).toContain("Platinum")
    expect(markup).toContain("Linear equations Secure")
    expect(markup).toContain("Composite Climb +5")
    expect(markup).toContain("Toward momentum level 6")
    expect(markup).toContain("1,000 study points = one momentum level")
    expect(markup).not.toContain("estimated ACT composite point")
    expect(markup).toContain("Weeks on plan")
    expect(markup.match(/role="progressbar"/g)?.length).toBeGreaterThan(10)
  })
})
