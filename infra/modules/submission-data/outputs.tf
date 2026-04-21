output "submission_table_name" {
  value = aws_dynamodb_table.submissions.name
}

output "submission_table_arn" {
  value = aws_dynamodb_table.submissions.arn
}

output "artifacts_bucket_name" {
  value = aws_s3_bucket.artifacts.bucket
}

output "artifacts_bucket_arn" {
  value = aws_s3_bucket.artifacts.arn
}

output "artifacts_bucket_regional_domain_name" {
  value = aws_s3_bucket.artifacts.bucket_regional_domain_name
}
