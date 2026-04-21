data "aws_route53_zone" "selected" {
  zone_id = var.hosted_zone_id
}

locals {
  cloudfront_zone_id          = "Z2FDTNDATAQYW2"
  cognito_resource_identifier = "infrastructure-as-words"
  cognito_read_scope          = "${local.cognito_resource_identifier}/read"
  cognito_write_scope         = "${local.cognito_resource_identifier}/write"
  cognito_user_pool_issuer    = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
  shared_auth_tags = merge(var.tags, {
    Module = "shared-auth"
  })
}

resource "aws_acm_certificate" "auth" {
  provider          = aws.us_east_1
  domain_name       = var.auth_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = local.shared_auth_tags
}

resource "aws_route53_record" "auth_validation" {
  for_each = {
    for option in aws_acm_certificate.auth.domain_validation_options : option.domain_name => {
      name   = option.resource_record_name
      record = option.resource_record_value
      type   = option.resource_record_type
    }
  }

  zone_id         = data.aws_route53_zone.selected.zone_id
  allow_overwrite = true
  name            = each.value.name
  type            = each.value.type
  ttl             = 60
  records         = [each.value.record]
}

resource "aws_acm_certificate_validation" "auth" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.auth.arn
  validation_record_fqdns = [for record in aws_route53_record.auth_validation : record.fqdn]
}

resource "aws_cognito_user_pool" "main" {
  name                = "infrastructure-as-words-auth"
  deletion_protection = "ACTIVE"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  verification_message_template {
    default_email_option  = "CONFIRM_WITH_LINK"
    email_subject_by_link = "Confirm your Infrastructure as Words account"
    email_message_by_link = "Confirm your account by following this link: {##Click Here##}"
  }

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  tags = local.shared_auth_tags
}

resource "aws_ssm_parameter" "admin_email" {
  name        = var.admin_email_parameter_name
  description = "Infrastructure as Words admin email"
  type        = "String"
  value       = lower(var.admin_email)
  tags        = local.shared_auth_tags
}

resource "aws_cognito_resource_server" "main" {
  identifier   = local.cognito_resource_identifier
  name         = "infrastructure-as-words-auth"
  user_pool_id = aws_cognito_user_pool.main.id

  scope {
    scope_name        = "read"
    scope_description = "Read access to submission history."
  }

  scope {
    scope_name        = "write"
    scope_description = "Write access to submission history."
  }
}

resource "aws_cognito_user" "admin" {
  user_pool_id = aws_cognito_user_pool.main.id
  username     = lower(var.admin_email)

  attributes = {
    email          = lower(var.admin_email)
    email_verified = "true"
  }

  desired_delivery_mediums = ["EMAIL"]
}

resource "aws_cognito_user_pool_domain" "main" {
  domain          = var.auth_domain
  user_pool_id    = aws_cognito_user_pool.main.id
  certificate_arn = aws_acm_certificate_validation.auth.certificate_arn
}

resource "aws_route53_record" "auth_a" {
  zone_id         = data.aws_route53_zone.selected.zone_id
  allow_overwrite = true
  name            = var.auth_domain
  type            = "A"

  alias {
    name                   = aws_cognito_user_pool_domain.main.cloudfront_distribution
    zone_id                = local.cloudfront_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "auth_aaaa" {
  zone_id         = data.aws_route53_zone.selected.zone_id
  allow_overwrite = true
  name            = var.auth_domain
  type            = "AAAA"

  alias {
    name                   = aws_cognito_user_pool_domain.main.cloudfront_distribution
    zone_id                = local.cloudfront_zone_id
    evaluate_target_health = false
  }
}
