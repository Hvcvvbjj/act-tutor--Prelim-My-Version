import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function git(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

const trackedChanges = git(["status", "--porcelain", "--untracked-files=no"]);
if (trackedChanges) {
  throw new Error(
    "Sites builds must start from a clean committed source tree. Commit tracked changes, then rebuild.",
  );
}

const head = git(["rev-parse", "--verify", "HEAD"]).toLowerCase();
const buildId = (await readFile(resolve(root, "dist/assets/BUILD_ID"), "utf8"))
  .trim()
  .toLowerCase();
const serverBundle = await readFile(
  resolve(root, "dist/server/index.js"),
  "utf8",
);

if (buildId !== head || !serverBundle.includes(head)) {
  throw new Error(
    `Sites bundle provenance mismatch: expected ${head}, found ${buildId || "no build ID"}.`,
  );
}

console.log(`Verified Sites bundle for ${head}.`);
