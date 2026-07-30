import type {
  CoreSection,
  PracticeDifficulty,
  PracticeQuestionSecure,
} from "@act-tutor/core";

export interface ActQuestionDifficultyStandard {
  label: PracticeDifficulty;
  cognitiveDemand: string;
  distractorStandard: string;
  sectionSignals: Readonly<Record<CoreSection, string>>;
}

export interface ReviewedQuestionGenerationExample extends PracticeQuestionSecure {
  difficultyEvidence: ReadonlyArray<string>;
  content: {
    status: "published";
    license: "original";
    reviewer: string;
    reviewedAt: string;
    purpose: "ai-few-shot";
  };
}

export const ACT_QUESTION_DIFFICULTY_RUBRIC = {
  version: "act-question-difficulty-v1",
  sharedRequirements: [
    "Every item has one unambiguously best answer and three plausible distractors tied to specific, common errors.",
    "The stem supplies every fact needed to answer; no outside trivia, cultural knowledge, or trick wording is required.",
    "Difficulty comes from ACT-relevant reasoning, not obscure vocabulary, excessive arithmetic, or intentionally confusing prose.",
    "Medium and hard items require the student to connect at least two pieces of information or complete at least two meaningful reasoning steps.",
    "The item must be newly written. Never quote, lightly rewrite, or claim to reproduce an official ACT item.",
  ],
  levels: {
    easy: {
      label: "easy",
      cognitiveDemand:
        "One familiar rule or operation is visible, but the student must still identify the tested skill rather than recall trivia.",
      distractorStandard:
        "Each wrong answer represents one direct error, such as using the wrong operation, overlooking one clause, or selecting a nearby detail.",
      sectionSignals: {
        english:
          "One local grammar or usage decision with a short, complete context.",
        math: "One standard setup and one main calculation, with no hidden conversion.",
        reading:
          "One explicitly stated idea located in a short passage, paraphrased rather than copied.",
      },
    },
    medium: {
      label: "medium",
      cognitiveDemand:
        "Two linked decisions are required, or the tested rule must be applied in a context containing one credible competing path.",
      distractorStandard:
        "At least two distractors should be attractive after a recognizable partial solution or incomplete reading.",
      sectionSignals: {
        english:
          "The student must identify clause or paragraph logic before applying punctuation, usage, organization, or concision.",
        math: "The student must translate context or structure, then perform two linked algebraic, geometric, or proportional steps.",
        reading:
          "The student must combine details across sentences or distinguish the passage's claim from a plausible overstatement.",
      },
    },
    hard: {
      label: "hard",
      cognitiveDemand:
        "Several linked decisions, a non-obvious representation, or a close distinction among defensible-looking choices is required.",
      distractorStandard:
        "Every distractor must survive a surface reading and fail for a precise reason that can be named in the rationale.",
      sectionSignals: {
        english:
          "Meaning and sentence or paragraph structure must be resolved before choosing among grammatically plausible revisions.",
        math: "The problem combines representations, constraints, or stages; arithmetic remains reasonable after the difficult setup.",
        reading:
          "The answer depends on synthesizing separated evidence, tracking a qualification, or distinguishing purpose from content.",
      },
    },
  } satisfies Record<PracticeDifficulty, ActQuestionDifficultyStandard>,
} as const;

const EXAMPLE_META = {
  status: "published",
  license: "original",
  reviewer: "AlexACT content review",
  reviewedAt: "2026-07-27",
  purpose: "ai-few-shot",
} as const;

export const REVIEWED_ACT_QUESTION_EXAMPLES: ReadonlyArray<ReviewedQuestionGenerationExample> =
  [
    {
      id: "few-shot-sentence-boundaries",
      version: 1,
      skill: "sentence-boundaries",
      section: "english",
      difficulty: "hard",
      stimulus:
        "The observatory's oldest telescope still produces remarkably sharp images. Its original tracking motor, however, turns unevenly after decades of use, the staff therefore guides the telescope by hand during long exposures.",
      prompt:
        "Which revision of the final sentence most effectively corrects the sentence boundary while preserving its logical relationship?",
      choices: [
        {
          id: "A",
          text: "Its original tracking motor, however, turns unevenly after decades of use, the staff therefore guides the telescope by hand during long exposures.",
          misconception:
            "A comma alone cannot join the two independent clauses.",
        },
        {
          id: "B",
          text: "Its original tracking motor, however, turns unevenly after decades of use; therefore, the staff guides the telescope by hand during long exposures.",
        },
        {
          id: "C",
          text: "Its original tracking motor, however, turning unevenly after decades of use, therefore the staff guides the telescope by hand during long exposures.",
          misconception:
            "Turning removes the working verb from the first clause and leaves the structure incomplete.",
        },
        {
          id: "D",
          text: "Its original tracking motor, however, turns unevenly after decades of use and therefore, guiding the telescope by hand during long exposures.",
          misconception:
            "The revision makes guiding a modifier without a clear grammatical subject.",
        },
      ],
      correctChoiceId: "B",
      rationale:
        "Both main ideas are independent clauses. A semicolon correctly joins them, and therefore is set off with a following comma to show that the staff's action results from the motor's uneven motion.",
      difficultyEvidence: [
        "The student must identify two independent clauses before choosing punctuation.",
        "The student must also punctuate the conjunctive adverb therefore correctly.",
      ],
      content: EXAMPLE_META,
    },
    {
      id: "few-shot-concision-and-redundancy",
      version: 1,
      skill: "concision-and-redundancy",
      section: "english",
      difficulty: "medium",
      stimulus:
        "Because the archive's paper maps are fragile, volunteers first create digital scans. The scans provide a substitute copy that can be used in place of the original when researchers need to compare handwritten notes.",
      prompt:
        "Which revision of the second sentence is most concise while preserving all of its relevant meaning?",
      choices: [
        {
          id: "A",
          text: "The scans provide a substitute copy that can be used in place of the original when researchers need to compare handwritten notes.",
          misconception:
            "Substitute and used in place of repeat the same relationship.",
        },
        {
          id: "B",
          text: "The scans can be used instead of the original maps when researchers compare handwritten notes.",
        },
        {
          id: "C",
          text: "The scans, which are digital in their format, are substitute copies for researchers and their handwritten-note comparisons.",
          misconception:
            "The revision adds wordy nominalizations and repeats information from the first sentence.",
        },
        {
          id: "D",
          text: "Researchers compare handwritten notes, and the scans are used.",
          misconception:
            "The revision loses the important relationship between the scans and the fragile originals.",
        },
      ],
      correctChoiceId: "B",
      rationale:
        "Choice B keeps the purpose of the scans, the comparison task, and the contrast with the original maps while removing the repeated ideas in substitute copy and used in place of.",
      difficultyEvidence: [
        "The student must separate required meaning from repeated wording.",
        "A shorter distractor is incorrect because it drops the scans' relationship to the originals.",
      ],
      content: EXAMPLE_META,
    },
    {
      id: "few-shot-punctuation-and-commas",
      version: 1,
      skill: "punctuation-and-commas",
      section: "english",
      difficulty: "hard",
      stimulus:
        "The cedar waxwing, unlike many birds that defend a feeding territory will often pass berries to another waxwing perched nearby.",
      prompt: "Which choice uses commas correctly?",
      choices: [
        {
          id: "A",
          text: "The cedar waxwing unlike many birds that defend a feeding territory, will often pass berries to another waxwing perched nearby.",
          misconception:
            "The opening edge of the interrupting contrast is not marked.",
        },
        {
          id: "B",
          text: "The cedar waxwing, unlike many birds that defend a feeding territory, will often pass berries to another waxwing perched nearby.",
        },
        {
          id: "C",
          text: "The cedar waxwing, unlike many birds, that defend a feeding territory will often pass berries to another waxwing perched nearby.",
          misconception:
            "The comma wrongly separates “birds” from the restrictive relative clause that modifies the noun.",
        },
        {
          id: "D",
          text: "The cedar waxwing unlike many birds, that defend a feeding territory, will often pass berries to another waxwing perched nearby.",
          misconception:
            "The revision both misses the start of the interruption and separates a restrictive clause.",
        },
      ],
      correctChoiceId: "B",
      rationale:
        "Unlike many birds that defend a feeding territory is a removable contrast that interrupts the main clause and therefore needs commas at both ends. Within that phrase, that defend a feeding territory identifies which birds and should not be separated.",
      difficultyEvidence: [
        "The student must distinguish the removable interrupting phrase from the restrictive clause inside it.",
        "All four options contain plausible comma placements, so pause-based guessing is unreliable.",
      ],
      content: EXAMPLE_META,
    },
    {
      id: "few-shot-logical-transitions",
      version: 1,
      skill: "logical-transitions",
      section: "english",
      difficulty: "hard",
      stimulus:
        "Early acoustic panels absorbed a broad range of frequencies but also muffled speech. Newer panels can be tuned to absorb only the frequencies most likely to produce echoes. ______, a concert hall can reduce distracting reverberation without making a speaker's voice sound dull.",
      prompt: "Which transition most logically completes the final sentence?",
      choices: [
        {
          id: "A",
          text: "For instance,",
          misconception:
            "The final sentence states a consequence, not one example of frequency tuning.",
        },
        {
          id: "B",
          text: "Nevertheless,",
          misconception:
            "The final sentence does not contrast with the benefit described before it.",
        },
        {
          id: "C",
          text: "As a result,",
        },
        {
          id: "D",
          text: "In comparison,",
          misconception:
            "The final sentence explains an outcome rather than setting two halls side by side.",
        },
      ],
      correctChoiceId: "C",
      rationale:
        "The final sentence gives the practical result of tuning panels to a narrower range of frequencies. As a result accurately labels that cause-and-effect relationship.",
      difficultyEvidence: [
        "The student must summarize the relationship across all three sentences.",
        "For instance is locally plausible but mislabels an effect as an example.",
      ],
      content: EXAMPLE_META,
    },
    {
      id: "few-shot-linear-equations",
      version: 1,
      skill: "linear-equations",
      section: "math",
      difficulty: "hard",
      prompt: "For what value of x does 3/4(2x − 8) + 5 equal 2x − 9?",
      choices: [
        {
          id: "A",
          text: "4",
          misconception:
            "This results from distributing the fraction to only one term.",
        },
        {
          id: "B",
          text: "8",
          misconception:
            "This results from moving the constants but not accounting for the coefficient difference.",
        },
        { id: "C", text: "16" },
        {
          id: "D",
          text: "20",
          misconception:
            "This results from treating three-fourths of 2x as three-fourths x.",
        },
      ],
      correctChoiceId: "C",
      rationale:
        "Distribute 3/4 to get 3x/2 − 6 + 5 = 2x − 9, or 3x/2 − 1 = 2x − 9. Adding 9 and subtracting 3x/2 gives 8 = x/2, so x = 16.",
      difficultyEvidence: [
        "The equation requires fractional distribution and combining constants.",
        "The variable appears on both sides, so a correct distribution is only the first step.",
      ],
      content: EXAMPLE_META,
    },
    {
      id: "few-shot-functions-and-modeling",
      version: 1,
      skill: "functions-and-modeling",
      section: "math",
      difficulty: "medium",
      prompt:
        "A repair service charges $48 for the first 2 hours of work and $12 for each additional hour. For h > 2, which expression gives the total charge C(h), in dollars, for h hours of work?",
      choices: [
        {
          id: "A",
          text: "C(h) = 48 + 12h",
          misconception:
            "This charges the additional-hour rate for the first 2 hours as well.",
        },
        {
          id: "B",
          text: "C(h) = 48 + 12(h − 2)",
        },
        {
          id: "C",
          text: "C(h) = 48h + 12",
          misconception:
            "This treats the fixed first-2-hour charge as an hourly rate.",
        },
        {
          id: "D",
          text: "C(h) = 24h + 12(h − 2)",
          misconception:
            "This invents a per-hour breakdown for the fixed charge and adds it again.",
        },
      ],
      correctChoiceId: "B",
      rationale:
        "The first 2 hours cost a fixed $48. Only h − 2 hours remain after those first 2 hours, so the additional charge is 12(h − 2), making the total 48 + 12(h − 2).",
      difficultyEvidence: [
        "The student must distinguish a fixed initial block from an hourly rate.",
        "The number of additional hours must be represented as h minus 2.",
      ],
      content: EXAMPLE_META,
    },
    {
      id: "few-shot-ratios-and-percent",
      version: 1,
      skill: "ratios-and-percent",
      section: "math",
      difficulty: "hard",
      prompt:
        "A theater increased a ticket price by 20% and later reduced the new price by 15%. Compared with the original price, the final price is:",
      choices: [
        {
          id: "A",
          text: "5% lower",
          misconception:
            "This subtracts the percentages even though they use different reference prices.",
        },
        {
          id: "B",
          text: "2% higher",
        },
        {
          id: "C",
          text: "3% higher",
          misconception:
            "This treats 15% of the increased price as 15% of the original price.",
        },
        {
          id: "D",
          text: "5% higher",
          misconception:
            "This adds the signed percentage changes without compounding them.",
        },
      ],
      correctChoiceId: "B",
      rationale:
        "Let the original price be 1. After the increase it is 1.20. Reducing that by 15% multiplies it by 0.85: 1.20 × 0.85 = 1.02, which is 2% above the original.",
      difficultyEvidence: [
        "The two percent changes use different reference amounts.",
        "A tempting subtraction shortcut gives a plausible but incorrect answer.",
      ],
      content: EXAMPLE_META,
    },
    {
      id: "few-shot-geometry-and-measurement",
      version: 1,
      skill: "geometry-and-measurement",
      section: "math",
      difficulty: "hard",
      prompt:
        "Two similar triangular banners have corresponding side lengths in the ratio 3:5. If the smaller banner has an area of 54 square inches, what is the area, in square inches, of the larger banner?",
      choices: [
        {
          id: "A",
          text: "90",
          misconception:
            "This scales area by the linear factor 5/3 instead of its square.",
        },
        {
          id: "B",
          text: "120",
          misconception:
            "This uses an additive change rather than an area scale factor.",
        },
        { id: "C", text: "150" },
        {
          id: "D",
          text: "250",
          misconception:
            "This squares the larger ratio term without dividing by the smaller term.",
        },
      ],
      correctChoiceId: "C",
      rationale:
        "Areas of similar figures scale by the square of the side-length ratio. The area factor is (5/3)^2 = 25/9, and 54 × 25/9 = 6 × 25 = 150.",
      difficultyEvidence: [
        "The student must recognize that area uses the square of the linear scale factor.",
        "The final calculation requires simplifying a fractional scale factor.",
      ],
      content: EXAMPLE_META,
    },
    {
      id: "few-shot-central-ideas-and-details",
      version: 1,
      skill: "central-ideas-and-details",
      section: "reading",
      difficulty: "medium",
      stimulus:
        "For decades, botanists classified the silverleaf vine as a single species because plants across its range produced nearly identical flowers. Ecologist Mina Rao noticed, however, that northern populations released their pollen weeks earlier than southern populations. Genetic analysis later revealed two distinct lineages. The flowers had hidden a difference that timing and DNA made visible.",
      prompt: "Which choice best states the central idea of the passage?",
      choices: [
        {
          id: "A",
          text: "Flower shape is usually unreliable when botanists classify plants.",
          misconception:
            "The passage makes a narrower claim about one vine, not a general rule about flower shape.",
        },
        {
          id: "B",
          text: "Evidence from reproductive timing and genetics showed that one apparent vine species contained two lineages.",
        },
        {
          id: "C",
          text: "Northern silverleaf vines release more pollen than southern vines.",
          misconception:
            "The passage compares timing, not the amount of pollen.",
        },
        {
          id: "D",
          text: "Rao's genetic methods were more accurate than every earlier botanical method.",
          misconception:
            "The passage does not rank all methods or attribute the genetic analysis solely to Rao.",
        },
      ],
      correctChoiceId: "B",
      rationale:
        "Choice B combines the original classification, Rao's timing observation, and the later genetic evidence. The other choices either add unsupported general claims or focus on a detail the passage does not state.",
      difficultyEvidence: [
        "The student must synthesize evidence from the middle and end of the passage.",
        "The wrong choices use passage vocabulary while changing the scope or factual relationship.",
      ],
      content: EXAMPLE_META,
    },
    {
      id: "few-shot-supported-inference",
      version: 1,
      skill: "supported-inference",
      section: "reading",
      difficulty: "hard",
      stimulus:
        "At the first rehearsal, conductor Lena Ortiz asked the string players to shorten several sustained notes. During the next run, she stood at the back of the empty hall rather than at the podium. After listening there, Ortiz restored the notes to their original lengths but asked the brass section to play more softly beneath them.",
      prompt: "Which inference about Ortiz is best supported by the passage?",
      choices: [
        {
          id: "A",
          text: "She believed the string players had ignored her first instruction.",
          misconception:
            "The passage gives no evidence that the players failed to follow directions.",
        },
        {
          id: "B",
          text: "She changed her diagnosis of the balance problem after listening from a different location.",
        },
        {
          id: "C",
          text: "She preferred rehearsing without any brass players present.",
          misconception:
            "She asks the brass to adjust; she does not ask them to leave.",
        },
        {
          id: "D",
          text: "She intended the next performance to take place in an empty hall.",
          misconception:
            "The empty hall is the rehearsal setting, not a stated performance plan.",
        },
      ],
      correctChoiceId: "B",
      rationale:
        "Ortiz first changes the string notes, then listens from the back of the hall, reverses that change, and adjusts the brass instead. That sequence supports a revised diagnosis, not player disobedience or a preference for an empty hall.",
      difficultyEvidence: [
        "The inference depends on tracking a three-step sequence rather than one sentence.",
        "The correct answer describes a change in reasoning without inventing a motive.",
      ],
      content: EXAMPLE_META,
    },
    {
      id: "few-shot-textual-evidence-and-details",
      version: 1,
      skill: "textual-evidence-and-details",
      section: "reading",
      difficulty: "hard",
      stimulus:
        "Engineer Sol Kim tested two coatings on identical roof tiles. Coating P reflected more sunlight at noon, but its performance dropped sharply after dust settled on it. Coating Q reflected slightly less sunlight when clean yet retained most of that ability after a month outdoors. Kim recommended Q for buildings in dry regions where rain would rarely wash the tiles.",
      prompt:
        "Which detail from the passage most directly supports Kim's recommendation?",
      choices: [
        {
          id: "A",
          text: "The coatings were tested on identical roof tiles.",
          misconception:
            "This makes the comparison fair but does not favor Q for dry regions.",
        },
        {
          id: "B",
          text: "Coating P reflected more sunlight at noon when it was clean.",
          misconception:
            "This detail favors P only under the condition that did not drive the recommendation.",
        },
        {
          id: "C",
          text: "Coating Q retained most of its reflective ability after a month outdoors.",
        },
        {
          id: "D",
          text: "Rain would rarely wash roof tiles in the recommended regions.",
          misconception:
            "This identifies the regional condition but needs the durability result to support choosing Q.",
        },
      ],
      correctChoiceId: "C",
      rationale:
        "Kim recommends Q because it continues to perform after outdoor exposure and dust accumulation. Choice D explains why durability matters, but choice C is the result that directly establishes Q's advantage under that condition.",
      difficultyEvidence: [
        "Two choices are relevant, but the student must distinguish supporting test evidence from contextual explanation.",
        "The answer requires connecting the recommendation to the month-long performance result.",
      ],
      content: EXAMPLE_META,
    },
    {
      id: "few-shot-author-purpose-and-structure",
      version: 1,
      skill: "author-purpose-and-structure",
      section: "reading",
      difficulty: "hard",
      stimulus:
        "When a city replaces asphalt with pale pavement, daytime surface temperatures often fall. That result seems to make pale pavement an obvious response to summer heat. Yet some researchers caution that the brighter surface can reflect additional sunlight toward pedestrians and nearby buildings. They argue that cities should measure air temperature and human heat exposure, not surface temperature alone, before choosing where to use the material.",
      prompt: "The third sentence primarily serves to:",
      choices: [
        {
          id: "A",
          text: "reject the claim that pale pavement lowers surface temperatures.",
          misconception:
            "The sentence qualifies the benefit rather than denying the earlier result.",
        },
        {
          id: "B",
          text: "introduce a limitation that complicates the apparent benefit described earlier.",
        },
        {
          id: "C",
          text: "provide a historical explanation for why cities first used asphalt.",
          misconception: "The passage gives no history of asphalt use.",
        },
        {
          id: "D",
          text: "summarize the measurements researchers recommend in the final sentence.",
          misconception:
            "The measurement recommendation follows from the limitation; the third sentence does not summarize it.",
        },
      ],
      correctChoiceId: "B",
      rationale:
        "The third sentence begins with Yet and introduces reflected sunlight as a drawback that complicates the preceding benefit. It does not deny the temperature result; it qualifies what that result means for people and buildings.",
      difficultyEvidence: [
        "The student must distinguish qualification from contradiction.",
        "The correct purpose depends on the sentence's relationship to both the preceding benefit and following recommendation.",
      ],
      content: EXAMPLE_META,
    },
  ] as const;

export function getReviewedQuestionExamples(
  section: CoreSection,
  skill?: string,
) {
  const sectionExamples = REVIEWED_ACT_QUESTION_EXAMPLES.filter(
    (example) => example.section === section,
  );
  if (!skill) return sectionExamples;
  return [
    ...sectionExamples.filter((example) => example.skill === skill),
    ...sectionExamples.filter((example) => example.skill !== skill),
  ];
}
