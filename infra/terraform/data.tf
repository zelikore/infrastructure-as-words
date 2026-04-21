data "terraform_remote_state" "shared_auth" {
  backend = "s3"

  config = {
    bucket = var.terraform_state_bucket_name
    key    = var.shared_auth_state_key
    region = var.aws_region
  }
}

data "aws_ssm_parameter" "admin_email" {
  name = data.terraform_remote_state.shared_auth.outputs.admin_email_parameter_name
}

locals {
  is_prod     = var.environment_name == "prod"
  app_origin  = "https://${var.app_domain}"
  api_origin  = "https://${var.api_domain}"
  auth_origin = "https://${var.auth_domain}"
  admin_email_allowlist = [
    for email in split(",", nonsensitive(data.aws_ssm_parameter.admin_email.value)) :
    lower(trimspace(email))
    if trimspace(email) != ""
  ]
  cognito_user_pool_id = data.terraform_remote_state.shared_auth.outputs.user_pool_id
  cognito_read_scope   = data.terraform_remote_state.shared_auth.outputs.read_scope
  cognito_write_scope  = data.terraform_remote_state.shared_auth.outputs.write_scope
  cognito_issuer       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${local.cognito_user_pool_id}"
  common_tags = merge(var.tags, {
    Repository = "infrastructure-as-words"
  })
  cloudfront_zone_id = "Z2FDTNDATAQYW2"
  content_security_policy = join(
    " ",
    [
      "default-src 'self';",
      "base-uri 'self';",
      "connect-src 'self' ${local.api_origin} ${local.auth_origin};",
      "font-src 'self' data:;",
      "form-action 'self' ${local.auth_origin};",
      "frame-ancestors 'none';",
      "img-src 'self' data: blob:;",
      "object-src 'none';",
      "script-src 'self' 'unsafe-inline';",
      "style-src 'self' 'unsafe-inline';"
    ]
  )
}
