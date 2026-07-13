import { describe, expect, it, vi } from "vitest";

import { scoreExamLab, type DiagnosticFormSecure } from "@act-tutor/core";

import { OpenAICompatibleExamDebriefComposer } from "./exam-debrief-composer";

const form = {
  id: "f", version: "1", mode: "rapid", title: "F", estimatedMinutes: 1, blueprint: [],
  questions: [{
    id: "q", version: 1, section: "english", category: "C", primarySkill: "s", skillLabel: "Skill",
    difficulty: "medium", prompt: "Prompt", choices: ["a", "b", "c", "d"].map((id) => ({ id, text: id })),
    expectedSeconds: 40, format: "standalone", correctChoiceId: "a", rationale: "Reason",
    content: { status: "published", license: "original", reviewer: "r", reviewedAt: "2026-07-12" },
  }],
} as DiagnosticFormSecure;
const scored = scoreExamLab("section", form.questions, {});

describe("OpenAICompatibleExamDebriefComposer", () => {
  it("accepts a validated aggregate-only debrief", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      headline: "Make pacing the next score lever.",
      summary: "The evidence is still limited, but the current timing sample identifies a clear next action.",
      wins: ["The simulation established a timing baseline.", "Confidence labeling separated uncertainty from omission."],
      priorities: ["Complete more items before interpreting accuracy.", "Use the expected-time marker before overinvesting."],
      nextAction: "Run a twelve-skill sprint and answer every item.",
    }) } }] }), { status: 200 }));
    const composer = new OpenAICompatibleExamDebriefComposer({ baseUrl: "http://model.test/v1", model: "qwen", fetchImplementation: fetchMock as unknown as typeof fetch });
    const result = await composer.compose(scored);
    expect(result.generation.mode).toBe("ai");
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("correctChoiceId");
  });

  it("falls back when model output is malformed", async () => {
    const composer = new OpenAICompatibleExamDebriefComposer({
      baseUrl: "http://model.test/v1", model: "qwen",
      fetchImplementation: vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 })) as unknown as typeof fetch,
    });
    expect((await composer.compose(scored)).generation.mode).toBe("authored-fallback");
  });
});
