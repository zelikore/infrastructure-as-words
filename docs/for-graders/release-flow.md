# Release Flow

This repo uses a two-branch delivery model:

- `dev` is the integration branch. Pushes to `dev` run CI and deploy the `dev`
  environment.
- `prod` is the production branch. Pushes to `prod` run CI, deploy the shared
  auth stack, then deploy the `prod` environment.

## Pull request review

Pull requests are reviewed in three layers:

1. Standard CI runs `npm run check` and `npm run build:all`.
2. A Bedrock-powered PR review job reads the repo-owned requirements from
   `tools/pr-review-requirements.json`.
3. The PR template requires the author to explain how AI was used and what they
   manually verified.

## Why this exists for the submission

The challenge asks for AI-native development workflow evidence and operational
discipline. This flow makes both visible:

- the branch promotion model is explicit
- PRs have repeatable AI review against configured requirements
- reviewers can inspect a real PR, not just a claim that AI was used
