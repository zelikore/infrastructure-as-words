# Terraform Module Catalog

This directory contains reusable Terraform modules used by the environment roots under:

- `infra/terraform` (dev/prod application environments)
- `infra/terraform-auth` (shared auth stack)

## Metadata and AI Governance

Each module includes:

- `README.md`: human documentation for behavior, inputs, outputs, and usage boundaries
- `module-metadata.json`: machine-readable metadata for governance and AI prompt context

The aggregate index is `module-catalog.json`, which references each module metadata file.

In the application API layer, governance settings store module metadata fields (visibility, priority, category, required, capabilities, and documentation) and inject that context into the Bedrock generation prompt. Any module marked `required` in admin governance is automatically enforced into normalized generation output.

## Terraform Tests

Module tests are stored next to modules as `*.tftest.hcl` and run in CI through:

- `npm run validate --workspace @infrastructure-as-words/infra`

Current tested modules:

- `submission-data`
- `cognito-web-client`

Reusable composition modules:

- `app-environment`: full application environment baseline used by this repo
- `observability-suite`: alarms, dashboard, and alert routing baseline
- `docs-website`: opinionated static-site profile for docs/marketing delivery
- `example-static-website`: example wrapper over `docs-website`
- `example-website-with-api`: example wrapper over `app-environment`
