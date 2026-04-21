# AI Usage Guide For Reviewers

This submission uses AI in two places:

1. As a development collaborator while building the repository.
2. As a product capability inside Infrastructure as Words itself.

## AI in development

The development workflow used an AI coding agent as an active implementation
partner rather than as a passive autocomplete tool.

### What the AI helped build

- Terraform module refactors and environment composition
- strict TypeScript contract shaping and normalization logic
- Bedrock orchestration and cost-accounting flows
- UI iteration for the signed-out and signed-in experiences
- observability, admin governance, and SSM-backed runtime configuration
- deployment verification and AWS environment checks

### How the workflow was constrained

- Repo instructions for the AI agent live in [`AGENTS.md`](../../AGENTS.md) and
  the scoped handbooks under `packages/`, `services/`, `web/`, `infra/`,
  `tests/`, and `scripts/`.
- The AI was kept inside a strict feedback loop: schema validation, Node tests,
  Terraform validation/tests, and live AWS verification were used to confirm
  output before changes were treated as complete.
- Sensitive configuration was not left in prompts or source. Runtime admin
  configuration moved into SSM Parameter Store and is retrieved at runtime by
  Lambda.

### Reviewer evidence map

- Root agent workflow: [`AGENTS.md`](../../AGENTS.md)
- Pull request workflow template:
  [`.github/pull_request_template.md`](../../.github/pull_request_template.md)
- AI PR review workflow:
  [`.github/workflows/pr-review.yml`](../../.github/workflows/pr-review.yml)
- AI PR review requirements:
  [`tools/pr-review-requirements.json`](../../tools/pr-review-requirements.json)
- Shared contracts: [`packages/contracts/src/submissions.ts`](../../packages/contracts/src/submissions.ts)
- Test harness: [`tests/run-node-tests.mjs`](../../tests/run-node-tests.mjs)
- Critical regression gate:
  [`tests/critical-test-gate.txt`](../../tests/critical-test-gate.txt)
- Terraform module tests:
  [`infra/modules/submission-data/submission-data.tftest.hcl`](../../infra/modules/submission-data/submission-data.tftest.hcl)
  and
  [`infra/modules/cognito-web-client/cognito-web-client.tftest.hcl`](../../infra/modules/cognito-web-client/cognito-web-client.tftest.hcl)

## AI in the product

Infrastructure as Words is itself an AI-assisted internal platform tool.

### Product flow

1. An authenticated user describes the infrastructure they want.
2. The API loads admin-controlled governance settings, prioritized modules, and
   module documentation.
3. Bedrock generates a governed Terraform starter output.
4. The service normalizes the model output into a strict internal contract,
   stores the run in DynamoDB, writes a zip artifact to S3, and returns a live
   browser diagram model.
5. The user can inspect history, cost, limitations, and download artifacts.

### Product-side AI controls

- Bedrock model output is normalized and validated before use:
  [`services/api/src/generation-normalizer.ts`](../../services/api/src/generation-normalizer.ts)
- Governance settings and module metadata are injected into the prompt:
  [`services/api/src/bedrock-generator.ts`](../../services/api/src/bedrock-generator.ts)
  and
  [`services/api/src/module-catalog.ts`](../../services/api/src/module-catalog.ts)
- Each generation request tracks AI usage and cost:
  [`services/api/src/bedrock-pricing.ts`](../../services/api/src/bedrock-pricing.ts),
  [`services/api/src/bedrock-usage.ts`](../../services/api/src/bedrock-usage.ts),
  and
  [`services/api/src/generation-budget.ts`](../../services/api/src/generation-budget.ts)
- The default monthly AI budget is capped at `$20` and is admin-configurable:
  [`packages/contracts/src/submissions.ts`](../../packages/contracts/src/submissions.ts)
- The output includes diagram data for the React Flow UI:
  [`web/components/submission-diagram.tsx`](../../web/components/submission-diagram.tsx)
- The repo also includes a committed architecture artifact for reviewers:
  [`diagrams/infrastructure-as-words-platform.drawio.xml`](../../diagrams/infrastructure-as-words-platform.drawio.xml)
  and
  [`diagrams/infrastructure-as-words-platform.svg`](../../diagrams/infrastructure-as-words-platform.svg)

## Why this matters for the challenge

The goal was not to merely say "AI was used." The repo is structured so the
grader can inspect:

- the explicit instructions given to the development agent
- the validation and safety rails around AI-authored changes
- the concrete product surface where Bedrock is used as a governed capability
- the operational controls around cost, observability, and runtime config
