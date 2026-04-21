# Scripts Handbook

`scripts/` owns repeatable repo automation for builds, deploys, Terraform var
rendering, and local validation.

## Rules

- Keep scripts repo-root aware and safe to run from any current working
  directory.
- Prefer composing root npm scripts over duplicating long command chains across
  shell scripts.
- Keep deploy scripts idempotent and explicit about which environment they
  target.
- If a shell script repeats root validation logic, move that logic into the
  root npm script layer and call the shared command instead.
- Add guardrails and clear failure messages when a script depends on generated
  artifacts or AWS state.
