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
    return `You have not answered a ${input.skill.label.toLowerCase()} question yet, so Scout will teach the rule first and then give you a quick check.`;
  }
  return `You got ${evidence.correct} of ${evidence.total} ${input.skill.label.toLowerCase()} questions right on the diagnostic (${Math.round(evidence.accuracy * 100)}%).`;
}

export function buildAuthoredPersonalizedLesson(
  input: LessonCompositionInput,
  generatedAt = new Date().toISOString(),
): PersonalizedLessonContent {
  const depth = depthFor(input);
  const evidence = diagnosticEvidence(input);
  const urgency =
    input.plan.daysUntilTest <= 14
      ? "Your test is close, so this lesson starts with the fastest useful rule."
      : "You have time to learn the rule before adding a timer.";
  const assignmentReason = evidence
    ? `Scout picked it because you got ${evidence.correct} of ${evidence.total} matching diagnostic questions right.`
    : "Scout picked it because you have not answered a scored question for this skill yet.";

  return {
    ...input.baseLesson,
    minutes: Math.max(10, Math.min(18, input.plan.minutesPerSession - 8)),
    depth,
    whyAssigned: `${assignmentReason} ${urgency}`,
    evidenceSummary: evidenceSummary(input),
    tutorOpening:
      depth === "foundation"
        ? `Let’s make ${input.skill.label.toLowerCase()} easier to spot, one step at a time.`
        : depth === "stretch"
          ? `You know the basic rule. Now let’s try the harder versions you may see near a ${input.plan.goalScore}.`
          : `You know part of this. Let’s turn it into a rule you can use every time.`,
    sections: [
      {
        id: "mental-model",
        title: "Learn the main idea",
        explanation: input.baseLesson.concept,
        coachPrompt: `In your own words, what must you notice first in a ${input.skill.label.toLowerCase()} question?`,
      },
      {
        id: "guided-example",
        title: "See one worked out",
        explanation: `${input.baseLesson.workedExample.prompt} ${input.baseLesson.workedExample.explanation.join(" ")}`,
        coachPrompt: `Before revealing the answer, name the first step. Then compare it with: ${input.baseLesson.workedExample.answer}.`,
      },
      {
        id: "decision-rule",
        title: "Use the rule",
        explanation: input.baseLesson.steps.join(" "),
        coachPrompt: `Which step would prevent the common trap: ${input.baseLesson.trap}`,
      },
      {
        id: "transfer",
        title: "Try ACT-style wording",
        explanation: `Your next five questions start ${depth === "foundation" ? "with clear examples and then get harder" : "with harder wording and add time pressure"}. Use the same rule even when the question looks different.`,
        coachPrompt: "Say the rule once without looking, then try the questions.",
      },
    ],
    strategyChecklist: [
      ...input.baseLesson.steps,
      `Use the last 10 seconds to cross out choices that make this mistake: ${input.baseLesson.trap}`,
    ],
    transferPrompt: `Before solving, name the ${input.skill.label.toLowerCase()} rule the question is testing.`,
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
  const generatedText = [
    candidate.whyAssigned,
    candidate.tutorOpening,
    candidate.transferPrompt,
    ...(Array.isArray(candidate.strategyChecklist)
      ? candidate.strategyChecklist
      : []),
    ...sections.flatMap((section) => [
      section.title,
      section.explanation,
      section.coachPrompt,
    ]),
  ]
    .filter((item): item is string => typeof item === "string")
    .join(" ")
    .toLowerCase();
  if (
    /\b(guarantee(?:d)? score|official act question|leaked item|answer key|correct (?:answer|choice) is [a-d])\b/.test(
      generatedText,
    )
  ) {
    throw new TypeError("AI lesson failed the claim or answer-leakage check.");
  }
  const reviewedTerms = input.baseLesson.concept
    .toLowerCase()
    .match(/[a-z]{5,}/g)
    ?.slice(0, 12) ?? [];
  if (
    reviewedTerms.length > 0 &&
    !reviewedTerms.some((term) => generatedText.includes(term))
  ) {
    throw new TypeError("AI lesson is not grounded in the reviewed rule.");
  }

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
                  "You are Scout, a friendly ACT tutor speaking to a 13- to 18-year-old. Use short, concrete sentences and everyday words. Sound like a real teacher, not a report. Do not use the words evidence, model, latent, calibrated, probe, optimize, route, decision rule, transfer, mastery, readiness, priority, or confidence unless one is a necessary subject term in the reviewed lesson. Personalize instruction, but never invent score guarantees, copyrighted ACT items, answer keys, or facts beyond the supplied reviewed lesson. Return only valid JSON.",
              },
              {
                role: "user",
                content: JSON.stringify({
                  task: "Turn the reviewed lesson into four plain-English parts for this student.",
                  student: input.plan,
                  diagnosticEvidence: diagnosticEvidence(input) ?? null,
                  skill: input.skill,
                  reviewedLesson: input.baseLesson,
                  requiredJson: {
                    minutes: "integer from 10 to 20",
                    whyAssigned: "one short sentence saying what the student got right or wrong and why this skill is next",
                    tutorOpening: "a warm, direct opening from Scout using everyday words",
                    sections: SECTION_IDS.map((id) => ({
                      id,
                      title: "a short student-friendly title",
                      explanation: "at least three useful sentences written for a teenager",
                      coachPrompt: "one simple question that makes the student recall the rule",
                    })),
                    strategyChecklist: ["at least four concise steps"],
                    transferPrompt: "how to spot this skill when the wording looks different",
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
