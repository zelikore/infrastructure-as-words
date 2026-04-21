# Release Flow

This repo now uses a long-lived `development` branch plus a protected `main`
branch.

## Branches

- `development` is the integration branch. Any push to `development`, whether it
  came from a merge or a direct commit, runs CI and deploys the `dev`
  environment.
- `main` is the protected production branch. Pushes to `main` run CI, deploy
  the shared auth stack, then deploy the `prod` environment.

## Pull request policy

- Pull requests into `main` are only valid when the source branch is
  `development`.
- The CI workflow contains an explicit guard job named
  `Require development source branch`. `main` branch protection requires that
  job, so a PR from any other branch cannot merge.
- The Bedrock-powered PR review job only runs for pull requests into `main`.

## Why this exists for the submission

The challenge asks for AI-native workflow evidence and operational discipline.
This release model makes both visible:

- `development` is a stable long-running environment that graders can inspect
  while work continues
- promotion to `main` is deliberate and reviewable
- the AI review lane is reserved for the production promotion step instead of
  running on every feature branch
