moved {
  from = aws_dynamodb_table.submissions
  to   = module.application_platform.module.submission_data.aws_dynamodb_table.submissions
}

moved {
  from = aws_s3_bucket.artifacts
  to   = module.application_platform.module.submission_data.aws_s3_bucket.artifacts
}

moved {
  from = aws_s3_bucket_versioning.artifacts
  to   = module.application_platform.module.submission_data.aws_s3_bucket_versioning.artifacts
}

moved {
  from = aws_s3_bucket_server_side_encryption_configuration.artifacts
  to   = module.application_platform.module.submission_data.aws_s3_bucket_server_side_encryption_configuration.artifacts
}

moved {
  from = aws_s3_bucket_public_access_block.artifacts
  to   = module.application_platform.module.submission_data.aws_s3_bucket_public_access_block.artifacts
}

moved {
  from = aws_cognito_user_pool_client.web
  to   = module.application_platform.module.cognito_web_client.aws_cognito_user_pool_client.web
}

moved {
  from = aws_iam_role.api
  to   = module.application_platform.module.http_api_service.aws_iam_role.api
}

moved {
  from = aws_iam_role_policy.api_logging
  to   = module.application_platform.module.http_api_service.aws_iam_role_policy.api_logging
}

moved {
  from = aws_iam_role_policy.api_dynamodb
  to   = module.application_platform.module.http_api_service.aws_iam_role_policy.api_dynamodb
}

moved {
  from = aws_iam_role_policy.api_generation
  to   = module.application_platform.module.http_api_service.aws_iam_role_policy.api_generation
}

moved {
  from = aws_cloudwatch_log_group.api_lambda
  to   = module.application_platform.module.http_api_service.aws_cloudwatch_log_group.api_lambda
}

moved {
  from = aws_lambda_function.api
  to   = module.application_platform.module.http_api_service.aws_lambda_function.api
}

moved {
  from = aws_cloudwatch_log_group.api_access
  to   = module.application_platform.module.http_api_service.aws_cloudwatch_log_group.api_access
}

moved {
  from = aws_apigatewayv2_api.http
  to   = module.application_platform.module.http_api_service.aws_apigatewayv2_api.http
}

moved {
  from = aws_apigatewayv2_integration.lambda
  to   = module.application_platform.module.http_api_service.aws_apigatewayv2_integration.lambda
}

moved {
  from = aws_apigatewayv2_authorizer.jwt
  to   = module.application_platform.module.http_api_service.aws_apigatewayv2_authorizer.jwt
}

moved {
  from = aws_apigatewayv2_stage.default
  to   = module.application_platform.module.http_api_service.aws_apigatewayv2_stage.default
}

moved {
  from = aws_lambda_permission.api
  to   = module.application_platform.module.http_api_service.aws_lambda_permission.api
}

moved {
  from = aws_apigatewayv2_route.health
  to   = module.application_platform.module.http_api_service.aws_apigatewayv2_route.health
}

moved {
  from = aws_apigatewayv2_route.list_submissions
  to   = module.application_platform.module.http_api_service.aws_apigatewayv2_route.list_submissions
}

moved {
  from = aws_apigatewayv2_route.workspace_profile
  to   = module.application_platform.module.http_api_service.aws_apigatewayv2_route.workspace_profile
}

moved {
  from = aws_apigatewayv2_route.create_submission
  to   = module.application_platform.module.http_api_service.aws_apigatewayv2_route.create_submission
}

moved {
  from = aws_apigatewayv2_route.get_submission
  to   = module.application_platform.module.http_api_service.aws_apigatewayv2_route.get_submission
}

moved {
  from = aws_apigatewayv2_route.get_admin_settings
  to   = module.application_platform.module.http_api_service.aws_apigatewayv2_route.get_admin_settings
}

moved {
  from = aws_apigatewayv2_route.put_admin_settings
  to   = module.application_platform.module.http_api_service.aws_apigatewayv2_route.put_admin_settings
}

moved {
  from = aws_acm_certificate.api
  to   = module.application_platform.module.http_api_service.aws_acm_certificate.api
}

moved {
  from = aws_route53_record.api_validation
  to   = module.application_platform.module.http_api_service.aws_route53_record.api_validation
}

moved {
  from = aws_acm_certificate_validation.api
  to   = module.application_platform.module.http_api_service.aws_acm_certificate_validation.api
}

moved {
  from = aws_apigatewayv2_domain_name.api
  to   = module.application_platform.module.http_api_service.aws_apigatewayv2_domain_name.api
}

moved {
  from = aws_apigatewayv2_api_mapping.api
  to   = module.application_platform.module.http_api_service.aws_apigatewayv2_api_mapping.api
}

moved {
  from = aws_route53_record.api_a
  to   = module.application_platform.module.http_api_service.aws_route53_record.api_a
}

moved {
  from = aws_route53_record.api_aaaa
  to   = module.application_platform.module.http_api_service.aws_route53_record.api_aaaa
}

moved {
  from = aws_s3_bucket.web
  to   = module.application_platform.module.static_website.aws_s3_bucket.web
}

moved {
  from = aws_s3_bucket_versioning.web
  to   = module.application_platform.module.static_website.aws_s3_bucket_versioning.web
}

moved {
  from = aws_s3_bucket_server_side_encryption_configuration.web
  to   = module.application_platform.module.static_website.aws_s3_bucket_server_side_encryption_configuration.web
}

moved {
  from = aws_s3_bucket_public_access_block.web
  to   = module.application_platform.module.static_website.aws_s3_bucket_public_access_block.web
}

moved {
  from = aws_cloudfront_origin_access_control.web
  to   = module.application_platform.module.static_website.aws_cloudfront_origin_access_control.web
}

moved {
  from = aws_cloudfront_function.rewrite
  to   = module.application_platform.module.static_website.aws_cloudfront_function.rewrite
}

moved {
  from = aws_cloudfront_response_headers_policy.documents
  to   = module.application_platform.module.static_website.aws_cloudfront_response_headers_policy.documents
}

moved {
  from = aws_cloudfront_response_headers_policy.assets
  to   = module.application_platform.module.static_website.aws_cloudfront_response_headers_policy.assets
}

moved {
  from = aws_cloudfront_distribution.web
  to   = module.application_platform.module.static_website.aws_cloudfront_distribution.web
}

moved {
  from = aws_s3_bucket_policy.web
  to   = module.application_platform.module.static_website.aws_s3_bucket_policy.web
}

moved {
  from = aws_route53_record.app_a
  to   = module.application_platform.module.static_website.aws_route53_record.app_a
}

moved {
  from = aws_route53_record.app_aaaa
  to   = module.application_platform.module.static_website.aws_route53_record.app_aaaa
}

moved {
  from = aws_acm_certificate.edge
  to   = module.application_platform.module.static_website.aws_acm_certificate.edge
}

moved {
  from = aws_route53_record.edge_validation
  to   = module.application_platform.module.static_website.aws_route53_record.edge_validation
}

moved {
  from = aws_acm_certificate_validation.edge
  to   = module.application_platform.module.static_website.aws_acm_certificate_validation.edge
}
