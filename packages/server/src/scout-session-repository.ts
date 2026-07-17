import { randomUUID } from "node:crypto";

import type {
  ScoutExplanationPreferences,
  ScoutMessage,
  ScoutStateResponse,
} from "@act-tutor/core";

import {
  resolveJsonDocumentStore,
  type JsonDocumentStore,
} from "./atomic-json-repository";

interface StoredScoutSession {
  id: string;
  preferences: ScoutExplanationPreferences;
  preferencesVersion?: 2;
  preferencesUpdatedAt?: string;
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
    preferencesVersion: 2,
    preferencesUpdatedAt: session.preferencesUpdatedAt ?? session.createdAt,
    messages: session.messages.slice(-30),
  };
}

export class FileScoutSessionRepository {
  private readonly store: JsonDocumentStore;

  constructor(source: string | JsonDocumentStore) {
    this.store = resolveJsonDocumentStore(source);
  }

  private async readStore() {
    const value = await this.store.read();
    if (value === null) return structuredClone(EMPTY_STORE);
    const parsed = value as ScoutStoreFile;
    if (parsed.version !== 1 || !parsed.sessions) {
      throw new Error("Unsupported Scout session store format.");
    }
    return parsed;
  }

  private async writeStore(store: ScoutStoreFile) {
    await this.store.write(store);
  }

  private async transact<T>(
    operation: (store: ScoutStoreFile) => Promise<T> | T,
  ): Promise<T> {
    const previous = queues.get(this.store.key) ?? Promise.resolve();
    let release: () => void = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    queues.set(this.store.key, tail);
    await previous;
    try {
      return await operation(await this.readStore());
    } finally {
      release();
      if (queues.get(this.store.key) === tail) queues.delete(this.store.key);
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
        preferencesVersion: 2,
        preferencesUpdatedAt: now,
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
    preferencesUpdatedAt?: string,
  ) {
    return this.transact(async (store) => {
      const session = store.sessions[sessionId];
      if (!session) throw new RangeError("Scout session not found.");
      const currentUpdatedAt =
        session.preferencesUpdatedAt ?? session.createdAt;
      const nextUpdatedAt =
        preferencesUpdatedAt && !Number.isNaN(Date.parse(preferencesUpdatedAt))
          ? preferencesUpdatedAt
          : new Date().toISOString();
      if (nextUpdatedAt >= currentUpdatedAt) {
        session.preferences = { ...preferences };
        session.preferencesVersion = 2;
        session.preferencesUpdatedAt = nextUpdatedAt;
        session.updatedAt = nextUpdatedAt;
      }
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
