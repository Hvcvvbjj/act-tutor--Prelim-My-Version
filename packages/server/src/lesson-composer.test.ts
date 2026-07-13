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
    concept: "An ACT inference is a conclusion the passage makes likely, not a creative possibility.",
    steps: [
      "Restate the relevant lines.",
      "Predict the smallest supported conclusion.",
      "Reject choices that add a new motive or absolute claim.",
    ],
    workedExample: {
      prompt: "The curator checked the humidity twice before opening the case.",
      answer: "The object may be sensitive to moisture.",
      explanation: ["The repeated check supplies evidence of concern.", "The answer does not invent a specific type of damage."],
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
  plan: { goalScore: 32, currentScore: 25, daysUntilTest: 28, minutesPerSession: 40 },
};

describe("lesson composition", () => {
  it("builds an extensive evidence-aware authored fallback", () => {
    const lesson = buildAuthoredPersonalizedLesson(input, "2026-07-12T00:00:00.000Z");
    expect(lesson.depth).toBe("foundation");
    expect(lesson.whyAssigned).toContain("25% accuracy");
    expect(lesson.sections).toHaveLength(4);
    expect(lesson.strategyChecklist.length).toBeGreaterThanOrEqual(4);
    expect(lesson.generation.mode).toBe("authored-fallback");
  });

  it("accepts structured output from an OpenAI-compatible model", async () => {
    const generated = {
      minutes: 15,
      whyAssigned: "Your inference evidence is currently the clearest barrier between 25 and the goal of 32.",
      tutorOpening: "We are going to make every inference earn its place with direct passage evidence.",
      sections: [
        ["mental-model", "Shrink the claim", "Treat an inference as the smallest conclusion made likely by the cited lines. Start from what the text proves, then add only one cautious step beyond it.", "Which word in your prediction makes the claim cautious rather than absolute?"],
        ["guided-example", "Trace the evidence", "Read the curator example and underline the repeated behavior. That repetition signals concern without proving a specific disaster or motive.", "What is the narrowest conclusion supported by checking humidity twice?"],
        ["decision-rule", "Run the two-part test", "First point to the exact evidence. Then inspect every new noun, motive, and absolute word in the answer choice because each needs separate support.", "Which new claim would force you to reject an otherwise plausible choice?"],
        ["transfer", "Hold up under time", "Use the same evidence test when the passage is longer. The location of the proof changes, but the burden of proof for every answer stays fixed.", "State the rule before beginning the focused set."],
      ].map(([id, title, explanation, coachPrompt]) => ({ id, title, explanation, coachPrompt })),
      strategyChecklist: ["Locate the relevant lines", "Restate only what they establish", "Predict a cautious conclusion", "Reject unsupported additions"],
      transferPrompt: "When wording changes, test each added claim against a specific line before accepting it.",
    };
    const composer = new OpenAICompatibleLessonComposer({
      baseUrl: "http://model.test/v1",
      model: "qwen-test",
      fetchImplementation: (async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify(generated) } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )) as typeof fetch,
    });
    const lesson = await composer.compose(input);
    expect(lesson.generation.mode).toBe("ai");
    expect(lesson.generation.model).toBe("qwen-test");
    expect(lesson.sections[0].id).toBe("mental-model");
  });

  it("falls back safely when model output is malformed", async () => {
    const composer = new OpenAICompatibleLessonComposer({
      baseUrl: "http://model.test/v1",
      model: "broken-model",
      fetchImplementation: (async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })) as typeof fetch,
    });
    const lesson = await composer.compose(input);
    expect(lesson.generation.mode).toBe("authored-fallback");
    expect(lesson.sections).toHaveLength(4);
  });
});
