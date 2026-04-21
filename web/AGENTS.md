# Web Handbook

`web/` is a static-exported Next.js SPA with a sharp signed-out experience and
an authenticated workbench for submissions, history, diagrams, and admin
controls.

## Rules

- Keep the signed-out and signed-in experiences visibly different.
- Keep copy short. This product should rely more on structure, motion, and data
  than on long explanations.
- Preserve the existing design language: restrained enterprise UI, generous
  space, focused motion, and a strong central composer.
- Keep auth gating explicit: generation, history, and admin functionality only
  exist for signed-in users.
- Prefer shared formatting and state helpers over one-off component-local
  versions.
- If a UI change affects workflows or response shapes, update contracts and
  tests alongside the component work.
