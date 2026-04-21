# Packages Handbook

`packages/` currently holds the shared contract surface for the repo.

## What lives here

- `contracts` owns Zod schemas, DTOs, and shared TypeScript types used by the
  API and web app.

## Rules

- Make schema changes here before updating API or web consumers.
- Prefer tightening schemas over adding downstream defensive parsing.
- Keep package exports narrow and intentional.
- Avoid runtime side effects at module scope.
- When changing contracts, add or update tests under `tests/src/`.
