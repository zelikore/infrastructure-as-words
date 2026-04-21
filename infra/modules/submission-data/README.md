# Submission Data Module

Creates the persistent data plane for generated infrastructure requests:

- DynamoDB table for submissions, details, governance settings, and budget state
- S3 bucket for generated artifact archives

Security defaults:

- SSE enabled for both DynamoDB and S3
- S3 public access blocked
- PITR enabled for DynamoDB
