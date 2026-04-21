output "app_url" {
  value = "https://${var.app_domain}"
}

output "web_bucket_name" {
  value = aws_s3_bucket.web.bucket
}

output "web_bucket_arn" {
  value = aws_s3_bucket.web.arn
}

output "web_distribution_id" {
  value = aws_cloudfront_distribution.web.id
}

output "web_distribution_domain_name" {
  value = aws_cloudfront_distribution.web.domain_name
}
