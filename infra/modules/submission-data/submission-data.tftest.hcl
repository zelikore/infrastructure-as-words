mock_provider "aws" {}

run "plan_dev_data_plane" {
  command = plan

  variables {
    environment_name      = "dev"
    is_prod               = false
    submission_table_name = "iaw-submissions-dev"
    artifacts_bucket_name = "iaw-artifacts-dev"
    tags = {
      Environment = "dev"
      ManagedBy   = "terraform-test"
    }
  }

  assert {
    condition     = aws_dynamodb_table.submissions.name == "iaw-submissions-dev"
    error_message = "Submission table name should be passed through to DynamoDB."
  }

  assert {
    condition     = aws_dynamodb_table.submissions.deletion_protection_enabled == false
    error_message = "Deletion protection should be disabled in non-production environments."
  }

  assert {
    condition     = aws_s3_bucket.artifacts.bucket == "iaw-artifacts-dev"
    error_message = "Artifacts bucket name should be passed through to S3."
  }

  assert {
    condition     = aws_s3_bucket.artifacts.force_destroy == true
    error_message = "Artifacts bucket should allow force destroy in non-production environments."
  }
}

run "plan_prod_data_plane" {
  command = plan

  variables {
    environment_name      = "prod"
    is_prod               = true
    submission_table_name = "iaw-submissions-prod"
    artifacts_bucket_name = "iaw-artifacts-prod"
    tags = {
      Environment = "prod"
      ManagedBy   = "terraform-test"
    }
  }

  assert {
    condition     = aws_dynamodb_table.submissions.deletion_protection_enabled == true
    error_message = "Deletion protection should be enabled in production."
  }

  assert {
    condition     = aws_s3_bucket.artifacts.force_destroy == false
    error_message = "Artifacts bucket should not be force-destroyable in production."
  }
}
