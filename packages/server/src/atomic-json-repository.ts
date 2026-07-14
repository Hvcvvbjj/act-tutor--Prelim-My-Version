import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

const queues = new Map<string, Promise<void>>()

export class AtomicJsonRepository<T> {
  constructor(
    private readonly filePath: string,
    private readonly emptyStore: T,
    private readonly validate: (value: T) => void
  ) {}

  protected async writeStore(store: T) {
    await mkdir(dirname(this.filePath), { recursive: true })
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`
    try {
      await writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      })
      await rename(temporaryPath, this.filePath)
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined)
      throw error
    }
  }

  protected async transact<R>(
    operation: (store: T) => Promise<R> | R
  ): Promise<R> {
    const previous = queues.get(this.filePath) ?? Promise.resolve()
    let release: () => void = () => {}
    const current = new Promise<void>((resolve) => {
      release = resolve
    })
    const tail = previous.then(() => current)
    queues.set(this.filePath, tail)
    await previous
    try {
      return await operation(await this.readStore())
    } finally {
      release()
      if (queues.get(this.filePath) === tail) queues.delete(this.filePath)
    }
  }

  private async readStore(): Promise<T> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as T
      this.validate(parsed)
      return parsed
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return structuredClone(this.emptyStore)
      }
      throw error
    }
  }
}
