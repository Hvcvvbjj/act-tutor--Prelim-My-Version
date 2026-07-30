import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requireFromWeb = createRequire(resolve(root, "apps/web/package.json"));
const packageJson = requireFromWeb.resolve("@heyputer/puter.js/package.json");
const source = resolve(dirname(packageJson), "dist/puter.cjs");
const target = resolve(root, "apps/web/public/vendor/puter-v2.5.4.js");

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
