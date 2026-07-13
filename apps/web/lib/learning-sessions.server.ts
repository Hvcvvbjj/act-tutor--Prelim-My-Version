import { join } from "node:path";

import { FileLearningSessionRepository } from "@act-tutor/server";

const storePath =
  process.env.LEARNING_SESSION_STORE_PATH ??
  join(process.cwd(), ".data", "learning-sessions.json");

export const learningSessions = new FileLearningSessionRepository(storePath);
