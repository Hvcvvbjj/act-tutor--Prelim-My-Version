import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

import {
  historyMrKimContext,
  historyMrKimQuestion,
} from "@/components/tutor/history-surface"

describe("History surface", () => {
  it("sends Mr. Kim the exact missed answer context", () => {
    const question = historyMrKimQuestion({
      id: "mistake-1",
      questionId: "question-1",
      skill: "linear-equations",
      section: "math",
      skillLabel: "Linear equations",
      prompt: "Solve 3x = 12.",
      selectedChoiceText: "x = 3",
      correctChoiceText: "x = 4",
      rationale: "Divide both sides by 3.",
      resolved: false,
    })
    expect(question).toBe(
      "I missed this Linear equations question. Explain the reasoning in plain English, show me the decision rule, and give me one similar example."
    )
    expect(question.length).toBeLessThanOrEqual(500)
    expect(question).toContain("give me one similar example")
    const context = historyMrKimContext({
      id: "mistake-1",
      questionId: "question-1",
      skill: "linear-equations",
      section: "math",
      skillLabel: "Linear equations",
      prompt: "Solve 3x = 12.",
      selectedChoiceText: "x = 3",
      correctChoiceText: "x = 4",
      rationale: "Divide both sides by 3.",
      resolved: false,
    })
    expect(context.length).toBeLessThanOrEqual(1_600)
    expect(JSON.parse(context)).toMatchObject({
      k: "saved-mistake",
      g: "linear-equations",
      c: "x = 4",
    })
  })

  it("preserves the meaningful difference between long answer choices", () => {
    const sharedPrefix =
      "Its original tracking motor, however, turns unevenly after decades of use"
    const question = historyMrKimQuestion({
      id: "mistake-2",
      questionId: "question-2",
      skill: "sentence-boundaries",
      section: "english",
      skillLabel: "Sentence boundaries",
      prompt: "Which revision correctly joins the clauses?",
      selectedChoiceText: `${sharedPrefix}, the staff therefore guides the telescope by hand during long exposures.`,
      correctChoiceText: `${sharedPrefix}; therefore, the staff guides the telescope by hand during long exposures.`,
      rationale: "The clauses are complete, so a semicolon joins them.",
      resolved: false,
    })

    const context = JSON.parse(
      historyMrKimContext({
        id: "mistake-2",
        questionId: "question-2",
        skill: "sentence-boundaries",
        section: "english",
        skillLabel: "Sentence boundaries",
        prompt: "Which revision correctly joins the clauses?",
        selectedChoiceText: `${sharedPrefix}, the staff therefore guides the telescope by hand during long exposures.`,
        correctChoiceText: `${sharedPrefix}; therefore, the staff guides the telescope by hand during long exposures.`,
        rationale: "The clauses are complete, so a semicolon joins them.",
        resolved: false,
      })
    ) as { a: string; c: string }

    expect(context.a).toBe(
      `${sharedPrefix}, the staff therefore guides the telescope by hand during long exposures.`
    )
    expect(context.c).toBe(
      `${sharedPrefix}; therefore, the staff guides the telescope by hand during long exposures.`
    )
    expect(context.a).not.toBe(context.c)
    expect(
      historyMrKimContext({
        id: "mistake-2",
        questionId: "question-2",
        skill: "sentence-boundaries",
        section: "english",
        skillLabel: "Sentence boundaries",
        prompt: "Which revision correctly joins the clauses?",
        selectedChoiceText: `${sharedPrefix}, the staff therefore guides the telescope by hand during long exposures.`,
        correctChoiceText: `${sharedPrefix}; therefore, the staff guides the telescope by hand during long exposures.`,
        rationale: "The clauses are complete, so a semicolon joins them.",
        resolved: false,
      }).length
    ).toBeLessThanOrEqual(1_600)
    expect(question.length).toBeLessThanOrEqual(500)
  })

  it("keeps assessments, lesson checks, scores, and AI review in one ledger", async () => {
    const source = await readFile(
      new URL("./history-surface.tsx", import.meta.url),
      "utf8"
    )

    expect(source).toContain("Every miss, in one place.")
    expect(source).toContain("Lesson checks and focused practice")
    expect(source).toContain("Practice estimate")
    expect(source).toContain("Section practice estimates")
    expect(source).toContain("not official ACT scores")
    expect(source).toContain("Ask Mr. Kim")
    expect(source).toContain("entry.sectionScores")
  })
})
