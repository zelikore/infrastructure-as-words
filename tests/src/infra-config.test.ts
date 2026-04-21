import assert from "node:assert/strict";
import test from "node:test";
import {
  buildApiBaseUrl,
  buildAppOrigin,
  environments,
  terraformLockTableName,
  terraformStateBucketName
} from "@infrastructure-as-words/infra-config";

void test("environment domains stay stable", () => {
  assert.equal(buildAppOrigin("dev"), "https://dev.infrastructure-as-words.com");
  assert.equal(buildApiBaseUrl("prod"), "https://api.infrastructure-as-words.com");
  assert.equal(environments.dev.authDomain, "auth.infrastructure-as-words.com");
  assert.equal(environments.prod.authDomain, "auth.infrastructure-as-words.com");
});

void test("terraform backend names stay stable", () => {
  assert.equal(terraformStateBucketName, "infrastructure-as-words-terraform-state-283107799662");
  assert.equal(terraformLockTableName, "infrastructure-as-words-terraform-locks");
});
