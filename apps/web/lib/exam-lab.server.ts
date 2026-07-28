import "server-only"

import { join } from "node:path"

import {
  createExamDebriefComposerFromEnv,
  FileExamLabRepository,
} from "@act-tutor/server"

import { EXAM_LAB_FORMS } from "./diagnostic-content.server"
import { sessionDocumentStore } from "./session-document-store.server"

const storePath =
  process.env.EXAM_LAB_STORE_PATH ??
  join(process.cwd(), ".data", "exam-lab-sessions.json")

export const examLabSessions = new FileExamLabRepository(
  sessionDocumentStore("exam-lab-sessions", storePath)
)
export const examDebriefComposer = createExamDebriefComposerFromEnv()

export async function getExamLabSession(sessionId: string) {
  let lastError: unknown = null
  for (const form of EXAM_LAB_FORMS) {
    try {
      return {
        form,
        session: await examLabSessions.get(sessionId, form),
      }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new RangeError("Timed Practice session not found.")
}
