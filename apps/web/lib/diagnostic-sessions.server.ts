import "server-only"

import path from "node:path"

import { FileDiagnosticSessionRepository } from "@act-tutor/server"

import { sessionDocumentStore } from "./session-document-store.server"

const storePath =
  process.env.DIAGNOSTIC_STORE_PATH ??
  path.join(process.cwd(), ".data", "diagnostic-sessions.json")

export const diagnosticSessions = new FileDiagnosticSessionRepository(
  sessionDocumentStore("diagnostic-sessions", storePath)
)
