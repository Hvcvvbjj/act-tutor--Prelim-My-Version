import "server-only"

import type { DiagnosticFormSecure } from "@act-tutor/core"

export const STARTER_DIAGNOSTIC_FORM = {
  id: "starter-core-form",
  version: "starter-core-v1",
  mode: "starter",
  title: "Reviewed starter diagnostic",
  estimatedMinutes: 12,
  questions: [
    {
      id: "eng-boundaries-1",
      version: 1,
      section: "english",
      category: "Production of Writing",
      primarySkill: "sentence-boundaries",
      skillLabel: "Sentence boundaries",
      difficulty: "medium",
      stimulus:
        "The telescope was finally repaired ___ the astronomy club scheduled an observation night.",
      prompt:
        "Which option correctly joins the two independent clauses at the blank?",
      choices: [
        { id: "a", text: ", the" },
        { id: "b", text: "; the" },
        { id: "c", text: " the" },
        { id: "d", text: ", which the" },
      ],
      expectedSeconds: 45,
      correctChoiceId: "b",
      rationale:
        "Both sides of the blank are complete sentences. A semicolon can join two closely related independent clauses without a coordinating conjunction.",
    },
    {
      id: "eng-boundaries-2",
      version: 1,
      section: "english",
      category: "Knowledge of Language",
      primarySkill: "sentence-boundaries",
      skillLabel: "Sentence boundaries",
      difficulty: "medium",
      stimulus:
        "Although the rain stopped before noon. The trail remained muddy for the afternoon hike.",
      prompt:
        "Which revision fixes the sentence-boundary error while preserving the meaning?",
      choices: [
        {
          id: "a",
          text: "Although the rain stopped before noon. The trail remained muddy for the afternoon hike.",
        },
        {
          id: "b",
          text: "Although the rain stopped before noon, the trail remained muddy for the afternoon hike.",
        },
        {
          id: "c",
          text: "The rain stopped before noon, the trail remained muddy for the afternoon hike.",
        },
        {
          id: "d",
          text: "Stopping before noon. The rain left the trail muddy for the afternoon hike.",
        },
      ],
      expectedSeconds: 50,
      correctChoiceId: "b",
      rationale:
        "The opening dependent clause beginning with “Although” must be attached to the independent clause with a comma.",
    },
    {
      id: "eng-concision-1",
      version: 1,
      section: "english",
      category: "Knowledge of Language",
      primarySkill: "concision-and-redundancy",
      skillLabel: "Concision and redundancy",
      difficulty: "easy",
      stimulus: "Each individual runner received a medal after finishing.",
      prompt:
        "Which revision is the most concise without changing the sentence's meaning?",
      choices: [
        {
          id: "a",
          text: "Every separate individual runner received a medal after finishing.",
        },
        { id: "b", text: "Each runner received a medal after finishing." },
        {
          id: "c",
          text: "Each individual runner personally received a medal after finishing.",
        },
        {
          id: "d",
          text: "After finishing, each and every individual runner received a medal.",
        },
      ],
      expectedSeconds: 40,
      correctChoiceId: "b",
      rationale:
        "“Each” already refers to runners one at a time, so “individual” adds no useful meaning.",
    },
    {
      id: "eng-concision-2",
      version: 1,
      section: "english",
      category: "Knowledge of Language",
      primarySkill: "concision-and-redundancy",
      skillLabel: "Concision and redundancy",
      difficulty: "medium",
      stimulus:
        "The reason the bus arrived late was because a fallen branch blocked the road.",
      prompt: "Which revision states the idea most directly and grammatically?",
      choices: [
        {
          id: "a",
          text: "The bus arrived late because a fallen branch blocked the road.",
        },
        {
          id: "b",
          text: "The reason why the bus arrived late was due to the fact that a fallen branch blocked the road.",
        },
        {
          id: "c",
          text: "Because of a fallen branch being what blocked the road, this was the reason the bus arrived late.",
        },
        {
          id: "d",
          text: "The bus, for the reason of a fallen branch, arrived late because the road was blocked.",
        },
      ],
      expectedSeconds: 45,
      correctChoiceId: "a",
      rationale:
        "The direct subject-verb structure removes the redundant pairing of “the reason” with “because.”",
    },
    {
      id: "math-linear-1",
      version: 1,
      section: "math",
      category: "Preparing for Higher Math",
      primarySkill: "linear-equations",
      skillLabel: "Linear equations",
      difficulty: "easy",
      prompt: "What value of x satisfies 3x − 7 = 20?",
      choices: [
        { id: "a", text: "4" },
        { id: "b", text: "7" },
        { id: "c", text: "9" },
        { id: "d", text: "13" },
      ],
      expectedSeconds: 50,
      correctChoiceId: "c",
      rationale:
        "Add 7 to both sides to get 3x = 27, then divide by 3. Therefore, x = 9.",
    },
    {
      id: "math-linear-2",
      version: 1,
      section: "math",
      category: "Integrating Essential Skills",
      primarySkill: "linear-equations",
      skillLabel: "Linear equations",
      difficulty: "medium",
      prompt:
        "A game café charges a $4 entry fee plus $3 for each game played. If the total bill is $19, how many games were played?",
      choices: [
        { id: "a", text: "4" },
        { id: "b", text: "5" },
        { id: "c", text: "6" },
        { id: "d", text: "7" },
      ],
      expectedSeconds: 70,
      correctChoiceId: "b",
      rationale:
        "The equation is 4 + 3g = 19. Subtracting 4 gives 3g = 15, so g = 5.",
    },
    {
      id: "math-functions-1",
      version: 1,
      section: "math",
      category: "Preparing for Higher Math",
      primarySkill: "functions-and-modeling",
      skillLabel: "Functions and modeling",
      difficulty: "medium",
      prompt: "If f(x) = 2x² − 3, what is f(3)?",
      choices: [
        { id: "a", text: "9" },
        { id: "b", text: "12" },
        { id: "c", text: "15" },
        { id: "d", text: "33" },
      ],
      expectedSeconds: 55,
      correctChoiceId: "c",
      rationale: "Substitute 3 for x: 2(3²) − 3 = 2(9) − 3 = 15.",
    },
    {
      id: "math-functions-2",
      version: 1,
      section: "math",
      category: "Integrating Essential Skills",
      primarySkill: "functions-and-modeling",
      skillLabel: "Functions and modeling",
      difficulty: "medium",
      stimulus: "A linear function contains the points (1, 5) and (3, 13).",
      prompt: "What is the slope of the function?",
      choices: [
        { id: "a", text: "2" },
        { id: "b", text: "4" },
        { id: "c", text: "6" },
        { id: "d", text: "8" },
      ],
      expectedSeconds: 60,
      correctChoiceId: "b",
      rationale:
        "Slope is the change in y divided by the change in x: (13 − 5) ÷ (3 − 1) = 8 ÷ 2 = 4.",
    },
    {
      id: "read-central-1",
      version: 1,
      section: "reading",
      category: "Key Ideas and Details",
      primarySkill: "central-ideas-and-details",
      skillLabel: "Central ideas and details",
      difficulty: "medium",
      stimulus:
        "A neighborhood library began lending vegetable seeds from a small cabinet near its entrance. At first, few visitors used it. The librarians then added planting labels and held short weekend workshops. By midsummer, the cabinet emptied weekly, and several gardeners returned seeds from their strongest plants.",
      prompt: "Which statement best expresses the passage's central idea?",
      choices: [
        {
          id: "a",
          text: "Libraries should replace books with community gardening supplies.",
        },
        {
          id: "b",
          text: "The seed program became more useful after the library added guidance and instruction.",
        },
        {
          id: "c",
          text: "Weekend workshops are the only effective way to teach gardening.",
        },
        {
          id: "d",
          text: "The gardeners returned every seed they borrowed from the library.",
        },
      ],
      expectedSeconds: 75,
      correctChoiceId: "b",
      rationale:
        "The passage contrasts low initial use with strong participation after labels and workshops were added.",
    },
    {
      id: "read-inference-1",
      version: 1,
      section: "reading",
      category: "Craft and Structure",
      primarySkill: "supported-inference",
      skillLabel: "Supported inference",
      difficulty: "medium",
      stimulus:
        "A neighborhood library began lending vegetable seeds from a small cabinet near its entrance. At first, few visitors used it. The librarians then added planting labels and held short weekend workshops. By midsummer, the cabinet emptied weekly, and several gardeners returned seeds from their strongest plants.",
      prompt:
        "The passage most strongly suggests that some visitors initially avoided the seed cabinet because they:",
      choices: [
        { id: "a", text: "did not know how to use the seeds successfully." },
        { id: "b", text: "believed the seeds were too expensive." },
        { id: "c", text: "wanted the library to offer flower seeds instead." },
        { id: "d", text: "were not allowed to enter the library on weekends." },
      ],
      expectedSeconds: 75,
      correctChoiceId: "a",
      rationale:
        "Use increased after the library provided labels and instruction, supporting the inference that uncertainty was an early barrier.",
    },
    {
      id: "read-central-2",
      version: 1,
      section: "reading",
      category: "Key Ideas and Details",
      primarySkill: "central-ideas-and-details",
      skillLabel: "Central ideas and details",
      difficulty: "easy",
      stimulus:
        "The school cafeteria installed sound-absorbing panels along one wall. Before the change, a meter regularly recorded lunch-hour noise above 85 decibels. After installation, the average fell to 72 decibels, and students in a survey reported that conversations required less shouting.",
      prompt: "Which conclusion is best supported by the passage?",
      choices: [
        {
          id: "a",
          text: "The panels reduced measured noise and made conversation easier.",
        },
        {
          id: "b",
          text: "The cafeteria became completely silent during lunch.",
        },
        {
          id: "c",
          text: "Students began eating lunch more quickly after the installation.",
        },
        {
          id: "d",
          text: "Every school should install the same brand of acoustic panel.",
        },
      ],
      expectedSeconds: 65,
      correctChoiceId: "a",
      rationale:
        "Both the meter reading and student survey directly support reduced noise and easier conversation.",
    },
    {
      id: "read-inference-2",
      version: 1,
      section: "reading",
      category: "Craft and Structure",
      primarySkill: "supported-inference",
      skillLabel: "Supported inference",
      difficulty: "medium",
      stimulus:
        "Ceramic artist Lena Ortiz keeps several cracked bowls on a shelf above her worktable. She labels each one with the clay mixture, kiln temperature, and glaze used. Before beginning a new batch, she often studies those labels and runs a small test tile through the kiln.",
      prompt:
        "It can reasonably be inferred that Ortiz keeps the cracked bowls because she:",
      choices: [
        { id: "a", text: "plans to sell them at a lower price." },
        { id: "b", text: "uses them to learn from earlier results." },
        { id: "c", text: "prefers cracked bowls to finished work." },
        { id: "d", text: "has no room to store new materials." },
      ],
      expectedSeconds: 70,
      correctChoiceId: "b",
      rationale:
        "Her detailed labels and later test tiles show that the failed pieces function as records for improving future batches.",
    },
  ],
} satisfies DiagnosticFormSecure
