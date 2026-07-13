import type {
  DiagnosticSkillResult,
  LessonContent,
  LessonDepth,
  LessonPlanContext,
  PersonalizedLessonContent,
  PersonalizedLessonSection,
  SkillDefinition,
} from "@act-tutor/core";

export interface LessonCompositionInput {
  baseLesson: LessonContent;
  skill: SkillDefinition;
  diagnosticSkillResults: ReadonlyArray<DiagnosticSkillResult>;
  plan: LessonPlanContext;
}

export interface LessonComposer {
  compose(input: LessonCompositionInput): Promise<PersonalizedLessonContent>;
}

export interface OpenAICompatibleLessonComposerConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchImplementation?: typeof fetch;
}

function diagnosticEvidence(input: LessonCompositionInput) {
  return input.diagnosticSkillResults.find(
    (result) => result.skill === input.skill.diagnosticSkill,
  );
}

function depthFor(input: LessonCompositionInput): LessonDepth {
  const evidence = diagnosticEvidence(input);
  if (!evidence || evidence.total === 0 || evidence.accuracy < 0.45) return "foundation";
  if (evidence.accuracy >= 0.8 && input.plan.goalScore >= 30) return "stretch";
  return "standard";
}

function evidenceSummary(input: LessonCompositionInput) {
  const evidence = diagnosticEvidence(input);
  if (!evidence || evidence.total === 0) {
    return `No direct ${input.skill.label.toLowerCase()} evidence is available yet, so this lesson begins with a short model and an early check.`;
  }
  return `${evidence.correct} of ${evidence.total} ${input.skill.label.toLowerCase()} diagnostic questions were correct (${Math.round(evidence.accuracy * 100)}%).`;
}

export function buildAuthoredPersonalizedLesson(
  input: LessonCompositionInput,
  generatedAt = new Date().toISOString(),
): PersonalizedLessonContent {
  const depth = depthFor(input);
  const evidence = diagnosticEvidence(input);
  const urgency =
    input.plan.daysUntilTest <= 14
      ? "Because test day is close, the lesson uses a compact rule-first approach."
      : "There is enough runway to build the reasoning before adding time pressure.";
  const accuracyPhrase = evidence
    ? `${Math.round(evidence.accuracy * 100)}% accuracy in the diagnostic evidence`
    : "limited direct diagnostic evidence";

  return {
    ...input.baseLesson,
    minutes: Math.max(10, Math.min(18, input.plan.minutesPerSession - 8)),
    depth,
    whyAssigned: `${input.skill.label} is a priority because the planner found ${accuracyPhrase}. ${urgency}`,
    evidenceSummary: evidenceSummary(input),
    tutorOpening:
      depth === "foundation"
        ? `Let’s slow this down and make ${input.skill.label.toLowerCase()} predictable before we race the clock.`
        : depth === "stretch"
          ? `You have the base pattern. Now we’ll attack the harder versions that separate strong scores from a ${input.plan.goalScore}.`
          : `We’ll turn what you partly know about ${input.skill.label.toLowerCase()} into a repeatable decision.` ,
    sections: [
      {
        id: "mental-model",
        title: "Build the mental model",
        explanation: input.baseLesson.concept,
        coachPrompt: `In your own words, what must you notice first in a ${input.skill.label.toLowerCase()} question?`,
      },
      {
        id: "guided-example",
        title: "Work one with Scout",
        explanation: `${input.baseLesson.workedExample.prompt} ${input.baseLesson.workedExample.explanation.join(" ")}`,
        coachPrompt: `Before revealing the answer, name the first step. Then compare it with: ${input.baseLesson.workedExample.answer}.`,
      },
      {
        id: "decision-rule",
        title: "Use the decision rule",
        explanation: input.baseLesson.steps.join(" "),
        coachPrompt: `Which step would prevent the common trap: ${input.baseLesson.trap}`,
      },
      {
        id: "transfer",
        title: "Transfer it to test conditions",
        explanation: `Your next five questions move from ${depth === "foundation" ? "clean examples to mixed wording" : "mixed wording to time-pressure traps"}. The rule stays the same even when the surface changes.`,
        coachPrompt: "Say the rule once without looking, then start the focused set.",
      },
    ],
    strategyChecklist: [
      ...input.baseLesson.steps,
      `Budget the final 10 seconds to eliminate choices that trigger: ${input.baseLesson.trap}`,
    ],
    transferPrompt: `When the wording changes, identify the tested ${input.skill.label.toLowerCase()} decision before calculating or editing anything.`,
    generation: {
      mode: "authored-fallback",
      provider: "Reviewed lesson engine",
      model: null,
      generatedAt,
    },
  };
}

function asString(value: unknown, field: string, min = 8) {
  if (typeof value !== "string" || value.trim().length < min) {
    throw new TypeError(`AI lesson field ${field} is missing or too short.`);
  }
  return value.trim();
}

function asStringArray(value: unknown, field: string, minItems: number) {
  if (!Array.isArray(value) || value.length < minItems) {
    throw new TypeError(`AI lesson field ${field} needs at least ${minItems} items.`);
  }
  return value.map((item, index) => asString(item, `${field}[${index}]`, 4));
}

const SECTION_IDS = [
  "mental-model",
  "guided-example",
  "decision-rule",
  "transfer",
] as const;

function validateGeneratedLesson(
  value: unknown,
  input: LessonCompositionInput,
  provider: string,
  model: string,
): PersonalizedLessonContent {
  if (!value || typeof value !== "object") throw new TypeError("AI lesson is not an object.");
  const candidate = value as Record<string, unknown>;
  const sectionsValue = candidate.sections;
  if (!Array.isArray(sectionsValue) || sectionsValue.length !== SECTION_IDS.length) {
    throw new TypeError("AI lesson must contain exactly four teaching sections.");
  }
  const sections = sectionsValue.map((section, index) => {
    if (!section || typeof section !== "object") {
      throw new TypeError(`AI lesson section ${index} is malformed.`);
    }
    const record = section as Record<string, unknown>;
    const expectedId = SECTION_IDS[index];
    if (record.id !== expectedId) {
      throw new TypeError(`AI lesson section ${index} must use id ${expectedId}.`);
    }
    return {
      id: expectedId,
      title: asString(record.title, `sections[${index}].title`, 4),
      explanation: asString(record.explanation, `sections[${index}].explanation`, 40),
      coachPrompt: asString(record.coachPrompt, `sections[${index}].coachPrompt`, 12),
    } satisfies PersonalizedLessonSection;
  });

  return {
    ...input.baseLesson,
    minutes: Math.max(10, Math.min(20, Number(candidate.minutes) || input.baseLesson.minutes)),
    depth: depthFor(input),
    whyAssigned: asString(candidate.whyAssigned, "whyAssigned", 30),
    evidenceSummary: evidenceSummary(input),
    tutorOpening: asString(candidate.tutorOpening, "tutorOpening", 20),
    sections,
    strategyChecklist: asStringArray(candidate.strategyChecklist, "strategyChecklist", 4),
    transferPrompt: asString(candidate.transferPrompt, "transferPrompt", 20),
    generation: {
      mode: "ai",
      provider,
      model,
      generatedAt: new Date().toISOString(),
    },
  };
}

function extractJson(text: string) {
  const trimmed = text.trim();
  const unfenced = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed;
  return JSON.parse(unfenced) as unknown;
}

export class OpenAICompatibleLessonComposer implements LessonComposer {
  private readonly fetchImplementation: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly config: OpenAICompatibleLessonComposerConfig) {
    this.fetchImplementation = config.fetchImplementation ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 12_000;
  }

  async compose(input: LessonCompositionInput): Promise<PersonalizedLessonContent> {
    const fallback = buildAuthoredPersonalizedLesson(input);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImplementation(
        `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.config.apiKey
              ? { Authorization: `Bearer ${this.config.apiKey}` }
              : {}),
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: this.config.model,
            temperature: 0.35,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "You are Scout, an expert ACT tutor. Personalize instruction, but never invent score guarantees, copyrighted ACT items, answer keys, or factual claims beyond the supplied reviewed lesson. Return only valid JSON.",
              },
              {
                role: "user",
                content: JSON.stringify({
                  task: "Rewrite the reviewed lesson into a student-specific four-stage teaching sequence.",
                  student: input.plan,
                  diagnosticEvidence: diagnosticEvidence(input) ?? null,
                  skill: input.skill,
                  reviewedLesson: input.baseLesson,
                  requiredJson: {
                    minutes: "integer from 10 to 20",
                    whyAssigned: "specific explanation tied to supplied evidence",
                    tutorOpening: "warm direct opening from Scout",
                    sections: SECTION_IDS.map((id) => ({
                      id,
                      title: "specific stage title",
                      explanation: "at least three useful sentences",
                      coachPrompt: "one active-recall prompt",
                    })),
                    strategyChecklist: ["at least four concise steps"],
                    transferPrompt: "how to recognize this skill under changed wording",
                  },
                }),
              },
            ],
          }),
        },
      );
      if (!response.ok) throw new Error(`AI provider returned ${response.status}.`);
      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = body.choices?.[0]?.message?.content;
      if (!content) throw new Error("AI provider returned no lesson content.");
      return validateGeneratedLesson(
        extractJson(content),
        input,
        "OpenAI-compatible provider",
        this.config.model,
      );
    } catch {
      return fallback;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class AuthoredLessonComposer implements LessonComposer {
  async compose(input: LessonCompositionInput) {
    return buildAuthoredPersonalizedLesson(input);
  }
}

export function createLessonComposerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): LessonComposer {
  const baseUrl = env.AI_TUTOR_BASE_URL?.trim();
  const model = env.AI_TUTOR_MODEL?.trim();
  if (!baseUrl || !model) return new AuthoredLessonComposer();
  return new OpenAICompatibleLessonComposer({
    baseUrl,
    model,
    apiKey: env.AI_TUTOR_API_KEY?.trim(),
  });
}
