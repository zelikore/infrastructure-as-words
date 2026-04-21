resource "aws_cognito_user_pool_client" "web" {
  name         = "infrastructure-as-words-web-${var.environment_name}"
  user_pool_id = var.user_pool_id

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes = [
    "email",
    "openid",
    "profile",
    var.cognito_read_scope,
    var.cognito_write_scope
  ]
  callback_urls                 = var.callback_urls
  logout_urls                   = var.logout_urls
  supported_identity_providers  = ["COGNITO"]
  explicit_auth_flows           = ["ALLOW_REFRESH_TOKEN_AUTH"]
  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true
  access_token_validity         = 60
  id_token_validity             = 60
  refresh_token_validity        = 30

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}
