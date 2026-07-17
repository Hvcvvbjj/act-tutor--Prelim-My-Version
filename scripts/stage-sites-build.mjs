import { access, cp, mkdir, rm } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const openNext = resolve(root, "apps/web/.open-next")
const worker = resolve(openNext, "worker.js")
const assets = resolve(openNext, "assets")
const output = resolve(root, "dist")
const server = resolve(output, "server")

await access(worker)
await rm(output, { recursive: true, force: true })
await mkdir(server, { recursive: true })
await cp(openNext, server, { recursive: true })
await cp(worker, resolve(server, "index.js"))

try {
  await access(assets)
  await cp(assets, resolve(output, "assets"), { recursive: true })
  await rm(resolve(server, "assets"), { recursive: true, force: true })
} catch {
  // Some builds do not emit static assets.
}
