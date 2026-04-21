# Infrastructure as Words

Infrastructure as Words is a Bedrock-backed infrastructure design workspace.
Authenticated users describe the platform they want, the system generates a
governed Terraform-oriented response, stores the run history, saves a zip
artifact, and renders an infrastructure diagram in the browser.

This repository was built by Elijah Faviel for the CVS team take-home coding
challenge.

## Start Here

If you are grading the submission, this is the fastest path through the repo:

1. Read `docs/for-graders/ai-usage.md` for the AI workflow evidence and the
   product-level AI architecture.
2. Read `docs/for-graders/release-flow.md` for the branch model, PR policy, and
   deployment promotion flow.
3. Open `diagrams/infrastructure-as-words-platform.svg` for the system diagram.
   The editable source lives at `diagrams/infrastructure-as-words-platform.drawio.xml`.
4. Open `web/components/app-shell.tsx` to see the signed-out gate, signed-in
   workspace shell, and top-level UX flow.
5. Open `services/api/src/lambda.ts` and
   `services/api/src/generation-service.ts` to see the API entrypoint,
   generation orchestration, persistence, and response shaping.
6. Open `infra/modules/README.md`, `infra/modules/module-catalog.json`, and the
   module directories under `infra/modules/` to see the reusable Terraform
   surface.
7. Open `.github/workflows/` to inspect CI, deployment, and Bedrock PR review.

## What the product does

- Cognito-hosted sign-in gates all generation functionality behind auth.
- A signed-in user submits an infrastructure request.
- The API runs a governed generation flow against Amazon Bedrock.
- The run is stored in DynamoDB with timestamps, status, summary, cost, and
  diagram JSON.
- A downloadable zip artifact is written to S3.
- The UI shows current and historical runs with filters, ordering, cost, and
  diagram detail.
- Admin settings control governance metadata, module preferences, and budget
  guardrails.

## Repository Guide

### Product code

- `web/`
  Next.js static SPA, exported for S3/CloudFront hosting. Key files:
  - `web/components/app-shell.tsx`: top-level signed-in and signed-out shell
  - `web/components/workspace-overview.tsx`: request entry point
  - `web/components/workspace-history-view.tsx`: sortable/filterable run list
  - `web/components/submission-detail-panel.tsx`: diagram and artifact detail
  - `web/components/governance-page.tsx`: admin governance and observability UI
  - `web/app/globals.css`: shared design system and layout language

- `services/api/`
  Typed Lambda API. Key files:
  - `services/api/src/lambda.ts`: API Gateway/Lambda handler
  - `services/api/src/generation-service.ts`: request lifecycle orchestration
  - `services/api/src/bedrock-generator.ts`: Bedrock invocation and output
    normalization
  - `services/api/src/repository.ts`: DynamoDB persistence
  - `services/api/src/admin-auth.ts`: admin SSM lookup and authorization
  - `services/api/src/observability.ts`: structured JSON logging helpers

- `packages/contracts/`
  Shared schemas and API contracts used by both the web app and the Lambda API.

### Infrastructure code

- `infra/modules/`
  Reusable Terraform modules. The catalog and metadata are committed so the same
  module descriptions can be reused in governance and AI prompting.
  - `infra/modules/app-environment/`: composed environment module
  - `infra/modules/shared-auth/`: shared Cognito custom-domain stack
  - `infra/modules/http-api-service/`: Lambda + API Gateway
  - `infra/modules/submission-data/`: DynamoDB + S3 run storage
  - `infra/modules/static-website/`: S3 + CloudFront front-end hosting
  - `infra/modules/observability-suite/`: dashboard, alarms, SNS
  - `infra/modules/*.tftest.hcl`: Terraform module tests

- `infra/terraform/`
  Environment root for the application platform. It consumes the reusable
  modules for both `dev` and `prod`.

- `infra/terraform-auth/`
  Separate shared-auth root so the Cognito custom domain can be deployed and
  managed independently from any one environment.

- `infra/config/`
  Typed source of truth for environment names, domains, and deployment inputs.

### Delivery, testing, and AI workflow

- `.github/workflows/ci.yml`
  Runs workflow linting, repository checks, artifact builds, and the branch
  guard that only allows `development` to promote into `main`.

- `.github/workflows/deploy.yml`
  Pushes to `development` deploy the `dev` environment. Pushes to `main` deploy
  shared auth and the `prod` environment.

- `.github/workflows/pr-review.yml`
  Runs the Bedrock-powered PR review lane, but only for pull requests into
  `main`.

- `tools/pr-review-requirements.json`
  Repo-owned PR review criteria consumed by the AI review workflow.

- `tests/`
  Node-level tests for normalization, observability, and other critical logic.

- `scripts/`
  Deployment, GitHub OIDC bootstrap, and test support scripts.

- `AGENTS.md` plus the scoped `*/AGENTS.md` files
  Repo instructions for AI-assisted development in this codebase.

## Architecture Diagram

![Infrastructure as Words architecture](./diagrams/infrastructure-as-words-platform.svg)

## Commands

```bash
npm install --include-workspace-root --workspaces
npm run build:shared
npm run lint:type
npm run typecheck
npm run test:critical
npm test
npm run test:watch
npm run check
npm run build:all
npm run validate:infra
npm run deploy:auth
DEPLOY_ENV=dev npm run deploy:env
DEPLOY_ENV=prod npm run deploy:env
npm run deploy:all
```

For the first shared-auth deployment, set `IAW_ADMIN_EMAIL` explicitly. After
the shared auth stack exists, `scripts/deploy-auth.sh` reuses the live value
from the `"/infrastructure-as-words/admin-email"` SSM parameter so a real admin
email does not need to live in source control.

## Submission Docs

- `docs/for-graders/ai-usage.md`
  How AI was used in development and how Bedrock is used in the product.
- `docs/for-graders/release-flow.md`
  The long-running `development` environment model and the protected
  `development -> main` promotion flow.
- `diagrams/infrastructure-as-words-platform.svg`
  Architecture diagram for reviewers.

## Environments

- `dev`
  - App: `https://dev.infrastructure-as-words.com`
  - API: `https://api.dev.infrastructure-as-words.com`
  - Auth: `https://auth.infrastructure-as-words.com`

- `prod`
  - App: `https://infrastructure-as-words.com`
  - API: `https://api.infrastructure-as-words.com`
  - Auth: `https://auth.infrastructure-as-words.com`

## Branch and Deployment Model

- `development` is the long-running integration branch.
- Any push to `development` runs CI and deploys the `dev` environment.
- `main` is the protected production branch.
- Pull requests into `main` must come from `development`.
- The Bedrock PR review workflow only runs on pull requests into `main`.
- Any push to `main` runs CI, deploys shared auth, and deploys `prod`.

## GitHub Actions and AWS Setup

- Run `./scripts/configure-github-actions-oidc.sh` from a workstation with AWS
  CLI and GitHub CLI access. It creates or updates the GitHub OIDC provider,
  the branch-bound IAM roles, and the repository variables used by Actions.
- `AWS_DEPLOY_ROLE_ARN_DEV` trusts the `development` branch deploy workflow.
- `AWS_DEPLOY_ROLE_ARN_PROD` trusts the `main` branch deploy workflow.
- `AWS_REVIEW_ROLE_ARN` trusts the PR review workflow.
- The deploy roles need Terraform apply access to the services managed by this
  repo: ACM, API Gateway, CloudFront, Cognito, DynamoDB, IAM, Lambda, Route53,
  S3, SNS, SSM, CloudWatch, and STS.
