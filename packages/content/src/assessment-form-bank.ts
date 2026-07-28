import type {
  CoreSection,
  DiagnosticDifficulty,
  DiagnosticFormSecure,
  DiagnosticQuestionSecure,
} from "@act-tutor/core";

const REVIEW = {
  status: "published",
  license: "original",
  reviewer: "Scout ACT content review",
  reviewedAt: "2026-07-28",
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

const CHOICE_IDS = ["a", "b", "c", "d"] as const;
type ChoiceId = (typeof CHOICE_IDS)[number];
type AssessmentVariant = 0 | 1 | 2 | 3;

interface QuestionInput {
  section: CoreSection;
  skill: string;
  skillLabel: string;
  category: string;
  difficulty: DiagnosticDifficulty;
  prompt: string;
  choices: readonly [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
  rationale: string;
  stimulus?: string;
  passageId?: string;
  passageTitle?: string;
}

function question(
  variant: AssessmentVariant,
  ordinal: number,
  input: QuestionInput,
): DiagnosticQuestionSecure {
  const formCode = ["atlas", "beacon", "cedar", "delta"][variant];
  return {
    id: `${formCode}-${input.section}-${String(ordinal).padStart(2, "0")}`,
    version: 1,
    section: input.section,
    category: input.category,
    primarySkill: input.skill,
    skillLabel: input.skillLabel,
    difficulty: input.difficulty,
    prompt: input.prompt,
    ...(input.stimulus ? { stimulus: input.stimulus } : {}),
    choices: input.choices.map((text, index) => ({
      id: CHOICE_IDS[index],
      text,
    })),
    expectedSeconds: input.section === "english" ? 42 : 67,
    format: input.stimulus ? "passage" : "standalone",
    ...(input.stimulus
      ? {
          passageId:
            input.passageId ??
            `${formCode}-${input.section}-passage-${String(ordinal).padStart(2, "0")}`,
          passageTitle: input.passageTitle ?? "Assessment passage",
        }
      : {}),
    correctChoiceId: CHOICE_IDS[input.correct] as ChoiceId,
    rationale: input.rationale,
    content: REVIEW,
  };
}

function rotatedChoices(
  correct: string,
  distractors: readonly [string, string, string],
  correctIndex: number,
) {
  const values = [...distractors];
  values.splice(correctIndex, 0, correct);
  return values as [string, string, string, string];
}

const FORM_MODIFIERS = [
  "during the first field trial",
  "during the overnight calibration",
  "after a week of outdoor testing",
  "while volunteers observed the demonstration",
] as const;

const CLAUSE_PAIRS = [
  [
    "the tide gauge stopped transmitting",
    "the harbor crew replaced its battery",
  ],
  ["the archive scanner jammed", "the librarian cleared the paper path"],
  ["the greenhouse fan slowed", "the seedlings began to overheat"],
  ["the rehearsal room echoed", "the director moved the choir forward"],
  ["the trail sensor lost power", "the ranger installed a new solar cell"],
  ["the pottery glaze cracked", "the artist lowered the kiln temperature"],
  ["the weather balloon drifted east", "the tracking team changed its route"],
  ["the sample vial leaked", "the technician repeated the measurement"],
  ["the bridge model twisted", "the class reinforced its center joint"],
  ["the translation sounded stiff", "the editor restored the original rhythm"],
  ["the irrigation timer failed", "the gardeners watered the beds by hand"],
  ["the telescope image blurred", "the observer adjusted the tracking motor"],
  ["the audio recording clipped", "the engineer reduced the input level"],
] as const;

function sentenceCase(value: string) {
  return `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
}

function englishBoundaryQuestions(variant: AssessmentVariant) {
  return CLAUSE_PAIRS.map(([left, right], index) => {
    const modifier = FORM_MODIFIERS[variant];
    const first = sentenceCase(left);
    const second = right;
    const type = index % 4;
    const correctIndex = (index + variant) % 4;
    if (type === 0) {
      const correct = `${first} ${modifier}; ${second}.`;
      return {
        section: "english",
        skill: "sentence-boundaries",
        skillLabel: "Sentence boundaries",
        category: "Conventions of Standard English",
        difficulty: "medium",
        stimulus: `${first} ${modifier}, ${second}.`,
        prompt: "Which revision correctly joins the two complete thoughts?",
        choices: rotatedChoices(
          correct,
          [
            `${first} ${modifier}, ${second}.`,
            `${first} ${modifier} ${second}.`,
            `${first} ${modifier}, while ${second}.`,
          ],
          correctIndex,
        ),
        correct: correctIndex as 0 | 1 | 2 | 3,
        rationale:
          "Both sides can stand as complete sentences, so a semicolon can join the closely related independent clauses.",
      } satisfies QuestionInput;
    }
    if (type === 1) {
      const correct = `${first} ${modifier}, so ${second}.`;
      return {
        section: "english",
        skill: "sentence-boundaries",
        skillLabel: "Sentence boundaries",
        category: "Conventions of Standard English",
        difficulty: "medium",
        stimulus: `${first} ${modifier}, ${second}.`,
        prompt:
          "Which revision makes the cause-and-result relationship grammatically complete?",
        choices: rotatedChoices(
          correct,
          [
            `${first} ${modifier}, ${second}.`,
            `${first} ${modifier}; so, ${second}.`,
            `${first} ${modifier} so, ${second}.`,
          ],
          correctIndex,
        ),
        correct: correctIndex as 0 | 1 | 2 | 3,
        rationale:
          "A comma plus the coordinating conjunction so correctly joins the two independent clauses and states their result relationship.",
      } satisfies QuestionInput;
    }
    if (type === 2) {
      const correct = `Because ${left} ${modifier}, ${second}.`;
      return {
        section: "english",
        skill: "sentence-boundaries",
        skillLabel: "Sentence boundaries",
        category: "Conventions of Standard English",
        difficulty: "medium",
        stimulus: `Because ${left} ${modifier}. ${sentenceCase(second)}.`,
        prompt: "Which choice most effectively combines the two sentences?",
        choices: rotatedChoices(
          correct,
          [
            `Because ${left} ${modifier}. ${sentenceCase(second)}.`,
            `Because ${left} ${modifier}; ${second}.`,
            `${first} because ${modifier}, ${second}.`,
          ],
          correctIndex,
        ),
        correct: correctIndex as 0 | 1 | 2 | 3,
        rationale:
          "Because makes the first clause dependent, so it must be attached to the complete main clause with a comma.",
      } satisfies QuestionInput;
    }
    const correct = `${first} ${modifier}; therefore, ${second}.`;
    return {
      section: "english",
      skill: "sentence-boundaries",
      skillLabel: "Sentence boundaries",
      category: "Conventions of Standard English",
      difficulty: "hard",
      stimulus: `${first} ${modifier}, therefore, ${second}.`,
      prompt:
        "Which revision correctly punctuates the boundary and the logical connector?",
      choices: rotatedChoices(
        correct,
        [
          `${first} ${modifier}, therefore, ${second}.`,
          `${first} ${modifier}; therefore ${second}.`,
          `${first} ${modifier}: therefore; ${second}.`,
        ],
        correctIndex,
      ),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale:
        "The ideas on both sides are independent clauses. A semicolon separates them, and the conjunctive adverb therefore takes a following comma.",
    } satisfies QuestionInput;
  });
}

const CONCISION_CASES = [
  {
    wordy:
      "The committee reached a consensus of agreement about the revised schedule.",
    clean: "The committee agreed on the revised schedule.",
    incomplete: "The committee met about the schedule.",
  },
  {
    wordy:
      "The sensor repeated the measurement again for a second time after the alarm.",
    clean: "The sensor repeated the measurement after the alarm.",
    incomplete: "The sensor measured after the alarm.",
  },
  {
    wordy:
      "The two researchers collaborated together to compare the separate samples.",
    clean: "The two researchers collaborated to compare the samples.",
    incomplete: "The researchers worked.",
  },
  {
    wordy:
      "At this point in time, the orchestra currently rehearses in the west hall.",
    clean: "The orchestra now rehearses in the west hall.",
    incomplete: "The orchestra rehearses.",
  },
  {
    wordy:
      "The reason the launch was delayed was because wind speeds rose suddenly.",
    clean: "The launch was delayed because wind speeds rose suddenly.",
    incomplete: "The launch was delayed.",
  },
  {
    wordy:
      "The archive stores a substitute copy that can be used in place of the fragile original.",
    clean:
      "The archive stores a copy that can be used instead of the fragile original.",
    incomplete: "The archive stores a copy.",
  },
  {
    wordy:
      "The final outcome at the end of the trial surprised the entire team.",
    clean: "The trial's outcome surprised the entire team.",
    incomplete: "The team was surprised.",
  },
  {
    wordy:
      "Each individual seedling was measured separately on its own every Friday.",
    clean: "Each seedling was measured every Friday.",
    incomplete: "Seedlings were measured.",
  },
  {
    wordy:
      "The map shows the exact location of where each water sample was collected.",
    clean: "The map shows where each water sample was collected.",
    incomplete: "The map shows the samples.",
  },
  {
    wordy:
      "The unexpected storm was an unplanned surprise that forced the crew indoors.",
    clean: "The unexpected storm forced the crew indoors.",
    incomplete: "The crew went indoors.",
  },
  {
    wordy:
      "The new insulation reduced heat loss while still continuing to allow airflow.",
    clean: "The new insulation reduced heat loss while allowing airflow.",
    incomplete: "The new insulation reduced heat loss.",
  },
  {
    wordy:
      "The curator combined both lists together without removing their source labels.",
    clean:
      "The curator combined the lists without removing their source labels.",
    incomplete: "The curator combined the lists.",
  },
] as const;

function englishConcisionQuestions(variant: AssessmentVariant) {
  return CONCISION_CASES.map((item, index) => {
    const modifier =
      [
        "for the spring report",
        "before the public demonstration",
        "during the final review",
        "for the visiting research team",
      ][variant] ?? "";
    const correct = `${item.clean.replace(/\.$/, "")} ${modifier}.`;
    const correctIndex = (index * 3 + variant) % 4;
    return {
      section: "english",
      skill: "concision-and-redundancy",
      skillLabel: "Concision and redundancy",
      category: "Knowledge of Language",
      difficulty: index < 2 ? "easy" : "medium",
      stimulus: `${item.wordy.replace(/\.$/, "")} ${modifier}.`,
      prompt:
        "Which revision is most concise while preserving every relevant detail?",
      choices: rotatedChoices(
        correct,
        [
          `${item.wordy.replace(/\.$/, "")} ${modifier}.`,
          `${item.incomplete.replace(/\.$/, "")} ${modifier}.`,
          `${item.clean.replace(/\.$/, "")}, and this occurred ${modifier}.`,
        ],
        correctIndex,
      ),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale:
        "The correct revision removes wording that repeats an idea while keeping the timing, cause, contrast, or other detail needed by the sentence.",
    } satisfies QuestionInput;
  });
}

const PUNCTUATION_CASES = [
  [
    "The lead engineer",
    "who designed the original valve",
    "reviewed the repair",
  ],
  [
    "The island fox",
    "unlike larger mainland predators",
    "can live on limited prey",
  ],
  [
    "Mara's first prototype",
    "a lightweight bamboo frame",
    "bent in strong wind",
  ],
  [
    "The observatory",
    "which opened before sunrise",
    "recorded the meteor shower",
  ],
  ["The copper beech", "the oldest tree in the square", "survived the drought"],
  [
    "The translation",
    "despite its formal vocabulary",
    "keeps the poem's quick pace",
  ],
  [
    "The ceramic bowl",
    "which was fired twice",
    "produced a clear ringing tone",
  ],
  [
    "The route planner",
    "a volunteer-built program",
    "flagged the flooded streets",
  ],
  [
    "The smallest sensor",
    "not the expensive laboratory model",
    "gave the steadiest readings",
  ],
  [
    "The repair manual",
    "which includes annotated diagrams",
    "explains the hidden latch",
  ],
  [
    "The wetland edge",
    "where reeds slow the current",
    "trapped the most sediment",
  ],
  [
    "The final rehearsal",
    "after several uneven attempts",
    "matched the conductor's tempo",
  ],
] as const;

function englishPunctuationQuestions(variant: AssessmentVariant) {
  return PUNCTUATION_CASES.map(([subject, interruption, predicate], index) => {
    const modifier = FORM_MODIFIERS[variant];
    const correct = `${subject}, ${interruption}, ${predicate} ${modifier}.`;
    const correctIndex = (index + 2 * variant) % 4;
    return {
      section: "english",
      skill: "punctuation-and-commas",
      skillLabel: "Punctuation and commas",
      category: "Conventions of Standard English",
      difficulty: "medium",
      stimulus: `${subject}, ${interruption} ${predicate} ${modifier}.`,
      prompt: "Which choice correctly punctuates the interrupting information?",
      choices: rotatedChoices(
        correct,
        [
          `${subject}, ${interruption} ${predicate} ${modifier}.`,
          `${subject} ${interruption}, ${predicate} ${modifier}.`,
          `${subject}, ${interruption}; ${predicate} ${modifier}.`,
        ],
        correctIndex,
      ),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale:
        "The middle phrase can be removed without changing the main clause, so a comma is required at both its opening and closing edges.",
    } satisfies QuestionInput;
  });
}

const TRANSITION_CASES = [
  [
    "The first coating reflected the most sunlight when clean.",
    "Dust quickly reduced its performance.",
    "contrast",
    "However,",
  ],
  [
    "The water sample contained very little nitrogen.",
    "The class added compost before planting.",
    "result",
    "As a result,",
  ],
  [
    "The team measured air temperature at every stop.",
    "It recorded humidity at the same locations.",
    "addition",
    "Additionally,",
  ],
  [
    "One watch lost time whenever the room cooled.",
    "Several watches using the same lubricant showed the same pattern.",
    "example",
    "For example,",
  ],
  [
    "The direct route crossed a flooded bridge.",
    "The hikers chose a longer path along the ridge.",
    "result",
    "Therefore,",
  ],
  [
    "The first translation preserved every dictionary meaning.",
    "It flattened the poem's abrupt rhythm.",
    "contrast",
    "Nevertheless,",
  ],
  [
    "The archive scanned each fragile map.",
    "Researchers could compare notes without handling the originals.",
    "result",
    "Consequently,",
  ],
  [
    "Mature trees produced broad afternoon shade.",
    "Narrow buildings also cooled several streets.",
    "addition",
    "Likewise,",
  ],
  [
    "The prototype's frame was unusually light.",
    "It twisted whenever the motor accelerated.",
    "contrast",
    "Yet,",
  ],
  [
    "Volunteers first mapped the hottest blocks.",
    "They checked water lines and pedestrian traffic before recommending trees.",
    "sequence",
    "Next,",
  ],
  [
    "The audio files revealed a seasonal insect pattern.",
    "One species became audible days before appearing in net samples.",
    "example",
    "For instance,",
  ],
  [
    "The committee could replace every window at once.",
    "It chose to begin with the rooms used most often.",
    "contrast",
    "Instead,",
  ],
  [
    "The initial test produced an unexpected result.",
    "The researcher repeated it with a freshly calibrated sensor.",
    "result",
    "Accordingly,",
  ],
] as const;

function englishTransitionQuestions(variant: AssessmentVariant) {
  return TRANSITION_CASES.map(
    ([first, second, relationship, answer], index) => {
      const modifier = [
        "During the spring study,",
        "During the summer field session,",
        "In the autumn review,",
        "During the winter trial,",
      ][variant];
      const correctIndex = (index * 2 + variant) % 4;
      const distractorsByRelationship = {
        contrast: ["For example,", "Therefore,", "Similarly,"],
        result: ["Meanwhile,", "For example,", "In contrast,"],
        addition: ["Nevertheless,", "Consequently,", "Instead,"],
        example: ["However,", "Therefore,", "Meanwhile,"],
        sequence: ["In contrast,", "For example,", "Nevertheless,"],
      } as const;
      return {
        section: "english",
        skill: "logical-transitions",
        skillLabel: "Logical transitions",
        category: "Knowledge of Language",
        difficulty: "medium",
        stimulus: `${modifier} ${first} ______ ${second}`,
        prompt:
          "Which transition most precisely expresses the relationship between the ideas?",
        choices: rotatedChoices(
          answer,
          distractorsByRelationship[
            relationship as keyof typeof distractorsByRelationship
          ],
          correctIndex,
        ),
        correct: correctIndex as 0 | 1 | 2 | 3,
        rationale: `${answer.replace(",", "")} correctly labels the ${relationship} relationship established by the two sentences.`,
      } satisfies QuestionInput;
    },
  );
}

function buildEnglish(variant: AssessmentVariant) {
  const inputs = [
    ...englishBoundaryQuestions(variant),
    ...englishConcisionQuestions(variant),
    ...englishPunctuationQuestions(variant),
    ...englishTransitionQuestions(variant),
  ];
  if (inputs.length !== 50) {
    throw new RangeError(
      `Expected 50 English questions; found ${inputs.length}.`,
    );
  }
  return inputs.map((input, index) => question(variant, index + 1, input));
}

function numericChoices(
  answer: number,
  offsets: readonly [number, number, number],
  correctIndex: number,
) {
  const distractors = offsets.map((offset) => answer + offset) as [
    number,
    number,
    number,
  ];
  if (new Set([answer, ...distractors]).size !== 4) {
    throw new RangeError("Numeric assessment choices must be unique.");
  }
  return rotatedChoices(
    String(answer),
    distractors.map(String) as [string, string, string],
    correctIndex,
  );
}

function buildLinearMath(
  variant: AssessmentVariant,
  localIndex: number,
): QuestionInput {
  const shift = variant + 1;
  const correctIndex = (localIndex + variant) % 4;
  const type = localIndex % 6;
  if (type === 0) {
    const answer = 6 + shift + Math.floor(localIndex / 6);
    const a = 3 + (variant % 2);
    const b = 2 + (localIndex % 3);
    const right = a * (answer - b);
    return {
      section: "math",
      skill: "linear-equations",
      skillLabel: "Linear equations",
      category: "Preparing for Higher Math",
      difficulty: "medium",
      prompt: `What value of x satisfies ${a}(x − ${b}) = ${right}?`,
      choices: numericChoices(answer, [-2, 2, a], correctIndex),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale: `Divide by ${a}, then add ${b}; this gives x = ${answer}.`,
    };
  }
  if (type === 1) {
    const slope = 2 + ((variant + localIndex) % 4);
    return {
      section: "math",
      skill: "linear-equations",
      skillLabel: "Linear equations",
      category: "Preparing for Higher Math",
      difficulty: "hard",
      prompt: `For what value of k do y = ${slope}x + ${3 + shift} and y = kx − ${2 + localIndex} have no solution?`,
      choices: numericChoices(slope, [-2, -1, 2], correctIndex),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale:
        "Two distinct lines have no solution when their slopes are equal and their y-intercepts are different.",
    };
  }
  if (type === 2) {
    const center = 4 + shift;
    const distance = 5 + (localIndex % 4);
    const sum = center * 2;
    return {
      section: "math",
      skill: "linear-equations",
      skillLabel: "Linear equations",
      category: "Preparing for Higher Math",
      difficulty: "hard",
      prompt: `If |x − ${center}| = ${distance}, what is the sum of all possible values of x?`,
      choices: numericChoices(sum, [-distance, -1, distance], correctIndex),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale: `The solutions are ${center + distance} and ${center - distance}; their sum is ${sum}.`,
    };
  }
  if (type === 3) {
    const student = 8 + shift;
    const adult = student + 5;
    const total = 100 + 10 * (localIndex + variant);
    const studentCount = 40 + 2 * variant + localIndex;
    const revenue = student * studentCount + adult * (total - studentCount);
    return {
      section: "math",
      skill: "linear-equations",
      skillLabel: "Linear equations",
      category: "Modeling",
      difficulty: "hard",
      prompt: `A theater sells student tickets for $${student} and adult tickets for $${adult}. It sells ${total} tickets for $${revenue}. How many student tickets were sold?`,
      choices: numericChoices(studentCount, [-10, -5, 5], correctIndex),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale: `If s is the student-ticket count, ${student}s + ${adult}(${total} − s) = ${revenue}; solving gives s = ${studentCount}.`,
    };
  }
  if (type === 4) {
    const threshold = 2 + shift + Math.floor(localIndex / 6);
    const coefficient = -(2 + (localIndex % 3));
    const constant = 5 + shift;
    const right = coefficient * threshold + constant;
    return {
      section: "math",
      skill: "linear-equations",
      skillLabel: "Linear equations",
      category: "Preparing for Higher Math",
      difficulty: "medium",
      prompt: `Which inequality is equivalent to ${coefficient}x + ${constant} > ${right}?`,
      choices: rotatedChoices(
        `x < ${threshold}`,
        [`x > ${threshold}`, `x < ${threshold - 1}`, `x > ${threshold + 1}`],
        correctIndex,
      ),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale:
        "Isolate the x-term, then reverse the inequality when dividing by the negative coefficient.",
    };
  }
  const slope = -(2 + variant + 4 * Math.floor(localIndex / 6));
  const perpendicular = `1/${Math.abs(slope)}`;
  return {
    section: "math",
    skill: "linear-equations",
    skillLabel: "Linear equations",
    category: "Preparing for Higher Math",
    difficulty: "medium",
    prompt: `A line has slope ${slope}. Which slope belongs to a line perpendicular to it?`,
    choices: rotatedChoices(
      perpendicular,
      [String(-slope), String(slope), `−1/${Math.abs(slope)}`],
      correctIndex,
    ),
    correct: correctIndex as 0 | 1 | 2 | 3,
    rationale:
      "Perpendicular nonvertical lines have slopes whose product is negative 1.",
  };
}

function buildFunctionMath(
  variant: AssessmentVariant,
  localIndex: number,
): QuestionInput {
  const correctIndex = (localIndex * 2 + variant) % 4;
  const type = localIndex % 6;
  const shift = variant + 1;
  if (type === 0) {
    const repeat = Math.floor(localIndex / 6);
    const rate = 10 + 5 * variant + repeat * 2;
    const included = 2 + variant;
    const fixed = 40 + 30 * variant + repeat * 10;
    return {
      section: "math",
      skill: "functions-and-modeling",
      skillLabel: "Functions and modeling",
      category: "Modeling",
      difficulty: "medium",
      prompt: `A service charges $${fixed} for the first ${included} hours and $${rate} for each additional hour. For h > ${included}, which expression gives the total charge C(h)?`,
      choices: rotatedChoices(
        `C(h) = ${fixed} + ${rate}(h − ${included})`,
        [
          `C(h) = ${fixed} + ${rate}h`,
          `C(h) = ${fixed}h + ${rate}`,
          `C(h) = ${rate}(h + ${included})`,
        ],
        correctIndex,
      ),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale: `Only h − ${included} hours are billed at the additional-hour rate, after the fixed initial charge.`,
    };
  }
  if (type === 1) {
    const horizontal = 3 + 10 * variant + Math.floor(localIndex / 6);
    const vertical = 1 + 5 * variant + (localIndex % 3);
    return {
      section: "math",
      skill: "functions-and-modeling",
      skillLabel: "Functions and modeling",
      category: "Preparing for Higher Math",
      difficulty: "hard",
      prompt: `The graph of y = f(x) is shifted ${horizontal} units left and ${vertical} units down. Which equation represents the new graph?`,
      choices: rotatedChoices(
        `y = f(x + ${horizontal}) − ${vertical}`,
        [
          `y = f(x − ${horizontal}) + ${vertical}`,
          `y = f(x + ${vertical}) − ${horizontal}`,
          `y = f(x − ${horizontal}) − ${vertical}`,
        ],
        correctIndex,
      ),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale:
        "A left shift adds inside the function input; a downward shift subtracts outside the function.",
    };
  }
  if (type === 2) {
    const base = 2 + (variant % 2);
    const exponent = 4 + (localIndex % 3) + Math.floor(localIndex / 6);
    const offset = 1 + shift;
    const target = base ** exponent;
    const answer = exponent - offset;
    return {
      section: "math",
      skill: "functions-and-modeling",
      skillLabel: "Functions and modeling",
      category: "Preparing for Higher Math",
      difficulty: "hard",
      prompt: `If h(x) = ${base}ˣ and h(a + ${offset}) = ${target}, what is a?`,
      choices: numericChoices(answer, [-2, -1, 2], correctIndex),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale: `${target} = ${base}^${exponent}, so a + ${offset} = ${exponent} and a = ${answer}.`,
    };
  }
  if (type === 3) {
    const a = 2 + shift;
    const b = 3 + (localIndex % 4);
    return {
      section: "math",
      skill: "functions-and-modeling",
      skillLabel: "Functions and modeling",
      category: "Preparing for Higher Math",
      difficulty: "medium",
      prompt: `Which expression is the inverse of f(x) = (x − ${b})/${a}?`,
      choices: rotatedChoices(
        `f⁻¹(x) = ${a}x + ${b}`,
        [
          `f⁻¹(x) = ${a}x − ${b}`,
          `f⁻¹(x) = (x + ${b})/${a}`,
          `f⁻¹(x) = 1/(${a}x − ${b})`,
        ],
        correctIndex,
      ),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale:
        "Swap x and y, then solve for y; multiplication by the denominator and addition of the constant undo the original operations.",
    };
  }
  if (type === 4) {
    const rootA = 3 + 10 * variant + Math.floor(localIndex / 6);
    const rootB = rootA + 2 + (localIndex % 2);
    const sum = rootA + rootB;
    const product = rootA * rootB;
    return {
      section: "math",
      skill: "functions-and-modeling",
      skillLabel: "Functions and modeling",
      category: "Preparing for Higher Math",
      difficulty: "hard",
      prompt: `What are the zeros of p(x) = x² − ${sum}x + ${product}?`,
      choices: rotatedChoices(
        `${rootA} and ${rootB}`,
        [
          `−${rootA} and −${rootB}`,
          `−${rootA} and ${rootB}`,
          `${rootA} and ${sum}`,
        ],
        correctIndex,
      ),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale: `The polynomial factors as (x − ${rootA})(x − ${rootB}), so its zeros are ${rootA} and ${rootB}.`,
    };
  }
  const x1 = 1 + shift;
  const x2 = x1 + 4;
  const slope = 3 + (variant % 3);
  const y1 = slope * x1 + 2 + shift;
  const y2 = slope * x2 + 2 + shift;
  const intercept = 2 + shift;
  return {
    section: "math",
    skill: "functions-and-modeling",
    skillLabel: "Functions and modeling",
    category: "Modeling",
    difficulty: "medium",
    prompt: `A linear function g has g(${x1}) = ${y1} and g(${x2}) = ${y2}. What is g(0)?`,
    choices: numericChoices(intercept, [-2, 1, 3], correctIndex),
    correct: correctIndex as 0 | 1 | 2 | 3,
    rationale: `The slope is ${slope}; substituting either point into g(x) = ${slope}x + b gives b = ${intercept}.`,
  };
}

function buildRatioMath(
  variant: AssessmentVariant,
  localIndex: number,
): QuestionInput {
  const correctIndex = (localIndex * 3 + variant) % 4;
  const type = localIndex % 6;
  const shift = variant + 1;
  if (type === 0) {
    const increase = 10 + 5 * variant + localIndex;
    const decrease = 5 + 3 * variant + Math.floor(localIndex / 2);
    const multiplier = (1 + increase / 100) * (1 - decrease / 100);
    const percent = Math.round((multiplier - 1) * 1000) / 10;
    const answer = `${Math.abs(percent)}% ${percent >= 0 ? "higher" : "lower"}`;
    return {
      section: "math",
      skill: "ratios-and-percent",
      skillLabel: "Ratios and percent",
      category: "Integrating Essential Skills",
      difficulty: "hard",
      prompt: `A price is increased by ${increase}% and then the new price is decreased by ${decrease}%. Compared with the original price, the final price is:`,
      choices: rotatedChoices(
        answer,
        [
          `${Math.abs(increase - decrease)}% ${increase >= decrease ? "higher" : "lower"}`,
          `${decrease}% lower`,
          `${increase}% higher`,
        ],
        correctIndex,
      ),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale: `Successive percent changes multiply: (1 + ${increase}/100)(1 − ${decrease}/100) = ${multiplier.toFixed(3)} of the original.`,
    };
  }
  if (type === 1) {
    const red = 3 + 10 * variant + Math.floor(localIndex / 6);
    const blue = red + 2;
    const green = 3 + 5 * variant + (localIndex % 3);
    const total = red + blue + green;
    const numerator = blue * (blue - 1);
    const denominator = total * (total - 1);
    const divisor = (() => {
      function gcd(a: number, b: number): number {
        return b ? gcd(b, a % b) : a;
      }
      return gcd(numerator, denominator);
    })();
    const answer = `${numerator / divisor}/${denominator / divisor}`;
    return {
      section: "math",
      skill: "ratios-and-percent",
      skillLabel: "Ratios and percent",
      category: "Integrating Essential Skills",
      difficulty: "hard",
      prompt: `A bag contains ${red} red, ${blue} blue, and ${green} green tiles. Two tiles are drawn without replacement. What is the probability that both are blue?`,
      choices: rotatedChoices(
        answer,
        [
          `${blue}/${total}`,
          `${blue * blue}/${total * total}`,
          `${blue - 1}/${total - 1}`,
        ],
        correctIndex,
      ),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale: `Multiply ${blue}/${total} by ${blue - 1}/${total - 1}, then reduce the fraction.`,
    };
  }
  if (type === 2) {
    const mean = 17 + 10 * variant + Math.floor(localIndex / 6);
    const count = 5;
    const known = [mean - 6, mean - 2, mean + 1, mean + 5];
    const answer = mean * count - known.reduce((sum, value) => sum + value, 0);
    return {
      section: "math",
      skill: "ratios-and-percent",
      skillLabel: "Ratios and percent",
      category: "Integrating Essential Skills",
      difficulty: "medium",
      prompt: `The mean of five numbers is ${mean}. Four numbers are ${known.join(", ")}. What is the fifth number?`,
      choices: numericChoices(answer, [-3, 2, 5], correctIndex),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale: `The five numbers total ${mean * count}; subtracting the four known values leaves ${answer}.`,
    };
  }
  if (type === 3) {
    const median = 12 + shift;
    const factor = 1.5 + (variant % 2) * 0.5;
    const added = 1 + (localIndex % 4);
    const answer = factor * median + added;
    return {
      section: "math",
      skill: "ratios-and-percent",
      skillLabel: "Ratios and percent",
      category: "Integrating Essential Skills",
      difficulty: "hard",
      prompt: `A data set has median ${median}. Every value is multiplied by ${factor} and then ${added} is added. What is the new median?`,
      choices: numericChoices(answer, [-added, added, median], correctIndex),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale:
        "A positive linear transformation changes the median by the same multiplication and addition applied to every data value.",
    };
  }
  if (type === 4) {
    const a = 3 + variant;
    const b = a + 2;
    const multiplier = 6 + localIndex;
    const known = a * multiplier;
    const answer = b * multiplier;
    return {
      section: "math",
      skill: "ratios-and-percent",
      skillLabel: "Ratios and percent",
      category: "Integrating Essential Skills",
      difficulty: "medium",
      prompt: `The ratio of red to blue markers is ${a}:${b}. If there are ${known} red markers, how many blue markers are there?`,
      choices: numericChoices(answer, [-b, a, b], correctIndex),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale: `The scale factor is ${multiplier}, so the blue count is ${b} × ${multiplier} = ${answer}.`,
    };
  }
  const total = 70 + 10 * shift;
  const percent = 15 + 5 * (localIndex % 3);
  const answer = (total * percent) / 100;
  return {
    section: "math",
    skill: "ratios-and-percent",
    skillLabel: "Ratios and percent",
    category: "Integrating Essential Skills",
    difficulty: "easy",
    prompt: `What is ${percent}% of ${total}?`,
    choices: numericChoices(answer, [-5, 5, 10], correctIndex),
    correct: correctIndex as 0 | 1 | 2 | 3,
    rationale: `Convert ${percent}% to a decimal and multiply by ${total}.`,
  };
}

function buildGeometryMath(
  variant: AssessmentVariant,
  localIndex: number,
): QuestionInput {
  const correctIndex = (localIndex + 3 * variant) % 4;
  const type = localIndex % 6;
  const shift = variant + 1;
  if (type === 0) {
    const small = 2 + shift;
    const large = small + 2;
    const baseArea = small * small * (3 + localIndex);
    const answer = (baseArea * large * large) / (small * small);
    return {
      section: "math",
      skill: "geometry-and-measurement",
      skillLabel: "Geometry and measurement",
      category: "Preparing for Higher Math",
      difficulty: "hard",
      prompt: `Two similar triangles have corresponding side lengths in the ratio ${small}:${large}. If the smaller triangle's area is ${baseArea}, what is the larger triangle's area?`,
      choices: numericChoices(
        answer,
        [-large * 3, small * 3, large * 3],
        correctIndex,
      ),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale: `Area scales by (${large}/${small})², not by the linear scale factor.`,
    };
  }
  if (type === 1) {
    const radius = 4 + shift + (localIndex % 3);
    const h = 1 + variant;
    const k = -(2 + localIndex);
    return {
      section: "math",
      skill: "geometry-and-measurement",
      skillLabel: "Geometry and measurement",
      category: "Preparing for Higher Math",
      difficulty: "medium",
      prompt: `A circle has equation (x − ${h})² + (y + ${Math.abs(k)})² = ${radius * radius}. What is its diameter?`,
      choices: numericChoices(
        radius * 2,
        [-radius, radius, radius * 2],
        correctIndex,
      ),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale: `The squared radius is ${radius * radius}, so r = ${radius} and the diameter is ${radius * 2}.`,
    };
  }
  if (type === 2) {
    const opposite = 3 + 2 * shift;
    const adjacent = 4 + 2 * shift;
    const hypotenuse = Math.sqrt(opposite * opposite + adjacent * adjacent);
    if (!Number.isInteger(hypotenuse)) {
      const triples = [
        [9, 40, 41],
        [12, 35, 37],
        [8, 15, 17],
        [11, 60, 61],
        [7, 24, 25],
        [28, 45, 53],
        [20, 21, 29],
        [33, 56, 65],
      ] as const;
      const [o, a, h] = triples[variant * 2 + Math.floor(localIndex / 6)];
      return {
        section: "math",
        skill: "geometry-and-measurement",
        skillLabel: "Geometry and measurement",
        category: "Preparing for Higher Math",
        difficulty: "hard",
        prompt: `In a right triangle, sin θ = ${o}/${h}. What is cos θ?`,
        choices: rotatedChoices(
          `${a}/${h}`,
          [`${o}/${a}`, `${o}/${h}`, `${h}/${a}`],
          correctIndex,
        ),
        correct: correctIndex as 0 | 1 | 2 | 3,
        rationale: `The side lengths form a ${o}-${a}-${h} right triangle; cosine is adjacent over hypotenuse, ${a}/${h}.`,
      };
    }
  }
  if (type === 3) {
    const length = 4 + shift;
    const width = 3 + (localIndex % 4);
    const height = 5 + variant;
    const answer = 2 * (length * width + length * height + width * height);
    return {
      section: "math",
      skill: "geometry-and-measurement",
      skillLabel: "Geometry and measurement",
      category: "Preparing for Higher Math",
      difficulty: "medium",
      prompt: `A rectangular prism has dimensions ${length}, ${width}, and ${height}. What is its surface area?`,
      choices: numericChoices(
        answer,
        [-length * width, height * 3 + 1, length * width + 2],
        correctIndex,
      ),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale: `Surface area is 2(lw + lh + wh) = ${answer}.`,
    };
  }
  if (type === 4) {
    const legs = [
      [9, 40, 41],
      [12, 35, 37],
      [8, 15, 17],
      [11, 60, 61],
      [7, 24, 25],
      [28, 45, 53],
      [20, 21, 29],
      [33, 56, 65],
    ] as const;
    const [a, b, c] = legs[variant * 2 + Math.floor(localIndex / 6)];
    return {
      section: "math",
      skill: "geometry-and-measurement",
      skillLabel: "Geometry and measurement",
      category: "Preparing for Higher Math",
      difficulty: "medium",
      prompt: `A right triangle has legs ${a} and ${b}. What is the length of its hypotenuse?`,
      choices: numericChoices(c, [-2, 2, a], correctIndex),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale: `By the Pythagorean theorem, √(${a}² + ${b}²) = ${c}.`,
    };
  }
  const radius = 4 + shift;
  const angle = [60, 90, 120, 150][variant];
  const coefficient = (angle / 360) * radius * radius;
  const answer = Number.isInteger(coefficient)
    ? `${coefficient}π`
    : `${angle}/${360} · ${radius * radius}π`;
  return {
    section: "math",
    skill: "geometry-and-measurement",
    skillLabel: "Geometry and measurement",
    category: "Preparing for Higher Math",
    difficulty: "hard",
    prompt: `A sector of a circle with radius ${radius} has central angle ${angle}°. What is the sector's area?`,
    choices: rotatedChoices(
      answer,
      [
        `${radius * radius}π`,
        `${(angle / 360) * 2 * radius}π`,
        `${angle * radius}π`,
      ],
      correctIndex,
    ),
    correct: correctIndex as 0 | 1 | 2 | 3,
    rationale:
      "A sector's area is its fraction of 360 degrees multiplied by πr².",
  };
}

function buildMath(variant: AssessmentVariant) {
  const inputs: QuestionInput[] = [];
  for (let index = 0; index < 12; index += 1) {
    inputs.push(buildLinearMath(variant, index));
  }
  for (let index = 0; index < 11; index += 1) {
    inputs.push(buildFunctionMath(variant, index));
    inputs.push(buildRatioMath(variant, index));
    if (index < 11) inputs.push(buildGeometryMath(variant, index));
  }
  if (inputs.length !== 45) {
    throw new RangeError(`Expected 45 Math questions; found ${inputs.length}.`);
  }
  return inputs.map((input, index) => question(variant, index + 1, input));
}

interface ReadingScenario {
  title: string;
  text: string;
  centralIdea: string;
  centralDistractors: readonly [string, string, string];
  detailQuestion: string;
  detailAnswer: string;
  detailDistractors: readonly [string, string, string];
  inferenceAnswer: string;
  inferenceDistractors: readonly [string, string, string];
  purposeAnswer: string;
  purposeDistractors: readonly [string, string, string];
  phrase: string;
  phraseAnswer: string;
  phraseDistractors: readonly [string, string, string];
  supportAnswer: string;
  supportDistractors: readonly [string, string, string];
}

const READING_SCENARIOS: readonly (readonly ReadingScenario[])[] = [
  [
    {
      title: "The Orchard Notebook",
      text: "When Nia inherited her aunt's orchard notebook, she expected tidy harvest totals. Instead, many pages held sketches of bruised fruit, dates of sudden frosts, and arrows connecting one season to the next. At first the marks looked like a record of failure. Nia compared them with the orchard's planting map and noticed a pattern: trees near the low stone wall bloomed early and were repeatedly damaged by cold air that settled there overnight. Her aunt had gradually moved the most sensitive varieties uphill. The notebook did not contain a finished rule. It preserved the observations from which a rule could be built. Nia used that evidence to choose where to plant six new trees, then added her own notes after the next frost.",
      centralIdea:
        "Nia turns an apparent record of orchard failures into evidence for future planting decisions.",
      centralDistractors: [
        "Nia proves that every fruit tree should be planted uphill.",
        "Nia replaces her aunt's notes with a more organized harvest ledger.",
        "Nia discovers that stone walls always damage nearby trees.",
      ],
      detailQuestion:
        "What pattern does Nia notice after comparing the notebook with the planting map?",
      detailAnswer:
        "Trees near the low wall bloomed early and were often damaged by frost.",
      detailDistractors: [
        "Uphill trees produced no fruit.",
        "New trees required less water.",
        "Harvest totals were missing only in cold years.",
      ],
      inferenceAnswer:
        "Nia's aunt treated unsuccessful seasons as information worth preserving.",
      inferenceDistractors: [
        "Nia's aunt intended to publish the notebook.",
        "Nia had managed the orchard before inheriting it.",
        "The aunt believed frost could be eliminated entirely.",
      ],
      purposeAnswer:
        "It shows Nia extending the evidence record rather than merely using it once.",
      purposeDistractors: [
        "It proves the six trees survived every later frost.",
        "It introduces an unrelated problem with the notebook.",
        "It shows Nia rejecting her aunt's method.",
      ],
      phrase: "a rule could be built",
      phraseAnswer:
        "a general planting insight could be inferred from the observations",
      phraseDistractors: [
        "a legal restriction could be written",
        "a stone wall could be constructed",
        "a harvest total could be estimated without evidence",
      ],
      supportAnswer:
        "Later frost records show that the uphill sensitive trees were damaged less often.",
      supportDistractors: [
        "The notebook's cover was made of rare leather.",
        "Several harvest totals were written in blue ink.",
        "A nearby orchard used different fruit varieties.",
      ],
    },
    {
      title: "Listening for Loose Bolts",
      text: "Rail inspectors have long checked bridge fasteners by sight, but a research group tested whether sound could reveal changes too small to see. They attached inexpensive microphones to a scale bridge and recorded the vibrations produced as a cart crossed it. Tight fasteners created a short, high-frequency response. After the researchers loosened one bolt by a quarter turn, a lower vibration persisted longer. The team did not claim that microphones should replace visual inspections. Wind and passing traffic can distort recordings, and a sound change does not identify the exact defect. Instead, the system could flag a location for closer inspection. In that role, sound becomes an early warning rather than a final diagnosis.",
      centralIdea:
        "Sound monitoring may help inspectors locate possible bridge problems that still require direct examination.",
      centralDistractors: [
        "Microphones can identify every bridge defect without inspectors.",
        "Visual bridge inspections are too inaccurate to continue.",
        "Loose bolts always produce the same sound in every setting.",
      ],
      detailQuestion:
        "How did the vibration change after one bolt was loosened?",
      detailAnswer: "A lower vibration lasted longer.",
      detailDistractors: [
        "The bridge became silent.",
        "A shorter, higher response appeared.",
        "The cart stopped before crossing.",
      ],
      inferenceAnswer:
        "The researchers view acoustic data as a screening tool, not conclusive proof.",
      inferenceDistractors: [
        "They believe traffic noise has no effect on results.",
        "They intend to end all visual inspections immediately.",
        "They can determine bolt size from sound alone.",
      ],
      purposeAnswer:
        "It distinguishes an alert that guides inspection from a finding that establishes the defect.",
      purposeDistractors: [
        "It claims early warnings are usually wrong.",
        "It changes the passage to a history of bridge design.",
        "It argues that final diagnoses should be made by microphones.",
      ],
      phrase: "flag a location",
      phraseAnswer: "identify a place that deserves closer attention",
      phraseDistractors: [
        "mark a bridge as permanently unsafe",
        "attach a colored banner to the structure",
        "measure the exact size of a defect",
      ],
      supportAnswer:
        "Inspectors later find that sites flagged by persistent low vibrations contain more loose fasteners than unflagged sites.",
      supportDistractors: [
        "The microphones are available in several colors.",
        "The test cart can carry more weight.",
        "Some bridges cross wider rivers than others.",
      ],
    },
    {
      title: "Two Conservators on Visible Repairs",
      text: "Conservator A: When I repair a cracked ceramic vessel, I try to make the join quiet but not invisible. A visitor should first see the vessel's form, yet a close look should reveal where modern material begins. Hiding every trace of repair can make a restored object seem untouched by time.\n\nConservator B: I also document every addition, but I place that information in the display label rather than on the object's surface. A visible join can interrupt a painted pattern that the original maker intended as continuous. When reliable evidence shows how the pattern crossed the break, I favor a visually integrated repair.\n\nBoth conservators reject undocumented restoration. Their disagreement concerns where the evidence of repair should remain visible: on the vessel itself or in the record beside it.",
      centralIdea:
        "The conservators agree repairs must be documented but differ about whether the repair should remain visible on the object.",
      centralDistractors: [
        "Both conservators believe every crack should be left unrepaired.",
        "Conservator A values painted patterns while Conservator B ignores them.",
        "The conservators disagree about whether museums should display ceramics.",
      ],
      detailQuestion:
        "Where does Conservator B prefer to disclose added modern material?",
      detailAnswer: "In the display documentation beside the object.",
      detailDistractors: [
        "Only in a private notebook.",
        "Through a visible gap in the vessel.",
        "Nowhere if the painted pattern is restored.",
      ],
      inferenceAnswer:
        "Conservator A worries that an invisible repair can create a misleading impression of an object's history.",
      inferenceDistractors: [
        "Conservator A refuses to use any modern repair material.",
        "Conservator A believes visitors should ignore a vessel's form.",
        "Conservator A repairs only unpainted objects.",
      ],
      purposeAnswer:
        "It states the shared principle and precisely locates the disagreement.",
      purposeDistractors: [
        "It introduces a third conservator's method.",
        "It proves that one approach is always more accurate.",
        "It argues that documentation is unnecessary.",
      ],
      phrase: "make the join quiet",
      phraseAnswer:
        "keep the repair from dominating the viewer's first impression",
      phraseDistractors: [
        "prevent the vessel from producing sound",
        "hide all evidence that a crack existed",
        "remove the painted pattern around the repair",
      ],
      supportAnswer:
        "Visitors often mistake fully hidden repairs for untouched original material unless labels clearly identify the additions.",
      supportDistractors: [
        "Ceramic vessels vary greatly in size.",
        "Some museums display objects behind glass.",
        "Modern adhesives dry faster than older adhesives.",
      ],
    },
    {
      title: "Rebuilding a Lost Footpath",
      text: "A coastal town wanted to reopen a footpath erased by decades of dune movement. No single map showed the entire route. Surveyor Mateo Silva compared a 1912 harbor chart, aerial photographs from the 1950s, and property descriptions that referred to a 'cart track above the high-water mark.' Each source had a different distortion. The chart simplified curves; the photographs showed vegetation but not legal boundaries; the descriptions used landmarks that no longer existed. Silva treated the sources as overlapping clues rather than competing verdicts. Where all three pointed to the same ridge, the town marked a provisional route. Archaeologists then tested those locations and found compacted shell and gravel beneath the sand. The recovered path was not copied from one perfect record. It emerged from agreement among imperfect ones.",
      centralIdea:
        "The town reconstructs the footpath by combining partial evidence from several imperfect sources.",
      centralDistractors: [
        "The oldest harbor chart provides a complete and exact route.",
        "Archaeologists prove that property descriptions are never useful.",
        "Dune movement has made coastal paths impossible to recover.",
      ],
      detailQuestion:
        "What evidence did archaeologists find beneath the provisional route?",
      detailAnswer: "Compacted shell and gravel.",
      detailDistractors: [
        "A legal boundary marker.",
        "An intact wooden cart.",
        "A copy of the 1912 chart.",
      ],
      inferenceAnswer:
        "Silva gives greater confidence to locations supported independently by multiple sources.",
      inferenceDistractors: [
        "Silva assumes the newest source is always the most accurate.",
        "Silva ignores evidence once a route is marked.",
        "Silva believes every source has the same distortion.",
      ],
      purposeAnswer:
        "It summarizes the passage's method of building confidence through converging evidence.",
      purposeDistractors: [
        "It claims the original path was perfectly preserved.",
        "It introduces a new dispute about property law.",
        "It dismisses the archaeological findings as irrelevant.",
      ],
      phrase: "overlapping clues",
      phraseAnswer: "pieces of evidence that can support and check one another",
      phraseDistractors: [
        "maps printed on top of each other",
        "conflicts that cannot be resolved",
        "landmarks that occupy the same physical space",
      ],
      supportAnswer:
        "Additional test pits along locations identified by all three sources repeatedly uncover the same compacted path material.",
      supportDistractors: [
        "The harbor chart uses decorative lettering.",
        "One aerial photograph was taken in winter.",
        "Modern hikers prefer a shorter route.",
      ],
    },
    {
      title: "When a Helpful Beetle Travels",
      text: "Farmers in one valley welcomed the copper ground beetle because it consumed larvae that damaged bean roots. The beetle rarely flew and seemed unlikely to spread far. A decade later, however, biologists found it in upland meadows beyond the farms. Genetic comparisons suggested that beetles had repeatedly traveled in soil attached to nursery plants. In the meadows, the insects ate not only pest larvae but also the larvae of a rare native moth. Removing every beetle was impractical, so managers changed nursery rules, cleaned soil from equipment, and concentrated trapping near newly planted sites. The same appetite that made the beetle useful in fields made it risky elsewhere. Its effect depended less on whether it was 'helpful' or 'harmful' than on which community it entered.",
      centralIdea:
        "A beetle useful on farms becomes a conservation risk after human-assisted movement carries it into a different ecosystem.",
      centralDistractors: [
        "The beetle stopped eating crop pests after ten years.",
        "Rare moths caused the beetle to spread from upland meadows.",
        "Managers successfully removed every beetle from the valley.",
      ],
      detailQuestion:
        "How did the beetles most likely reach the upland meadows?",
      detailAnswer: "In soil transported with nursery plants.",
      detailDistractors: [
        "By flying long distances.",
        "Inside harvested bean pods.",
        "Along streams during floods.",
      ],
      inferenceAnswer:
        "The managers' strategy emphasizes preventing new introductions and responding early.",
      inferenceDistractors: [
        "Managers expect the beetle to stop feeding.",
        "Managers believe trapping on farms is unnecessary because no beetles remain.",
        "Managers regard nursery practices as unrelated to spread.",
      ],
      purposeAnswer:
        "It explains why a single label cannot describe the beetle's effect in every ecological setting.",
      purposeDistractors: [
        "It claims the beetle has changed its diet permanently.",
        "It argues that crop pests should be protected.",
        "It shows that the moth is harmful on farms.",
      ],
      phrase: "which community it entered",
      phraseAnswer:
        "the group of species and conditions in the beetle's new ecosystem",
      phraseDistractors: [
        "the nearest human neighborhood",
        "the scientific team that named the beetle",
        "the number of farms in the valley",
      ],
      supportAnswer:
        "New meadow infestations occur most often beside sites receiving nursery plants from the valley.",
      supportDistractors: [
        "Farmers grow several varieties of beans.",
        "The rare moth has patterned wings.",
        "Ground beetles are active mainly at night.",
      ],
    },
    {
      title: "A Choreographer's Margins",
      text: "Choreographer Sora Bell's rehearsal scripts contain few descriptions of finished movements. Their margins are crowded instead with verbs: suspend, ricochet, resist, fold. Dancer Emil Reyes initially treated the words as names for fixed shapes. Bell asked him to perform the same verb three ways—slowly with the whole body, sharply with one arm, and while moving backward. The resulting phrases looked different, yet each preserved a recognizable quality. Bell then arranged the phrases beside one another, using the contrast to build a duet. For her, the margin verbs were not instructions that narrowed a dancer's choices. They were constraints that focused invention. By limiting the kind of energy a phrase explored, each word opened several possible forms.",
      centralIdea:
        "Bell uses action words as focused constraints that generate varied movement rather than prescribe one fixed shape.",
      centralDistractors: [
        "Bell expects dancers to copy movements exactly from written diagrams.",
        "Reyes proves that action words have only one physical meaning.",
        "Bell removes every constraint before creating a duet.",
      ],
      detailQuestion: "How does Bell ask Reyes to explore the same verb?",
      detailAnswer: "By performing it in three different physical ways.",
      detailDistractors: [
        "By replacing it with a drawing.",
        "By repeating one fixed pose.",
        "By asking another dancer to define it verbally.",
      ],
      inferenceAnswer:
        "Bell evaluates whether movements share an energetic quality even when their shapes differ.",
      inferenceDistractors: [
        "Bell prefers slow movements to sharp ones.",
        "Bell believes backward movement is always unclear.",
        "Bell writes complete choreography before rehearsal.",
      ],
      purposeAnswer:
        "It resolves the apparent contradiction between limiting a task and producing multiple creative options.",
      purposeDistractors: [
        "It argues that dancers should ignore the verbs.",
        "It introduces a new dancer who rejects the method.",
        "It shows that every possible movement was used.",
      ],
      phrase: "focused invention",
      phraseAnswer: "creative exploration directed by a specific quality",
      phraseDistractors: [
        "a machine designed to record movement",
        "memorization of a finished sequence",
        "creativity without any shared condition",
      ],
      supportAnswer:
        "Different dancers produce distinct phrases from the same verb while observers consistently identify the intended energetic quality.",
      supportDistractors: [
        "Bell's scripts use wide margins.",
        "The rehearsal room has mirrors.",
        "Reyes has performed in several duets.",
      ],
    },
  ],
  [
    {
      title: "The Harbor Log",
      text: "A box of water-stained harbor logs seemed useless to engineer Amara Wells because many columns were incomplete. Alongside arrival times, however, keepers had noted unusual vibrations in the wooden pier and sketched the direction of strong winds. Wells aligned those notes with surviving repair bills. She found that braces on the west side were replaced most often after weeks of crosswind, even when no single storm was severe. The logs did not provide a modern stress calculation. They preserved repeated observations that revealed where small forces accumulated. Wells used the pattern to place sensors on the rebuilt pier and continued the record with digital measurements.",
      centralIdea:
        "Wells combines informal historical observations with repair records to guide modern monitoring of a pier.",
      centralDistractors: [
        "Wells proves that one storm destroyed the original pier.",
        "The harbor logs contain complete engineering calculations.",
        "Digital sensors make all historical records unnecessary.",
      ],
      detailQuestion:
        "Which side of the pier needed braces replaced most often?",
      detailAnswer: "The west side.",
      detailDistractors: [
        "The east side.",
        "The north end.",
        "Every side equally.",
      ],
      inferenceAnswer:
        "The pier could be weakened by repeated modest forces, not only dramatic storms.",
      inferenceDistractors: [
        "The keepers caused the vibration.",
        "Repair bills were written before the logs.",
        "Wind direction never changed.",
      ],
      purposeAnswer:
        "It shows the historical record becoming part of an ongoing modern evidence system.",
      purposeDistractors: [
        "It claims sensors can reconstruct every missing log entry.",
        "It introduces a different harbor.",
        "It shows Wells abandoning the pattern she found.",
      ],
      phrase: "small forces accumulated",
      phraseAnswer: "repeated stresses combined over time",
      phraseDistractors: [
        "workers gathered in one place",
        "wind disappeared gradually",
        "repair costs became smaller",
      ],
      supportAnswer:
        "New sensors record the highest cumulative strain at the same west-side brace locations identified in the logs.",
      supportDistractors: [
        "Some log pages contain sketches of ships.",
        "The rebuilt pier is longer.",
        "Harbor keepers used several kinds of ink.",
      ],
    },
    {
      title: "Mapping Nighttime Heat",
      text: "Satellite maps show which neighborhoods absorb the most sunlight during the day, but they reveal less about how quickly individual streets cool after sunset. A research team mounted temperature sensors on city buses that followed fixed evening routes. Readings showed that broad avenues cooled rapidly when wind moved through them, while narrow courtyards remained warm hours longer. The team compared those patterns with building height and pavement type. It did not recommend the same intervention everywhere: shade trees mattered on exposed avenues, whereas ventilation corridors mattered more in enclosed blocks. The bus data added timing and street-scale detail to the regional map.",
      centralIdea:
        "Evening bus measurements add local timing information that helps tailor heat interventions to different street conditions.",
      centralDistractors: [
        "Satellite maps should never be used to study cities.",
        "Every hot location needs the same number of trees.",
        "Buses caused narrow courtyards to remain warm.",
      ],
      detailQuestion: "Which locations remained warm longer after sunset?",
      detailAnswer: "Narrow courtyards.",
      detailDistractors: [
        "Broad windy avenues.",
        "All streets equally.",
        "Only city parks.",
      ],
      inferenceAnswer:
        "The usefulness of a cooling intervention depends on the physical reason a location stays hot.",
      inferenceDistractors: [
        "Building height has no relation to heat.",
        "Regional maps contain exact evening street temperatures.",
        "Wind always makes shade trees ineffective.",
      ],
      purposeAnswer:
        "It summarizes the distinct information supplied by the two measurement scales.",
      purposeDistractors: [
        "It claims bus data replace every regional map.",
        "It introduces a plan to change bus routes.",
        "It argues that time of day is irrelevant.",
      ],
      phrase: "tailor heat interventions",
      phraseAnswer: "adapt cooling strategies to local conditions",
      phraseDistractors: [
        "measure the temperature of clothing",
        "apply one identical solution citywide",
        "end all evening bus service",
      ],
      supportAnswer:
        "Blocks receiving interventions matched to their cooling pattern show larger nighttime temperature reductions than blocks receiving a uniform treatment.",
      supportDistractors: [
        "Buses carry more riders during the day.",
        "Some pavements are pale in color.",
        "Satellite images cover rural areas too.",
      ],
    },
    {
      title: "Two Editors on Dialect",
      text: "Editor A: In a historical novel, I preserve a character's regional grammar when it shapes voice or social relationships. I may remove spellings that make every word difficult to decode, but I will not flatten a distinctive sentence pattern merely because it differs from formal prose.\n\nEditor B: I also protect voice, yet I worry when unfamiliar grammar forces readers to solve the language before they can follow the scene. I prefer a lighter signal: a few recurring words and rhythms, supported by context.\n\nBoth editors reject replacing every feature with standard prose. They differ mainly in how much sustained unfamiliarity they believe a reader can navigate without losing the story.",
      centralIdea:
        "The editors agree dialect can convey voice but differ over how densely unfamiliar features should appear.",
      centralDistractors: [
        "Both editors want to remove every trace of dialect.",
        "Editor A values plot while Editor B values only grammar.",
        "The editors disagree about whether novels need characters.",
      ],
      detailQuestion: "What does Editor A say may be removed?",
      detailAnswer: "Spellings that make every word difficult to decode.",
      detailDistractors: [
        "All regional sentence patterns.",
        "Every social relationship.",
        "The novel's historical setting.",
      ],
      inferenceAnswer:
        "Editor B weighs accessibility more heavily when dialect features are continuous.",
      inferenceDistractors: [
        "Editor B believes dialect has no expressive value.",
        "Editor B reads only formal essays.",
        "Editor B always replaces dialogue with narration.",
      ],
      purposeAnswer:
        "It identifies a shared boundary and the degree of emphasis separating the editors.",
      purposeDistractors: [
        "It introduces a third editor.",
        "It proves unfamiliar grammar never affects reading.",
        "It claims Editor A and Editor B use identical methods.",
      ],
      phrase: "a lighter signal",
      phraseAnswer: "a less dense use of dialect features",
      phraseDistractors: [
        "a brighter printed page",
        "a shorter historical period",
        "a complete removal of character voice",
      ],
      supportAnswer:
        "Readers follow the scene more accurately when recurring dialect cues are supported by clear context than when every word uses unfamiliar spelling.",
      supportDistractors: [
        "The novel has a colorful cover.",
        "Some characters speak more often than others.",
        "Formal prose uses paragraphs.",
      ],
    },
    {
      title: "Finding the Canal Gate",
      text: "Historians knew that a nineteenth-century canal once crossed the eastern field, but plowing had erased its visible edges. Priya Nordin compared tax maps, workers' diaries, and differences in soil moisture visible in drone images. Each source narrowed the search in a different way. Maps gave legal parcels but simplified the canal's curves. Diaries mentioned walking times from a mill whose foundation survived. Moisture patterns traced buried stone that retained water. Where the clues converged, excavation uncovered an iron hinge and a line of dressed blocks—the remains of a control gate. No source had supplied the answer alone.",
      centralIdea:
        "Researchers locate a lost canal gate by combining spatial, written, and physical evidence.",
      centralDistractors: [
        "A single tax map shows the exact canal gate.",
        "Drone images make excavation unnecessary.",
        "Workers' diaries describe how the hinge was manufactured.",
      ],
      detailQuestion: "What did excavation uncover at the likely gate site?",
      detailAnswer: "An iron hinge and a line of dressed blocks.",
      detailDistractors: [
        "The complete mill.",
        "A new tax map.",
        "A wooden boat.",
      ],
      inferenceAnswer:
        "Nordin treats agreement among independent clues as stronger than any clue by itself.",
      inferenceDistractors: [
        "Nordin assumes diaries never contain errors.",
        "Nordin ignores physical evidence after excavation.",
        "Nordin believes legal parcels match canal curves exactly.",
      ],
      purposeAnswer:
        "It restates the passage's central method of converging evidence.",
      purposeDistractors: [
        "It dismisses the hinge as unimportant.",
        "It claims every source was complete.",
        "It introduces an unrelated excavation.",
      ],
      phrase: "the clues converged",
      phraseAnswer: "different evidence pointed to the same location",
      phraseDistractors: [
        "the canal branches joined",
        "the researchers ended the project",
        "the maps were printed together",
      ],
      supportAnswer:
        "A second location where the three evidence types agree also contains canal masonry.",
      supportDistractors: [
        "The field is planted with wheat.",
        "The diaries use cursive handwriting.",
        "Drone flights require batteries.",
      ],
    },
    {
      title: "The Mussel on the Raft",
      text: "Biologists installed floating rafts to give young native fish shelter from shoreline predators. Within two seasons, a nonnative mussel covered the rafts' submerged ropes. The mussels filtered the water, making it clearer, but they also concentrated nutrients beneath each raft. Dense algae then grew on the bottom and reduced oxygen at night. Removing the rafts would eliminate fish shelter, so the team tested rope coatings and shorter cleaning intervals. The project had not simply succeeded or failed. One structure produced a benefit and a new pathway for harm, requiring the design to change.",
      centralIdea:
        "A fish-shelter project creates an unintended mussel problem, leading biologists to modify rather than abandon the design.",
      centralDistractors: [
        "Clearer water always improves oxygen levels.",
        "The team removes every raft immediately.",
        "Native fish cause algae to grow beneath the rafts.",
      ],
      detailQuestion:
        "What happened after nutrients accumulated beneath the rafts?",
      detailAnswer: "Dense algae grew and nighttime oxygen fell.",
      detailDistractors: [
        "The ropes became shorter.",
        "Fish left the shoreline forever.",
        "The mussels stopped filtering water.",
      ],
      inferenceAnswer:
        "The team judges the rafts by multiple ecological effects rather than one intended benefit.",
      inferenceDistractors: [
        "The team considers clear water the only important result.",
        "The team expected no organisms to touch the ropes.",
        "The team believes cleaning can never help.",
      ],
      purposeAnswer:
        "It reframes the outcome as a tradeoff that calls for revision.",
      purposeDistractors: [
        "It proves the original design had no benefit.",
        "It changes the topic to commercial fishing.",
        "It claims all conservation structures should be removed.",
      ],
      phrase: "a new pathway for harm",
      phraseAnswer:
        "an indirect sequence through which the design created a negative effect",
      phraseDistractors: [
        "a walking route beside the water",
        "a deliberate attempt to injure fish",
        "a new method for building ropes",
      ],
      supportAnswer:
        "Coated, frequently cleaned ropes retain fish use while supporting fewer mussels and less nighttime oxygen loss.",
      supportDistractors: [
        "The rafts are visible from shore.",
        "Some fish are larger than others.",
        "Mussels have hard shells.",
      ],
    },
    {
      title: "Composing with Echoes",
      text: "Composer Devon Li recorded a violin phrase in four rooms: a carpeted studio, a tiled stairwell, a wooden hall, and an empty warehouse. Rather than remove each room's reverberation, Li treated the echoes as musical material. A short note from the stairwell became a bright cluster; a sustained warehouse tone formed a slowly fading background. During rehearsal, musicians first tried to imitate the recordings exactly. Li instead asked them to respond to the length and density of each echo. The performance therefore combined fixed recordings with live decisions. The rooms had shaped the source sounds, but they did not dictate a single response.",
      centralIdea:
        "Li uses room echoes as constraints that guide, but do not fully determine, live musical responses.",
      centralDistractors: [
        "Li removes all reverberation before composing.",
        "The musicians perform only in the warehouse.",
        "Each room produces exactly the same violin sound.",
      ],
      detailQuestion: "How was the warehouse recording used?",
      detailAnswer: "As a slowly fading background.",
      detailDistractors: [
        "As a bright short cluster.",
        "As a spoken introduction.",
        "As a replacement for every live musician.",
      ],
      inferenceAnswer:
        "Li values live interpretation within clearly defined acoustic conditions.",
      inferenceDistractors: [
        "Li wants musicians to copy recordings mechanically.",
        "Li believes rooms have no effect on sound.",
        "Li avoids combining live and recorded material.",
      ],
      purposeAnswer:
        "It clarifies that the acoustic source limits possibilities without prescribing one performance.",
      purposeDistractors: [
        "It claims the rooms performed without musicians.",
        "It introduces a fifth recording location.",
        "It argues that live decisions damaged the composition.",
      ],
      phrase: "musical material",
      phraseAnswer: "sound features used as elements in the composition",
      phraseDistractors: [
        "fabric placed on an instrument",
        "written biographies of the rooms",
        "noise removed before rehearsal",
      ],
      supportAnswer:
        "Different ensembles make distinct live choices while listeners can still match each response to its source echo.",
      supportDistractors: [
        "The violin has four strings.",
        "The warehouse is the largest room.",
        "Carpet is softer than tile.",
      ],
    },
  ],
  [
    {
      title: "The Glacier Photographs",
      text: "Photographer Eli Moreno left hundreds of mountain images labeled only by month. Geologist Rina Cho initially doubted they could support research because the camera positions were unknown. Then she noticed recurring fence posts and cliff notches in the frames. By matching those fixed points with modern coordinates, Cho reconstructed twelve viewpoints. The photographs revealed that one glacier retreated unevenly: its shaded edge barely moved while the sun-exposed edge pulled back rapidly. The collection was not a planned scientific survey, yet its repeated visual anchors made careful comparison possible. Cho published both the measurements and the uncertainty remaining at each viewpoint.",
      centralIdea:
        "Cho converts an informal photograph collection into qualified evidence of uneven glacier retreat.",
      centralDistractors: [
        "Moreno planned a complete glacier survey.",
        "Every glacier edge retreated at the same rate.",
        "Unknown camera positions make old photographs useless.",
      ],
      detailQuestion: "What allowed Cho to reconstruct the camera viewpoints?",
      detailAnswer: "Recurring fence posts and cliff notches.",
      detailDistractors: [
        "Dates printed on every image.",
        "A map drawn by Moreno.",
        "The color of the glacier ice.",
      ],
      inferenceAnswer:
        "Cho distinguishes between using imperfect evidence and pretending that evidence is exact.",
      inferenceDistractors: [
        "Cho removes all uncertainty before publishing.",
        "Cho assumes every month had one photograph.",
        "Cho believes shade causes glaciers to grow.",
      ],
      purposeAnswer:
        "It emphasizes transparent limits alongside the useful finding.",
      purposeDistractors: [
        "It shows Cho hiding the reconstruction method.",
        "It introduces a different photographer.",
        "It claims uncertainty invalidates all measurements.",
      ],
      phrase: "visual anchors",
      phraseAnswer: "stable features used to align photographs",
      phraseDistractors: [
        "weights attached to cameras",
        "decorative parts of the mountain",
        "labels naming every glacier",
      ],
      supportAnswer:
        "Independent survey markers confirm most reconstructed viewpoints within the uncertainty Cho reported.",
      supportDistractors: [
        "The images were stored in several boxes.",
        "Some photographs include clouds.",
        "Modern cameras have larger sensors.",
      ],
    },
    {
      title: "Measuring a Quiet Street",
      text: "A city noise map averaged sound across large zones and classified Alder Street as moderate. Residents, however, complained about brief nighttime bursts from delivery carts. Researchers placed small monitors at doorways and recorded both volume and duration. The street was quiet most of the hour, but metal wheels crossing one drain cover produced repeated peaks loud enough to wake sleepers. Repaving the entire block would have been expensive. Replacing the drain cover removed most peaks while barely changing the hourly average. The fine-grained record identified a narrow cause hidden inside a broad summary.",
      centralIdea:
        "Detailed nighttime measurements reveal and solve a brief noise problem that a zone-wide average concealed.",
      centralDistractors: [
        "Hourly averages always exaggerate street noise.",
        "The city repaves every block near Alder Street.",
        "Residents complain because the street is continuously loud.",
      ],
      detailQuestion: "What produced the repeated noise peaks?",
      detailAnswer: "Metal cart wheels crossing one drain cover.",
      detailDistractors: [
        "A nearby train.",
        "Doorways closing.",
        "The sound monitors themselves.",
      ],
      inferenceAnswer:
        "An average can miss short events that matter greatly to people experiencing them.",
      inferenceDistractors: [
        "Short events never affect sleep.",
        "Every drain cover creates identical noise.",
        "Broad maps are more detailed than doorway monitors.",
      ],
      purposeAnswer:
        "It contrasts a targeted improvement with the mostly unchanged broad metric.",
      purposeDistractors: [
        "It proves the repair made the street continuously silent.",
        "It introduces a different source of noise.",
        "It argues that averages should never be calculated.",
      ],
      phrase: "a narrow cause",
      phraseAnswer: "one specific source responsible for the problem",
      phraseDistractors: [
        "a physically thin street",
        "a cause with little importance",
        "a measurement taken at noon",
      ],
      supportAnswer:
        "After the cover is replaced, nighttime wake complaints drop even though the zone's average category remains moderate.",
      supportDistractors: [
        "Delivery carts carry different products.",
        "Alder Street has brick buildings.",
        "The monitors use small batteries.",
      ],
    },
    {
      title: "Two Historians on Reenactment",
      text: "Historian A: Reenacting a workshop process can reveal practical limits a written instruction omits. When a recipe says to heat glue 'until ready,' repeated trials can show the workable temperature range.\n\nHistorian B: Trials are valuable, but modern materials and expectations can quietly shape the result. I treat reenactment as a question-generating tool, not a direct replay of the past.\n\nBoth historians use physical experiments. A is more willing to draw conclusions about technique from a successful reconstruction; B insists that each conclusion remain tied to differences between the historical and modern conditions.",
      centralIdea:
        "Both historians value reenactment, but they differ in how directly its results can support claims about past practice.",
      centralDistractors: [
        "Historian B refuses to conduct physical experiments.",
        "Historian A believes written sources contain every detail.",
        "Both historians regard modern materials as identical to historical ones.",
      ],
      detailQuestion: "What example does Historian A use?",
      detailAnswer:
        "Finding a workable glue temperature through repeated trials.",
      detailDistractors: [
        "Replacing every written recipe.",
        "Building a modern factory.",
        "Measuring the age of a manuscript.",
      ],
      inferenceAnswer:
        "Historian B is especially concerned about assumptions introduced by present-day conditions.",
      inferenceDistractors: [
        "Historian B thinks experiments cannot raise useful questions.",
        "Historian B prefers conclusions without evidence.",
        "Historian B studies only written language.",
      ],
      purposeAnswer:
        "It summarizes agreement about method and disagreement about the strength of conclusions.",
      purposeDistractors: [
        "It proves Historian A's conclusions are always correct.",
        "It introduces a third type of evidence.",
        "It claims both historians reach identical conclusions.",
      ],
      phrase: "question-generating tool",
      phraseAnswer: "a method that suggests what to investigate further",
      phraseDistractors: [
        "a device that writes exam questions",
        "proof that needs no other evidence",
        "a replacement for historical materials",
      ],
      supportAnswer:
        "Reconstructions using different plausible modern materials produce different results from the same written instruction.",
      supportDistractors: [
        "Some workshops have large windows.",
        "Historical recipes use old spelling.",
        "Glue containers come in many sizes.",
      ],
    },
    {
      title: "Tracing the Bell Foundry",
      text: "A village archive listed payments to a bell founder but never named the workshop's location. Researcher Malik Grant plotted charcoal deliveries, rent records, and complaints about nighttime hammering. The three records used different street names because the district had been renumbered. Grant matched buildings through neighboring owners rather than numbers alone. All three trails pointed to a courtyard behind the former grain market. Soil samples there contained copper droplets and fragments of casting molds. The workshop's location became convincing because documents and material traces supported the same place.",
      centralIdea:
        "Grant identifies a lost bell workshop by reconciling changing addresses and matching documents with physical remains.",
      centralDistractors: [
        "A payment record states the workshop's exact address.",
        "Street numbers in the district never changed.",
        "Copper droplets prove every courtyard held a foundry.",
      ],
      detailQuestion: "How did Grant account for renumbered streets?",
      detailAnswer:
        "He matched buildings through the names of neighboring owners.",
      detailDistractors: [
        "He ignored all street records.",
        "He used only modern house numbers.",
        "He asked the bell founder directly.",
      ],
      inferenceAnswer:
        "Grant gives the location more confidence because independent evidence types agree.",
      inferenceDistractors: [
        "Grant assumes every complaint concerns the foundry.",
        "Grant considers soil evidence unnecessary.",
        "Grant believes neighboring ownership never changes.",
      ],
      purposeAnswer:
        "It states why the combined evidence is stronger than any single record.",
      purposeDistractors: [
        "It claims the workshop is still operating.",
        "It introduces an unrelated market.",
        "It dismisses documentary evidence.",
      ],
      phrase: "all three trails",
      phraseAnswer: "the separate lines of documentary evidence",
      phraseDistractors: [
        "three walking paths through the village",
        "marks left by delivery carts",
        "modern roads leading to the market",
      ],
      supportAnswer:
        "A mold fragment from the courtyard matches the size and alloy of the bell named in the payment record.",
      supportDistractors: [
        "The archive stores many rent records.",
        "The grain market sold several crops.",
        "Nighttime work can be noisy.",
      ],
    },
    {
      title: "The Grass that Held Sand",
      text: "Coastal managers planted silver cordgrass to hold sand around a restored dune. Its dense roots did stabilize the slope. They also trapped so much sand that the low openings used by nesting shorebirds gradually closed. Managers first considered removing the grass entirely, but exposed sections eroded during storms. They instead cut narrow corridors before nesting season and monitored both dune height and bird movement. The revised plan preserved much of the grass's protective effect while restoring access. Measuring only erosion would have labeled the first design a success; measuring habitat use revealed the tradeoff.",
      centralIdea:
        "Managers revise a successful erosion-control planting after broader monitoring reveals harm to shorebird access.",
      centralDistractors: [
        "Cordgrass fails to stabilize any part of the dune.",
        "Shorebirds nest only in dense grass.",
        "Managers remove every plant before storms.",
      ],
      detailQuestion: "What unintended change affected shorebirds?",
      detailAnswer: "Sand accumulation closed low openings through the dune.",
      detailDistractors: [
        "Dune height decreased everywhere.",
        "Storms removed every nesting site.",
        "Grass roots poisoned the birds.",
      ],
      inferenceAnswer:
        "The managers define success using both physical stability and habitat function.",
      inferenceDistractors: [
        "The managers now ignore erosion.",
        "The managers believe corridors prevent every storm.",
        "The managers monitor birds only outside nesting season.",
      ],
      purposeAnswer:
        "It explains how the evaluation changed when a second outcome was measured.",
      purposeDistractors: [
        "It proves erosion measurements were fabricated.",
        "It introduces a different dune project.",
        "It claims tradeoffs cannot be managed.",
      ],
      phrase: "revealed the tradeoff",
      phraseAnswer: "made the benefit and accompanying cost visible together",
      phraseDistractors: [
        "showed that no benefit existed",
        "recorded a financial exchange",
        "proved shorebirds caused erosion",
      ],
      supportAnswer:
        "After corridors are cut, bird crossings increase while most monitored dune sections remain stable.",
      supportDistractors: [
        "Cordgrass has silver-colored leaves.",
        "Some shorebirds migrate long distances.",
        "Storms occur in several seasons.",
      ],
    },
    {
      title: "Painting with Drying Time",
      text: "Painter Laila Chen mixed four versions of the same blue pigment with oils that dried at different rates. She brushed each mixture across a tilted panel, then returned at fixed intervals to drag a comb through the paint. Fast-drying mixtures preserved sharp ridges; slow ones settled into soft bands. Chen did not choose one mixture as best. She layered them, placing crisp marks over broad fields that continued to shift beneath them. The drying rate became part of the composition's timing. It limited when a mark could be changed, yet those limits helped Chen coordinate textures she could not produce all at once.",
      centralIdea:
        "Chen uses different drying rates as time-based constraints for coordinating layered textures.",
      centralDistractors: [
        "Chen searches for one oil that dries faster than all others.",
        "Every mixture produces the same texture.",
        "Chen avoids changing paint after it reaches the panel.",
      ],
      detailQuestion: "What texture did the fast-drying mixtures preserve?",
      detailAnswer: "Sharp ridges.",
      detailDistractors: [
        "Soft bands.",
        "A colorless surface.",
        "Only broad fields.",
      ],
      inferenceAnswer:
        "Chen plans layers partly around when each mixture remains workable.",
      inferenceDistractors: [
        "Chen believes drying time has no effect on composition.",
        "Chen uses only one layer per painting.",
        "Chen chooses oils based solely on price.",
      ],
      purposeAnswer:
        "It explains how a physical limit becomes a tool for organizing the work.",
      purposeDistractors: [
        "It claims limits prevent all creative decisions.",
        "It introduces a new pigment color.",
        "It shows Chen removing every crisp mark.",
      ],
      phrase: "the composition's timing",
      phraseAnswer: "the sequence and windows in which layers could be worked",
      phraseDistractors: [
        "the date when the painting was sold",
        "a musical beat painted on the panel",
        "the total time needed to mix blue pigment",
      ],
      supportAnswer:
        "Studio notes show Chen schedules combing and layering according to measured working times for each mixture.",
      supportDistractors: [
        "The panel is tilted at an angle.",
        "Blue pigment can be stored in jars.",
        "Combs come in several widths.",
      ],
    },
  ],
  [
    {
      title: "The Seed Exchange Cards",
      text: "Mina Patel found a cabinet of old seed-exchange cards whose formal descriptions were brief, but growers had crowded the backs with notes: 'bolted after three hot nights,' 'sweetest from the shaded row,' and 'survived the late frost.' Patel matched the cards with weather records and field maps. Varieties praised in one decade sometimes failed in another because planting dates had shifted. The cards were not controlled experiments, yet together they preserved many small comparisons across places and years. Patel used them to choose candidates for new trials rather than to declare one variety universally best.",
      centralIdea:
        "Patel uses informal grower observations as leads for new seed trials while respecting their limits.",
      centralDistractors: [
        "Patel proves one seed variety is best in every climate.",
        "The cards contain complete controlled experiments.",
        "Weather records show planting dates never changed.",
      ],
      detailQuestion: "What records did Patel compare with the seed cards?",
      detailAnswer: "Weather records and field maps.",
      detailDistractors: [
        "Sales receipts and recipes.",
        "Only modern seed catalogs.",
        "Photographs of farm buildings.",
      ],
      inferenceAnswer:
        "Patel treats repeated informal observations as useful hypotheses, not final conclusions.",
      inferenceDistractors: [
        "Patel assumes every grower note is equally accurate.",
        "Patel refuses to run new trials.",
        "Patel ignores changes in planting date.",
      ],
      purposeAnswer:
        "It draws a careful boundary between selecting what to test and claiming what is universally true.",
      purposeDistractors: [
        "It claims all candidates will succeed.",
        "It shows Patel discarding the cabinet.",
        "It introduces a new seed exchange.",
      ],
      phrase: "preserved many small comparisons",
      phraseAnswer:
        "retained numerous observations that could be compared across conditions",
      phraseDistractors: [
        "stored seeds in tiny containers",
        "proved every note was a controlled result",
        "kept growers from sharing information",
      ],
      supportAnswer:
        "Varieties selected from repeated heat-tolerance notes outperform comparison varieties in a controlled warm-night trial.",
      supportDistractors: [
        "Some cards have torn corners.",
        "Growers used different pencils.",
        "Seed cabinets can contain many drawers.",
      ],
    },
    {
      title: "Counting Shade by the Minute",
      text: "Regional tree-canopy maps classified Juniper Plaza as well shaded, but people still avoided its benches at midday. Landscape researchers mounted light sensors at seat height and recorded shade minute by minute. Tall trees covered most of the plaza area, yet wind moved their narrow crowns enough to expose the benches repeatedly. A nearby wall cast a smaller but steadier shadow. The team shifted two benches into that stable band and planted lower shrubs near the others. Area alone had overstated the comfort provided by moving shade. Duration at the exact place people sat proved more useful.",
      centralIdea:
        "Minute-by-minute measurements at bench height reveal why broad canopy coverage did not provide reliable comfort.",
      centralDistractors: [
        "Juniper Plaza contains no trees.",
        "Walls always produce more shade area than trees.",
        "Researchers remove every bench from the plaza.",
      ],
      detailQuestion: "Why were the benches repeatedly exposed?",
      detailAnswer: "Wind moved the trees' narrow crowns.",
      detailDistractors: [
        "The sensors produced heat.",
        "The wall was removed.",
        "People moved the benches each day.",
      ],
      inferenceAnswer:
        "A useful shade metric must reflect where and how long people experience shade.",
      inferenceDistractors: [
        "Total canopy area has no value in any study.",
        "Shrubs always cast the widest shadows.",
        "Midday comfort depends only on bench material.",
      ],
      purposeAnswer:
        "It contrasts a broad area measure with the site-specific duration measure that better fits the design question.",
      purposeDistractors: [
        "It claims the canopy map was intentionally false.",
        "It introduces a second plaza.",
        "It argues that shade changes should be ignored.",
      ],
      phrase: "stable band",
      phraseAnswer: "an area that stayed shaded consistently",
      phraseDistractors: [
        "a musical group that performed nearby",
        "a strip of stronger pavement",
        "a place where wind speed increased",
      ],
      supportAnswer:
        "Seat-temperature readings fall most at benches receiving uninterrupted shade during the busiest midday hour.",
      supportDistractors: [
        "The plaza has a stone fountain.",
        "Some trees are taller than others.",
        "Sensors can record data at night.",
      ],
    },
    {
      title: "Two Curators on Missing Pieces",
      text: "Curator A: When a sculpture lacks an arm, I avoid adding a full replacement unless its shape is documented. A plain support can stabilize the work without pretending certainty.\n\nCurator B: I share that caution, but a carefully differentiated reconstruction can help viewers understand the original pose. I use a neutral color and label the evidence behind the proposed shape.\n\nBoth curators reject an unmarked imitation. A gives greater weight to leaving uncertainty physically open; B is more willing to visualize a supported hypothesis as long as viewers can distinguish it from original material.",
      centralIdea:
        "The curators agree additions must be distinguishable but differ over whether a supported reconstruction should fill a missing form.",
      centralDistractors: [
        "Both curators favor invisible imitations.",
        "Curator A believes damaged sculptures should never be displayed.",
        "Curator B ignores evidence about original poses.",
      ],
      detailQuestion: "How would Curator B distinguish a reconstruction?",
      detailAnswer: "With a neutral color and an evidence label.",
      detailDistractors: [
        "By matching the original surface exactly.",
        "By hiding it behind the sculpture.",
        "By refusing to stabilize the work.",
      ],
      inferenceAnswer:
        "Curator A is more concerned that a completed shape may imply more certainty than the evidence supports.",
      inferenceDistractors: [
        "Curator A believes supports are always original.",
        "Curator A prefers neutral colors to all others.",
        "Curator A has evidence for the missing arm's exact shape.",
      ],
      purposeAnswer:
        "It defines the common ethical limit and the practical choice on which the curators differ.",
      purposeDistractors: [
        "It declares Curator B's method unethical.",
        "It introduces a third sculpture.",
        "It claims viewers cannot distinguish materials.",
      ],
      phrase: "leaving uncertainty physically open",
      phraseAnswer: "allowing the missing area to remain visibly unresolved",
      phraseDistractors: [
        "keeping the museum doors unlocked",
        "refusing to document the damage",
        "placing the sculpture outdoors",
      ],
      supportAnswer:
        "Viewer studies show that clearly differentiated additions aid pose recognition without being mistaken for original material.",
      supportDistractors: [
        "The sculpture is made of stone.",
        "Museums use several kinds of labels.",
        "Some sculptures have two arms.",
      ],
    },
    {
      title: "Locating the Winter Road",
      text: "A mining town's winter road vanished after the river shifted course. Historian Tess Okafor compared sled-freight receipts, diary references to travel time, and rows of cut stumps visible in aerial images. Receipts named destinations but not the route. Diaries described steep climbs. The stump line marked where crews had once cleared a corridor. Okafor modeled several possible paths and walked each after snowfall. Only one matched both the recorded travel times and the documented climb. Rusted horseshoe nails found along that corridor added material support to the reconstruction.",
      centralIdea:
        "Okafor reconstructs a lost winter road by testing a route against documentary, landscape, and material evidence.",
      centralDistractors: [
        "A receipt prints the road's complete route.",
        "Every possible path matches the diary times.",
        "The river's old course is still visible.",
      ],
      detailQuestion: "Which landscape feature suggested a cleared corridor?",
      detailAnswer: "A row of cut stumps.",
      detailDistractors: [
        "A line of new houses.",
        "The shifted river.",
        "A modern paved road.",
      ],
      inferenceAnswer:
        "Okafor tests candidate routes against constraints rather than selecting the first plausible path.",
      inferenceDistractors: [
        "Okafor assumes receipts contain no useful evidence.",
        "Okafor believes snowfall changes travel time randomly.",
        "Okafor ignores material finds.",
      ],
      purposeAnswer:
        "It adds a different evidence type that independently strengthens the route identification.",
      purposeDistractors: [
        "It proves horses wore no shoes on winter roads.",
        "It introduces a second mining town.",
        "It contradicts the travel-time match.",
      ],
      phrase: "material support",
      phraseAnswer: "physical evidence consistent with the proposed route",
      phraseDistractors: [
        "wood used to brace the road",
        "financial aid for the project",
        "written evidence from a diary",
      ],
      supportAnswer:
        "Additional metal finds dating to the freight period cluster along the same modeled corridor.",
      supportDistractors: [
        "The town mined several minerals.",
        "Some receipts are faded.",
        "Snowfall varies from year to year.",
      ],
    },
    {
      title: "A Pond that Became Too Clear",
      text: "Managers added filter-feeding oysters to a coastal pond to reduce suspended algae. Water clarity improved quickly, allowing sunlight to reach deeper sediment. That change encouraged thick mats of bottom algae, which trapped gas and lifted loose sediment when they broke apart. The pond became clear in the water column but unstable at the bottom. Managers reduced oyster density and added periodic sediment checks. The intervention had met its original clarity target while exposing a second process the target did not measure.",
      centralIdea:
        "An oyster intervention improves one water-quality measure but triggers a bottom-algae problem, so managers broaden monitoring and adjust density.",
      centralDistractors: [
        "Oysters fail to filter any suspended algae.",
        "Clear water prevents sunlight from reaching sediment.",
        "Managers increase oyster density without monitoring.",
      ],
      detailQuestion: "What did greater light at the bottom encourage?",
      detailAnswer: "Thick mats of bottom algae.",
      detailDistractors: [
        "Less oyster feeding.",
        "A deeper pond.",
        "Immediate sediment removal.",
      ],
      inferenceAnswer:
        "A single target can improve while the ecosystem develops a different problem.",
      inferenceDistractors: [
        "Water clarity has no connection to light.",
        "Managers expected oysters to increase suspended algae.",
        "Bottom processes can never be monitored.",
      ],
      purposeAnswer:
        "It states the mismatch between the original success measure and the newly observed consequence.",
      purposeDistractors: [
        "It claims the clarity data were wrong.",
        "It changes the topic to a different pond.",
        "It shows the intervention achieved no target.",
      ],
      phrase: "water column",
      phraseAnswer: "the body of water above the pond bottom",
      phraseDistractors: [
        "a written table of measurements",
        "the oysters' shells",
        "a pipe carrying water",
      ],
      supportAnswer:
        "Lower-density plots retain much of the clarity gain while developing smaller bottom-algae mats.",
      supportDistractors: [
        "Oysters have uneven shells.",
        "The pond is near the coast.",
        "Algae occur in many colors.",
      ],
    },
    {
      title: "Carving with the Grain",
      text: "Sculptor Jo Adebayo began each wood panel with a geometric plan, but she did not force every line to follow it. When a dense knot deflected the chisel, Adebayo traced the grain around it and repeated that curve elsewhere in the panel. The obstacle became a motif. Students watching her assumed improvisation meant abandoning the plan. Adebayo instead described it as negotiation: the original geometry set a direction, while the wood supplied local information. The finished panel remained structured, but its repeated curves recorded decisions made in response to one particular board.",
      centralIdea:
        "Adebayo preserves an overall geometric plan while using the wood's grain and knots to shape local design decisions.",
      centralDistractors: [
        "Adebayo discards every plan before carving.",
        "Dense knots make wood impossible to carve.",
        "Students design the entire panel for Adebayo.",
      ],
      detailQuestion: "What does Adebayo do after a knot deflects the chisel?",
      detailAnswer:
        "She repeats the resulting grain curve elsewhere as a motif.",
      detailDistractors: [
        "She throws away the panel.",
        "She removes every geometric line.",
        "She covers the knot with paint.",
      ],
      inferenceAnswer:
        "Adebayo sees material resistance as information that can guide a structured revision.",
      inferenceDistractors: [
        "Adebayo believes improvisation has no limits.",
        "Adebayo chooses boards without grain.",
        "Adebayo wants every panel to look identical.",
      ],
      purposeAnswer:
        "It clarifies that responsiveness to material can coexist with an organizing plan.",
      purposeDistractors: [
        "It argues that geometry has no role in the work.",
        "It introduces a new carving tool.",
        "It claims the board makes every decision.",
      ],
      phrase: "the wood supplied local information",
      phraseAnswer:
        "features of the particular board influenced nearby choices",
      phraseDistractors: [
        "the wood included written instructions",
        "local stores provided the material",
        "the board determined the entire design in advance",
      ],
      supportAnswer:
        "Across several panels, Adebayo keeps the same broad grid but develops different motifs around each board's knots.",
      supportDistractors: [
        "Wood panels vary in weight.",
        "Chisels require sharpening.",
        "Students sketch geometric shapes.",
      ],
    },
  ],
] as const;

function readingQuestionInputs(
  variant: AssessmentVariant,
  scenario: ReadingScenario,
  passageIndex: number,
): QuestionInput[] {
  const stimulus = scenario.text;
  const passageId = `${["atlas", "beacon", "cedar", "delta"][variant]}-reading-passage-${passageIndex + 1}`;
  const shared = {
    section: "reading" as const,
    stimulus,
    passageId,
    passageTitle: scenario.title,
  };
  const entries = [
    {
      skill: "central-ideas-and-details",
      skillLabel: "Central ideas and details",
      category: "Key Ideas and Details",
      difficulty: "medium",
      prompt: "Which choice best states the central idea of the passage?",
      correctAnswer: scenario.centralIdea,
      distractors: scenario.centralDistractors,
      rationale:
        "The correct choice accounts for the passage's problem, evidence, and outcome without adding a claim the passage does not make.",
    },
    {
      skill: "textual-evidence-and-details",
      skillLabel: "Textual evidence and details",
      category: "Key Ideas and Details",
      difficulty: "medium",
      prompt: scenario.detailQuestion,
      correctAnswer: scenario.detailAnswer,
      distractors: scenario.detailDistractors,
      rationale:
        "The correct choice restates the specific detail supplied in the passage; the other choices change or invent that evidence.",
    },
    {
      skill: "supported-inference",
      skillLabel: "Supported inference",
      category: "Key Ideas and Details",
      difficulty: "hard",
      prompt: "Which inference is best supported by the passage?",
      correctAnswer: scenario.inferenceAnswer,
      distractors: scenario.inferenceDistractors,
      rationale:
        "The inference follows from the sequence of actions and evidence while avoiding an unsupported motive or absolute claim.",
    },
    {
      skill: "author-purpose-and-structure",
      skillLabel: "Author purpose and structure",
      category: "Craft and Structure",
      difficulty: "hard",
      prompt: "The final sentence primarily serves to:",
      correctAnswer: scenario.purposeAnswer,
      distractors: scenario.purposeDistractors,
      rationale:
        "The final sentence interprets the preceding evidence and completes the passage's central contrast or method.",
    },
    {
      skill: "author-purpose-and-structure",
      skillLabel: "Author purpose and structure",
      category: "Craft and Structure",
      difficulty: "medium",
      prompt: `As used in the passage, the phrase “${scenario.phrase}” most nearly means:`,
      correctAnswer: scenario.phraseAnswer,
      distractors: scenario.phraseDistractors,
      rationale:
        "The phrase's surrounding sentences establish the contextual meaning given by the correct choice.",
    },
    {
      skill: "textual-evidence-and-details",
      skillLabel: "Textual evidence and details",
      category: "Integration of Knowledge and Ideas",
      difficulty: "hard",
      prompt:
        "Which new finding would most strongly support the passage's central interpretation?",
      correctAnswer: scenario.supportAnswer,
      distractors: scenario.supportDistractors,
      rationale:
        "The correct finding directly tests and reinforces the passage's explanation; the other facts may be true but do not bear on that explanation.",
    },
  ] as const;
  return entries.map((entry, index) => {
    const correctIndex = (passageIndex * 2 + index + variant) % 4;
    return {
      ...shared,
      skill: entry.skill,
      skillLabel: entry.skillLabel,
      category: entry.category,
      difficulty: entry.difficulty,
      prompt: entry.prompt,
      choices: rotatedChoices(
        entry.correctAnswer,
        entry.distractors,
        correctIndex,
      ),
      correct: correctIndex as 0 | 1 | 2 | 3,
      rationale: entry.rationale,
    } satisfies QuestionInput;
  });
}

function buildReading(variant: AssessmentVariant) {
  const scenarios = READING_SCENARIOS[variant];
  const inputs = scenarios.flatMap((scenario, passageIndex) =>
    readingQuestionInputs(variant, scenario, passageIndex),
  );
  if (inputs.length !== 36) {
    throw new RangeError(
      `Expected 36 Reading questions; found ${inputs.length}.`,
    );
  }
  return inputs.map((input, index) => question(variant, index + 1, input));
}

function validateAssessmentForm(form: DiagnosticFormSecure) {
  const expected = { english: 50, math: 45, reading: 36 } as const;
  if (form.questions.length !== 131) {
    throw new RangeError("An ACT-length core form must contain 131 questions.");
  }
  if (new Set(form.questions.map((item) => item.id)).size !== 131) {
    throw new RangeError("Assessment question IDs must be unique.");
  }
  for (const section of Object.keys(expected) as CoreSection[]) {
    const count = form.questions.filter(
      (item) => item.section === section,
    ).length;
    if (count !== expected[section]) {
      throw new RangeError(
        `Assessment form requires ${expected[section]} ${section} questions; found ${count}.`,
      );
    }
  }
  for (const item of form.questions) {
    if (new Set(item.choices.map((choice) => choice.text)).size !== 4) {
      throw new RangeError(`Question ${item.id} contains duplicate choices.`);
    }
    if (!item.choices.some((choice) => choice.id === item.correctChoiceId)) {
      throw new RangeError(`Question ${item.id} has an invalid answer key.`);
    }
  }
  if (
    new Set(form.questions.map(assessmentQuestionFingerprint)).size !==
    form.questions.length
  ) {
    throw new RangeError(
      "An ACT-length core form cannot repeat an exact question.",
    );
  }
  return form;
}

function buildAssessmentForm(
  variant: AssessmentVariant,
  purpose: "full-test" | "progress-check",
): DiagnosticFormSecure {
  const code = ["atlas", "beacon", "cedar", "delta"][variant];
  return validateAssessmentForm({
    id: `scout-act-${purpose}-${code}`,
    version: `assessment-bank-v1-${code}`,
    mode: "rapid",
    title:
      purpose === "full-test"
        ? `Enhanced ACT full-length core practice · Form ${code}`
        : `Enhanced ACT progress check · Form ${code}`,
    estimatedMinutes: 125,
    blueprint: BLUEPRINT,
    questions: [
      ...buildEnglish(variant),
      ...buildMath(variant),
      ...buildReading(variant),
    ],
  });
}

export const FULL_LENGTH_PRACTICE_FORMS = [
  buildAssessmentForm(0, "full-test"),
  buildAssessmentForm(1, "full-test"),
] as const;

export const PROGRESS_CHECK_FORMS = [
  buildAssessmentForm(2, "progress-check"),
  buildAssessmentForm(3, "progress-check"),
] as const;

export const EXAM_LAB_FORMS: ReadonlyArray<DiagnosticFormSecure> = [
  ...FULL_LENGTH_PRACTICE_FORMS,
  ...PROGRESS_CHECK_FORMS,
];

export const FULL_LENGTH_PRACTICE_FORM = FULL_LENGTH_PRACTICE_FORMS[0];
export const PROGRESS_CHECK_FORM = PROGRESS_CHECK_FORMS[0];

export function assessmentFormForAttempt(
  purpose: "full-test" | "progress-check",
  attempt: number,
) {
  const forms =
    purpose === "progress-check"
      ? PROGRESS_CHECK_FORMS
      : FULL_LENGTH_PRACTICE_FORMS;
  const safeAttempt = Number.isInteger(attempt) && attempt >= 0 ? attempt : 0;
  return forms[safeAttempt % forms.length];
}

export function assessmentQuestionFingerprint(
  item: Pick<
    DiagnosticQuestionSecure,
    "section" | "prompt" | "stimulus" | "choices"
  >,
) {
  const normalize = (value: string) =>
    value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
  return JSON.stringify({
    section: item.section,
    stimulus: normalize(item.stimulus ?? ""),
    prompt: normalize(item.prompt),
    choices: item.choices.map((choice) => normalize(choice.text)).sort(),
  });
}
