output "auth_url" {
  value = module.shared_auth.auth_url
}

output "user_pool_id" {
  value = module.shared_auth.user_pool_id
}

output "issuer" {
  value = module.shared_auth.issuer
}

output "resource_server_identifier" {
  value = module.shared_auth.resource_server_identifier
}

output "read_scope" {
  value = module.shared_auth.read_scope
}

output "write_scope" {
  value = module.shared_auth.write_scope
}

output "admin_email_parameter_name" {
  value = module.shared_auth.admin_email_parameter_name
}

output "admin_email_parameter_arn" {
  value = module.shared_auth.admin_email_parameter_arn
}

output "admin_user_email" {
  value = module.shared_auth.admin_user_email
}
