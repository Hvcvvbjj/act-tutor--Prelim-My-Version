import type {
  CoreSection,
  DiagnosticFormSecure,
  DiagnosticQuestionSecure,
} from "@act-tutor/core";

import { ACT_PRACTICE_QUESTIONS, ACT_SKILLS } from "./learning-content";
import { RAPID_DIAGNOSTIC_FORM } from "./rapid-diagnostic";

const REVIEW = {
  status: "published",
  license: "original",
  reviewer: "Scout ACT content review",
  reviewedAt: "2026-07-26",
} as const;

const BLUEPRINT = [
  {
    section: "english",
    officialQuestions: 50,
    officialScoredQuestions: 40,
    officialMinutes: 35,
    diagnosticQuestions: 50,
    diagnosticMinutes: 35,
    reportingCategories: [
      { label: "Production of Writing", range: "38–43%" },
      { label: "Knowledge of Language", range: "18–23%" },
      { label: "Conventions of Standard English", range: "38–43%" },
    ],
  },
  {
    section: "math",
    officialQuestions: 45,
    officialScoredQuestions: 41,
    officialMinutes: 50,
    diagnosticQuestions: 45,
    diagnosticMinutes: 50,
    reportingCategories: [
      { label: "Preparing for Higher Math", range: "80%" },
      { label: "Integrating Essential Skills", range: "20%" },
      { label: "Modeling", range: "20% or more; overlaps other categories" },
    ],
  },
  {
    section: "reading",
    officialQuestions: 36,
    officialScoredQuestions: 27,
    officialMinutes: 40,
    diagnosticQuestions: 36,
    diagnosticMinutes: 40,
    reportingCategories: [
      { label: "Key Ideas and Details", range: "44–52%" },
      { label: "Craft and Structure", range: "26–33%" },
      { label: "Integration of Knowledge and Ideas", range: "19–26%" },
    ],
  },
] as const;

function expectedSeconds(section: CoreSection) {
  return section === "english" ? 42 : section === "math" ? 67 : 67;
}

const skillBySlug = new Map(ACT_SKILLS.map((skill) => [skill.slug, skill]));

function practiceAsExamQuestion(
  question: (typeof ACT_PRACTICE_QUESTIONS)[number],
): DiagnosticQuestionSecure {
  const skill = skillBySlug.get(question.skill);
  if (!skill)
    throw new RangeError(`Unknown full-test skill ${question.skill}.`);
  const passage = question.stimulus !== undefined;
  return {
    id: `full-${question.id}`,
    version: question.version,
    section: question.section,
    category: skill.category,
    primarySkill: question.skill,
    skillLabel: skill.label,
    difficulty: question.difficulty,
    prompt: question.prompt,
    ...(question.stimulus ? { stimulus: question.stimulus } : {}),
    choices: question.choices.map(({ id, text }) => ({ id, text })),
    expectedSeconds: expectedSeconds(question.section),
    format: passage ? "passage" : "standalone",
    ...(passage
      ? {
          passageId: `full-passage-${question.id}`,
          passageTitle: `${skill.label} practice`,
        }
      : {}),
    correctChoiceId: question.correctChoiceId,
    rationale: question.rationale,
    content: REVIEW,
  };
}

const ADDITIONAL_QUESTIONS: ReadonlyArray<DiagnosticQuestionSecure> = [
  {
    id: "full-english-additional-1",
    version: 1,
    section: "english",
    category: "Conventions of Standard English",
    primarySkill: "sentence-boundaries",
    skillLabel: "Sentence boundaries",
    difficulty: "medium",
    prompt: "Which choice correctly joins the two complete thoughts?",
    stimulus:
      "The community telescope was finally repaired, students could again track the moons of Jupiter.",
    choices: [
      {
        id: "A",
        text: "The community telescope was finally repaired, students could again track the moons of Jupiter.",
      },
      {
        id: "B",
        text: "The community telescope was finally repaired; students could again track the moons of Jupiter.",
      },
      {
        id: "C",
        text: "The community telescope was finally repaired students, could again track the moons of Jupiter.",
      },
      {
        id: "D",
        text: "The community telescope being finally repaired, students could again track the moons of Jupiter.",
      },
    ],
    expectedSeconds: 42,
    format: "passage",
    passageId: "full-passage-english-additional-1",
    passageTitle: "The repaired telescope",
    correctChoiceId: "B",
    rationale:
      "Both sides are complete sentences, so a semicolon correctly joins the closely related thoughts.",
    content: REVIEW,
  },
  {
    id: "full-english-additional-2",
    version: 1,
    section: "english",
    category: "Production of Writing",
    primarySkill: "concision-and-redundancy",
    skillLabel: "Concision and redundancy",
    difficulty: "easy",
    prompt: "Which choice is the most concise revision?",
    stimulus:
      "The two partners collaborated together on the mural design before painting began.",
    choices: [
      { id: "A", text: "collaborated together jointly" },
      { id: "B", text: "collaborated together" },
      { id: "C", text: "collaborated" },
      { id: "D", text: "worked in a collaborative way together" },
    ],
    expectedSeconds: 42,
    format: "passage",
    passageId: "full-passage-english-additional-2",
    passageTitle: "The mural partners",
    correctChoiceId: "C",
    rationale:
      "Collaborated already means worked together, so the single verb preserves the meaning without repetition.",
    content: REVIEW,
  },
  {
    id: "full-english-additional-3",
    version: 1,
    section: "english",
    category: "Conventions of Standard English",
    primarySkill: "punctuation-and-commas",
    skillLabel: "Punctuation and commas",
    difficulty: "medium",
    prompt: "Which choice uses commas correctly?",
    stimulus:
      "The oldest tree in the park, a towering oak provides shade for the playground.",
    choices: [
      {
        id: "A",
        text: "The oldest tree in the park a towering oak, provides shade for the playground.",
      },
      {
        id: "B",
        text: "The oldest tree in the park, a towering oak, provides shade for the playground.",
      },
      {
        id: "C",
        text: "The oldest tree, in the park a towering oak, provides shade for the playground.",
      },
      {
        id: "D",
        text: "The oldest tree in the park, a towering oak provides shade, for the playground.",
      },
    ],
    expectedSeconds: 42,
    format: "passage",
    passageId: "full-passage-english-additional-3",
    passageTitle: "The park oak",
    correctChoiceId: "B",
    rationale:
      "A towering oak renames the tree and is removable, so it needs a comma on both sides.",
    content: REVIEW,
  },
  {
    id: "full-english-additional-4",
    version: 1,
    section: "english",
    category: "Knowledge of Language",
    primarySkill: "logical-transitions",
    skillLabel: "Logical transitions",
    difficulty: "medium",
    prompt: "Which transition most logically completes the blank?",
    stimulus:
      "The first soil sample contained almost no nitrogen. ___, the class added compost before planting.",
    choices: [
      { id: "A", text: "For example," },
      { id: "B", text: "As a result," },
      { id: "C", text: "Meanwhile," },
      { id: "D", text: "In contrast," },
    ],
    expectedSeconds: 42,
    format: "passage",
    passageId: "full-passage-english-additional-4",
    passageTitle: "Preparing the garden",
    correctChoiceId: "B",
    rationale:
      "Adding compost is a result of finding too little nitrogen, so As a result states the relationship.",
    content: REVIEW,
  },
  {
    id: "full-english-additional-5",
    version: 1,
    section: "english",
    category: "Production of Writing",
    primarySkill: "concision-and-redundancy",
    skillLabel: "Concision and redundancy",
    difficulty: "hard",
    prompt: "Which revision states the idea most directly?",
    stimulus:
      "At this point in time, the committee currently meets every Tuesday.",
    choices: [
      { id: "A", text: "At this point in time, the committee currently meets" },
      { id: "B", text: "Currently, the committee now meets" },
      { id: "C", text: "The committee meets" },
      { id: "D", text: "The committee has meetings that occur" },
    ],
    expectedSeconds: 42,
    format: "passage",
    passageId: "full-passage-english-additional-5",
    passageTitle: "The committee schedule",
    correctChoiceId: "C",
    rationale:
      "The present-tense verb meets already establishes the current schedule, so the extra time phrases repeat the same idea.",
    content: REVIEW,
  },
  {
    id: "full-math-additional-1",
    version: 1,
    section: "math",
    category: "Preparing for Higher Math",
    primarySkill: "linear-equations",
    skillLabel: "Linear equations",
    difficulty: "medium",
    prompt: "If 4(2x − 3) = 28, what is the value of x?",
    choices: [
      { id: "A", text: "2" },
      { id: "B", text: "4" },
      { id: "C", text: "5" },
      { id: "D", text: "8" },
    ],
    expectedSeconds: 67,
    format: "standalone",
    correctChoiceId: "C",
    rationale:
      "Divide by 4 to get 2x minus 3 equals 7, then add 3 and divide by 2 to get x equals 5.",
    content: REVIEW,
  },
  {
    id: "full-math-additional-2",
    version: 1,
    section: "math",
    category: "Integrating Essential Skills",
    primarySkill: "ratios-and-percent",
    skillLabel: "Ratios and percent",
    difficulty: "medium",
    prompt:
      "A jacket originally costs $80 and is discounted by 25%. What is the sale price?",
    choices: [
      { id: "A", text: "$20" },
      { id: "B", text: "$55" },
      { id: "C", text: "$60" },
      { id: "D", text: "$75" },
    ],
    expectedSeconds: 67,
    format: "standalone",
    correctChoiceId: "C",
    rationale:
      "Twenty-five percent of 80 is 20, and subtracting that discount from 80 gives a sale price of 60 dollars.",
    content: REVIEW,
  },
];

const PRACTICE_QUESTIONS = ACT_PRACTICE_QUESTIONS.filter(
  (question) =>
    question.id !== "central-ideas-and-details-practice-5" &&
    question.id !== "supported-inference-practice-5",
).map(practiceAsExamQuestion);

function validateFullLengthForm(form: DiagnosticFormSecure) {
  const expected = { english: 50, math: 45, reading: 36 } as const;
  if (form.questions.length !== 131) {
    throw new RangeError(
      "Full-length core practice must contain 131 questions.",
    );
  }
  if (new Set(form.questions.map((question) => question.id)).size !== 131) {
    throw new RangeError(
      "Full-length core practice question IDs must be unique.",
    );
  }
  for (const section of Object.keys(expected) as CoreSection[]) {
    const count = form.questions.filter(
      (question) => question.section === section,
    ).length;
    if (count !== expected[section]) {
      throw new RangeError(
        `Full-length core practice requires ${expected[section]} ${section} questions; found ${count}.`,
      );
    }
  }
  return form;
}

export const FULL_LENGTH_PRACTICE_FORM = validateFullLengthForm({
  id: "enhanced-act-full-length-core-practice",
  version: "full-core-v1",
  mode: "rapid",
  title: "Enhanced ACT full-length core practice",
  estimatedMinutes: 125,
  blueprint: BLUEPRINT,
  questions: [
    ...RAPID_DIAGNOSTIC_FORM.questions,
    ...PRACTICE_QUESTIONS,
    ...ADDITIONAL_QUESTIONS,
  ],
});
