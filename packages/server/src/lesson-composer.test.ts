import { describe, expect, it } from "vitest";

import type { LessonCompositionInput } from "./lesson-composer";
import {
  OpenAICompatibleLessonComposer,
  buildAuthoredPersonalizedLesson,
} from "./lesson-composer";

const input: LessonCompositionInput = {
  skill: {
    slug: "supported-inference",
    label: "Supported inference",
    section: "reading",
    category: "Key Ideas and Details",
    diagnosticSkill: "supported-inference",
  },
  baseLesson: {
    id: "supported-inference-lesson-v1",
    skill: "supported-inference",
    title: "Inference without overreaching",
    minutes: 8,
    objective: "Choose the inference most tightly supported by the passage.",
    concept:
      "An ACT inference is a conclusion the passage makes likely, not a creative possibility.",
    steps: [
      "Use the relevant lines.",
      "Predict the smallest supported conclusion.",
      "Reject choices that add a new motive or absolute claim.",
    ],
    workedExample: {
      prompt: "The curator checked the humidity twice before opening the case.",
      answer: "The object may be sensitive to moisture.",
      explanation: [
        "The repeated check supplies evidence of concern.",
        "The answer does not invent a specific type of damage.",
      ],
    },
    trap: "A plausible answer is still wrong when the passage does not supply its key idea.",
  },
  diagnosticSkillResults: [
    {
      skill: "supported-inference",
      label: "Supported inference",
      section: "reading",
      correct: 1,
      total: 4,
      accuracy: 0.25,
      signal: "focus",
    },
  ],
  plan: {
    goalScore: 32,
    currentScore: 25,
    daysUntilTest: 28,
    minutesPerSession: 40,
  },
};

describe("lesson composition", () => {
  it("builds an extensive evidence-aware authored fallback", () => {
    const lesson = buildAuthoredPersonalizedLesson(
      input,
      "2026-07-12T00:00:00.000Z",
    );
    expect(lesson.depth).toBe("foundation");
    expect(lesson.whyAssigned).toContain("1 of 4");
    expect(lesson.sections).toHaveLength(5);
    expect(lesson.sections.map((section) => section.id)).toEqual([
      "question-type",
      "mental-model",
      "guided-example",
      "decision-rule",
      "need-to-know",
    ]);
    expect(JSON.stringify(lesson)).not.toMatch(
      /in your own words|say the rule|name the rule|rewrite the rule|restate the method|summarize the rule|teach it back/i,
    );
    expect(lesson.strategyChecklist).toEqual(input.baseLesson.steps);
    expect(lesson.generation.mode).toBe("authored-fallback");
    const concept = lesson.sections.find(
      (section) => section.id === "mental-model",
    )?.explanation;
    expect(concept?.match(/[^.!?]+[.!?]+/g)).toHaveLength(3);
    expect(
      concept?.match(/[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*/g)?.length,
    ).toBeGreaterThanOrEqual(24);
  });

  it("accepts a deep three-sentence concept from an OpenAI-compatible model", async () => {
    const generated = {
      minutes: 15,
      whyAssigned:
        "Your inference evidence is currently the clearest barrier between 25 and the goal of 32.",
      tutorOpening:
        "We are going to make every inference earn its place with direct passage evidence.",
      sections: [
        [
          "question-type",
          "Spot the question type",
          "A supported inference question asks for the smallest conclusion made likely by the passage. It never gives permission to invent a motive, event, or absolute claim.",
          "Look for wording that asks for an inference rather than a stated detail.",
        ],
        [
          "mental-model",
          "Shrink the claim",
          "Treat an inference as the smallest conclusion made likely by the cited lines. Start from what the text proves, then add only one cautious step beyond it. That limit keeps a plausible but unsupported choice from slipping through.",
          "Keep the prediction cautious rather than absolute.",
        ],
        [
          "guided-example",
          "Trace the evidence",
          "Read the curator example and underline the repeated behavior. That repetition signals concern without proving a specific disaster or motive.",
          "Start with the repeated behavior and choose the narrowest conclusion.",
        ],
        [
          "decision-rule",
          "Run the two-part test",
          "First point to the exact evidence. Then inspect every new noun, motive, and absolute word in the answer choice because each needs separate support.",
          "Reject an otherwise plausible choice when it adds an unsupported claim.",
        ],
        [
          "need-to-know",
          "Keep the burden of proof",
          "Every important part of an inference needs support from the passage. Reject a choice when its key noun, motive, certainty, or event appears only in the answer.",
          "Keep every important part of the answer tied to the passage.",
        ],
      ].map(([id, title, explanation, coachPrompt]) => ({
        id,
        title,
        explanation,
        coachPrompt,
      })),
      strategyChecklist: [
        "Locate the relevant lines",
        "Use only what they establish",
        "Predict a cautious conclusion",
        "Reject unsupported additions",
      ],
      transferPrompt:
        "When wording changes, test each added claim against a specific line before accepting it.",
    };
    const composer = new OpenAICompatibleLessonComposer({
      baseUrl: "http://model.test/v1",
      model: "qwen-test",
      fetchImplementation: (async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(generated) } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )) as typeof fetch,
    });
    const lesson = await composer.compose(input);
    expect(lesson.generation.mode).toBe("ai");
    expect(lesson.generation.model).toBe("qwen-test");
    expect(lesson.sections).toHaveLength(5);
    expect(lesson.sections[0].id).toBe("question-type");
    expect(lesson.sections[1].explanation.match(/[^.!?]+[.!?]+/g)).toHaveLength(
      3,
    );
    expect(JSON.stringify(lesson)).not.toMatch(
      /in your own words|say the rule|name the rule|rewrite the rule|restate the method|summarize the rule|teach it back/i,
    );

    const shallowGenerated = {
      ...generated,
      sections: generated.sections.map((section) =>
        section.id === "mental-model"
          ? {
              ...section,
              explanation:
                "Use the smallest conclusion supported by the text. Stay cautious when you compare the choices.",
            }
          : section,
      ),
    };
    const shallowComposer = new OpenAICompatibleLessonComposer({
      baseUrl: "http://model.test/v1",
      model: "shallow-model",
      fetchImplementation: (async () =>
        new Response(
          JSON.stringify({
            choices: [
              { message: { content: JSON.stringify(shallowGenerated) } },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )) as typeof fetch,
    });
    const shallowLesson = await shallowComposer.compose(input);
    expect(shallowLesson.generation.mode).toBe("authored-fallback");
  });

  it("falls back safely when model output is malformed", async () => {
    const composer = new OpenAICompatibleLessonComposer({
      baseUrl: "http://model.test/v1",
      model: "broken-model",
      fetchImplementation: (async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: "not json" } }] }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        )) as typeof fetch,
    });
    const lesson = await composer.compose(input);
    expect(lesson.generation.mode).toBe("authored-fallback");
    expect(lesson.sections).toHaveLength(5);
  });

  it("falls back when generated lesson copy exceeds the learner-facing limits", async () => {
    const generated = {
      minutes: 15,
      whyAssigned:
        "Your recent answers show that supported inference should be your next lesson.",
      tutorOpening:
        "Let’s make each inference stay close to what the passage actually supports.",
      sections: [
        {
          id: "question-type",
          title: "Spot the question type",
          explanation: "A".repeat(261),
          coachPrompt: "Look for wording that asks for an inference.",
        },
        {
          id: "mental-model",
          title: "Shrink the claim",
          explanation:
            "Use the smallest conclusion made likely by the cited lines.",
          coachPrompt: "Keep the prediction cautious.",
        },
        {
          id: "guided-example",
          title: "Trace the evidence",
          explanation:
            "The repeated check suggests concern without proving a specific disaster.",
          coachPrompt: "Start with the repeated behavior.",
        },
        {
          id: "decision-rule",
          title: "Run the test",
          explanation:
            "Point to the evidence, then check each added claim for support.",
          coachPrompt: "Reject unsupported additions.",
        },
        {
          id: "need-to-know",
          title: "Keep the burden of proof",
          explanation:
            "Every important part of an inference needs support from the passage.",
          coachPrompt: "Tie each claim to the passage.",
        },
      ],
      strategyChecklist: [
        "Locate the relevant lines",
        "Predict a cautious conclusion",
        "Reject unsupported additions",
      ],
      transferPrompt:
        "When wording changes, test each claim against a specific line.",
    };
    const composer = new OpenAICompatibleLessonComposer({
      baseUrl: "http://model.test/v1",
      model: "verbose-model",
      fetchImplementation: (async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(generated) } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )) as typeof fetch,
    });

    const lesson = await composer.compose(input);

    expect(lesson.generation.mode).toBe("authored-fallback");
    expect(lesson.strategyChecklist).toEqual(input.baseLesson.steps);
  });
});
