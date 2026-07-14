import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type {
  ScoutExplanationPreferences,
  ScoutMessage,
  ScoutStateResponse,
} from "@act-tutor/core";

interface StoredScoutSession {
  id: string;
  preferences: ScoutExplanationPreferences;
  messages: ScoutMessage[];
  createdAt: string;
  updatedAt: string;
}

interface ScoutStoreFile {
  version: 1;
  sessions: Record<string, StoredScoutSession>;
}

const EMPTY_STORE: ScoutStoreFile = { version: 1, sessions: {} };
const queues = new Map<string, Promise<void>>();

export const DEFAULT_SCOUT_PREFERENCES: ScoutExplanationPreferences = {
  depth: "normal",
  readingLevel: "standard",
  exampleStyle: "everyday",
  fewerTechnicalTerms: true,
};

function state(session: StoredScoutSession): ScoutStateResponse {
  return {
    preferences: { ...session.preferences },
    messages: session.messages.slice(-30),
  };
}

export class FileScoutSessionRepository {
  constructor(private readonly filePath: string) {}

  private async readStore() {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as ScoutStoreFile;
      if (parsed.version !== 1 || !parsed.sessions) {
        throw new Error("Unsupported Scout session store format.");
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return structuredClone(EMPTY_STORE);
      }
      throw error;
    }
  }

  private async writeStore(store: ScoutStoreFile) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporaryPath, this.filePath);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  private async transact<T>(
    operation: (store: ScoutStoreFile) => Promise<T> | T,
  ): Promise<T> {
    const previous = queues.get(this.filePath) ?? Promise.resolve();
    let release: () => void = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    queues.set(this.filePath, tail);
    await previous;
    try {
      return await operation(await this.readStore());
    } finally {
      release();
      if (queues.get(this.filePath) === tail) queues.delete(this.filePath);
    }
  }

  async getOrCreate(sessionId: string | null) {
    return this.transact(async (store) => {
      const existing = sessionId ? store.sessions[sessionId] : undefined;
      if (existing) return { sessionId: existing.id, state: state(existing) };
      const now = new Date().toISOString();
      const created: StoredScoutSession = {
        id: randomUUID(),
        preferences: { ...DEFAULT_SCOUT_PREFERENCES },
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      store.sessions[created.id] = created;
      await this.writeStore(store);
      return { sessionId: created.id, state: state(created) };
    });
  }

  async updatePreferences(
    sessionId: string,
    preferences: ScoutExplanationPreferences,
  ) {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Scout session not found.");
      session.preferences = { ...preferences };
      session.updatedAt = new Date().toISOString();
      await this.writeStore(store);
      return state(session);
    });
  }

  async appendMessage(sessionId: string, message: ScoutMessage) {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Scout session not found.");
      session.messages = [...session.messages, message].slice(-50);
      session.updatedAt = message.askedAt;
      await this.writeStore(store);
      return state(session);
    });
  }

  async reset(sessionId: string) {
    return this.transact(async (store) => {
      if (!store.sessions[sessionId]) return;
      delete store.sessions[sessionId];
      await this.writeStore(store);
    });
  }
}
