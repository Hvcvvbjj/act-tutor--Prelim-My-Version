import "server-only"

import { join } from "node:path"

import { FileStudyPlanRepository } from "@act-tutor/server"

import { sessionDocumentStore } from "./session-document-store.server"

const storePath =
  process.env.STUDY_PLAN_STORE_PATH ??
  join(process.cwd(), ".data", "study-plan-sessions.json")

export const studyPlanSessions = new FileStudyPlanRepository(
  sessionDocumentStore("study-plan-sessions", storePath)
)
