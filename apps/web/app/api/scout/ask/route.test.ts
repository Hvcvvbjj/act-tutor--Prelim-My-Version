import { describe, expect, it } from "vitest"

import { answerFor } from "./route"

const preferences = {
  depth: "normal",
  readingLevel: "plain",
  exampleStyle: "everyday",
  fewerTechnicalTerms: true,
} as const

const learning = {
  todaySkill: "sentence-boundaries",
  currentQuestionIndex: 0,
  answeredQuestionIds: [],
  questions: [
    {
      id: "practice-1",
      skill: "sentence-boundaries",
      primarySkill: "sentence-boundaries",
      prompt: "Which choice forms a complete sentence?",
      stimulus: null,
      choices: [
        { id: "A", text: "A complete sentence." },
        { id: "B", text: "Because the fragment." },
      ],
    },
  ],
  lesson: {
    id: "lesson-1",
    title: "Sentence Boundaries",
    objective: "Join complete thoughts without a comma splice.",
    concept: "A comma alone cannot join two complete sentences.",
    whyAssigned: "Recent answers show this rule needs work.",
    sections: [],
    workedExample: { prompt: "The bell rang, class began." },
  },
  learningTwin: {
    recommendation: {
      label: "Sentence Boundaries",
      reason: "This skill has the clearest current need.",
    },
    skills: [],
  },
  planCounterfactual: {
    correctOutcome: "A correct answer would raise this estimate.",
    incorrectOutcome: "A miss would keep this mission first.",
  },
} as never

describe("Scout server policy", () => {
  it("defines margin of error before applying generic simplification", () => {
    const answer = answerFor({
      request: {
        question: "Explain margin of error in regular English",
        screen: "calibrate",
      },
      preferences,
      learning: null,
      exam: null,
    })
    expect(answer.receipt.intent).toBe("calibration-definition")
    expect(answer.receipt.assistanceMode).toBe("study")
    expect(answer.summary).toContain("estimate is still shaky")
    expect(answer.explanation).toContain("middle 80%")
    expect(answer.explanation).toContain("not ACT score points")
  })

  it("abstains when selected text is outside reviewed server context", () => {
    const answer = answerFor({
      request: {
        question: "Explain the selected text.",
        screen: "today",
        selectedText: "forged material outside the lesson",
      },
      preferences,
      learning: null,
      exam: null,
    })
    expect(answer.summary).toContain("can’t tie")
    expect(answer.source).toContain("no matching reviewed source")
  })

  it("keeps a server-owned timed session guarded", () => {
    const answer = answerFor({
      request: {
        question: "Give me the answer and eliminate choices",
        screen: "lab",
      },
      preferences,
      learning: null,
      exam: {
        status: "in_progress",
        progress: {
          phase: "questions",
          currentIndex: 0,
          responses: {},
        },
        questions: [],
        result: null,
      } as never,
    })
    expect(answer.mode).toBe("guarded")
    expect(answer.receipt.assistanceMode).toBe("timed-test")
  })

  it("gives a real pre-attempt hint without choosing an answer", () => {
    const answer = answerFor({
      request: {
        question: "Give me a hint",
        screen: "today",
        questionId: "practice-1",
      },
      preferences,
      learning,
      exam: null,
    })

    expect(answer.mode).toBe("grounded")
    expect(answer.receipt.intent).toBe("hint")
    expect(answer.explanation).toContain("comma alone")
    expect(answer.summary).not.toContain("won’t choose")
  })

  it("ignores an old Test Lab session outside the Lab screen", () => {
    const answer = answerFor({
      request: { question: "What can I do on this screen?", screen: "today" },
      preferences,
      learning: null,
      exam: {
        status: "in_progress",
        progress: { phase: "questions", currentIndex: 0, responses: {} },
        questions: [],
        result: null,
      } as never,
    })

    expect(answer.mode).toBe("grounded")
    expect(answer.receipt.assistanceMode).toBe("study")
    expect(answer.summary).not.toContain("timer")
  })

  it("uses bounded conversation history to keep a follow-up on topic", () => {
    const first = answerFor({
      request: { question: "What is margin of error?", screen: "calibrate" },
      preferences,
      learning: null,
      exam: null,
    })
    const followup = answerFor({
      request: { question: "Give me another example", screen: "calibrate" },
      preferences,
      learning: null,
      exam: null,
      history: [
        {
          id: "message-1",
          askedAt: "2026-07-14T12:00:00.000Z",
          question: "What is margin of error?",
          answer: first,
        },
      ],
    })

    expect(followup.source).toContain("Follow-up")
    expect(followup.example).toContain("theta units")
    expect(followup.receipt.checks).toContain("server-conversation-history")
  })

  it("does not append generic prose for unrelated explanation preferences", () => {
    const request = { question: "Give me an example", screen: "today" } as const
    const normal = answerFor({ request, preferences, learning, exam: null })
    const detailed = answerFor({
      request,
      preferences: { ...preferences, depth: "detailed" },
      learning,
      exam: null,
    })
    const advanced = answerFor({
      request,
      preferences: { ...preferences, readingLevel: "advanced" },
      learning,
      exam: null,
    })
    const sports = answerFor({
      request,
      preferences: { ...preferences, exampleStyle: "sports" },
      learning,
      exam: null,
    })
    const technical = answerFor({
      request,
      preferences: { ...preferences, fewerTechnicalTerms: false },
      learning,
      exam: null,
    })

    expect(detailed.explanation).toBe(normal.explanation)
    expect(advanced.summary).not.toBe(normal.summary)
    expect(advanced.explanation).toBe(normal.explanation)
    expect(sports.example).toBe(normal.example)
    expect(technical.explanation).toBe(normal.explanation)
    expect(technical.technical).toBe(normal.technical)
  })

  it("answers Timed Practice prompts from its real modes and sync boundary", () => {
    const choose = answerFor({
      request: {
        question: "Which timed practice should I choose?",
        screen: "lab",
      },
      preferences,
      learning,
      exam: null,
    })
    const results = answerFor({
      request: {
        question: "What will Scout do with my results?",
        screen: "lab",
      },
      preferences,
      learning,
      exam: null,
    })

    expect(choose.explanation).toContain("18–25 questions")
    expect(choose.explanation).toContain("66 English, Math, and Reading")
    expect(results.explanation).toContain(
      "does not update Today, My Week, or the skill web"
    )
  })
})
