# Services Handbook

`services/` currently contains the Lambda API that orchestrates generation,
storage, admin governance, and observability.

## Rules

- Keep route validation and response shaping aligned with
  `@infrastructure-as-words/contracts`.
- Keep persistence access behind repository helpers instead of scattering raw
  DynamoDB calls across handlers.
- Keep admin authorization tied to Cognito identity plus the SSM-backed admin
  email configuration.
- Log structured events for request and generation paths when behavior changes.
- Treat Bedrock responses as untrusted input. Normalize and validate before the
  result becomes user-facing data or artifact content.
- Add tests for behavior changes in auth, budget, normalization, persistence,
  or observability.
