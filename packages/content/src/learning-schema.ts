import { CORE_SECTIONS } from "@act-tutor/core";
import { z } from "zod";

const slugSchema = z
  .string()
  .min(2)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a stable kebab-case slug.");

const contentMetaSchema = z.object({
  status: z.literal("published"),
  license: z.literal("original"),
  reviewer: z.string().min(2),
  reviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const learningChoiceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  misconception: z.string().min(4).optional(),
});

export const skillDefinitionSchema = z.object({
  slug: slugSchema,
  label: z.string().min(2),
  section: z.enum(CORE_SECTIONS),
  category: z.string().min(2),
  diagnosticSkill: slugSchema,
});

export const lessonSchema = z.object({
  id: slugSchema,
  skill: slugSchema,
  title: z.string().min(8),
  minutes: z.number().int().min(3).max(12),
  objective: z.string().min(12),
  concept: z.string().min(40),
  steps: z.array(z.string().min(12)).min(3).max(5),
  workedExample: z.object({
    prompt: z.string().min(12),
    answer: z.string().min(1),
    explanation: z.array(z.string().min(12)).min(2).max(4),
  }),
  trap: z.string().min(20),
  content: contentMetaSchema,
});

export const practiceQuestionSchema = z
  .object({
    id: slugSchema,
    version: z.number().int().positive(),
    skill: slugSchema,
    section: z.enum(CORE_SECTIONS),
    difficulty: z.enum(["easy", "medium", "hard"]),
    prompt: z.string().min(12),
    stimulus: z.string().min(8).optional(),
    choices: z.array(learningChoiceSchema).length(4),
    correctChoiceId: z.string().min(1),
    rationale: z.string().min(24),
    content: contentMetaSchema,
  })
  .superRefine((question, context) => {
    const ids = question.choices.map((choice) => choice.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Choice IDs must be unique within a question.",
      });
    }
    if (!ids.includes(question.correctChoiceId)) {
      context.addIssue({
        code: "custom",
        path: ["correctChoiceId"],
        message: "Correct choice must exist in choices.",
      });
    }
  });

export const learningBankSchema = z
  .object({
    id: slugSchema,
    version: slugSchema,
    skills: z.array(skillDefinitionSchema).length(12),
    lessons: z.array(lessonSchema).length(12),
    practice: z.array(practiceQuestionSchema).length(60),
  })
  .superRefine((bank, context) => {
    const skillSlugs = new Set(bank.skills.map((skill) => skill.slug));
    if (skillSlugs.size !== bank.skills.length) {
      context.addIssue({
        code: "custom",
        path: ["skills"],
        message: "Skill slugs must be unique.",
      });
    }

    const lessonSkills = new Set(bank.lessons.map((lesson) => lesson.skill));
    for (const skill of skillSlugs) {
      if (!lessonSkills.has(skill)) {
        context.addIssue({
          code: "custom",
          path: ["lessons"],
          message: `Missing lesson for ${skill}.`,
        });
      }
      const count = bank.practice.filter((question) => question.skill === skill).length;
      if (count !== 5) {
        context.addIssue({
          code: "custom",
          path: ["practice"],
          message: `Expected 5 practice questions for ${skill}; found ${count}.`,
        });
      }
    }

    for (const lesson of bank.lessons) {
      if (!skillSlugs.has(lesson.skill)) {
        context.addIssue({
          code: "custom",
          path: ["lessons"],
          message: `Unknown lesson skill ${lesson.skill}.`,
        });
      }
    }
    for (const question of bank.practice) {
      const skill = bank.skills.find((item) => item.slug === question.skill);
      if (!skill) {
        context.addIssue({
          code: "custom",
          path: ["practice"],
          message: `Unknown practice skill ${question.skill}.`,
        });
      } else if (skill.section !== question.section) {
        context.addIssue({
          code: "custom",
          path: ["practice"],
          message: `${question.id} section does not match its skill.`,
        });
      }
    }
  });

export function validateLearningBank<T>(input: T): T {
  learningBankSchema.parse(input);
  return input;
}
