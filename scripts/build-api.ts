import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.resolve(rootDir, "services", "api", "dist", "lambda");

mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [path.resolve(rootDir, "services", "api", "src", "lambda.ts")],
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  outfile: path.resolve(outDir, "index.js"),
  sourcemap: true,
  minify: false
});
