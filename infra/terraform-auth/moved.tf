moved {
  from = aws_acm_certificate.auth
  to   = module.shared_auth.aws_acm_certificate.auth
}

moved {
  from = aws_route53_record.auth_validation
  to   = module.shared_auth.aws_route53_record.auth_validation
}

moved {
  from = aws_acm_certificate_validation.auth
  to   = module.shared_auth.aws_acm_certificate_validation.auth
}

moved {
  from = aws_cognito_user_pool.main
  to   = module.shared_auth.aws_cognito_user_pool.main
}

moved {
  from = aws_cognito_resource_server.main
  to   = module.shared_auth.aws_cognito_resource_server.main
}

moved {
  from = aws_cognito_user_pool_domain.main
  to   = module.shared_auth.aws_cognito_user_pool_domain.main
}

moved {
  from = aws_route53_record.auth_a
  to   = module.shared_auth.aws_route53_record.auth_a
}

moved {
  from = aws_route53_record.auth_aaaa
  to   = module.shared_auth.aws_route53_record.auth_aaaa
}
