import "server-only"

import { join } from "node:path"

import { FileScoutSessionRepository } from "@act-tutor/server"

import { sessionDocumentStore } from "./session-document-store.server"

const storePath =
  process.env.SCOUT_SESSION_STORE_PATH ??
  join(process.cwd(), ".data", "scout-sessions.json")

export const scoutSessions = new FileScoutSessionRepository(
  sessionDocumentStore("scout-sessions", storePath)
)
