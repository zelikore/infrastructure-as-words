# Shared Auth Module

Creates a shared Cognito identity plane:

- User pool with secure password policy
- Resource server scopes (`read` and `write`)
- Shared SSM parameter for runtime admin identity lookup
- Seeded admin user in the shared user pool
- Cognito hosted UI custom domain
- ACM cert + Route53 aliases for auth domain

Use this module once and share its outputs with consuming environment stacks.
