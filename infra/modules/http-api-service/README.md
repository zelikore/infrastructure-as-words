# HTTP API Service Module

Deploys the API service runtime and public API entrypoint:

- Lambda runtime and tightly scoped IAM policies
- API Gateway HTTP API routes with Cognito JWT scopes
- API access logs in CloudWatch
- Runtime admin identity lookup via SSM Parameter Store
- structured observability env wiring for dashboard and alerts
- API custom domain with ACM DNS validation + Route53 aliases

This module expects upstream data-plane and Cognito client inputs.
