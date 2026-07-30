import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { NeedsWorkSurface } from "./needs-work-surface"
import { buildNeedsWorkItems, needsWorkVideoGuide } from "./needs-work"

const diagnostic = [
  {
    skill: "sentence-boundaries",
    label: "Sentence boundaries",
    section: "english",
    correct: 1,
    total: 5,
    accuracy: 0.2,
    signal: "focus",
  },
  {
    skill: "linear-equations",
    label: "Linear equations",
    section: "math",
    correct: 3,
    total: 5,
    accuracy: 0.6,
    signal: "developing",
  },
  {
    skill: "supported-inference",
    label: "Supported inference",
    section: "reading",
    correct: 4,
    total: 5,
    accuracy: 0.8,
    signal: "strength",
  },
] as const

describe("needs work ranking", () => {
  it("ranks only scored skills below the learner's goal threshold", () => {
    const items = buildNeedsWorkItems({
      diagnosticSkillResults: diagnostic,
      goalScore: 31,
    })

    expect(items.map((item) => item.skill)).toEqual([
      "sentence-boundaries",
      "linear-equations",
    ])
    expect(items.map((item) => item.rank)).toEqual([1, 2])
    expect(items[0]?.evidenceLabel).toBe("1 of 5 correct on the diagnostic")
    expect(items[0]?.targetReadiness).toBe(0.8)
  })

  it("uses later scored learning evidence without admitting neutral estimates", () => {
    const items = buildNeedsWorkItems({
      diagnosticSkillResults: diagnostic,
      knowledgeStates: [
        {
          skill: "sentence-boundaries",
          label: "Sentence boundaries",
          section: "english",
          predictedCorrectProbability: 0.67,
          baselineEvidence: 5,
          observations: 2,
          evidenceCount: 7,
          priorSource: "diagnostic",
          lastUpdate: {
            correct: false,
            difficulty: "medium",
            learnedBefore: 0.62,
            posteriorAfterEvidence: 0.3,
            learnedAfterTransition: 0.36,
            predictedCorrectAfter: 0.67,
            delta: -0.26,
            observedAt: "2026-07-28T12:00:00.000Z",
          },
        },
        {
          skill: "functions-and-modeling",
          label: "Functions and modeling",
          section: "math",
          predictedCorrectProbability: 0.2,
          baselineEvidence: 0,
          observations: 0,
          evidenceCount: 0,
          priorSource: "neutral-prior",
          lastUpdate: null,
        },
      ],
      goalScore: 31,
    })

    expect(items.map((item) => item.skill)).not.toContain(
      "functions-and-modeling"
    )
    expect(
      items.find((item) => item.skill === "sentence-boundaries")
    ).toMatchObject({
      readiness: 0.67,
      latestAnswerMissed: true,
      practiceEvidence: 2,
    })
  })

  it("uses the three-of-five threshold for a goal at or below 30", () => {
    expect(
      buildNeedsWorkItems({
        diagnosticSkillResults: diagnostic,
        goalScore: 30,
      }).map((item) => item.skill)
    ).toEqual(["sentence-boundaries"])
  })

  it("builds durable, reputable channel-search links instead of invented videos", () => {
    for (const [skill, section] of [
      ["sentence-boundaries", "english"],
      ["linear-equations", "math"],
      ["supported-inference", "reading"],
    ] as const) {
      const guide = needsWorkVideoGuide(skill, section)
      const url = new URL(guide.href)
      expect(url.hostname).toBe("www.youtube.com")
      expect(["@khanacademy", "@TheOrganicChemistryTutor"]).toContain(
        url.pathname.split("/")[1]
      )
      expect(url.pathname.endsWith("/search")).toBe(true)
      expect(url.searchParams.get("query")).toBeTruthy()
      expect(url.searchParams.has("v")).toBe(false)
    }
  })

  it("renders one clear priority and labels outside video links", () => {
    const markup = renderToStaticMarkup(
      <NeedsWorkSurface diagnosticSkillResults={diagnostic} goalScore={31} />
    )

    expect(markup).toContain("Needs work")
    expect(markup).toContain("Start here")
    expect(markup).toContain("Sentence boundaries")
    expect(markup).toContain("Ask Mr. Kim")
    expect(markup).toContain("Find free videos")
    expect(markup).toContain("opens in a new tab")
    expect(markup).toContain("<a ")
    expect(markup).not.toContain('role="button"')
    expect(markup).toContain("min-h-11")
    expect(markup.match(/id=\"needs-work-priority-title\"/g)).toHaveLength(1)
  })

  it("keeps missed questions and their reviewed explanations in Needs Work", () => {
    const markup = renderToStaticMarkup(
      <NeedsWorkSurface
        diagnosticSkillResults={diagnostic}
        goalScore={31}
        mistakes={[
          {
            id: "miss-1",
            skill: "sentence-boundaries",
            skillLabel: "Sentence boundaries",
            section: "english",
            prompt: "Which punctuation correctly joins these two clauses?",
            selectedChoiceText: "A comma",
            correctChoiceText: "A semicolon",
            rationale:
              "Both sides are complete sentences, so a comma alone creates a comma splice.",
          },
        ]}
      />
    )

    expect(markup).toContain("Questions to revisit")
    expect(markup).toContain("Which punctuation correctly joins")
    expect(markup).toContain("A semicolon")
    expect(markup).toContain("Ask Mr. Kim about this")
  })
})
