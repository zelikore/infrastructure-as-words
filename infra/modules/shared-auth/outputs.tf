output "auth_url" {
  value = "https://${var.auth_domain}"
}

output "user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "issuer" {
  value = local.cognito_user_pool_issuer
}

output "resource_server_identifier" {
  value = local.cognito_resource_identifier
}

output "read_scope" {
  value = local.cognito_read_scope
}

output "write_scope" {
  value = local.cognito_write_scope
}

output "user_pool_domain" {
  value = aws_cognito_user_pool_domain.main.domain
}

output "admin_email_parameter_name" {
  value = aws_ssm_parameter.admin_email.name
}

output "admin_email_parameter_arn" {
  value = aws_ssm_parameter.admin_email.arn
}

output "admin_user_email" {
  value = aws_cognito_user.admin.username
}
