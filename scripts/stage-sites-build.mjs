import { spawnSync } from "node:child_process"
import { access, cp, mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const openNext = resolve(root, "apps/web/.open-next")
const worker = resolve(openNext, "worker.js")
const assets = resolve(openNext, "assets")
const output = resolve(root, "dist")
const server = resolve(output, "server")
const bundle = await mkdtemp(resolve(tmpdir(), "scout-sites-bundle-"))

await access(worker)
const wrangler = spawnSync(
  "pnpm",
  [
    "--filter",
    "web",
    "exec",
    "wrangler",
    "deploy",
    "--dry-run",
    "--outdir",
    bundle,
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      WRANGLER_WRITE_LOGS: "false",
      WRANGLER_LOG_PATH: resolve(root, ".wrangler/wrangler.log"),
      MINIFLARE_REGISTRY_PATH: resolve(root, ".wrangler/registry"),
    },
    stdio: "inherit",
  }
)
if (wrangler.status !== 0) {
  await rm(bundle, { recursive: true, force: true })
  process.exit(wrangler.status ?? 1)
}

await rm(output, { recursive: true, force: true })
await mkdir(server, { recursive: true })
await cp(bundle, server, { recursive: true })
await cp(resolve(bundle, "worker.js"), resolve(server, "index.js"))

try {
  await access(assets)
  await cp(assets, resolve(output, "assets"), { recursive: true })
  await rm(resolve(server, "assets"), { recursive: true, force: true })
} catch {
  // Some builds do not emit static assets.
}

await rm(bundle, { recursive: true, force: true })
