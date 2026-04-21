variable "environment_name" {
  type = string
}

variable "user_pool_id" {
  type = string
}

variable "callback_urls" {
  type = list(string)
}

variable "logout_urls" {
  type = list(string)
}

variable "cognito_read_scope" {
  type = string
}

variable "cognito_write_scope" {
  type = string
}
