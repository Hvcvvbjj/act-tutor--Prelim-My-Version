import {
  ACT_QUESTION_DIFFICULTY_RUBRIC,
  getReviewedQuestionExamples,
} from "@act-tutor/content";
import type {
  CoreSection,
  PracticeDifficulty,
  SkillDefinition,
} from "@act-tutor/core";

export const QUESTION_GENERATION_PROMPT_VERSION =
  "act-question-generation-v1" as const;

export type QuestionGenerationPurpose =
  "lesson-progress" | "adaptive-practice" | "diagnostic" | "full-test";

export interface QuestionGenerationPromptInput {
  section: CoreSection;
  skill: Pick<SkillDefinition, "slug" | "label" | "category">;
  count: number;
  purpose: QuestionGenerationPurpose;
  difficultyPlan?: ReadonlyArray<PracticeDifficulty>;
}

export interface QuestionGenerationMessage {
  role: "system" | "user";
  content: string;
}

const PRACTICE_DIFFICULTY_PATTERN = [
  "medium",
  "hard",
  "medium",
  "hard",
] as const;
const TEST_DIFFICULTY_PATTERN = [
  "medium",
  "hard",
  "easy",
  "medium",
  "hard",
] as const;

function assertQuestionCount(count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 60) {
    throw new RangeError(
      "Question generation count must be an integer from 1 to 60.",
    );
  }
}

export function buildDefaultQuestionDifficultyPlan(
  count: number,
  purpose: QuestionGenerationPurpose,
): ReadonlyArray<PracticeDifficulty> {
  assertQuestionCount(count);
  const pattern =
    purpose === "diagnostic" || purpose === "full-test"
      ? TEST_DIFFICULTY_PATTERN
      : PRACTICE_DIFFICULTY_PATTERN;
  return Array.from(
    { length: count },
    (_, index) => pattern[index % pattern.length],
  );
}

function resolveDifficultyPlan(input: QuestionGenerationPromptInput) {
  assertQuestionCount(input.count);
  if (!input.difficultyPlan) {
    return buildDefaultQuestionDifficultyPlan(input.count, input.purpose);
  }
  if (input.difficultyPlan.length !== input.count) {
    throw new RangeError(
      "The explicit difficulty plan must contain one level per requested question.",
    );
  }
  return [...input.difficultyPlan];
}

export function buildActQuestionGenerationMessages(
  input: QuestionGenerationPromptInput,
): ReadonlyArray<QuestionGenerationMessage> {
  const difficultyPlan = resolveDifficultyPlan(input);
  const fewShotExamples = getReviewedQuestionExamples(
    input.section,
    input.skill.slug,
  );
  const requestedRubric = Object.fromEntries(
    [...new Set(difficultyPlan)].map((difficulty) => [
      difficulty,
      ACT_QUESTION_DIFFICULTY_RUBRIC.levels[difficulty],
    ]),
  );

  return [
    {
      role: "system",
      content: [
        "You write original ACT-style practice questions for Scout.",
        "Write new items; never quote, reconstruct, lightly paraphrase, or claim to reproduce an official ACT question.",
        "The reviewed examples are rigor anchors only. Do not reuse their scenarios, numbers, sentence frames, answer choices, or rationales.",
        "Follow the requested difficulty for each item exactly. Medium and hard questions must require linked reasoning, not one-step arithmetic, direct word matching, or an obvious grammar cue.",
        "Every question must have exactly one best answer. Every wrong choice must be plausible after a specific common error, and its misconception field must name that error.",
        "Keep calculations reasonable and prose readable. Difficulty must come from ACT-relevant decisions, not obscure facts or deliberately confusing wording.",
        "Return only valid JSON matching the requested contract.",
      ].join(" "),
    },
    {
      role: "user",
      content: JSON.stringify({
        promptVersion: QUESTION_GENERATION_PROMPT_VERSION,
        task: `Create ${input.count} original ${input.section} questions for ${input.skill.label}.`,
        purpose: input.purpose,
        section: input.section,
        skill: input.skill,
        difficultyPlan,
        sharedQualityRequirements:
          ACT_QUESTION_DIFFICULTY_RUBRIC.sharedRequirements,
        requestedDifficultyRubric: requestedRubric,
        fewShotInstructions:
          "Study why these reviewed items earn their labels, then create materially different items at the same standard.",
        reviewedOriginalFewShotExamples: fewShotExamples,
        sectionRequirements: {
          english:
            "Supply enough sentence or paragraph context to resolve meaning and structure. Do not reduce medium or hard items to spotting one visibly wrong punctuation mark.",
          math: "For medium and hard items, require setup plus at least one additional linked step. Use exact values and verify the keyed choice by solving the item.",
          reading:
            "Supply an original passage substantial enough to support close reading. Medium and hard items must connect separated details, track a qualification, or distinguish close purposes or claims.",
        }[input.section],
        requiredJson: {
          questions: [
            {
              id: "unique kebab-case draft id",
              section: input.section,
              skill: input.skill.slug,
              difficulty:
                "the corresponding value from difficultyPlan, in the same order",
              stimulus:
                "original passage or sentence context; required for English and Reading",
              prompt: "clear question stem",
              choices: [
                {
                  id: "A, B, C, or D",
                  text: "answer choice",
                  misconception:
                    "required for each wrong choice; omit only on the keyed choice",
                },
              ],
              correctChoiceId: "A, B, C, or D",
              rationale:
                "solve the item and explain both why the key works and why the closest distractor fails",
              difficultyEvidence: [
                "at least two concrete reasoning demands for medium or hard items",
              ],
            },
          ],
        },
        finalChecks: [
          "The questions array has exactly the requested count.",
          "Difficulty values match difficultyPlan in order.",
          "Each item has four unique choices and exactly one keyed answer.",
          "Each wrong choice has a specific misconception.",
          "The rationale independently verifies the answer.",
          "No item copies or closely imitates an example or official test item.",
        ],
      }),
    },
  ];
}
