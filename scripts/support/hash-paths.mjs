#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const inputPaths = process.argv.slice(2);

const hasher = createHash("sha256");

const hashFile = (filePath) => {
  hasher.update(filePath);
  hasher.update(readFileSync(filePath));
};

const walk = (candidatePath) => {
  if (!existsSync(candidatePath)) {
    return;
  }

  const stat = statSync(candidatePath);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(candidatePath).sort()) {
      if (
        entry === "node_modules" ||
        entry === "dist" ||
        entry === ".next" ||
        entry === "out" ||
        entry === ".terraform"
      ) {
        continue;
      }
      walk(path.join(candidatePath, entry));
    }
    return;
  }

  hashFile(candidatePath);
};

for (const inputPath of inputPaths) {
  walk(path.resolve(inputPath));
}

process.stdout.write(hasher.digest("hex"));

