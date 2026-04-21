output "app_url" {
  value = local.app_origin
}

output "api_url" {
  value = local.api_origin
}

output "auth_url" {
  value = local.auth_origin
}

output "user_pool_id" {
  value = local.cognito_user_pool_id
}

output "user_pool_client_id" {
  value = module.application_platform.user_pool_client_id
}

output "web_bucket_name" {
  value = module.application_platform.web_bucket_name
}

output "artifacts_bucket_name" {
  value = module.application_platform.artifacts_bucket_name
}

output "web_distribution_id" {
  value = module.application_platform.web_distribution_id
}

output "submission_table_name" {
  value = module.application_platform.submission_table_name
}

output "http_api_id" {
  value = module.application_platform.http_api_id
}

output "observability_dashboard_name" {
  value = module.application_platform.observability_dashboard_name
}

output "observability_alerts_topic_arn" {
  value = module.application_platform.observability_alerts_topic_arn
}
