import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"
import {
  FileJsonDocumentStore,
  type JsonDocumentStore,
} from "@act-tutor/server"

interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike
  first<T>(): Promise<T | null>
  run(): Promise<unknown>
}

interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike
}

const CREATE_STORE_TABLE = `
  CREATE TABLE IF NOT EXISTS app_json_store (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`

const CREATE_DOCUMENT_LOCK_TABLE = `
  CREATE TABLE IF NOT EXISTS app_document_locks (
    document_key TEXT PRIMARY KEY NOT NULL,
    owner TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )
`

let tablePromise: Promise<void> | null = null

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

function cloudflareDatabase(): Promise<D1DatabaseLike | null> {
  try {
    const context = getCloudflareContext()
    return Promise.resolve(
      (context.env as CloudflareEnv & { DB?: D1DatabaseLike }).DB ?? null
    )
  } catch {
    return Promise.resolve(null)
  }
}

class SitesJsonDocumentStore implements JsonDocumentStore {
  readonly key: string
  private readonly fallback: FileJsonDocumentStore

  constructor(
    private readonly documentKey: string,
    fallbackPath: string
  ) {
    this.key = `sites-d1:${documentKey}`
    this.fallback = new FileJsonDocumentStore(fallbackPath)
  }

  private async database(): Promise<D1DatabaseLike | null> {
    return cloudflareDatabase()
  }

  private async ensureTable(database: D1DatabaseLike) {
    if (!tablePromise) {
      tablePromise = Promise.all([
        database.prepare(CREATE_STORE_TABLE).run(),
        database.prepare(CREATE_DOCUMENT_LOCK_TABLE).run(),
      ])
        .then(() => undefined)
        .catch((error) => {
          tablePromise = null
          throw error
        })
    }
    await tablePromise
  }

  /**
   * D1 requests can run in separate Worker isolates, so an in-memory queue is
   * not enough to protect the read-modify-write JSON document. This short
   * lease serializes mutations for the same document across isolates and
   * prevents two simultaneous signups from silently replacing each other.
   */
  async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const database = await this.database()
    if (!database) return operation()
    await this.ensureTable(database)

    const owner = globalThis.crypto.randomUUID()
    let acquired = false
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const now = Date.now()
      const expiresAt = now + 15_000
      await database
        .prepare(
          `INSERT INTO app_document_locks (document_key, owner, expires_at)
           VALUES (?1, ?2, ?3)
           ON CONFLICT(document_key) DO UPDATE SET
             owner = excluded.owner,
             expires_at = excluded.expires_at
           WHERE app_document_locks.expires_at <= ?4`
        )
        .bind(this.documentKey, owner, expiresAt, now)
        .run()
      const row = await database
        .prepare("SELECT owner FROM app_document_locks WHERE document_key = ?1")
        .bind(this.documentKey)
        .first<{ owner: string }>()
      if (row?.owner === owner) {
        acquired = true
        break
      }
      await wait(20 + (attempt % 5) * 5)
    }

    if (!acquired) {
      throw new Error("Account storage is busy. Please try again.")
    }

    try {
      return await operation()
    } finally {
      await database
        .prepare(
          "DELETE FROM app_document_locks WHERE document_key = ?1 AND owner = ?2"
        )
        .bind(this.documentKey, owner)
        .run()
        .catch(() => undefined)
    }
  }

  async read(): Promise<unknown | null> {
    const database = await this.database()
    if (!database) return this.fallback.read()
    await this.ensureTable(database)
    const row = await database
      .prepare("SELECT value FROM app_json_store WHERE key = ?1")
      .bind(this.documentKey)
      .first<{ value: string }>()
    return row ? (JSON.parse(row.value) as unknown) : null
  }

  async write(value: unknown) {
    const database = await this.database()
    if (!database) return this.fallback.write(value)
    await this.ensureTable(database)
    await database
      .prepare(
        `INSERT INTO app_json_store (key, value, updated_at)
         VALUES (?1, ?2, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = CURRENT_TIMESTAMP`
      )
      .bind(this.documentKey, JSON.stringify(value))
      .run()
  }
}

export function sessionDocumentStore(
  documentKey: string,
  fallbackPath: string
): JsonDocumentStore {
  return new SitesJsonDocumentStore(documentKey, fallbackPath)
}
