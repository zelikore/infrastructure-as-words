variable "environment_name" {
  type = string
}

variable "is_prod" {
  type = bool
}

variable "aws_region" {
  type = string
}

variable "hosted_zone_id" {
  type = string
}

variable "app_domain" {
  type = string
}

variable "api_domain" {
  type = string
}

variable "auth_domain" {
  type = string
}

variable "allowed_origins" {
  type = list(string)
}

variable "callback_urls" {
  type = list(string)
}

variable "logout_urls" {
  type = list(string)
}

variable "web_bucket_name" {
  type = string
}

variable "artifacts_bucket_name" {
  type = string
}

variable "submission_table_name" {
  type = string
}

variable "lambda_function_name" {
  type = string
}

variable "api_bundle_path" {
  type = string
}

variable "cognito_user_pool_id" {
  type = string
}

variable "cognito_issuer" {
  type = string
}

variable "cognito_read_scope" {
  type = string
}

variable "cognito_write_scope" {
  type = string
}

variable "bedrock_model_ids" {
  type = list(string)
}

variable "bedrock_invoke_resource_arns" {
  type = list(string)
}

variable "admin_email_allowlist" {
  type = list(string)
}

variable "admin_email_parameter_name" {
  type = string
}

variable "admin_email_parameter_arn" {
  type = string
}

variable "rewrite_function_code_path" {
  type = string
}

variable "tags" {
  type = map(string)
}
