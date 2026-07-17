import "server-only"

import { join } from "node:path"

import {
  createExamDebriefComposerFromEnv,
  FileExamLabRepository,
} from "@act-tutor/server"

import { sessionDocumentStore } from "./session-document-store.server"

const storePath =
  process.env.EXAM_LAB_STORE_PATH ??
  join(process.cwd(), ".data", "exam-lab-sessions.json")

export const examLabSessions = new FileExamLabRepository(
  sessionDocumentStore("exam-lab-sessions", storePath)
)
export const examDebriefComposer = createExamDebriefComposerFromEnv()
