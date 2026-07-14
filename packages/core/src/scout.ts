export type ScoutScreen =
  "today" | "plan" | "calibrate" | "progress" | "lab" | "control";

export type ScoutAssistanceMode = "study" | "timed-test" | "review";

export type ScoutIntent =
  | "plan-reason"
  | "calibration-definition"
  | "selection-explanation"
  | "simplify"
  | "hint"
  | "example"
  | "rule"
  | "estimate"
  | "screen-help";

export interface ScoutExplanationPreferences {
  depth: "quick" | "normal" | "detailed";
  readingLevel: "plain" | "standard" | "advanced";
  exampleStyle: "school" | "sports" | "gaming" | "everyday";
  fewerTechnicalTerms: boolean;
}

export interface ScoutAnswer {
  summary: string;
  explanation: string;
  example: string | null;
  technical: string;
  nextAction: string;
  source: string;
  mode: "grounded" | "guarded";
  receipt: {
    questionId: string | null;
    skillId: string | null;
    permissions: ReadonlyArray<string>;
    checks: ReadonlyArray<string>;
    delivery: "reviewed-rule" | "reviewed-interface-guidance";
    assistanceMode: ScoutAssistanceMode;
    intent: ScoutIntent;
  };
}

export interface ScoutMessage {
  id: string;
  askedAt: string;
  question: string;
  answer: ScoutAnswer;
}

export interface ScoutAskRequest {
  question: string;
  screen: ScoutScreen;
  questionId?: string | null;
  selectedText?: string | null;
}

export interface ScoutAskResponse {
  answer: ScoutAnswer;
  messages: ReadonlyArray<ScoutMessage>;
  preferences: ScoutExplanationPreferences;
  preferencesVersion: 2;
  preferencesUpdatedAt: string;
}

export interface ScoutStateResponse {
  messages: ReadonlyArray<ScoutMessage>;
  preferences: ScoutExplanationPreferences;
  preferencesVersion: 2;
  preferencesUpdatedAt: string;
}

export function classifyScoutIntent(input: {
  question: string;
  hasSelectedText: boolean;
}): ScoutIntent {
  const lower = input.question.toLowerCase();
  if (input.hasSelectedText) return "selection-explanation";
  if (
    /margin of error|starting estimate|uncertainty range|when will .* stop|why this question/.test(
      lower,
    )
  ) {
    return "calibration-definition";
  }
  if (/why.*(plan|skill|mission)|why this/.test(lower)) return "plan-reason";
  if (/confidence|percent|mastery|skill estimate|certainty/.test(lower)) {
    return "estimate";
  }
  if (/\b(hint|stuck|help me start)\b/.test(lower)) return "hint";
  if (/another example|give me an example|similar example/.test(lower)) {
    return "example";
  }
  if (/show.*rule|grammar rule|what rule|technical detail/.test(lower)) {
    return "rule";
  }
  if (/simpl|plain english|layman|regular english/.test(lower)) {
    return "simplify";
  }
  return "screen-help";
}
