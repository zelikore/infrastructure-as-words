variable "environment_name" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "hosted_zone_id" {
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

variable "lambda_function_name" {
  type = string
}

variable "api_bundle_path" {
  type = string
}

variable "submission_table_name" {
  type = string
}

variable "submission_table_arn" {
  type = string
}

variable "artifacts_bucket_name" {
  type = string
}

variable "artifacts_bucket_arn" {
  type = string
}

variable "cognito_user_pool_client_id" {
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

variable "admin_email_parameter_name" {
  type = string
}

variable "admin_email_parameter_arn" {
  type = string
}

variable "observability_dashboard_name" {
  type = string
}

variable "observability_alerts_topic_arn" {
  type = string
}

variable "observability_lambda_log_group_name" {
  type = string
}

variable "observability_api_log_group_name" {
  type = string
}

variable "tags" {
  type = map(string)
}
