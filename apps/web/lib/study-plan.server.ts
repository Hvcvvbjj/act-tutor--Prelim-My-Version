import "server-only"

import { join } from "node:path"

import { FileStudyPlanRepository } from "@act-tutor/server"

const storePath =
  process.env.STUDY_PLAN_STORE_PATH ??
  join(process.cwd(), ".data", "study-plan-sessions.json")

export const studyPlanSessions = new FileStudyPlanRepository(storePath)
