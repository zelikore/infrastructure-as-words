import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoFile = (...segments: string[]): string =>
  path.resolve(process.cwd(), ...segments);

void test("submission evidence artifacts remain committed", () => {
  const requiredFiles = [
    repoFile("AGENTS.md"),
    repoFile("docs", "for-graders", "ai-usage.md"),
    repoFile("diagrams", "infrastructure-as-words-platform.drawio.xml"),
    repoFile("diagrams", "infrastructure-as-words-platform.svg"),
    repoFile(".github", "workflows", "pr-review.yml"),
    repoFile(".github", "pull_request_template.md"),
  ];

  for (const filePath of requiredFiles) {
    assert.equal(
      fs.existsSync(filePath),
      true,
      `Missing required artifact: ${filePath}`,
    );
  }
});
