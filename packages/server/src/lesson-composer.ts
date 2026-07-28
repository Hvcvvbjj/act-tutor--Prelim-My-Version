import type {
  DiagnosticSkillResult,
  LessonContent,
  LessonDepth,
  LessonPlanContext,
  PersonalizedLessonContent,
  PersonalizedLessonSection,
  SkillDefinition,
} from "@act-tutor/core";

import { tutorModelConfigFromEnv } from "./ai-tutor-env";

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
  if (!evidence || evidence.total === 0 || evidence.accuracy < 0.45)
    return "foundation";
  if (evidence.accuracy >= 0.8 && input.plan.goalScore >= 30) return "stretch";
  return "standard";
}

function evidenceSummary(input: LessonCompositionInput) {
  const evidence = diagnosticEvidence(input);
  if (!evidence || evidence.total === 0) {
    return `You have not answered a scored ${input.skill.label.toLowerCase()} question yet. This lesson starts with the basics, then gives you practice.`;
  }
  return `You got ${evidence.correct} of ${evidence.total} ${input.skill.label.toLowerCase()} questions right on your latest check.`;
}

export function buildAuthoredPersonalizedLesson(
  input: LessonCompositionInput,
  generatedAt = new Date().toISOString(),
): PersonalizedLessonContent {
  const depth = depthFor(input);
  const evidence = diagnosticEvidence(input);
  const urgency =
    input.plan.daysUntilTest <= 14
      ? "Your test is close, so we’ll start with the fastest useful method."
      : "We’ll learn the method first, then add time pressure.";
  const assignmentReason = evidence
    ? `This is next because you got ${evidence.correct} of ${evidence.total} matching questions right on your latest check.`
    : "This is next because you have not answered a scored question for this skill yet.";

  return {
    ...input.baseLesson,
    minutes: Math.max(10, Math.min(18, input.plan.minutesPerSession - 8)),
    depth,
    whyAssigned: `${assignmentReason} ${urgency}`,
    evidenceSummary: evidenceSummary(input),
    tutorOpening:
      depth === "foundation"
        ? `First, see what a ${input.skill.label.toLowerCase()} question asks. Then use a simple method and practice it.`
        : depth === "stretch"
          ? `You know the basics. Now try the harder versions that can show up near a ${input.plan.goalScore}.`
          : "You have the basics. Let’s make your approach more consistent.",
    sections: [
      {
        id: "question-type",
        title: "Know the question type",
        explanation: `${input.skill.label} is part of ${input.skill.category}. ${input.baseLesson.objective}`,
        coachPrompt: `Look for the words or structure that signal a ${input.skill.label.toLowerCase()} question.`,
      },
      {
        id: "mental-model",
        title: "Build the main idea",
        explanation: input.baseLesson.concept,
        coachPrompt: `Start by noticing the key clue in the ${input.skill.label.toLowerCase()} question.`,
      },
      {
        id: "guided-example",
        title: "Try a worked example",
        explanation: `${input.baseLesson.workedExample.prompt} ${input.baseLesson.workedExample.explanation.join(" ")}`,
        coachPrompt: `Follow the first step, then compare your thinking with: ${input.baseLesson.workedExample.answer}.`,
      },
      {
        id: "decision-rule",
        title: "Use these steps",
        explanation: input.baseLesson.steps.join(" "),
        coachPrompt: `Use these steps to avoid the common trap: ${input.baseLesson.trap}`,
      },
      {
        id: "need-to-know",
        title: "Avoid the common trap",
        explanation: input.baseLesson.trap,
        coachPrompt: "Watch for this mistake in practice.",
      },
    ],
    strategyChecklist: input.baseLesson.steps,
    transferPrompt: `Use these ${input.skill.label.toLowerCase()} steps when the wording changes.`,
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

function asBoundedString(
  value: unknown,
  field: string,
  min: number,
  max: number,
) {
  const normalized = asString(value, field, min);
  if (normalized.length > max) {
    throw new TypeError(
      `AI lesson field ${field} must be ${max} characters or fewer.`,
    );
  }
  return normalized;
}

function asStringArray(
  value: unknown,
  field: string,
  minItems: number,
  maxItems: number,
  maxItemLength: number,
) {
  if (
    !Array.isArray(value) ||
    value.length < minItems ||
    value.length > maxItems
  ) {
    throw new TypeError(
      `AI lesson field ${field} needs ${minItems} to ${maxItems} items.`,
    );
  }
  return value.map((item, index) =>
    asBoundedString(item, `${field}[${index}]`, 4, maxItemLength),
  );
}

const SECTION_IDS = [
  "question-type",
  "mental-model",
  "guided-example",
  "decision-rule",
  "need-to-know",
] as const;

function validateGeneratedLesson(
  value: unknown,
  input: LessonCompositionInput,
  provider: string,
  model: string,
): PersonalizedLessonContent {
  if (!value || typeof value !== "object")
    throw new TypeError("AI lesson is not an object.");
  const candidate = value as Record<string, unknown>;
  const sectionsValue = candidate.sections;
  if (
    !Array.isArray(sectionsValue) ||
    sectionsValue.length !== SECTION_IDS.length
  ) {
    throw new TypeError(
      "AI lesson must contain exactly five teaching sections.",
    );
  }
  const sections = sectionsValue.map((section, index) => {
    if (!section || typeof section !== "object") {
      throw new TypeError(`AI lesson section ${index} is malformed.`);
    }
    const record = section as Record<string, unknown>;
    const expectedId = SECTION_IDS[index];
    if (record.id !== expectedId) {
      throw new TypeError(
        `AI lesson section ${index} must use id ${expectedId}.`,
      );
    }
    return {
      id: expectedId,
      title: asBoundedString(record.title, `sections[${index}].title`, 4, 72),
      explanation: asBoundedString(
        record.explanation,
        `sections[${index}].explanation`,
        24,
        260,
      ),
      coachPrompt: asBoundedString(
        record.coachPrompt,
        `sections[${index}].coachPrompt`,
        12,
        140,
      ),
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
  if (
    /\b(?:in your own words|rewrite the (?:rule|method)|restate the (?:rule|method)|summarize the (?:rule|method)|teach (?:it|the (?:rule|method)) back|(?:say|state|name|explain) the (?:rule|method))\b/.test(
      generatedText,
    )
  ) {
    throw new TypeError("AI lesson includes a retired recall exercise.");
  }
  const reviewedTerms =
    input.baseLesson.concept
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
    minutes: Math.max(
      10,
      Math.min(20, Number(candidate.minutes) || input.baseLesson.minutes),
    ),
    depth: depthFor(input),
    whyAssigned: asBoundedString(candidate.whyAssigned, "whyAssigned", 20, 220),
    evidenceSummary: evidenceSummary(input),
    tutorOpening: asBoundedString(
      candidate.tutorOpening,
      "tutorOpening",
      16,
      180,
    ),
    sections,
    strategyChecklist: asStringArray(
      candidate.strategyChecklist,
      "strategyChecklist",
      3,
      4,
      120,
    ),
    transferPrompt: asBoundedString(
      candidate.transferPrompt,
      "transferPrompt",
      16,
      180,
    ),
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

  async compose(
    input: LessonCompositionInput,
  ): Promise<PersonalizedLessonContent> {
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
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "You are Mr. Kim, Scout ACT’s friendly AI tutor, speaking to a 13- to 18-year-old. Use short, concrete sentences and everyday words. Sound like a real teacher, not a report. Never ask the student to rewrite, restate, name, summarize, or teach back a rule or method. Do not use the words evidence, model, latent, calibrated, probe, optimize, route, decision rule, transfer, mastery, readiness, priority, or confidence unless one is a necessary subject term in the reviewed lesson. Personalize instruction, but never invent score guarantees, copyrighted ACT items, answer keys, or facts beyond the supplied reviewed lesson. Return only valid JSON.",
              },
              {
                role: "user",
                content: JSON.stringify({
                  task: "Turn the reviewed lesson into five short, plain-English parts for this student.",
                  student: input.plan,
                  diagnosticEvidence: diagnosticEvidence(input) ?? null,
                  skill: input.skill,
                  reviewedLesson: input.baseLesson,
                  requiredJson: {
                    minutes: "integer from 10 to 20",
                    whyAssigned:
                      "one short sentence saying what the student got right or wrong and why this skill is next",
                    tutorOpening:
                      "a warm, direct opening from Scout using everyday words",
                    sections: SECTION_IDS.map((id) => ({
                      id,
                      title: "a short student-friendly title",
                      explanation:
                        "one or two concrete sentences, no more than 260 characters",
                      coachPrompt:
                        "one short coaching sentence, no more than 140 characters",
                    })),
                    strategyChecklist: [
                      "three or four short action steps; do not repeat the common trap from the final section",
                    ],
                    transferPrompt:
                      "one short sentence about spotting the skill when the wording looks different",
                  },
                }),
              },
            ],
          }),
        },
      );
      if (!response.ok)
        throw new Error(`AI provider returned ${response.status}.`);
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
  const config = tutorModelConfigFromEnv(env);
  return config
    ? new OpenAICompatibleLessonComposer(config)
    : new AuthoredLessonComposer();
}
