import {
  buildAuthoredExamDebrief,
  examLabInterpretationReadiness,
  type ExamDebrief,
  type ExamLabScoredResult,
} from "@act-tutor/core";

export interface ExamDebriefComposer {
  compose(result: ExamLabScoredResult): Promise<ExamDebrief>;
}

export interface OpenAICompatibleExamDebriefConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchImplementation?: typeof fetch;
}

function stringField(value: unknown, field: string, min = 12) {
  if (typeof value !== "string" || value.trim().length < min) {
    throw new TypeError(`AI debrief field ${field} is missing or too short.`);
  }
  return value.trim();
}

function stringList(value: unknown, field: string) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new TypeError(`AI debrief field ${field} must contain exactly two items.`);
  }
  return value.map((item, index) => stringField(item, `${field}[${index}]`));
}

function extractJson(text: string) {
  const trimmed = text.trim();
  return JSON.parse(trimmed.startsWith("```") ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "") : trimmed) as unknown;
}

function validateDebrief(value: unknown, model: string): ExamDebrief {
  if (!value || typeof value !== "object") throw new TypeError("AI debrief is not an object.");
  const record = value as Record<string, unknown>;
  return {
    headline: stringField(record.headline, "headline"),
    summary: stringField(record.summary, "summary", 40),
    wins: stringList(record.wins, "wins"),
    priorities: stringList(record.priorities, "priorities"),
    nextAction: stringField(record.nextAction, "nextAction", 20),
    generation: {
      mode: "ai",
      provider: "OpenAI-compatible provider",
      model,
      generatedAt: new Date().toISOString(),
    },
  };
}

function aggregateForModel(result: ExamLabScoredResult) {
  return {
    mode: result.mode,
    overall: { correct: result.correct, total: result.total, unanswered: result.unanswered },
    interpretationReadiness: examLabInterpretationReadiness(result),
    practiceEstimate: result.practiceEstimate,
    sections: result.sections,
    focusSkills: result.focusSkills,
    confidence: result.confidence,
    overconfidentMisses: result.overconfidentMisses,
    luckyGuesses: result.luckyGuesses,
    pacing: result.pacing,
  };
}

export class OpenAICompatibleExamDebriefComposer implements ExamDebriefComposer {
  private readonly fetchImplementation: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly config: OpenAICompatibleExamDebriefConfig) {
    this.fetchImplementation = config.fetchImplementation ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 12_000;
  }

  async compose(result: ExamLabScoredResult): Promise<ExamDebrief> {
    const fallback = buildAuthoredExamDebrief(result);
    if (!examLabInterpretationReadiness(result).sufficient) return fallback;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImplementation(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0.25,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "You are Scout, a friendly ACT tutor speaking to a 13- to 18-year-old. Use short, concrete sentences and everyday words. Sound like a real teacher, not a report. Do not use the words evidence, model, calibrate, optimize, route, score lever, mastery, or priority. Use only the supplied practice results. Never invent official scores, guarantees, answer keys, question text, or student facts. Return only JSON.",
            },
            {
              role: "user",
              content: JSON.stringify({
                task: "Explain these ACT practice results in plain English.",
                evidence: aggregateForModel(result),
                requiredJson: {
                  headline: "one short headline saying what to work on next",
                  summary: "2-3 simple sentences about correct answers, pacing, and how sure the student felt",
                  wins: ["exactly two specific things that went well"],
                  priorities: ["exactly two specific things to improve"],
                  nextAction: "one concrete lesson, practice, or pacing action",
                },
              }),
            },
          ],
        }),
      });
      if (!response.ok) throw new Error(`AI provider returned ${response.status}.`);
      const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = body.choices?.[0]?.message?.content;
      if (!content) throw new Error("AI provider returned no debrief.");
      return validateDebrief(extractJson(content), this.config.model);
    } catch {
      return fallback;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class AuthoredExamDebriefComposer implements ExamDebriefComposer {
  async compose(result: ExamLabScoredResult) {
    return buildAuthoredExamDebrief(result);
  }
}

export function createExamDebriefComposerFromEnv(env: NodeJS.ProcessEnv = process.env): ExamDebriefComposer {
  const baseUrl = env.AI_TUTOR_BASE_URL?.trim();
  const model = env.AI_TUTOR_MODEL?.trim();
  if (!baseUrl || !model) return new AuthoredExamDebriefComposer();
  return new OpenAICompatibleExamDebriefComposer({
    baseUrl,
    model,
    apiKey: env.AI_TUTOR_API_KEY?.trim(),
  });
}
