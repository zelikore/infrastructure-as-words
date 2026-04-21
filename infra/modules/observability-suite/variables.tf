variable "environment_name" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "dashboard_name" {
  type = string
}

variable "alerts_topic_name" {
  type = string
}

variable "notification_email_endpoints" {
  type = list(string)
}

variable "lambda_function_name" {
  type = string
}

variable "lambda_log_group_name" {
  type = string
}

variable "api_id" {
  type = string
}

variable "api_stage_name" {
  type    = string
  default = "$default"
}

variable "api_access_log_group_name" {
  type = string
}

variable "submission_table_name" {
  type = string
}

variable "tags" {
  type = map(string)
}
