# App Environment Module

Composes the full application environment used by this repository:

- submission data plane
- Cognito SPA client
- Lambda + HTTP API
- shared-admin runtime lookup via SSM parameter metadata
- CloudWatch alarms, dashboard, alert routing, and admin observability reads
- static SPA delivery on S3 + CloudFront

Use this when a team needs a complete browser application environment with a
shared Cognito identity plane and a separately deployed auth stack.
