import { CORE_SECTIONS, type DiagnosticFormSecure } from "@act-tutor/core";
import { z } from "zod";

const slugSchema = z
  .string()
  .min(2)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a stable kebab-case slug.");

export const diagnosticChoiceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

export const diagnosticQuestionSchema = z
  .object({
    id: slugSchema,
    version: z.number().int().positive(),
    section: z.enum(CORE_SECTIONS),
    category: z.string().min(2),
    primarySkill: slugSchema,
    skillLabel: z.string().min(2),
    difficulty: z.enum(["easy", "medium", "hard"]),
    prompt: z.string().min(10),
    stimulus: z.string().min(10).optional(),
    choices: z.array(diagnosticChoiceSchema).length(4),
    expectedSeconds: z.number().int().min(20).max(180),
    format: z.enum(["passage", "standalone"]),
    passageId: slugSchema.optional(),
    passageTitle: z.string().min(2).optional(),
    lineReference: z.string().min(1).optional(),
    correctChoiceId: z.string().min(1),
    rationale: z.string().min(20),
    content: z.object({
      status: z.literal("published"),
      license: z.literal("original"),
      reviewer: z.string().min(2),
      reviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  })
  .superRefine((question, context) => {
    const choiceIds = question.choices.map((choice) => choice.id);
    if (new Set(choiceIds).size !== choiceIds.length) {
      context.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Choice IDs must be unique within a question.",
      });
    }
    if (!choiceIds.includes(question.correctChoiceId)) {
      context.addIssue({
        code: "custom",
        path: ["correctChoiceId"],
        message: "The correct choice must exist in choices.",
      });
    }
    if (
      question.format === "passage" &&
      (!question.passageId || !question.passageTitle || !question.stimulus)
    ) {
      context.addIssue({
        code: "custom",
        path: ["passageId"],
        message: "Passage questions require passage metadata and a stimulus.",
      });
    }
  });

const diagnosticBlueprintSchema = z.object({
  section: z.enum(CORE_SECTIONS),
  officialQuestions: z.number().int().positive(),
  officialScoredQuestions: z.number().int().positive(),
  officialMinutes: z.number().int().positive(),
  diagnosticQuestions: z.number().int().positive(),
  diagnosticMinutes: z.number().int().positive(),
  reportingCategories: z.array(
    z.object({ label: z.string().min(2), range: z.string().min(2) }),
  ).min(2),
});

export const rapidDiagnosticFormSchema = z
  .object({
    id: slugSchema,
    version: slugSchema,
    mode: z.literal("rapid"),
    title: z.string().min(4),
    estimatedMinutes: z.number().int().min(55).max(75),
    blueprint: z.array(diagnosticBlueprintSchema).length(3),
    questions: z.array(diagnosticQuestionSchema).length(66),
  })
  .superRefine((form, context) => {
    const ids = form.questions.map((question) => question.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["questions"],
        message: "Question IDs must be unique.",
      });
    }

    const expectedCounts = { english: 25, math: 23, reading: 18 } as const;
    for (const section of CORE_SECTIONS) {
      const count = form.questions.filter(
        (question) => question.section === section,
      ).length;
      if (count !== expectedCounts[section]) {
        context.addIssue({
          code: "custom",
          path: ["questions"],
          message: `Half-length blueprint requires ${expectedCounts[section]} ${section} questions; found ${count}.`,
        });
      }
    }

    const skillCounts = new Map<string, number>();
    for (const question of form.questions) {
      skillCounts.set(
        question.primarySkill,
        (skillCounts.get(question.primarySkill) ?? 0) + 1,
      );
    }
    if (
      skillCounts.size !== 12 ||
      Array.from(skillCounts.values()).some((count) => count < 4 || count > 7)
    ) {
      context.addIssue({
        code: "custom",
        path: ["questions"],
        message: "Half-length blueprint requires 12 skills with 4 to 7 items each.",
      });
    }

    for (const blueprint of form.blueprint) {
      if (blueprint.diagnosticQuestions !== expectedCounts[blueprint.section]) {
        context.addIssue({
          code: "custom",
          path: ["blueprint"],
          message: `Blueprint count does not match ${blueprint.section} questions.`,
        });
      }
    }

    const expectedCategoryCounts: Record<
      (typeof CORE_SECTIONS)[number],
      Record<string, number>
    > = {
      english: {
        "Production of Writing": 10,
        "Knowledge of Language": 5,
        "Conventions of Standard English": 10,
      },
      math: {
        "Preparing for Higher Math": 18,
        "Integrating Essential Skills": 5,
      },
      reading: {
        "Key Ideas and Details": 9,
        "Craft and Structure": 5,
        "Integration of Knowledge and Ideas": 4,
      },
    };
    for (const section of CORE_SECTIONS) {
      for (const [category, expected] of Object.entries(
        expectedCategoryCounts[section],
      )) {
        const actual = form.questions.filter(
          (question) =>
            question.section === section && question.category === category,
        ).length;
        if (actual !== expected) {
          context.addIssue({
            code: "custom",
            path: ["questions"],
            message: `${section} requires ${expected} ${category} questions; found ${actual}.`,
          });
        }
      }
    }
  });

export function validateRapidDiagnosticForm(
  input: unknown,
): DiagnosticFormSecure {
  return rapidDiagnosticFormSchema.parse(input);
}
