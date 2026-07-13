import {
  ACT_LEARNING_BANK,
  ACT_LESSONS,
  ACT_PRACTICE_QUESTIONS,
  ACT_SKILLS,
} from "@act-tutor/content";
import type { LearningBankInput } from "@act-tutor/server";

export const LEARNING_BANK: LearningBankInput = {
  version: ACT_LEARNING_BANK.version,
  skills: ACT_SKILLS,
  lessons: ACT_LESSONS,
  practice: ACT_PRACTICE_QUESTIONS,
};
