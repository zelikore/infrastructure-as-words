locals {
  system_name                         = replace(lower(lookup(var.tags, "Project", "infrastructure-as-words")), " ", "-")
  observability_dashboard_name        = "${local.system_name}-${var.environment_name}-observability"
  observability_alerts_topic_name     = "${local.system_name}-${var.environment_name}-alerts"
  observability_lambda_log_group_name = "/aws/lambda/${var.lambda_function_name}"
  observability_api_log_group_name    = "/aws/apigateway/${var.environment_name}-${local.system_name}"
  observability_alerts_topic_arn      = "arn:aws:sns:${var.aws_region}:${var.account_id}:${local.observability_alerts_topic_name}"
}

module "submission_data" {
  source = "../submission-data"

  environment_name      = var.environment_name
  is_prod               = var.is_prod
  submission_table_name = var.submission_table_name
  artifacts_bucket_name = var.artifacts_bucket_name
  tags = merge(var.tags, {
    Module = "app-environment"
  })
}

module "cognito_web_client" {
  source = "../cognito-web-client"

  environment_name    = var.environment_name
  user_pool_id        = var.cognito_user_pool_id
  callback_urls       = var.callback_urls
  logout_urls         = var.logout_urls
  cognito_read_scope  = var.cognito_read_scope
  cognito_write_scope = var.cognito_write_scope
}

module "http_api_service" {
  source = "../http-api-service"

  environment_name                    = var.environment_name
  aws_region                          = var.aws_region
  hosted_zone_id                      = var.hosted_zone_id
  api_domain                          = var.api_domain
  auth_domain                         = var.auth_domain
  allowed_origins                     = var.allowed_origins
  lambda_function_name                = var.lambda_function_name
  api_bundle_path                     = var.api_bundle_path
  submission_table_name               = module.submission_data.submission_table_name
  submission_table_arn                = module.submission_data.submission_table_arn
  artifacts_bucket_name               = module.submission_data.artifacts_bucket_name
  artifacts_bucket_arn                = module.submission_data.artifacts_bucket_arn
  cognito_user_pool_client_id         = module.cognito_web_client.user_pool_client_id
  cognito_issuer                      = var.cognito_issuer
  cognito_read_scope                  = var.cognito_read_scope
  cognito_write_scope                 = var.cognito_write_scope
  bedrock_model_ids                   = var.bedrock_model_ids
  bedrock_invoke_resource_arns        = var.bedrock_invoke_resource_arns
  admin_email_parameter_name          = var.admin_email_parameter_name
  admin_email_parameter_arn           = var.admin_email_parameter_arn
  observability_dashboard_name        = local.observability_dashboard_name
  observability_alerts_topic_arn      = local.observability_alerts_topic_arn
  observability_lambda_log_group_name = local.observability_lambda_log_group_name
  observability_api_log_group_name    = local.observability_api_log_group_name
  tags = merge(var.tags, {
    Module = "app-environment"
  })
}

module "observability_suite" {
  source = "../observability-suite"

  environment_name             = var.environment_name
  aws_region                   = var.aws_region
  dashboard_name               = local.observability_dashboard_name
  alerts_topic_name            = local.observability_alerts_topic_name
  notification_email_endpoints = var.admin_email_allowlist
  lambda_function_name         = var.lambda_function_name
  lambda_log_group_name        = local.observability_lambda_log_group_name
  api_id                       = module.http_api_service.http_api_id
  api_stage_name               = "$default"
  api_access_log_group_name    = local.observability_api_log_group_name
  submission_table_name        = module.submission_data.submission_table_name
  tags = merge(var.tags, {
    Module = "app-environment"
  })
}

module "static_website" {
  source = "../static-website"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  environment_name           = var.environment_name
  is_prod                    = var.is_prod
  hosted_zone_id             = var.hosted_zone_id
  app_domain                 = var.app_domain
  web_bucket_name            = var.web_bucket_name
  content_security_policy    = var.content_security_policy
  cloudfront_zone_id         = var.cloudfront_zone_id
  rewrite_function_code_path = var.rewrite_function_code_path
  tags = merge(var.tags, {
    Module = "app-environment"
  })
}
