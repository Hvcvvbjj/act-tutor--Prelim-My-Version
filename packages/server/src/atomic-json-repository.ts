import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

const queues = new Map<string, Promise<void>>()

export interface JsonDocumentStore {
  readonly key: string
  read(): Promise<unknown | null>
  write(value: unknown): Promise<void>
}

export class FileJsonDocumentStore implements JsonDocumentStore {
  readonly key: string

  constructor(private readonly filePath: string) {
    this.key = `file:${filePath}`
  }

  async read(): Promise<unknown | null> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as unknown
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
      throw error
    }
  }

  async write(value: unknown) {
    await mkdir(dirname(this.filePath), { recursive: true })
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`
    try {
      await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      })
      await rename(temporaryPath, this.filePath)
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined)
      throw error
    }
  }
}

export function resolveJsonDocumentStore(
  source: string | JsonDocumentStore
): JsonDocumentStore {
  return typeof source === "string" ? new FileJsonDocumentStore(source) : source
}

export class AtomicJsonRepository<T> {
  private readonly store: JsonDocumentStore

  constructor(
    source: string | JsonDocumentStore,
    private readonly emptyStore: T,
    private readonly validate: (value: T) => void
  ) {
    this.store = resolveJsonDocumentStore(source)
  }

  protected async writeStore(store: T) {
    await this.store.write(store)
  }

  protected async transact<R>(
    operation: (store: T) => Promise<R> | R
  ): Promise<R> {
    const previous = queues.get(this.store.key) ?? Promise.resolve()
    let release: () => void = () => {}
    const current = new Promise<void>((resolve) => {
      release = resolve
    })
    const tail = previous.then(() => current)
    queues.set(this.store.key, tail)
    await previous
    try {
      return await operation(await this.readStore())
    } finally {
      release()
      if (queues.get(this.store.key) === tail) queues.delete(this.store.key)
    }
  }

  private async readStore(): Promise<T> {
    const value = await this.store.read()
    if (value === null) return structuredClone(this.emptyStore)
    const parsed = value as T
    this.validate(parsed)
    return parsed
  }
}
