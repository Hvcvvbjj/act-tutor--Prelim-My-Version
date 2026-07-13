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
  });

export const rapidDiagnosticFormSchema = z
  .object({
    id: slugSchema,
    version: slugSchema,
    mode: z.literal("rapid"),
    title: z.string().min(4),
    estimatedMinutes: z.number().int().min(10).max(45),
    questions: z.array(diagnosticQuestionSchema).length(24),
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

    for (const section of CORE_SECTIONS) {
      const count = form.questions.filter(
        (question) => question.section === section,
      ).length;
      if (count !== 8) {
        context.addIssue({
          code: "custom",
          path: ["questions"],
          message: `Rapid blueprint requires 8 ${section} questions; found ${count}.`,
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
      Array.from(skillCounts.values()).some((count) => count !== 2)
    ) {
      context.addIssue({
        code: "custom",
        path: ["questions"],
        message: "Rapid blueprint requires exactly 12 skills with 2 items each.",
      });
    }
  });

export function validateRapidDiagnosticForm(
  input: unknown,
): DiagnosticFormSecure {
  return rapidDiagnosticFormSchema.parse(input);
}
