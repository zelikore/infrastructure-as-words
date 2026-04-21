variable "environment_name" {
  type = string
}

variable "is_prod" {
  type = bool
}

variable "submission_table_name" {
  type = string
}

variable "artifacts_bucket_name" {
  type = string
}

variable "tags" {
  type = map(string)
}
