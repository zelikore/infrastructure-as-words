# Tests Handbook

`tests/` contains the default Node test lane for repo behavior and contract
verification.

## Commands

- `npm test` runs the full Node suite.
- `npm run test:critical` runs the quick regression gate from
  `tests/critical-test-gate.txt`.
- `node tests/run-node-tests.mjs <file-or-directory>` runs focused suites.
- `npm run test:watch` keeps the Node runner open in watch mode.

## Rules

- Prefer integration-style tests over helper-only unit noise.
- Add tests when contracts, security boundaries, persistence, prompt
  normalization, diagrams, or observability behavior changes.
- Keep live AWS/browser checks out of the default Node lane unless the task is
  explicitly about live verification.
- Use the critical gate for high-signal suites that should stay fast and stable.
