module "environment" {
  source = "../app-environment"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  environment_name             = var.environment_name
  is_prod                      = var.is_prod
  aws_region                   = var.aws_region
  hosted_zone_id               = var.hosted_zone_id
  app_domain                   = var.app_domain
  api_domain                   = var.api_domain
  auth_domain                  = var.auth_domain
  allowed_origins              = var.allowed_origins
  callback_urls                = var.callback_urls
  logout_urls                  = var.logout_urls
  web_bucket_name              = var.web_bucket_name
  artifacts_bucket_name        = var.artifacts_bucket_name
  submission_table_name        = var.submission_table_name
  lambda_function_name         = var.lambda_function_name
  api_bundle_path              = var.api_bundle_path
  cognito_user_pool_id         = var.cognito_user_pool_id
  cognito_issuer               = var.cognito_issuer
  cognito_read_scope           = var.cognito_read_scope
  cognito_write_scope          = var.cognito_write_scope
  bedrock_model_ids            = var.bedrock_model_ids
  bedrock_invoke_resource_arns = var.bedrock_invoke_resource_arns
  admin_email_allowlist        = var.admin_email_allowlist
  admin_email_parameter_name   = var.admin_email_parameter_name
  admin_email_parameter_arn    = var.admin_email_parameter_arn
  content_security_policy      = "default-src 'self'; connect-src 'self' https://${var.api_domain} https://${var.auth_domain}; object-src 'none'; frame-ancestors 'none';"
  cloudfront_zone_id           = "Z2FDTNDATAQYW2"
  rewrite_function_code_path   = var.rewrite_function_code_path
  tags = merge(var.tags, {
    Example = "website-with-api"
  })
}
