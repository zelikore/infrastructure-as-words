import assert from "node:assert/strict";
import test from "node:test";
import { buildDefaultGenerationSettings } from "../../services/api/src/default-generation-settings.ts";
import { normalizeGenerationDraft } from "../../services/api/src/generation-normalizer.ts";

void test("normalizes near-miss model output into the strict generation contract", () => {
  const draft = normalizeGenerationDraft(
    {
      name: "governed-platform-with-cognito",
      summary:
        "A compact, governed AWS platform with Cognito sign-in, static web app, API Gateway, Lambda services, DynamoDB history, S3 artifacts, logging, and alarms.",
      explanation: [
        {
          title: "Cognito User Pool",
          detail: "Handles sign-in and profile management."
        }
      ],
      limitations: [
        {
          title: "Human Review Required",
          detail: "The generated infrastructure still needs human review before apply."
        }
      ],
      modules: [
        {
          source: "terraform-aws-modules/lambda/aws",
          version: "2.3.0"
        }
      ],
      files: [
        {
          path: "README.md",
          language: "markdown",
          content: "# Governed Platform\n"
        },
        {
          path: "main.tf",
          language: "terraform",
          content: "resource \"aws_s3_bucket\" \"artifact\" {}\n"
        }
      ],
      diagram: {
        nodes: [
          {
            id: "cognito",
            label: "Cognito User Pool"
          },
          {
            id: "lambda",
            label: "Lambda Function"
          }
        ],
        edges: [
          {
            from: "cognito",
            to: "lambda"
          }
        ]
      }
    },
    buildDefaultGenerationSettings()
  );

  assert.equal(draft.name, "Governed Platform With Cognito");
  assert.equal(draft.limitations[0], "Human Review Required: The generated infrastructure still needs human review before apply.");
  assert.deepEqual(draft.modules[0], {
    moduleId: "terraform-aws-lambda",
    label: "Lambda Service",
    source: "terraform-aws-modules/lambda/aws",
    visibility: "public",
    reason: "Matched prioritized module catalog entry Lambda Service."
  });
  assert.equal(draft.files[0]?.language, "md");
  assert.equal(draft.files[1]?.language, "hcl");
  assert.equal(draft.diagram.nodes[0]?.kind, "auth");
  assert.deepEqual(draft.diagram.edges[0], {
    source: "cognito",
    target: "lambda"
  });
});

void test("builds a fallback diagram when the model omits node kinds entirely", () => {
  const draft = normalizeGenerationDraft(
    {
      name: "artifact platform",
      summary: "Stores generated infrastructure.",
      explanation: [
        {
          title: "Storage",
          detail: "Writes artifacts to S3."
        }
      ],
      limitations: ["Review before apply."],
      modules: [
        {
          source: "terraform-aws-modules/s3-bucket/aws"
        }
      ],
      files: [
        {
          path: "main.tf",
          content: "module \"artifact_bucket\" {}\n"
        }
      ],
      diagram: {}
    },
    buildDefaultGenerationSettings()
  );

  assert.equal(draft.diagram.nodes.length, 1);
  assert.equal(draft.diagram.nodes[0]?.kind, "storage");
});

void test("enforces required governance modules when model output omits them", () => {
  const settings = buildDefaultGenerationSettings();
  const requiredModule = settings.modules[0];
  if (!requiredModule) {
    throw new Error("Expected at least one default module.");
  }

  settings.modules = settings.modules.map((module, index) => ({
    ...module,
    required: index === 0
  }));

  const draft = normalizeGenerationDraft(
    {
      name: "minimal platform",
      summary: "Small generated stack.",
      explanation: [
        {
          title: "Overview",
          detail: "Generated from a constrained prompt."
        }
      ],
      limitations: ["Review before apply."],
      modules: [
        {
          source: "terraform-aws-modules/lambda/aws"
        }
      ],
      files: [
        {
          path: "main.tf",
          language: "terraform",
          content: "resource \"aws_s3_bucket\" \"artifact\" {}\n"
        }
      ]
    },
    settings
  );

  assert.equal(draft.modules.some((module) => module.moduleId === requiredModule.moduleId), true);
  assert.equal(draft.modules[0]?.moduleId, requiredModule.moduleId);
  assert.match(draft.modules[0]?.reason ?? "", /Required by organization policy/i);
});
