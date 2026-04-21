variable "environment_name" {
  type = string
}

variable "is_prod" {
  type = bool
}

variable "hosted_zone_id" {
  type = string
}

variable "app_domain" {
  type = string
}

variable "web_bucket_name" {
  type = string
}

variable "rewrite_function_code_path" {
  type = string
}

variable "tags" {
  type = map(string)
}
