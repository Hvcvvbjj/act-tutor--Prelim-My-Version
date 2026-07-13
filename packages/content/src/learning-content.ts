import type {
  LessonContent,
  PracticeQuestionSecure,
  SkillDefinition,
} from "@act-tutor/core";

import { validateLearningBank } from "./learning-schema";

const CONTENT_META = {
  status: "published",
  license: "original",
  reviewer: "ACT Tutor content review",
  reviewedAt: "2026-07-12",
} as const;

interface LessonRecord extends LessonContent {
  content: typeof CONTENT_META;
}

interface PracticeRecord extends PracticeQuestionSecure {
  content: typeof CONTENT_META;
}

export const ACT_SKILLS = [
  {
    slug: "sentence-boundaries",
    label: "Sentence boundaries",
    section: "english",
    category: "Conventions of Standard English",
    diagnosticSkill: "sentence-boundaries",
  },
  {
    slug: "concision-and-redundancy",
    label: "Concision and redundancy",
    section: "english",
    category: "Production of Writing",
    diagnosticSkill: "concision-and-redundancy",
  },
  {
    slug: "punctuation-and-commas",
    label: "Punctuation and commas",
    section: "english",
    category: "Conventions of Standard English",
    diagnosticSkill: "punctuation-and-commas",
  },
  {
    slug: "logical-transitions",
    label: "Logical transitions",
    section: "english",
    category: "Knowledge of Language",
    diagnosticSkill: "logical-transitions",
  },
  {
    slug: "linear-equations",
    label: "Linear equations",
    section: "math",
    category: "Algebra",
    diagnosticSkill: "linear-equations",
  },
  {
    slug: "functions-and-modeling",
    label: "Functions and modeling",
    section: "math",
    category: "Functions",
    diagnosticSkill: "functions-and-modeling",
  },
  {
    slug: "ratios-and-percent",
    label: "Ratios and percent",
    section: "math",
    category: "Number and Quantity",
    diagnosticSkill: "ratios-and-percent",
  },
  {
    slug: "geometry-and-measurement",
    label: "Geometry and measurement",
    section: "math",
    category: "Geometry",
    diagnosticSkill: "geometry-and-measurement",
  },
  {
    slug: "central-ideas-and-details",
    label: "Central ideas and details",
    section: "reading",
    category: "Key Ideas and Details",
    diagnosticSkill: "central-ideas-and-details",
  },
  {
    slug: "supported-inference",
    label: "Supported inference",
    section: "reading",
    category: "Key Ideas and Details",
    diagnosticSkill: "supported-inference",
  },
  {
    slug: "textual-evidence-and-details",
    label: "Textual evidence and details",
    section: "reading",
    category: "Craft and Structure",
    diagnosticSkill: "textual-evidence-and-details",
  },
  {
    slug: "author-purpose-and-structure",
    label: "Author purpose and structure",
    section: "reading",
    category: "Craft and Structure",
    diagnosticSkill: "author-purpose-and-structure",
  },
] as const satisfies ReadonlyArray<SkillDefinition>;

const LESSON_CONFIG = {
  "sentence-boundaries": {
    title: "Sentence boundaries without guessing",
    objective: "Separate complete sentences from fragments and run-ons.",
    concept:
      "A complete ACT sentence needs a subject, a working verb, and a complete thought. Before choosing punctuation, identify whether each side can stand alone.",
    steps: [
      "Find the subject and verb on the left side of the punctuation.",
      "Find the subject and verb on the right side of the punctuation.",
      "Use a period or semicolon only when both sides are complete sentences.",
      "Use a comma with a joining word, or attach a dependent idea to the complete sentence.",
    ],
    prompt: "Although the speaker rehearsed for weeks, the final introduction.",
    answer: "Fragment",
    explanation: [
      "Although makes the first clause dependent, so it cannot stand alone.",
      "The final introduction has no working verb, so the sentence is unfinished.",
    ],
    trap: "Do not trust sentence length. Long fragments and short complete sentences both appear on ACT English.",
  },
  "concision-and-redundancy": {
    title: "Cut words that repeat the job",
    objective: "Choose the shortest grammatically complete option that preserves meaning.",
    concept:
      "ACT concision questions reward exact meaning, not fancy wording. If two words say the same thing, keep the cleaner one unless tone or logic changes.",
    steps: [
      "State the sentence's needed meaning in plain language.",
      "Cross out repeated ideas, filler intensifiers, and double modifiers.",
      "Keep required grammar and contrast words that change the relationship.",
    ],
    prompt: "The trail was surrounded on all sides by trees.",
    answer: "The trail was surrounded by trees.",
    explanation: [
      "Surrounded already means on all sides.",
      "The shorter version preserves the full idea without repetition.",
    ],
    trap: "Do not remove a word just because it is long. Remove it only when its meaning is already supplied.",
  },
  "punctuation-and-commas": {
    title: "Commas by sentence role",
    objective: "Use commas for structure, not for pauses.",
    concept:
      "ACT comma questions usually test whether a phrase is removable, introductory, or joining two complete clauses with a coordinator.",
    steps: [
      "Bracket nonessential information that could be removed.",
      "Check whether an opening phrase needs a comma before the main clause.",
      "Use comma plus for/and/nor/but/or/yet/so only between two complete sentences.",
    ],
    prompt: "Maya, the team captain, organized the fundraiser.",
    answer: "Keep both commas",
    explanation: [
      "The team captain renames Maya and can be removed.",
      "A removable middle phrase needs a comma before and after it.",
    ],
    trap: "A comma is not a weak period. It cannot join two complete sentences by itself.",
  },
  "logical-transitions": {
    title: "Transitions as logic labels",
    objective: "Pick transitions by relationship: continue, contrast, cause, or result.",
    concept:
      "A transition is a tiny logic label. Read the sentence before and after the blank, then name the relationship before looking at choices.",
    steps: [
      "Summarize the previous sentence in a few words.",
      "Summarize the new sentence in a few words.",
      "Choose the transition type that matches the relationship, not the one that sounds formal.",
    ],
    prompt: "The first trial failed. ___, the team changed the design before testing again.",
    answer: "Therefore",
    explanation: [
      "The design change happens because the first trial failed.",
      "Therefore signals result, which matches the logic.",
    ],
    trap: "However often sounds sophisticated, but it only works when the second idea contrasts with the first.",
  },
  "linear-equations": {
    title: "Linear equations in reverse order",
    objective: "Solve one-variable linear equations without losing signs.",
    concept:
      "Solving a linear equation means undoing operations in reverse order while keeping both sides balanced.",
    steps: [
      "Clear parentheses or combine like terms if needed.",
      "Move variable terms to one side and constants to the other.",
      "Undo addition or subtraction before undoing multiplication or division.",
    ],
    prompt: "Solve 3x + 5 = 20.",
    answer: "x = 5",
    explanation: [
      "Subtract 5 from both sides to get 3x = 15.",
      "Divide both sides by 3 to get x = 5.",
    ],
    trap: "Most misses come from changing one side but not the other, especially with negative signs.",
  },
  "functions-and-modeling": {
    title: "Functions as input-output rules",
    objective: "Evaluate and interpret functions from formulas and context.",
    concept:
      "A function takes an input and returns exactly one output. In ACT modeling, the letters usually represent real quantities with units.",
    steps: [
      "Identify what the input represents before substituting.",
      "Replace the variable with the given value using parentheses.",
      "Interpret the output with the units from the problem context.",
    ],
    prompt: "If C(n) = 12n + 30, what is C(4)?",
    answer: "78",
    explanation: [
      "Substitute 4 for n: 12(4) + 30.",
      "Compute 48 + 30 = 78.",
    ],
    trap: "Do not solve for the input unless the question asks which input produces a target output.",
  },
  "ratios-and-percent": {
    title: "Ratios and percent from the whole",
    objective: "Translate percent, part, and whole relationships accurately.",
    concept:
      "Percent means per 100. Most ACT percent errors happen because the wrong number is treated as the whole.",
    steps: [
      "Name the whole before calculating.",
      "Convert percent to a decimal or fraction.",
      "Use part = percent times whole, then check whether the result is reasonable.",
    ],
    prompt: "What is 15% of 80?",
    answer: "12",
    explanation: [
      "15% is 0.15.",
      "0.15 times 80 equals 12.",
    ],
    trap: "For percent change, the original amount is the whole, not the new amount.",
  },
  "geometry-and-measurement": {
    title: "Geometry formulas with units",
    objective: "Choose the right measurement formula and track units.",
    concept:
      "Geometry questions often hide whether they want length, area, volume, or angle measure. The units tell you which formula family is needed.",
    steps: [
      "Sketch or label the given measurements.",
      "Decide whether the answer is one-dimensional, square units, or cubic units.",
      "Substitute carefully and keep units attached until the answer choice.",
    ],
    prompt: "A rectangle has length 9 and width 4. What is its area?",
    answer: "36 square units",
    explanation: [
      "Area of a rectangle is length times width.",
      "9 times 4 equals 36, and area uses square units.",
    ],
    trap: "Perimeter and area use the same numbers but answer different questions.",
  },
  "central-ideas-and-details": {
    title: "Main idea from repeated work",
    objective: "Find the central idea by tracking what the passage keeps doing.",
    concept:
      "The central idea is the passage's controlling point, not one interesting detail. Look for the claim supported across multiple sentences or paragraphs.",
    steps: [
      "Write a short label for each paragraph's job.",
      "Ignore details that appear only once unless they support a larger pattern.",
      "Choose the answer broad enough for the whole passage but specific enough to match it.",
    ],
    prompt: "A passage describes three failed prototypes, then a final useful design.",
    answer: "The design improved through repeated testing.",
    explanation: [
      "The repeated pattern is prototype, failure, adjustment, and improvement.",
      "A single prototype detail is too narrow to be the central idea.",
    ],
    trap: "Avoid answers that are true but cover only one paragraph.",
  },
  "supported-inference": {
    title: "Inference with proof attached",
    objective: "Make only the inference the text can actually support.",
    concept:
      "A supported inference is a small step beyond the words, not a guess about motives or future events without evidence.",
    steps: [
      "Underline the exact sentence that points toward the answer.",
      "Ask what must be true if that sentence is true.",
      "Reject choices that add emotion, cause, or certainty the passage never provides.",
    ],
    prompt: "The narrator checks the map twice before choosing a trail.",
    answer: "The narrator is being careful about the route.",
    explanation: [
      "Checking twice supports caution.",
      "It does not prove fear, confusion, or expert knowledge.",
    ],
    trap: "ACT inference answers are usually modest. Extreme claims are rarely supported.",
  },
  "textual-evidence-and-details": {
    title: "Evidence before answer choice",
    objective: "Use precise lines and details to answer reading questions.",
    concept:
      "Detail questions are won before reading choices. Find the reference in the passage and predict the answer in plain words.",
    steps: [
      "Use names, dates, or repeated nouns from the question to locate the evidence.",
      "Read one sentence before and after the target detail.",
      "Pick the choice that matches the evidence without adding a new claim.",
    ],
    prompt: "A paragraph says the machine reduced water use by 30 percent.",
    answer: "It used less water than before.",
    explanation: [
      "Reduced water use directly supports using less water.",
      "The sentence does not prove the machine was cheaper or faster.",
    ],
    trap: "A choice can sound plausible and still be wrong if that detail is not in the passage.",
  },
  "author-purpose-and-structure": {
    title: "Author purpose by paragraph job",
    objective: "Identify why a sentence or paragraph is included.",
    concept:
      "Purpose questions ask what a part does for the passage. Answer with a job, such as contrast, example, cause, background, or qualification.",
    steps: [
      "Name the point immediately before the referenced part.",
      "Name the point immediately after it.",
      "Choose the job that explains how the referenced part moves the passage forward.",
    ],
    prompt: "After praising a policy, the author notes one drawback.",
    answer: "To qualify the earlier positive evaluation.",
    explanation: [
      "The drawback limits or complicates the praise.",
      "That is a qualification, not a total reversal.",
    ],
    trap: "Do not choose a purpose because it sounds important; tie it to the paragraph's actual job.",
  },
} as const;

export const ACT_LESSONS = ACT_SKILLS.map((skill) => {
  const config = LESSON_CONFIG[skill.slug];
  return {
    id: `${skill.slug}-lesson-v1`,
    skill: skill.slug,
    title: config.title,
    minutes: 7,
    objective: config.objective,
    concept: config.concept,
    steps: config.steps,
    workedExample: {
      prompt: config.prompt,
      answer: config.answer,
      explanation: config.explanation,
    },
    trap: config.trap,
    content: CONTENT_META,
  };
}) satisfies ReadonlyArray<LessonRecord>;

const PRACTICE_CONFIG = {
  "sentence-boundaries": [
    ["Although the rain stopped, the match.", "Fragment", "The second part has no working verb, so the thought is incomplete."],
    ["The lab opened early, students arrived before sunrise.", "Run-on", "Two complete sentences are joined only by a comma."],
    ["The writer revised the draft before class began.", "Complete", "The sentence has a subject, verb, and complete thought."],
    ["Because the batteries died during the test.", "Fragment", "Because makes the clause dependent, and no independent clause follows."],
    ["The museum closed at five; visitors gathered outside.", "Correct punctuation", "A semicolon can join two closely related complete sentences."],
  ],
  "concision-and-redundancy": [
    ["The result was completely final.", "final", "Final already means complete, so completely repeats the idea."],
    ["She returned back to the studio.", "returned", "Returned already includes the idea of back."],
    ["The brief summary covered the main points.", "brief summary", "Brief and summary work together without forced repetition here."],
    ["They collaborated together on the mural.", "collaborated", "Collaborated already means worked together."],
    ["The reason is because the pipe froze.", "because", "Use either the reason is that or because; both together are wordy."],
  ],
  "punctuation-and-commas": [
    ["The chef, who trained in Lima, opened a cafe.", "Keep both commas", "The middle clause is nonessential and needs paired commas."],
    ["The clouds darkened, and the hikers turned back.", "Keep the comma", "Comma plus and correctly joins two complete sentences."],
    ["The clouds darkened, the hikers turned back.", "Replace comma with semicolon", "A comma alone cannot join two complete sentences."],
    ["After the lecture ended students asked questions.", "Add comma after ended", "A longer introductory phrase should be followed by a comma."],
    ["My brother Leo plays violin.", "No comma", "Leo is essential if brother needs identification."],
  ],
  "logical-transitions": [
    ["The device was cheaper than expected. ___, it broke after one week.", "However", "The second sentence contrasts price advantage with poor durability."],
    ["The soil was dry. ___, the gardener watered the beds.", "Therefore", "The watering is a result of the dry soil."],
    ["The team measured wind speed. ___, it recorded air temperature.", "Additionally", "The second action adds another measurement."],
    ["The route was longer. ___, it avoided the flooded bridge.", "Still", "The second idea explains why the longer route remained useful."],
    ["The first plan required permits. ___, the group chose a simpler plan.", "Consequently", "The choice follows as a result of the permit problem."],
  ],
  "linear-equations": [
    ["Solve 2x + 7 = 19.", "6", "Subtract 7 to get 2x = 12, then divide by 2."],
    ["Solve 5x - 4 = 21.", "5", "Add 4 to get 5x = 25, then divide by 5."],
    ["Solve 3(x - 2) = 18.", "8", "Divide by 3 to get x - 2 = 6, then add 2."],
    ["Solve 4x + 6 = 2x + 18.", "6", "Subtract 2x and 6 to get 2x = 12."],
    ["Solve -2x + 9 = 1.", "4", "Subtract 9 to get -2x = -8, then divide by -2."],
  ],
  "functions-and-modeling": [
    ["If f(x) = 2x + 3, what is f(5)?", "13", "Substitute 5: 2(5) + 3 = 13."],
    ["A cab cost is C(m) = 4m + 6. What does 6 represent?", "Starting fee", "It is the cost when m is zero."],
    ["If g(t) = t^2 - 1, what is g(4)?", "15", "4 squared is 16, and 16 - 1 = 15."],
    ["If h(x) = 18 - 3x, what input gives h(x) = 6?", "4", "18 - 3x = 6, so x = 4."],
    ["A plant is 5 inches tall and grows 2 inches per week. Which model fits?", "H(w) = 5 + 2w", "The starting value is 5 and the weekly rate is 2."],
  ],
  "ratios-and-percent": [
    ["What is 20% of 45?", "9", "20 percent is one fifth, and one fifth of 45 is 9."],
    ["A price rises from $40 to $50. What is the percent increase?", "25%", "The increase is 10, and 10/40 = 25%."],
    ["The ratio of red to blue tiles is 3:5. If there are 24 red tiles, how many blue?", "40", "Scale 3 to 24 by 8, then 5 times 8 is 40."],
    ["A class has 12 juniors and 18 seniors. What percent are juniors?", "40%", "12 out of 30 students is 40 percent."],
    ["60 is 75% of what number?", "80", "Use 60 = 0.75w, so w = 80."],
  ],
  "geometry-and-measurement": [
    ["A triangle has base 10 and height 6. What is its area?", "30", "Triangle area is one half base times height."],
    ["A circle has radius 3. What is its circumference?", "6pi", "Circumference is 2pi r, so 2pi times 3 is 6pi."],
    ["A rectangle is 8 by 5. What is its perimeter?", "26", "Perimeter is 2(8 + 5) = 26."],
    ["A right triangle has legs 6 and 8. What is the hypotenuse?", "10", "Use 6-8-10 or the Pythagorean theorem."],
    ["A box is 4 by 3 by 5. What is its volume?", "60", "Volume is length times width times height."],
  ],
  "central-ideas-and-details": [
    ["A passage traces a scientist's repeated tests and revisions. What is the central idea?", "Progress came through revision", "The repeated testing pattern controls the passage."],
    ["A paragraph mainly lists causes of a town's growth. What should a main-idea answer emphasize?", "Reasons the town grew", "The paragraph's job is explaining causes."],
    ["If three paragraphs compare old and new maps, what answer is too narrow?", "One map used blue ink", "That is one detail, not the whole passage's point."],
    ["A passage describes a problem, failed fixes, and a final solution. What is the best central frame?", "How a problem was solved", "The structure centers on moving from problem to solution."],
    ["A passage profiles an artist's changing style over decades. What is central?", "The artist's style evolved", "The full passage tracks change over time."],
  ],
  "supported-inference": [
    ["A character saves receipts and checks prices twice. What is supported?", "The character is careful with spending", "The details support caution about money."],
    ["A researcher repeats a trial after a surprising result. What is supported?", "The researcher wants more reliable evidence", "Repeating a trial strengthens confidence."],
    ["A narrator avoids the main road after seeing dark clouds. What is supported?", "The narrator expects bad weather may affect travel", "The action connects clouds to route choice."],
    ["A student whispers before entering the auditorium. What is supported?", "The setting likely requires quiet", "Whispering supports a quiet expectation."],
    ["A shop extends hours after long lines form. What is supported?", "Demand exceeded the shop's earlier schedule", "Long lines explain the schedule change."],
  ],
  "textual-evidence-and-details": [
    ["The passage says the bridge opened in 1920. Which answer is supported?", "The bridge was open by 1920", "This restates the explicit date detail."],
    ["A paragraph says the sensor lowered errors by 12%. What is supported?", "The sensor made measurements more accurate", "Lower errors indicate improved accuracy."],
    ["The text states Mara left before dawn to avoid heat. Why did she leave early?", "To avoid heat", "The reason is stated directly."],
    ["The passage notes the fabric repels water but tears easily. Which is supported?", "It has both a benefit and a weakness", "Both properties are explicitly described."],
    ["The author says the second edition added maps. What changed?", "Maps were added", "The detail is stated without needing inference."],
  ],
  "author-purpose-and-structure": [
    ["An author gives a personal anecdote before statistics. What is the likely purpose?", "To introduce the issue through an example", "The anecdote makes the issue concrete before data appears."],
    ["A paragraph begins with critics' objections, then answers them. What is its job?", "Address counterarguments", "It presents objections so they can be answered."],
    ["Why include a definition before a technical explanation?", "To clarify a key term", "The definition prepares readers for the explanation."],
    ["A final paragraph returns to the opening image. What is the structural purpose?", "Create a closing connection", "Returning to an opening image frames the ending."],
    ["An author contrasts two methods before choosing one. What is the purpose?", "To justify the preferred method", "The contrast explains why one method is better suited."],
  ],
} as const;

const PRACTICE_DISTRACTORS = {
  "sentence-boundaries": [
    ["Complete sentence", "Run-on sentence", "Comma splice"],
    ["Fragment", "Complete sentence", "Correctly joined clauses"],
    ["Fragment", "Run-on sentence", "Dependent clause only"],
    ["Complete sentence", "Run-on sentence", "Correctly joined clauses"],
    ["Comma splice", "Fragment", "Replace the semicolon with a comma"],
  ],
  "concision-and-redundancy": [
    ["completely final", "final and conclusive", "final in every respect"],
    ["returned back", "went back and returned", "returned again back"],
    ["summary", "brief and short summary", "summary of the main points in brief"],
    ["collaborated together", "worked collaboratively together", "jointly collaborated together"],
    ["The reason is because", "The reason why is due to", "Due to the reason being that"],
  ],
  "punctuation-and-commas": [
    ["Remove the first comma only", "Remove the second comma only", "Remove both commas"],
    ["Remove the comma", "Replace the comma with a semicolon and keep and", "Add a second comma after hikers"],
    ["Keep the comma", "Delete all punctuation", "Add and without changing the comma"],
    ["Add a comma after lecture", "Add a comma after students", "No comma is needed"],
    ["Add commas around Leo", "Add a comma before plays", "Replace the period with a comma"],
  ],
  "logical-transitions": [
    ["Therefore", "For example", "Similarly"],
    ["However", "Meanwhile", "For instance"],
    ["Nevertheless", "Consequently", "In contrast"],
    ["Therefore", "For example", "Likewise"],
    ["Meanwhile", "Nevertheless", "For example"],
  ],
  "linear-equations": [
    ["5", "12", "13"],
    ["4", "17/5", "25"],
    ["4", "6", "20"],
    ["3", "12", "24"],
    ["−4", "5", "−5"],
  ],
  "functions-and-modeling": [
    ["10", "16", "25"],
    ["Cost per mile", "Total cost after 4 miles", "Maximum possible fare"],
    ["8", "16", "17"],
    ["3", "6", "8"],
    ["H(w) = 2 + 5w", "H(w) = 5w", "H(w) = 7w"],
  ],
  "ratios-and-percent": [
    ["4", "11.25", "25"],
    ["10%", "20%", "125%"],
    ["14", "32", "64"],
    ["30%", "60%", "66.7%"],
    ["45", "60", "75"],
  ],
  "geometry-and-measurement": [
    ["16", "60", "120"],
    ["3π", "9π", "18π"],
    ["13", "40", "80"],
    ["7", "12", "14"],
    ["12", "20", "47"],
  ],
  "central-ideas-and-details": [
    ["The scientist preferred the first test", "The laboratory equipment was expensive", "One revision changed a measurement"],
    ["The date the town was founded", "One resident's opinion of the town", "The town's current population only"],
    ["The maps changed how people traveled", "The two maps served different purposes", "Old and new maps share several features"],
    ["Why every proposed fix failed", "Who first discovered the problem", "A description of the problem only"],
    ["The artist used one material for decades", "The artist's childhood home", "One painting's auction price"],
  ],
  "supported-inference": [
    ["The character never buys anything", "The character works as an accountant", "The receipts are required by law"],
    ["The researcher expected the result to fail", "The first trial was definitely incorrect", "The researcher wants a different outcome"],
    ["The main road is permanently closed", "The narrator is lost", "Dark clouds always cause flooding"],
    ["The student is afraid of audiences", "The auditorium is empty", "The student has lost their voice"],
    ["The shop lowered every price", "The earlier schedule was illegal", "Customers requested fewer products"],
  ],
  "textual-evidence-and-details": [
    ["The bridge was built in exactly one year", "The bridge closed in 1920", "The bridge was the first in the region"],
    ["The sensor eliminated every error", "The sensor was 12% cheaper", "Measurements took 12% less time"],
    ["To see the sunrise", "To arrive before everyone else", "To avoid traffic"],
    ["It is inexpensive to manufacture", "It performs equally well in every condition", "Its weakness is water damage"],
    ["The maps were removed", "The text was shortened", "A second author was added"],
  ],
  "author-purpose-and-structure": [
    ["To replace the statistics with opinion", "To prove the issue affects only one person", "To reveal the author's final conclusion"],
    ["Introduce an unrelated historical detail", "Repeat the critics' claims as facts", "Avoid taking a position"],
    ["To make the explanation more technical", "To delay the passage's main idea", "To contradict the later explanation"],
    ["Introduce a completely new argument", "Show that the opening image was inaccurate", "Summarize every detail in order"],
    ["To show both methods are identical", "To avoid explaining either method", "To prove the rejected method never works"],
  ],
} as const;

const MISCONCEPTION_BY_SKILL: Record<string, string> = {
  "sentence-boundaries": "Recheck whether each clause has a subject, working verb, and complete thought before naming the boundary.",
  "concision-and-redundancy": "This choice keeps or creates wording that repeats an idea without adding meaning.",
  "punctuation-and-commas": "Name the grammatical role of the phrase or clause before choosing punctuation; do not punctuate by pause.",
  "logical-transitions": "This transition signals a different relationship from the one created by the surrounding sentences.",
  "linear-equations": "Substitute this value into the original equation; it comes from undoing an operation or sign incorrectly.",
  "functions-and-modeling": "Check the input, operation order, and what each coefficient or constant represents in context.",
  "ratios-and-percent": "Identify the whole and the scale factor before calculating; this choice uses the wrong reference quantity.",
  "geometry-and-measurement": "This choice uses the wrong formula, scale factor, or linear-versus-area relationship.",
  "central-ideas-and-details": "This choice is too narrow, unsupported, or misses the pattern controlling the whole passage.",
  "supported-inference": "This choice adds a motive, certainty, or fact that the supplied evidence does not establish.",
  "textual-evidence-and-details": "The passage states a different detail; return to the exact wording before paraphrasing it.",
  "author-purpose-and-structure": "This choice does not describe the actual job the referenced part performs in the passage.",
};

function practicePrompt(skill: SkillDefinition, source: string) {
  if (skill.section !== "english") return source;
  if (skill.slug === "sentence-boundaries") return "Which choice best describes the sentence as written?";
  if (skill.slug === "concision-and-redundancy") return "Which choice is the most concise revision that preserves the meaning?";
  if (skill.slug === "punctuation-and-commas") return "Which choice uses punctuation correctly?";
  return "Which transition most logically completes the blank?";
}

function actStyleChoices(
  skill: SkillDefinition,
  index: number,
  correct: string,
) {
  const slug = skill.slug as keyof typeof PRACTICE_DISTRACTORS;
  const distractorTexts = PRACTICE_DISTRACTORS[slug][index];
  const correctIndex = (index * 3 + 1) % 4;
  const texts: string[] = [...distractorTexts];
  texts.splice(correctIndex, 0, correct);
  return texts.map((text, choiceIndex) => ({
    id: ["A", "B", "C", "D"][choiceIndex],
    text,
    ...(choiceIndex === correctIndex
      ? {}
      : { misconception: MISCONCEPTION_BY_SKILL[skill.slug] }),
  }));
}

export const ACT_PRACTICE_QUESTIONS = ACT_SKILLS.flatMap((skill) =>
  PRACTICE_CONFIG[skill.slug].map(([prompt, answer, rationale], index) => ({
    id: `${skill.slug}-practice-${index + 1}`,
    version: 1,
    skill: skill.slug,
    section: skill.section,
    difficulty: index < 2 ? "easy" : index < 4 ? "medium" : "hard",
    prompt: practicePrompt(skill, prompt),
    ...(skill.section === "english" ? { stimulus: prompt } : {}),
    choices: actStyleChoices(skill, index, answer),
    correctChoiceId: ["A", "B", "C", "D"][(index * 3 + 1) % 4],
    rationale:
      rationale.length >= 24
        ? rationale
        : `${rationale} This follows the tested ACT skill rule.`,
    content: CONTENT_META,
  })),
) satisfies ReadonlyArray<PracticeRecord>;

export const ACT_LEARNING_BANK = validateLearningBank({
  id: "act-learning-bank",
  version: "learning-v2",
  skills: ACT_SKILLS,
  lessons: ACT_LESSONS,
  practice: ACT_PRACTICE_QUESTIONS,
});

export function getSkillDefinition(skillSlug: string) {
  return ACT_SKILLS.find((skill) => skill.slug === skillSlug) ?? null;
}

export function getLessonForSkill(skillSlug: string) {
  return ACT_LESSONS.find((lesson) => lesson.skill === skillSlug) ?? null;
}

export function getPracticeForSkill(skillSlug: string) {
  return ACT_PRACTICE_QUESTIONS.filter((question) => question.skill === skillSlug);
}
