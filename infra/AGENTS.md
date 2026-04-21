# Infra Handbook

`infra/` contains Terraform roots, reusable modules, module metadata, typed env
config, and the scripts that render deploy-time variables.

## Rules

- Prefer module changes over adding more logic directly in environment roots.
- Keep shared auth separate from app environments unless a change genuinely
  belongs to an environment.
- Document module behavior in `README.md` and `module-metadata.json` whenever a
  module contract changes.
- Add or update `*.tftest.hcl` coverage when module behavior changes.
- Keep IAM least-privilege. Avoid wildcard permissions.
- Keep runtime-sensitive configuration in SSM and thread the parameter
  name/ARN through Terraform intentionally.
- Run `npm run validate:infra` after Terraform changes.
- Use `terraform fmt` through the repo scripts or workspace scripts; do not
  hand-format HCL inconsistently.
