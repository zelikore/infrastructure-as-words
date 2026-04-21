import assert from "node:assert/strict";
import test from "node:test";
import {
  generationSettingsSchema,
  generationSettingsInputSchema,
  submissionInputSchema,
  submissionSchema
} from "@infrastructure-as-words/contracts";

void test("submission input trims surrounding whitespace", () => {
  const parsed = submissionInputSchema.parse({
    description: "   VPC with isolated private workloads   "
  });

  assert.equal(parsed.description, "VPC with isolated private workloads");
});

void test("submission schema requires an ISO timestamp", () => {
  assert.throws(() =>
    submissionSchema.parse({
      submissionId: "sub_123",
      userSub: "user_123",
      createdAt: "today",
      updatedAt: new Date().toISOString(),
      status: "pending",
      description: "Invalid timestamp",
      artifactAvailable: false
    })
  );
});

void test("generation settings input requires at least one module and guardrail", () => {
  assert.throws(() =>
    generationSettingsInputSchema.parse({
      organizationName: "Example Org",
      guidance: "Prefer managed services.",
      preferredRegions: ["us-west-2"],
      guardrails: [],
      limitationsTemplate: [],
      modules: []
    })
  );
});

void test("generation settings default the monthly AI budget to twenty dollars", () => {
  const parsed = generationSettingsSchema.parse({
    organizationName: "Example Org",
    guidance: "Prefer managed services.",
    preferredRegions: ["us-west-2"],
    guardrails: ["Use least privilege."],
    limitationsTemplate: [],
    modules: [
      {
        moduleId: "terraform-aws-lambda",
        label: "Lambda",
        source: "terraform-aws-modules/lambda/aws",
        visibility: "public",
        priority: "preferred",
        description: "Lambda baseline"
      }
    ],
    updatedAt: new Date().toISOString()
  });

  assert.equal(parsed.budgetPolicy.monthlyLimitUsd, 20);
});
