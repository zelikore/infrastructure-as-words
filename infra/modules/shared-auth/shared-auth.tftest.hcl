mock_provider "aws" {
  override_during = plan
}

mock_provider "aws" {
  alias           = "us_east_1"
  override_during = plan
}

override_resource {
  target          = aws_acm_certificate.auth
  override_during = plan
  values = {
    arn = "arn:aws:acm:us-east-1:123456789012:certificate/mock-auth"
    domain_validation_options = [
      {
        domain_name           = "auth.infrastructure-as-words.com"
        resource_record_name  = "_mock.auth.infrastructure-as-words.com"
        resource_record_type  = "CNAME"
        resource_record_value = "_validation.acm-validations.aws"
      },
    ]
  }
}

run "plan_shared_auth_uses_first_allowlist_email_for_seed_user" {
  command = plan

  variables {
    aws_region                 = "us-west-2"
    hosted_zone_id             = "Z123456789"
    auth_domain                = "auth.infrastructure-as-words.com"
    admin_email                = "elijahfaviel41+iaw-admin@gmail.com, devops.admin@example.com"
    admin_email_parameter_name = "/infrastructure-as-words/admin-email"
    tags = {
      Project = "infrastructure-as-words"
    }
  }

  assert {
    condition     = aws_ssm_parameter.admin_email.value == "elijahfaviel41+iaw-admin@gmail.com,devops.admin@example.com"
    error_message = "Shared auth should persist the normalized admin allowlist in SSM."
  }

  assert {
    condition     = aws_cognito_user.admin.username == "elijahfaviel41+iaw-admin@gmail.com"
    error_message = "Shared auth should seed Cognito with only the first admin email from the allowlist."
  }

  assert {
    condition     = aws_cognito_user.admin.attributes.email == "elijahfaviel41+iaw-admin@gmail.com"
    error_message = "Seeded Cognito admin email should match the first allowlist entry."
  }
}
