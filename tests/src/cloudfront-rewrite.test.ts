import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "infra", "terraform", "cloudfront-rewrite.js"),
  "utf8"
);

const runRewrite = (uri: string): string => {
  const context = vm.createContext({});
  vm.runInContext(`${source}\nthis.__handler = handler;`, context);

  const handler = context["__handler"] as (event: {
    request: { uri: string };
  }) => { uri: string };

  return handler({
    request: { uri }
  }).uri;
};

void test("cloudfront rewrite maps extensionless routes to html assets", () => {
  assert.equal(runRewrite("/"), "/index.html");
  assert.equal(runRewrite("/auth/callback"), "/auth/callback.html");
  assert.equal(runRewrite("/docs/"), "/docs/index.html");
  assert.equal(runRewrite("/favicon.ico"), "/favicon.ico");
});
