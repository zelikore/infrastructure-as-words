module "application_platform" {
  source = "../modules/app-environment"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  environment_name             = var.environment_name
  is_prod                      = local.is_prod
  aws_region                   = var.aws_region
  account_id                   = var.account_id
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
  cognito_user_pool_id         = local.cognito_user_pool_id
  cognito_issuer               = local.cognito_issuer
  cognito_read_scope           = local.cognito_read_scope
  cognito_write_scope          = local.cognito_write_scope
  bedrock_model_ids            = var.bedrock_model_ids
  bedrock_invoke_resource_arns = var.bedrock_invoke_resource_arns
  admin_email_allowlist        = [nonsensitive(data.aws_ssm_parameter.admin_email.value)]
  admin_email_parameter_name   = data.terraform_remote_state.shared_auth.outputs.admin_email_parameter_name
  admin_email_parameter_arn    = data.terraform_remote_state.shared_auth.outputs.admin_email_parameter_arn
  content_security_policy      = local.content_security_policy
  cloudfront_zone_id           = local.cloudfront_zone_id
  rewrite_function_code_path   = "${path.module}/cloudfront-rewrite.js"
  tags                         = local.common_tags
}
