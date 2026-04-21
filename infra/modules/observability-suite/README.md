# Observability Suite Module

Creates the shared observability layer for an application environment:

- CloudWatch alarms for Lambda, HTTP API, and DynamoDB health signals
- SNS topic and email subscriptions for alert delivery
- CloudWatch dashboard for the service control plane

Use this module when an environment needs first-class operational visibility with
alerting and a single dashboard entrypoint.
