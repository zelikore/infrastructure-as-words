# Agent Handbook

_Last verified: 2026-04-20 (commit HEAD)_

This monorepo contains Infrastructure as Words: a static Next.js SPA, a typed
AWS Lambda API, shared TypeScript contracts, and Terraform modules that deploy
the application plus its shared Cognito auth plane. Keep the repo strict,
deployable, and easy to audit.

## Daily workflow

- Install once with `npm install --include-workspace-root --workspaces`.
- Build shared dependencies with `npm run build:shared`.
- Build everything with `npm run build:all`.
- Lint with `npm run lint`; use `npm run lint:type` before closing work.
- Run the quick regression gate with `npm run test:critical`.
- Run the full Node suite with `npm test` or
  `node tests/run-node-tests.mjs <file-or-directory>`.
- Use `npm run test:watch` when iterating on the Node suite.
- Validate Terraform with `npm run validate:infra`.
- Before you mark work complete, run `npm run check`.
- Never loosen TypeScript, import, hook, or file-budget rules to make a change
  pass. Refactor instead.

## Where to look

- [`packages/`](packages/AGENTS.md) contains shared contracts and schema types.
- [`services/`](services/AGENTS.md) contains the Lambda API and generation
  runtime.
- [`web/`](web/AGENTS.md) contains the static Next.js SPA.
- [`infra/`](infra/AGENTS.md) contains Terraform roots, modules, and typed
  config.
- [`tests/`](tests/AGENTS.md) contains the Node test harness and regression
  suites.
- [`scripts/`](scripts/AGENTS.md) contains build, deploy, and repo-check
  automation.
- `docs/for-graders/` contains reviewer-facing notes, including the AI usage
  guide.

## Working a change

1. Read the nearest scoped `AGENTS.md` before editing a workspace.
2. Update shared contracts first when API and web behavior both depend on the
   same DTOs or schemas.
3. Keep runtime validation in shared schemas when possible instead of redoing
   shape checks ad hoc in the web or Lambda handler.
4. Keep sensitive or admin runtime configuration in AWS-managed stores such as
   SSM Parameter Store, and thread those values through Terraform outputs and
   Lambda env metadata intentionally.
5. Add or extend tests when behavior, persistence, security boundaries,
   governance logic, prompt normalization, or infrastructure contracts change.
6. Update docs when the submission evidence changes, especially
   `docs/for-graders/ai-usage.md` when the AI workflow or in-product AI surface
   changes materially.
7. Prefer small reusable Terraform modules and shared TypeScript helpers over
   repeating glue code in roots, handlers, or components.
8. Run `npm run check` before finishing.

## Writing rules

- Keep signed-out and signed-in product writing distinct.
- Use short, direct language. This product should feel precise, not chatty.
- Prefer concrete nouns such as request, run, diagram, artifact, module, and
  budget over vague platform copy.
- Avoid filler such as "streamline", "powerful", or "all in one place" unless
  the sentence immediately makes the claim concrete.
- The UI should stay visually strong without relying on heavy copy. When in
  doubt, cut text and let layout, motion, and data do more work.

## Shared workspace safety

This repo may be dirty while you work.

- Do not revert unrelated user changes.
- Avoid destructive git commands unless explicitly requested.
- Keep drive-by cleanup out of scope unless it is required for the task or to
  keep checks green.
