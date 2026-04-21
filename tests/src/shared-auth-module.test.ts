import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const sharedAuthModulePath = path.resolve(
  import.meta.dirname,
  "../../infra/modules/shared-auth/main.tf",
);

void test(
  "shared auth stores the full allowlist but seeds Cognito from the first email",
  () => {
  const source = fs.readFileSync(sharedAuthModulePath, "utf8");

  assert.match(
    source,
    /admin_email_allowlist\s*=\s*\[/,
    "Shared auth should derive a normalized admin email allowlist.",
  );

  assert.match(
    source,
    /admin_seed_email\s*=\s*try\(/,
    "Shared auth should derive a canonical seed email from the allowlist.",
  );

  assert.match(
    source,
    /resource "aws_ssm_parameter" "admin_email"[\s\S]*value\s*=\s*join\(",",\s*local\.admin_email_allowlist\)/,
    "The SSM parameter should preserve the normalized allowlist.",
  );

  assert.match(
    source,
    /resource "aws_cognito_user" "admin"[\s\S]*username\s*=\s*local\.admin_seed_email/,
    "The seeded Cognito admin username should use the canonical first email only.",
  );

  assert.match(
    source,
    /resource "aws_cognito_user" "admin"[\s\S]*email\s*=\s*local\.admin_seed_email/,
    "The seeded Cognito admin email attribute should use the canonical first email only.",
  );
  },
);
