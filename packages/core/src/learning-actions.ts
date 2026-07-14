import type { DiagnosticSkillResult } from "./diagnostic";
import type { AnswerConfidence, LessonPlanContext } from "./learning";

export interface LearningAnswerCommand {
  schemaVersion: 2;
  idempotencyKey: string;
  learnerSessionId: string;
  bankVersion: string;
  questionVersion: number;
  sequence: number;
  answerRevision: 1;
  issuedAt: string;
}

export interface LearningAnswerRequest {
  action: "answer";
  questionId: string;
  choiceId: string;
  confidence: AnswerConfidence;
  selfCorrected: boolean;
  responseSeconds: number;
  command: LearningAnswerCommand;
}

type PlanFields = LessonPlanContext;

export type LearningActionRequest =
  | ({
      action: "start";
      skill: string;
      diagnosticSkillResults: ReadonlyArray<DiagnosticSkillResult>;
    } & PlanFields)
  | ({ action: "rebase_after_calibration" } & Omit<PlanFields, "currentScore">)
  | { action: "complete_lesson" }
  | ({ action: "start_next" } & PlanFields)
  | ({ action: "start_skill"; skill: string } & PlanFields)
  | { action: "start_repair"; mistakeId: string }
  | { action: "start_checkpoint" }
  | { action: "start_retention"; skill: string }
  | { action: "start_challenge"; skill?: string }
  | ({ action: "start_micro"; skill?: string } & PlanFields)
  | { action: "start_recovery" }
  | { action: "teach_back"; response: string }
  | {
      action: "correct_model";
      skill: string;
      kind: "too-high" | "too-low" | "wrong-misconception";
      note: string;
    }
  | { action: "lesson_feedback"; helpful: boolean; style: string }
  | LearningAnswerRequest;

export interface QuarantinedLearningCommand {
  request: unknown;
  quarantinedAt: string;
  reason: string;
}
