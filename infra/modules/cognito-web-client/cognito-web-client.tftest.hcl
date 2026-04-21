mock_provider "aws" {}

run "plan_web_client_oauth_settings" {
  command = plan

  variables {
    environment_name    = "dev"
    user_pool_id        = "us-west-2_123456789"
    callback_urls       = ["https://dev.infrastructure-as-words.com/auth/callback"]
    logout_urls         = ["https://dev.infrastructure-as-words.com"]
    cognito_read_scope  = "infrastructure-as-words/read"
    cognito_write_scope = "infrastructure-as-words/write"
  }

  assert {
    condition     = aws_cognito_user_pool_client.web.user_pool_id == "us-west-2_123456789"
    error_message = "Cognito web client should target the configured shared user pool."
  }

  assert {
    condition     = contains(aws_cognito_user_pool_client.web.allowed_oauth_flows, "code")
    error_message = "Cognito web client should use OAuth authorization code flow."
  }

  assert {
    condition     = contains(aws_cognito_user_pool_client.web.allowed_oauth_scopes, "infrastructure-as-words/read")
    error_message = "Read scope should be present on the web client."
  }

  assert {
    condition     = contains(aws_cognito_user_pool_client.web.allowed_oauth_scopes, "infrastructure-as-words/write")
    error_message = "Write scope should be present on the web client."
  }

  assert {
    condition     = contains(aws_cognito_user_pool_client.web.explicit_auth_flows, "ALLOW_REFRESH_TOKEN_AUTH")
    error_message = "Refresh-token auth flow should remain enabled for browser sessions."
  }

  assert {
    condition     = aws_cognito_user_pool_client.web.enable_token_revocation == true
    error_message = "Token revocation should stay enabled for the web client."
  }
}
