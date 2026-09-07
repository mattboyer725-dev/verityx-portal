import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "node_modules/@electric-sql/pglite/dist");
const dests = [
  join(root, ".vercel/output/functions/__server.func/_libs"),
  join(root, ".output/server/_libs"),
];
const files = ["pglite.data", "pglite.wasm", "initdb.wasm"];
let copied = 0;
for (const dest of dests) {
  if (!existsSync(dest)) continue;
  mkdirSync(dest, { recursive: true });
  for (const name of files) {
    const from = join(srcDir, name);
    if (existsSync(from)) {
      copyFileSync(from, join(dest, name));
      copied += 1;
    }
  }
}
if (!copied) process.exit(0);
