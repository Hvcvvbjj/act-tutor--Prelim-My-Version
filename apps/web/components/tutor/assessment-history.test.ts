import { describe, expect, it } from "vitest"
import type {
  DiagnosticFormPublic,
  DiagnosticResult,
  ExamLabSessionPayload,
} from "@act-tutor/core"

import {
  addAssessmentHistoryEntry,
  buildDiagnosticHistoryEntry,
  buildFullTestHistoryEntry,
} from "@/components/tutor/assessment-history"

const diagnosticForm = {
  id: "diagnostic-form",
  version: "v1",
  mode: "rapid",
  title: "Diagnostic",
  estimatedMinutes: 60,
  blueprint: [],
  questions: [
    {
      id: "q1",
      section: "english",
      primarySkill: "sentence-boundaries",
      skillLabel: "Sentence boundaries",
      prompt: "Which choice completes the sentence?",
      choices: [
        { id: "a", text: "A comma" },
        { id: "b", text: "A period" },
      ],
    },
  ],
} as unknown as DiagnosticFormPublic

const diagnosticResult = {
  feedback: [
    {
      questionId: "q1",
      selectedChoiceId: "a",
      correctChoiceId: "b",
      correct: false,
      rationale: "Two complete thoughts need a period here.",
    },
  ],
  compositeRange: { low: 20, estimate: 22, high: 24 },
  planningBaseline: { english: 20, math: 23, reading: 23 },
} as unknown as DiagnosticResult

describe("assessment history records", () => {
  it("preserves the exact diagnostic prompt, choices, and reviewed rationale", () => {
    const entry = buildDiagnosticHistoryEntry({
      result: diagnosticResult,
      form: diagnosticForm,
      attemptId: "attempt-1",
      completedAt: "2026-07-29T12:00:00.000Z",
    })

    expect(entry.compositeScore).toBe(22)
    expect(entry.mistakes).toEqual([
      expect.objectContaining({
        prompt: "Which choice completes the sentence?",
        selectedChoiceText: "A comma",
        correctChoiceText: "A period",
        rationale: "Two complete thoughts need a period here.",
      }),
    ])
  })

  it("preserves full-test section and composite scores with missed answers", () => {
    const session = {
      id: "exam-1",
      mode: "core",
      questions: [
        {
          id: "m1",
          prompt: "What is x?",
          choices: [
            { id: "a", text: "2" },
            { id: "b", text: "4" },
          ],
        },
      ],
      progress: { updatedAt: "2026-07-29T12:00:00.000Z" },
      result: {
        correct: 40,
        total: 66,
        practiceEstimate: { estimate: 25 },
        sections: [
          { section: "english", practiceEstimate: 24 },
          { section: "math", practiceEstimate: 26 },
          { section: "reading", practiceEstimate: 25 },
        ],
        review: [
          {
            questionId: "m1",
            section: "math",
            skill: "linear-equations",
            skillLabel: "Linear equations",
            selectedChoiceId: "a",
            correctChoiceId: "b",
            correct: false,
            rationale: "Isolate x before evaluating.",
          },
        ],
        debrief: {
          generation: { generatedAt: "2026-07-29T12:00:00.000Z" },
        },
      },
    } as unknown as ExamLabSessionPayload

    expect(buildFullTestHistoryEntry({ session })).toEqual(
      expect.objectContaining({
        compositeScore: 25,
        sectionScores: { english: 24, math: 26, reading: 25 },
        mistakes: [
          expect.objectContaining({
            selectedChoiceText: "2",
            correctChoiceText: "4",
          }),
        ],
      })
    )
  })

  it("deduplicates a retried persistence call by assessment id", () => {
    const first = buildDiagnosticHistoryEntry({
      result: diagnosticResult,
      form: diagnosticForm,
      attemptId: "attempt-1",
      completedAt: "2026-07-29T12:00:00.000Z",
    })
    const updated = { ...first, completedAt: "2026-07-29T12:05:00.000Z" }

    expect(addAssessmentHistoryEntry([first], updated)).toEqual([updated])
  })
})
