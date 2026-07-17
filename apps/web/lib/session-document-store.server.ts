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

class SitesJsonDocumentStore implements JsonDocumentStore {
  readonly key: string
  private initialized = false
  private readonly fallback: FileJsonDocumentStore

  constructor(
    private readonly documentKey: string,
    fallbackPath: string
  ) {
    this.key = `sites-d1:${documentKey}`
    this.fallback = new FileJsonDocumentStore(fallbackPath)
  }

  private async database(): Promise<D1DatabaseLike | null> {
    try {
      const context = await getCloudflareContext({ async: true })
      return (
        context.env as CloudflareEnv & { DB?: D1DatabaseLike }
      ).DB ?? null
    } catch {
      return null
    }
  }

  private async ensureTable(database: D1DatabaseLike) {
    if (this.initialized) return
    await database.prepare(CREATE_STORE_TABLE).run()
    this.initialized = true
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
