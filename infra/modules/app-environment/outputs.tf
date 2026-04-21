output "app_url" {
  value = module.static_website.app_url
}

output "api_url" {
  value = module.http_api_service.api_url
}

output "user_pool_client_id" {
  value = module.cognito_web_client.user_pool_client_id
}

output "web_bucket_name" {
  value = module.static_website.web_bucket_name
}

output "artifacts_bucket_name" {
  value = module.submission_data.artifacts_bucket_name
}

output "web_distribution_id" {
  value = module.static_website.web_distribution_id
}

output "submission_table_name" {
  value = module.submission_data.submission_table_name
}

output "submission_table_arn" {
  value = module.submission_data.submission_table_arn
}

output "artifacts_bucket_arn" {
  value = module.submission_data.artifacts_bucket_arn
}

output "http_api_id" {
  value = module.http_api_service.http_api_id
}

output "observability_dashboard_name" {
  value = module.observability_suite.dashboard_name
}

output "observability_alerts_topic_arn" {
  value = module.observability_suite.alerts_topic_arn
}

output "observability_lambda_log_group_name" {
  value = module.observability_suite.lambda_log_group_name
}

output "observability_api_log_group_name" {
  value = module.observability_suite.api_access_log_group_name
}
