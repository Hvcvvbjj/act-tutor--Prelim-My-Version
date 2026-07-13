import type {
  CoreSection,
  DiagnosticDifficulty,
  DiagnosticQuestionSecure,
} from "@act-tutor/core";

import { validateRapidDiagnosticForm } from "./schema";

const REVIEW = {
  status: "published",
  license: "original",
  reviewer: "Scout ACT content review",
  reviewedAt: "2026-07-12",
} as const;

const BLUEPRINT = [
  {
    section: "english",
    officialQuestions: 50,
    officialScoredQuestions: 40,
    officialMinutes: 35,
    diagnosticQuestions: 25,
    diagnosticMinutes: 18,
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
    diagnosticQuestions: 23,
    diagnosticMinutes: 25,
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
    diagnosticQuestions: 18,
    diagnosticMinutes: 20,
    reportingCategories: [
      { label: "Key Ideas and Details", range: "44–52%" },
      { label: "Craft and Structure", range: "26–33%" },
      { label: "Integration of Knowledge and Ideas", range: "19–26%" },
    ],
  },
] as const;

interface ItemSpec {
  id: string;
  category: string;
  primarySkill: string;
  skillLabel: string;
  difficulty: DiagnosticDifficulty;
  prompt: string;
  choices: readonly [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
  rationale: string;
  lineReference?: string;
  expectedSeconds?: number;
}

interface PassageSpec {
  id: string;
  title: string;
  text: string;
}

const IDS = ["a", "b", "c", "d"] as const;

function makeQuestion(
  section: CoreSection,
  item: ItemSpec,
  passage?: PassageSpec,
): DiagnosticQuestionSecure {
  return {
    id: item.id,
    version: 2,
    section,
    category: item.category,
    primarySkill: item.primarySkill,
    skillLabel: item.skillLabel,
    difficulty: item.difficulty,
    prompt: item.prompt,
    ...(passage ? { stimulus: passage.text } : {}),
    choices: item.choices.map((text, index) => ({ id: IDS[index], text })),
    expectedSeconds: item.expectedSeconds ?? (section === "math" ? 70 : 45),
    format: passage ? "passage" : "standalone",
    ...(passage
      ? {
          passageId: passage.id,
          passageTitle: passage.title,
          ...(item.lineReference ? { lineReference: item.lineReference } : {}),
        }
      : {}),
    correctChoiceId: IDS[item.correct],
    rationale: item.rationale,
    content: REVIEW,
  };
}

function passageSet(section: CoreSection, passage: PassageSpec, items: ItemSpec[]) {
  return items.map((item) => makeQuestion(section, item, passage));
}

const englishPassages: PassageSpec[] = [
  {
    id: "eng-rooftop-garden",
    title: "A Garden Above the Gym",
    text:
      "[1] At first, the flat roof above the school gym seemed useful only to pigeons. [2] Then environmental science teacher Marisol Vega proposed a small garden there, the principal was skeptical. [3] The roof, which had recently been reinforced could hold the added weight. [4] Students began by carrying up shallow planters, soil, and seedlings. [5] Because summer temperatures on the roof climbed quickly. [6] The class installed a drip-irrigation line and spread pale mulch over the soil. [7] These two changes reduced evaporation; as a result, the herbs survived the hottest weeks. [8] By September, the garden supplied basil and mint to the culinary arts class. [9] It also gave science students a place to measure how shade, wind, and soil depth affected plant growth.",
  },
  {
    id: "eng-night-bus",
    title: "Mapping the Night Bus",
    text:
      "[1] On winter evenings, graphic-design student Imani Cole waited for a bus that sometimes appeared early and sometimes not at all. [2] Rather than simply complain, she began recording each arrival in a small notebook. [3] After three weeks of collecting data Imani transferred the times to a digital map. [4] The map revealed that delays clustered near two busy intersections. [5] Imani shared her findings with the transit office, they asked her to continue the project. [6] She then invited other riders to submit observations through a simple form. [7] The expanded data did not eliminate delays; however, it helped dispatchers adjust the published schedule. [8] The project was completely unanimous among every rider who saw it. [9] Most important, the map made an unpredictable wait easier to plan around.",
  },
  {
    id: "eng-clay-whistles",
    title: "Reconstructing a Clay Whistle",
    text:
      "[1] Archaeologist Jun Park studied a palm-size clay object recovered near an ancient footpath. [2] The object had one opening at the top and two smaller holes along its side. [3] Park suspected it might be a whistle, but the original was too fragile to test. [4] Working from precise measurements, a ceramic artist created three replicas. [5] Each replica differed slightly in the angle of its internal chamber. [6] When air was blown across the replicas openings, only one produced a clear tone. [7] That result did not prove exactly how the object had been used. [8] Nevertheless it supported Park's claim that sound production was possible. [9] The experiment demonstrated the reason why replicas can help researchers test ideas while protecting delicate artifacts.",
  },
  {
    id: "eng-stream-library",
    title: "A Library of Stream Sounds",
    text:
      "[1] Biologist Elena Ruiz records streams, not songs. [2] At each site, she lowers a waterproof microphone into the current for exactly ten minutes. [3] The recordings capture insect clicks, fish movement, rainfall, and the low rumble of stones shifting underwater. [4] Ruiz labels every file with its location date and water temperature. [5] Over time, her audio library has revealed seasonal patterns that are difficult to observe during a single visit. [6] For example, one insect species becomes audible several days before it appears in standard net samples. [7] The recordings are not a replacement for field measurements they are another source of evidence. [8] Ruiz plans to make the collection publicly accessible, allowing students to compare waterways from different regions. [9] In this way, listeners can hear an ecosystem changing before the change becomes visible.",
  },
  {
    id: "eng-repair-cafe",
    title: "The Saturday Repair Table",
    text:
      "[1] Every second Saturday, the back room of the neighborhood library becomes a repair café. [2] Residents bring lamps, clocks, and small appliances that would otherwise be discarded. [3] Volunteers do not promise that every object can be fixed, instead they explain each diagnosis as they work. [4] A teenager who arrived with a silent desk fan learned to test its switch and replace a damaged wire. [5] The fan began spinning again. [6] More importantly, the teenager left understanding why it had stopped. [7] The café's goal is not merely just to save broken objects. [8] It also makes repair knowledge less mysterious and gives neighbors a reason to exchange skills. [9] Since opening last year the café has hosted forty sessions and diverted hundreds of items from the landfill.",
  },
];

const E = {
  boundaries: ["sentence-boundaries", "Sentence boundaries"] as const,
  concision: ["concision-and-redundancy", "Concision and redundancy"] as const,
  punctuation: ["punctuation-and-commas", "Punctuation and commas"] as const,
  transitions: ["logical-transitions", "Logical transitions"] as const,
};

const englishItems: ItemSpec[][] = [
  [
    { id: "eng-roof-1", category: "Conventions of Standard English", primarySkill: E.boundaries[0], skillLabel: E.boundaries[1], difficulty: "hard", lineReference: "Sentence 2", prompt: "Which revision of sentence 2 correctly joins its clauses?", choices: ["Then environmental science teacher Marisol Vega proposed a small garden there, the principal was skeptical.", "Then environmental science teacher Marisol Vega proposed a small garden there; the principal was skeptical.", "Then environmental science teacher Marisol Vega proposed a small garden there the principal, was skeptical.", "Then environmental science teacher Marisol Vega proposed a small garden there, being skeptical was the principal."], correct: 1, rationale: "Both sides are independent clauses, so a semicolon correctly joins them without a coordinating conjunction." },
    { id: "eng-roof-2", category: "Conventions of Standard English", primarySkill: E.punctuation[0], skillLabel: E.punctuation[1], difficulty: "medium", lineReference: "Sentence 3", prompt: "Which revision of sentence 3 uses punctuation correctly?", choices: ["The roof which had recently been reinforced, could hold the added weight.", "The roof, which had recently been reinforced, could hold the added weight.", "The roof which had recently, been reinforced could hold the added weight.", "The roof, which had recently been reinforced could hold, the added weight."], correct: 1, rationale: "The nonessential clause can be removed and therefore needs a comma on both sides." },
    { id: "eng-roof-3", category: "Conventions of Standard English", primarySkill: E.boundaries[0], skillLabel: E.boundaries[1], difficulty: "medium", lineReference: "Sentences 5–6", prompt: "Which choice most effectively combines sentences 5 and 6?", choices: ["Because summer temperatures on the roof climbed quickly, the class installed a drip-irrigation line and spread pale mulch over the soil.", "Because summer temperatures on the roof climbed quickly. The class installed a drip-irrigation line and spread pale mulch over the soil.", "Summer temperatures on the roof climbed quickly, the class installed a drip-irrigation line and spread pale mulch.", "Climbing quickly, the class installed a drip-irrigation line because of summer temperatures."], correct: 0, rationale: "The dependent because-clause must attach to the complete main clause with a comma." },
    { id: "eng-roof-4", category: "Production of Writing", primarySkill: E.transitions[0], skillLabel: E.transitions[1], difficulty: "medium", lineReference: "Sentence 8", prompt: "Which transition, if added to the beginning of sentence 8, best shows the result of the earlier changes?", choices: ["On the other hand,", "For instance,", "Ultimately,", "Similarly,"], correct: 2, rationale: "Sentence 8 presents the eventual result of the class's work, so Ultimately best fits the relationship." },
    { id: "eng-roof-5", category: "Production of Writing", primarySkill: E.concision[0], skillLabel: E.concision[1], difficulty: "hard", lineReference: "Paragraph as a whole", prompt: "The writer wants to emphasize that the garden supports more than one school subject. Which sentence is most essential to that goal?", choices: ["Sentence 1", "Sentence 4", "Sentence 8", "Sentence 9"], correct: 3, rationale: "Sentence 9 directly describes the science investigations, while sentence 8 already establishes the culinary use." },
  ],
  [
    { id: "eng-bus-1", category: "Conventions of Standard English", primarySkill: E.punctuation[0], skillLabel: E.punctuation[1], difficulty: "medium", lineReference: "Sentence 3", prompt: "Where should a comma be added in sentence 3?", choices: ["After three weeks, of collecting data Imani transferred the times to a digital map.", "After three weeks of collecting data, Imani transferred the times to a digital map.", "After three weeks of collecting, data Imani transferred the times to a digital map.", "No comma is needed."], correct: 1, rationale: "The comma marks the end of the introductory prepositional phrase before the independent clause." },
    { id: "eng-bus-2", category: "Conventions of Standard English", primarySkill: E.boundaries[0], skillLabel: E.boundaries[1], difficulty: "hard", lineReference: "Sentence 5", prompt: "Which revision of sentence 5 is grammatically correct?", choices: ["Imani shared her findings with the transit office, they asked her to continue the project.", "Imani shared her findings with the transit office; and they asked her to continue the project.", "Imani shared her findings with the transit office, and they asked her to continue the project.", "Sharing her findings with the transit office, they asked Imani to continue the project."], correct: 2, rationale: "Comma plus the coordinating conjunction and correctly joins the two independent clauses." },
    { id: "eng-bus-3", category: "Knowledge of Language", primarySkill: E.transitions[0], skillLabel: E.transitions[1], difficulty: "medium", lineReference: "Sentence 7", prompt: "Which choice best preserves the logical relationship in sentence 7?", choices: ["NO CHANGE", "for example,", "therefore,", "likewise,"], correct: 0, rationale: "However correctly signals that the data helped even though it did not eliminate the delays." },
    { id: "eng-bus-4", category: "Knowledge of Language", primarySkill: E.concision[0], skillLabel: E.concision[1], difficulty: "easy", lineReference: "Sentence 8", prompt: "Which revision of sentence 8 is most concise without changing its intended meaning?", choices: ["Every rider was unanimous in complete agreement about the project.", "All riders who saw the project were unanimously in agreement.", "Riders who saw the project unanimously agreed about it.", "The project was completely unanimous among every rider who saw it."], correct: 2, rationale: "Unanimously already means complete agreement, so the direct verb form removes redundant wording." },
    { id: "eng-bus-5", category: "Production of Writing", primarySkill: E.transitions[0], skillLabel: E.transitions[1], difficulty: "hard", lineReference: "Sentence 9", prompt: "Which choice would best introduce sentence 9 while emphasizing the project's practical value to riders?", choices: ["To riders,", "In contrast,", "For that reason,", "Meanwhile,"], correct: 0, rationale: "To riders directly establishes the perspective from which easier planning matters." },
  ],
  [
    { id: "eng-clay-1", category: "Production of Writing", primarySkill: E.concision[0], skillLabel: E.concision[1], difficulty: "medium", lineReference: "Sentence 1", prompt: "Which choice most effectively describes the object without unnecessary wording?", choices: ["a small object that was palm-size in its dimensions", "a palm-size clay object", "an object made of clay that was small-sized", "a clay object of a size that fit into a palm"], correct: 1, rationale: "Palm-size clay object conveys material and scale directly without repeating the idea of size." },
    { id: "eng-clay-2", category: "Conventions of Standard English", primarySkill: E.punctuation[0], skillLabel: E.punctuation[1], difficulty: "hard", lineReference: "Sentence 6", prompt: "Which revision correctly shows possession in sentence 6?", choices: ["across the replicas openings", "across the replica's openings", "across the replicas' openings", "across the replicas's openings"], correct: 2, rationale: "The openings belong to multiple replicas, so the plural possessive replicas' is required." },
    { id: "eng-clay-3", category: "Knowledge of Language", primarySkill: E.transitions[0], skillLabel: E.transitions[1], difficulty: "medium", lineReference: "Sentence 8", prompt: "Which punctuation should follow Nevertheless in sentence 8?", choices: ["no punctuation", "a comma", "a semicolon", "a colon"], correct: 1, rationale: "An introductory conjunctive adverb is followed by a comma when it begins the sentence." },
    { id: "eng-clay-4", category: "Knowledge of Language", primarySkill: E.concision[0], skillLabel: E.concision[1], difficulty: "medium", lineReference: "Sentence 9", prompt: "Which revision removes redundancy from sentence 9?", choices: ["The experiment demonstrated why replicas can help researchers test ideas while protecting delicate artifacts.", "The experiment demonstrated the reason as to why replicas can help researchers test ideas.", "The reason demonstrated by the experiment is why replicas can help researchers with testing ideas.", "The experiment was a demonstration of the reason why replicas are helpful for researchers."], correct: 0, rationale: "Demonstrated why states the relationship directly; demonstrated the reason why repeats the same logical job." },
    { id: "eng-clay-5", category: "Production of Writing", primarySkill: E.boundaries[0], skillLabel: E.boundaries[1], difficulty: "hard", lineReference: "Sentences 7–8", prompt: "Which choice most effectively combines sentences 7 and 8?", choices: ["That result did not prove exactly how the object had been used, nevertheless, it supported Park's claim.", "Although that result did not prove exactly how the object had been used, it supported Park's claim that sound production was possible.", "That result not proving exactly how the object had been used; supported Park's claim.", "Despite the result, it did not prove the use, and nevertheless supporting Park's claim."], correct: 1, rationale: "Although clearly expresses concession while attaching the dependent clause to a complete main clause." },
  ],
  [
    { id: "eng-stream-1", category: "Conventions of Standard English", primarySkill: E.punctuation[0], skillLabel: E.punctuation[1], difficulty: "medium", lineReference: "Sentence 4", prompt: "Which revision of sentence 4 uses commas correctly?", choices: ["Ruiz labels every file with its location, date, and water temperature.", "Ruiz labels every file with, its location date and water temperature.", "Ruiz labels every file with its location date, and water temperature.", "Ruiz labels every file, with its location, date and water temperature."], correct: 0, rationale: "The three label fields form a series and should be separated consistently with commas." },
    { id: "eng-stream-2", category: "Production of Writing", primarySkill: E.transitions[0], skillLabel: E.transitions[1], difficulty: "medium", lineReference: "Sentence 6", prompt: "The phrase For example primarily serves to:", choices: ["contrast the audio library with net samples", "introduce one instance of the seasonal patterns", "show the final result of Ruiz's work", "signal that sentence 6 restates sentence 5"], correct: 1, rationale: "Sentence 6 supplies a specific example of the broader seasonal patterns described in sentence 5." },
    { id: "eng-stream-3", category: "Conventions of Standard English", primarySkill: E.boundaries[0], skillLabel: E.boundaries[1], difficulty: "hard", lineReference: "Sentence 7", prompt: "Which revision of sentence 7 correctly separates its two complete thoughts?", choices: ["The recordings are not a replacement for field measurements, they are another source of evidence.", "The recordings are not a replacement for field measurements; they are another source of evidence.", "The recordings are not a replacement for field measurements being another source of evidence.", "The recordings not replacing field measurements, another source of evidence."], correct: 1, rationale: "A semicolon correctly joins the two closely related independent clauses." },
    { id: "eng-stream-4", category: "Production of Writing", primarySkill: E.concision[0], skillLabel: E.concision[1], difficulty: "hard", lineReference: "Sentence 8", prompt: "Which revision most directly explains the benefit of public access?", choices: ["Ruiz plans to make the collection publicly accessible, in terms of the public being able to access it.", "Ruiz plans future public accessibility for the collection of files.", "Ruiz plans to publish the collection so students can compare waterways from different regions.", "For accessibility that is public, Ruiz has plans involving the collection."], correct: 2, rationale: "The revision uses a direct verb and states the concrete student benefit without nominalizations or repetition." },
    { id: "eng-stream-5", category: "Production of Writing", primarySkill: E.transitions[0], skillLabel: E.transitions[1], difficulty: "hard", lineReference: "Sentence 9", prompt: "Should sentence 9 be kept or deleted?", choices: ["Kept, because it synthesizes the value of sound as an early signal of ecosystem change.", "Kept, because it introduces a new method Ruiz has not used.", "Deleted, because it repeats the exact wording of sentence 1.", "Deleted, because conclusions should never use figurative language."], correct: 0, rationale: "The final sentence ties the sound library to its broader scientific value and provides an effective conclusion." },
  ],
  [
    { id: "eng-repair-1", category: "Conventions of Standard English", primarySkill: E.boundaries[0], skillLabel: E.boundaries[1], difficulty: "hard", lineReference: "Sentence 3", prompt: "Which revision of sentence 3 is grammatically correct?", choices: ["Volunteers do not promise that every object can be fixed, instead they explain each diagnosis.", "Volunteers do not promise that every object can be fixed; instead, they explain each diagnosis as they work.", "Volunteers do not promise that every object can be fixed instead, explaining each diagnosis.", "Volunteers do not promise, that every object can be fixed; instead they explain each diagnosis."], correct: 1, rationale: "The semicolon separates independent clauses, and commas correctly set off the introductory adverb instead." },
    { id: "eng-repair-2", category: "Production of Writing", primarySkill: E.concision[0], skillLabel: E.concision[1], difficulty: "easy", lineReference: "Sentence 7", prompt: "Which revision of sentence 7 is most concise?", choices: ["The café's goal is not merely to save broken objects.", "The café's goal is not merely just to save broken objects.", "The goal that the café has is not only merely to save objects that are broken.", "Saving broken objects is not merely just the only goal of the café."], correct: 0, rationale: "Merely and just duplicate each other, so one should be removed." },
    { id: "eng-repair-3", category: "Knowledge of Language", primarySkill: E.transitions[0], skillLabel: E.transitions[1], difficulty: "medium", lineReference: "Sentence 8", prompt: "Which transition best begins sentence 8?", choices: ["Instead,", "For example,", "Likewise,", "Therefore,"], correct: 0, rationale: "Instead contrasts the broader educational goal with the narrower goal of saving objects." },
    { id: "eng-repair-4", category: "Conventions of Standard English", primarySkill: E.punctuation[0], skillLabel: E.punctuation[1], difficulty: "medium", lineReference: "Sentence 9", prompt: "Where should a comma be added in sentence 9?", choices: ["Since opening, last year the café has hosted forty sessions", "Since opening last year, the café has hosted forty sessions", "Since opening last year the café, has hosted forty sessions", "No comma is needed"], correct: 1, rationale: "The comma marks the end of the introductory phrase before the main clause." },
    { id: "eng-repair-5", category: "Production of Writing", primarySkill: E.boundaries[0], skillLabel: E.boundaries[1], difficulty: "medium", lineReference: "Sentences 5–6", prompt: "Which choice most effectively combines sentences 5 and 6?", choices: ["The fan began spinning again, more importantly, the teenager left understanding why it had stopped.", "The fan began spinning again; more importantly, the teenager left understanding why it had stopped.", "The fan beginning to spin again, and more importantly the teenager understanding why.", "More importantly the fan began spinning again and the teenager left."], correct: 1, rationale: "A semicolon joins the two complete sentences, and a comma follows the transitional phrase more importantly." },
  ],
];

const englishQuestions = englishPassages.flatMap((passage, index) =>
  passageSet("english", passage, englishItems[index]),
);

const M = {
  linear: ["linear-equations", "Linear equations"] as const,
  functions: ["functions-and-modeling", "Functions and modeling"] as const,
  ratios: ["ratios-and-percent", "Ratios and percent"] as const,
  geometry: ["geometry-and-measurement", "Geometry and measurement"] as const,
};

const mathItems: ItemSpec[] = [
  { id: "math-01", category: "Preparing for Higher Math", primarySkill: M.linear[0], skillLabel: M.linear[1], difficulty: "medium", prompt: "What value of x satisfies 5(2x − 3) = 4x + 21?", choices: ["3", "4", "5", "6"], correct: 3, rationale: "Expanding gives 10x − 15 = 4x + 21. Subtract 4x and add 15 to get 6x = 36, so x = 6." },
  { id: "math-02", category: "Preparing for Higher Math", primarySkill: M.functions[0], skillLabel: M.functions[1], difficulty: "medium", prompt: "For f(x) = x² − 4x + 7, what is f(−2)?", choices: ["3", "7", "15", "19"], correct: 3, rationale: "Substitute −2: 4 + 8 + 7 = 19." },
  { id: "math-03", category: "Integrating Essential Skills", primarySkill: M.ratios[0], skillLabel: M.ratios[1], difficulty: "medium", prompt: "A solution contains water and concentrate in a ratio of 7:3. How many ounces of concentrate are in 40 ounces of solution?", choices: ["9", "12", "21", "28"], correct: 1, rationale: "Concentrate is 3 of 10 total parts, so (3/10)(40) = 12 ounces." },
  { id: "math-04", category: "Preparing for Higher Math", primarySkill: M.geometry[0], skillLabel: M.geometry[1], difficulty: "medium", prompt: "A right triangle has legs of length 9 and 12. What is its area, in square units?", choices: ["42", "54", "90", "108"], correct: 1, rationale: "Area is one-half the product of the legs: (1/2)(9)(12) = 54." },
  { id: "math-05", category: "Preparing for Higher Math", primarySkill: M.linear[0], skillLabel: M.linear[1], difficulty: "hard", prompt: "For what value of k does the system y = 3x + 2 and y = kx − 4 have no solution?", choices: ["−3", "0", "2", "3"], correct: 3, rationale: "Distinct parallel lines have equal slopes and different intercepts. Therefore k must equal 3." },
  { id: "math-06", category: "Preparing for Higher Math", primarySkill: M.functions[0], skillLabel: M.functions[1], difficulty: "hard", prompt: "The graph of y = f(x) is shifted 4 units left and 2 units down. Which equation represents the transformed graph?", choices: ["y = f(x − 4) + 2", "y = f(x + 4) − 2", "y = f(x − 2) + 4", "y = f(x + 2) − 4"], correct: 1, rationale: "A left shift replaces x with x + 4, and a downward shift subtracts 2 outside the function." },
  { id: "math-07", category: "Integrating Essential Skills", primarySkill: M.ratios[0], skillLabel: M.ratios[1], difficulty: "hard", prompt: "A price is increased by 20% and then decreased by 20%. The final price is what percent of the original price?", choices: ["80%", "96%", "100%", "104%"], correct: 1, rationale: "Multiplying by 1.20 and then 0.80 gives 0.96 of the original price." },
  { id: "math-08", category: "Preparing for Higher Math", primarySkill: M.geometry[0], skillLabel: M.geometry[1], difficulty: "hard", prompt: "A circle has equation (x − 2)² + (y + 5)² = 49. What is the circle's diameter?", choices: ["7", "14", "49", "98"], correct: 1, rationale: "The radius squared is 49, so the radius is 7 and the diameter is 14." },
  { id: "math-09", category: "Preparing for Higher Math", primarySkill: M.linear[0], skillLabel: M.linear[1], difficulty: "medium", prompt: "Which inequality is equivalent to −3(2x − 5) > 9?", choices: ["x < 1", "x > 1", "x < 4", "x > 4"], correct: 0, rationale: "Expanding gives −6x + 15 > 9, so −6x > −6. Dividing by −6 reverses the sign: x < 1." },
  { id: "math-10", category: "Preparing for Higher Math", primarySkill: M.functions[0], skillLabel: M.functions[1], difficulty: "medium", prompt: "A linear function g has g(2) = 11 and g(6) = 27. What is g(0)?", choices: ["1", "3", "4", "7"], correct: 1, rationale: "The slope is (27−11)/(6−2)=4. Since 11=4(2)+b, b=3, so g(0)=3." },
  { id: "math-11", category: "Integrating Essential Skills", primarySkill: M.ratios[0], skillLabel: M.ratios[1], difficulty: "medium", prompt: "A car travels 168 miles in 3.5 hours at a constant rate. At that rate, how many miles does it travel in 5 hours?", choices: ["210", "224", "240", "252"], correct: 2, rationale: "The rate is 168 ÷ 3.5 = 48 miles per hour. In 5 hours it travels 240 miles." },
  { id: "math-12", category: "Preparing for Higher Math", primarySkill: M.geometry[0], skillLabel: M.geometry[1], difficulty: "medium", prompt: "Two similar rectangles have corresponding side lengths 6 and 15. If the smaller rectangle's area is 48, what is the larger rectangle's area?", choices: ["120", "240", "300", "750"], correct: 2, rationale: "The linear scale factor is 15/6 = 2.5, so the area scale factor is 2.5² = 6.25. Then 48(6.25)=300." },
  { id: "math-13", category: "Preparing for Higher Math", primarySkill: M.linear[0], skillLabel: M.linear[1], difficulty: "hard", prompt: "If |2x − 7| = 9, what is the sum of all possible values of x?", choices: ["−7", "2", "7", "9"], correct: 2, rationale: "The two equations give x=8 and x=−1. Their sum is 7." },
  { id: "math-14", category: "Preparing for Higher Math", primarySkill: M.functions[0], skillLabel: M.functions[1], difficulty: "hard", prompt: "If h(x) = 2ˣ and h(a + 2) = 32, what is a?", choices: ["2", "3", "4", "5"], correct: 1, rationale: "Since 32 = 2⁵, a + 2 = 5 and a = 3." },
  { id: "math-15", category: "Integrating Essential Skills", primarySkill: M.ratios[0], skillLabel: M.ratios[1], difficulty: "medium", prompt: "The mean of five numbers is 18. Four of the numbers are 12, 17, 21, and 25. What is the fifth number?", choices: ["15", "18", "22", "25"], correct: 0, rationale: "The total must be 5(18)=90. The four known numbers total 75, leaving 15." },
  { id: "math-16", category: "Preparing for Higher Math", primarySkill: M.geometry[0], skillLabel: M.geometry[1], difficulty: "hard", prompt: "In a right triangle, sin θ = 5/13. What is cos θ?", choices: ["5/12", "5/13", "12/13", "13/12"], correct: 2, rationale: "A 5-12-13 right triangle has adjacent side 12 when the opposite side is 5, so cos θ = 12/13." },
  { id: "math-17", category: "Preparing for Higher Math", primarySkill: M.linear[0], skillLabel: M.linear[1], difficulty: "medium", prompt: "The line 4x + 2y = 12 is perpendicular to which line?", choices: ["y = 2x + 1", "y = −2x + 1", "y = (1/2)x + 1", "y = −(1/2)x + 1"], correct: 2, rationale: "The given line has slope −2. A perpendicular line has slope 1/2." },
  { id: "math-18", category: "Preparing for Higher Math", primarySkill: M.functions[0], skillLabel: M.functions[1], difficulty: "hard", prompt: "The zeros of p(x) = x² − 9x + 20 are:", choices: ["−5 and −4", "−5 and 4", "4 and 5", "5 and 9"], correct: 2, rationale: "The polynomial factors as (x−4)(x−5), so its zeros are 4 and 5." },
  { id: "math-19", category: "Integrating Essential Skills", primarySkill: M.ratios[0], skillLabel: M.ratios[1], difficulty: "hard", prompt: "A data set has median 14. If every value in the set is multiplied by 1.5 and then 2 is added, what is the new median?", choices: ["17", "21", "23", "24"], correct: 2, rationale: "A positive linear transformation changes the median the same way: 1.5(14)+2=23." },
  { id: "math-20", category: "Preparing for Higher Math", primarySkill: M.geometry[0], skillLabel: M.geometry[1], difficulty: "medium", prompt: "A rectangular prism has dimensions 3, 4, and 8. What is its surface area?", choices: ["48", "72", "96", "136"], correct: 3, rationale: "Surface area is 2(3·4 + 3·8 + 4·8)=2(12+24+32)=136." },
  { id: "math-21", category: "Preparing for Higher Math", primarySkill: M.linear[0], skillLabel: M.linear[1], difficulty: "hard", prompt: "A theater sells adult tickets for $14 and student tickets for $9. It sells 120 tickets for $1,350. How many student tickets were sold?", choices: ["54", "60", "66", "72"], correct: 2, rationale: "Let s be student tickets: 9s + 14(120−s)=1350. Solving gives −5s=−330, so s=66." },
  { id: "math-22", category: "Preparing for Higher Math", primarySkill: M.functions[0], skillLabel: M.functions[1], difficulty: "medium", prompt: "Which expression gives the inverse of f(x) = (x − 4)/3?", choices: ["f⁻¹(x) = 3x + 4", "f⁻¹(x) = 3x − 4", "f⁻¹(x) = (x + 4)/3", "f⁻¹(x) = 1/(3x − 4)"], correct: 0, rationale: "Swap x and y and solve: x=(y−4)/3 gives y=3x+4." },
  { id: "math-23", category: "Preparing for Higher Math", primarySkill: M.ratios[0], skillLabel: M.ratios[1], difficulty: "hard", prompt: "A bag contains 4 red, 5 blue, and 3 green tiles. Two tiles are drawn without replacement. What is the probability both are blue?", choices: ["5/33", "5/22", "25/144", "10/33"], correct: 0, rationale: "The probability is (5/12)(4/11)=20/132=5/33." },
];

const mathQuestions = mathItems.map((item) => makeQuestion("math", item));

const readingPassages: PassageSpec[] = [
  {
    id: "read-watchmaker",
    title: "The Watchmaker's Drawer",
    text:
      "When Leena inherited her grandfather's workbench, she expected the obvious tools: magnifying lenses, narrow screwdrivers, tweezers fine enough to lift a grain of rice. What surprised her was the shallow bottom drawer. It held dozens of watch parts that appeared useless—clouded faces, bent hands, springs no wider than thread. Each rested in a paper envelope marked only with a date. Leena nearly emptied the drawer into a recycling bin. Instead, she opened one envelope and found a note on the back: 'Running fast in cold weather.' Another read, 'Stops when carried uphill.' The drawer was not a collection of spare parts. It was a record of failures. Her grandfather had kept the damaged pieces because each preserved a problem that a polished repair would hide. Over the next month, Leena arranged the envelopes by symptom and compared them with his repair logs. Patterns emerged. Several watches that lost time in winter used the same thin lubricant; watches damaged on steep hikes often had loose balance springs. The discarded parts became an index to decisions her grandfather had made years earlier. Leena still could not ask him why he had chosen one repair over another. Yet by studying what he refused to throw away, she began to hear an answer in the evidence he had left behind.",
  },
  {
    id: "read-cooling-city",
    title: "Measuring Shade Block by Block",
    text:
      "Cities often estimate summer heat using satellite images, which reveal broad patterns across roofs, roads, and parks. Those images are useful, but they can miss the temperature differences a pedestrian experiences within a single block. To capture that smaller scale, a research team in Mesa Verde equipped bicycles with temperature and humidity sensors. Volunteers rode assigned routes at the same times on cloudless afternoons. The resulting maps showed sharp changes: a shaded sidewalk could be several degrees cooler than an exposed crossing less than fifty meters away. The team then compared these measurements with tree-canopy maps and building heights. Mature trees generally produced the largest cooling effect, but narrow streets shaded by buildings also stayed relatively cool. Importantly, the researchers did not treat every cool location as proof that a tree should be planted there. Underground utilities, water access, and pedestrian traffic affect whether a planting is practical. Instead, the block-level data helped planners identify places where shade was both needed and feasible. Satellite images still supplied the regional view; bicycle measurements supplied the street-level detail. Used together, the methods turned a general statement—some neighborhoods are hotter—into a set of specific design decisions.",
  },
  {
    id: "read-two-translators",
    title: "Two Translators on Keeping a Poem's Voice",
    text:
      "Translator A: When I translate a poem, I begin with its movement. I read it aloud until I can feel where the language accelerates, hesitates, or turns. A literal version may preserve dictionary meanings while losing the experience of the original. If a line in the source language arrives like a sudden knock, I want the English line to interrupt the reader in a similar way—even if that requires changing word order. Fidelity, to me, includes the reader's physical encounter with the poem.\n\nTranslator B: I also read aloud, but I begin by mapping the poem's repeated images and key terms. A surprising word should not become ordinary merely because an ordinary word sounds smoother in English. Repetition may feel awkward, yet that awkwardness can be deliberate. I am willing to alter syntax, but I resist replacing a concrete image with a general feeling. The translated poem should not imitate English habits so comfortably that the original poem's strangeness disappears.\n\nBoth translators reject word-for-word substitution as a complete method. Their disagreement is one of emphasis. Translator A is most willing to reshape the sentence to recreate pace and impact. Translator B places a firmer boundary around recurring words and images. Each treats form as part of meaning; each simply listens for a different part of the form first.",
  },
];

const R = {
  central: ["central-ideas-and-details", "Central ideas and details"] as const,
  inference: ["supported-inference", "Supported inference"] as const,
  evidence: ["textual-evidence-and-details", "Textual evidence and details"] as const,
  purpose: ["author-purpose-and-structure", "Author purpose and structure"] as const,
};

const readingItems: ItemSpec[][] = [
  [
    { id: "read-watch-1", category: "Key Ideas and Details", primarySkill: R.central[0], skillLabel: R.central[1], difficulty: "medium", prompt: "Which statement best expresses the central idea of the passage?", choices: ["Leena learns that damaged watch parts preserve evidence about her grandfather's repair decisions.", "Leena discovers that old watches are more valuable than modern watches.", "Leena decides to become a professional watchmaker after finding expensive tools.", "Leena proves that her grandfather used the wrong lubricant in every repair."], correct: 0, rationale: "The passage centers on Leena recognizing the drawer as a record of problems and decisions rather than useless parts." },
    { id: "read-watch-2", category: "Key Ideas and Details", primarySkill: R.evidence[0], skillLabel: R.evidence[1], difficulty: "medium", prompt: "Which detail first causes Leena to reconsider discarding the contents of the drawer?", choices: ["The presence of magnifying lenses", "The dates written on the envelopes", "A note describing a watch running fast in cold weather", "The discovery of loose balance springs"], correct: 2, rationale: "Leena changes course immediately after opening an envelope and reading the symptom written on it." },
    { id: "read-watch-3", category: "Key Ideas and Details", primarySkill: R.inference[0], skillLabel: R.inference[1], difficulty: "hard", prompt: "It can reasonably be inferred that Leena's grandfather kept the damaged parts primarily because they:", choices: ["might eventually become valuable collectibles", "could document the causes of recurring watch problems", "were too small to dispose of safely", "belonged to customers who might return for them"], correct: 1, rationale: "The symptom notes, repair logs, and patterns show that the parts functioned as a record of recurring problems." },
    { id: "read-watch-4", category: "Craft and Structure", primarySkill: R.purpose[0], skillLabel: R.purpose[1], difficulty: "hard", prompt: "The final sentence primarily serves to:", choices: ["claim that Leena can literally hear her grandfather speaking", "shift the passage from evidence-based discovery to unsupported fantasy", "emphasize that material evidence allows Leena to understand decisions he can no longer explain", "show that Leena has completed every repair in the logs"], correct: 2, rationale: "The figurative phrasing connects Leena's emotional loss with the concrete evidence she studies." },
    { id: "read-watch-5", category: "Craft and Structure", primarySkill: R.central[0], skillLabel: R.central[1], difficulty: "medium", prompt: "As used in the passage, the phrase “an index to decisions” most nearly means:", choices: ["a price list for replacement parts", "an organized guide to earlier choices", "a measurement of mechanical speed", "a legal record of customer ownership"], correct: 1, rationale: "The arranged parts help Leena trace and understand choices recorded in the repair logs." },
    { id: "read-watch-6", category: "Integration of Knowledge and Ideas", primarySkill: R.inference[0], skillLabel: R.inference[1], difficulty: "hard", prompt: "Which new finding would most strongly support the passage's interpretation of the drawer?", choices: ["Several envelopes contain parts that match problems described in dated repair logs.", "The workbench is made from a rare type of wood.", "Leena's grandfather owned watches from many countries.", "A recycling center accepts small metal springs."], correct: 0, rationale: "Matching parts to documented symptoms directly supports the claim that the drawer preserved repair evidence." },
  ],
  [
    { id: "read-city-1", category: "Key Ideas and Details", primarySkill: R.central[0], skillLabel: R.central[1], difficulty: "medium", prompt: "The passage's main purpose is to explain how:", choices: ["satellite images should be replaced by bicycle measurements", "street-level data can refine broad heat maps into practical shade decisions", "volunteers can ride bicycles safely in hot weather", "building shade is always more effective than tree shade"], correct: 1, rationale: "The passage emphasizes combining regional and block-level data to guide feasible interventions." },
    { id: "read-city-2", category: "Key Ideas and Details", primarySkill: R.evidence[0], skillLabel: R.evidence[1], difficulty: "medium", prompt: "According to the passage, volunteers collected data:", choices: ["only on cloudy mornings", "at varying times to capture daily averages", "on assigned routes at consistent times", "only in neighborhoods without trees"], correct: 2, rationale: "The passage explicitly states that volunteers rode assigned routes at the same times on cloudless afternoons." },
    { id: "read-city-3", category: "Key Ideas and Details", primarySkill: R.inference[0], skillLabel: R.inference[1], difficulty: "hard", prompt: "The researchers' treatment of cool locations suggests that they believed temperature data should be:", choices: ["used without considering infrastructure", "treated as one factor among several planning constraints", "ignored whenever satellite data are available", "collected only after trees are planted"], correct: 1, rationale: "The passage notes utilities, water access, and traffic as additional constraints before a planting decision." },
    { id: "read-city-4", category: "Craft and Structure", primarySkill: R.purpose[0], skillLabel: R.purpose[1], difficulty: "medium", prompt: "The contrast between “regional view” and “street-level detail” primarily clarifies:", choices: ["why the two measurement methods are complementary", "why volunteers disliked satellite images", "why bicycle sensors are more accurate in every situation", "why building height has no effect on heat"], correct: 0, rationale: "The paired phrases distinguish the different scales at which the methods contribute useful information." },
    { id: "read-city-5", category: "Integration of Knowledge and Ideas", primarySkill: R.central[0], skillLabel: R.central[1], difficulty: "hard", prompt: "Which conclusion is best supported by the passage?", choices: ["The hottest block should always receive the first new tree.", "Broad heat patterns are sufficient for choosing exact planting sites.", "Fine-grained measurements are most useful when combined with feasibility information.", "Building shade makes urban trees unnecessary."], correct: 2, rationale: "The passage repeatedly links block-level heat data with practical constraints and the regional view." },
    { id: "read-city-6", category: "Craft and Structure", primarySkill: R.evidence[0], skillLabel: R.evidence[1], difficulty: "hard", prompt: "The example of an exposed crossing less than fifty meters from a shaded sidewalk is included primarily to:", choices: ["show why regional measurements can miss sharp local differences", "prove that volunteers rode beyond their routes", "show that humidity sensors were unnecessary", "argue that every crossing needs a tree"], correct: 0, rationale: "The short-distance contrast demonstrates the small-scale variation that satellite images may not capture." },
  ],
  [
    { id: "read-translate-1", category: "Key Ideas and Details", primarySkill: R.central[0], skillLabel: R.central[1], difficulty: "medium", prompt: "Both translators agree that:", choices: ["English word order should never change", "reading aloud has no role in translation", "word-for-word substitution is insufficient", "recurring images should always be replaced"], correct: 2, rationale: "The final paragraph explicitly states that both reject word-for-word substitution as a complete method." },
    { id: "read-translate-2", category: "Key Ideas and Details", primarySkill: R.inference[0], skillLabel: R.inference[1], difficulty: "hard", prompt: "Translator A would most likely approve a translation that changes syntax in order to:", choices: ["remove every unfamiliar image", "reproduce a sudden interruption in the poem's movement", "make repeated words less noticeable", "replace concrete language with a general feeling"], correct: 1, rationale: "Translator A prioritizes recreating pace and impact, including a line that arrives like a sudden knock." },
    { id: "read-translate-3", category: "Key Ideas and Details", primarySkill: R.evidence[0], skillLabel: R.evidence[1], difficulty: "medium", prompt: "Translator B specifically warns against:", choices: ["reading the source poem aloud", "altering syntax under any circumstances", "making a surprising word ordinary for smoother English", "tracking repeated images before drafting"], correct: 2, rationale: "Translator B directly says a surprising word should not become ordinary merely because that sounds smoother." },
    { id: "read-translate-4", category: "Craft and Structure", primarySkill: R.purpose[0], skillLabel: R.purpose[1], difficulty: "hard", prompt: "The final paragraph primarily functions to:", choices: ["introduce a third translation method", "synthesize the translators' shared principle and central difference", "prove that Translator A's method is superior", "show that the translators discussed different poems"], correct: 1, rationale: "It identifies their agreement about form and explains that their disagreement is one of emphasis." },
    { id: "read-translate-5", category: "Integration of Knowledge and Ideas", primarySkill: R.inference[0], skillLabel: R.inference[1], difficulty: "hard", prompt: "Which statement best characterizes the difference between the translators?", choices: ["A values meaning, while B values form.", "A prioritizes pace and impact, while B protects recurring words and images more strictly.", "A refuses literal meanings, while B uses only dictionary substitutions.", "A translates poetry, while B translates only prose."], correct: 1, rationale: "The passage explicitly frames their different emphases in those terms while noting both treat form as meaning." },
    { id: "read-translate-6", category: "Integration of Knowledge and Ideas", primarySkill: R.purpose[0], skillLabel: R.purpose[1], difficulty: "hard", prompt: "If both translators reviewed a version that preserved every image but flattened a poem's abrupt rhythm, they would most likely:", choices: ["both accept it without changes", "both reject it for using concrete images", "A object strongly, while B might value its imagery but still recognize a formal loss", "B object because repeated images should always be deleted"], correct: 2, rationale: "A explicitly prioritizes rhythm, while B prioritizes images but also states that form is part of meaning." },
  ],
];

const readingQuestions = readingPassages.flatMap((passage, index) =>
  passageSet("reading", passage, readingItems[index]),
);

export const RAPID_DIAGNOSTIC_FORM = validateRapidDiagnosticForm({
  id: "enhanced-act-half-length",
  version: "enhanced-half-v2",
  mode: "rapid",
  title: "Enhanced ACT half-length baseline",
  estimatedMinutes: 63,
  blueprint: BLUEPRINT,
  questions: [...englishQuestions, ...mathQuestions, ...readingQuestions],
});
