variable "aws_region" {
  type = string
}

variable "hosted_zone_id" {
  type = string
}

variable "auth_domain" {
  type = string
}

variable "admin_email" {
  type = string
}

variable "admin_email_parameter_name" {
  type = string
}

variable "tags" {
  type = map(string)
}
