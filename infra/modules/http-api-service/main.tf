data "aws_route53_zone" "selected" {
  zone_id = var.hosted_zone_id
}

data "archive_file" "api_bundle" {
  type        = "zip"
  source_file = var.api_bundle_path
  output_path = "${path.module}/.generated/${var.environment_name}-api.zip"
}

locals {
  common_tags = merge(var.tags, {
    Module = "http-api-service"
  })
  alarm_prefix = "${replace(lower(lookup(var.tags, "Project", "platform")), " ", "-")}-${var.environment_name}"
  observability_alarm_names = [
    "${local.alarm_prefix}-lambda-errors",
    "${local.alarm_prefix}-lambda-throttles",
    "${local.alarm_prefix}-lambda-duration-p95",
    "${local.alarm_prefix}-api-5xx",
    "${local.alarm_prefix}-api-latency-p95",
    "${local.alarm_prefix}-dynamodb-read-throttles",
    "${local.alarm_prefix}-dynamodb-write-throttles"
  ]
}

resource "aws_iam_role" "api" {
  name = "${var.lambda_function_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "api_logging" {
  name = "${var.lambda_function_name}-logging"
  role = aws_iam_role.api.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Effect = "Allow"
        Resource = [
          aws_cloudwatch_log_group.api_lambda.arn,
          "${aws_cloudwatch_log_group.api_lambda.arn}:*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "api_dynamodb" {
  name = "${var.lambda_function_name}-dynamodb"
  role = aws_iam_role.api.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query"
        ]
        Effect   = "Allow"
        Resource = var.submission_table_arn
      }
    ]
  })
}

resource "aws_iam_role_policy" "api_generation" {
  name = "${var.lambda_function_name}-generation"
  role = aws_iam_role.api.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "lambda:InvokeFunction"
        ]
        Effect   = "Allow"
        Resource = aws_lambda_function.api.arn
      },
      {
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Effect = "Allow"
        Resource = [
          "${var.artifacts_bucket_arn}/submissions/*"
        ]
      },
      {
        Action = [
          "bedrock:InvokeModel"
        ]
        Effect   = "Allow"
        Resource = var.bedrock_invoke_resource_arns
      }
    ]
  })
}

resource "aws_iam_role_policy" "api_ssm" {
  name = "${var.lambda_function_name}-ssm"
  role = aws_iam_role.api.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "ssm:GetParameter"
        ]
        Effect   = "Allow"
        Resource = var.admin_email_parameter_arn
      }
    ]
  })
}

resource "aws_iam_role_policy" "api_observability_read" {
  name = "${var.lambda_function_name}-observability-read"
  role = aws_iam_role.api.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "cloudwatch:DescribeAlarms",
          "cloudwatch:GetMetricData"
        ]
        Effect   = "Allow"
        Resource = "*"
      },
      {
        Action = [
          "logs:FilterLogEvents"
        ]
        Effect = "Allow"
        Resource = [
          aws_cloudwatch_log_group.api_lambda.arn,
          "${aws_cloudwatch_log_group.api_lambda.arn}:*",
          aws_cloudwatch_log_group.api_access.arn,
          "${aws_cloudwatch_log_group.api_access.arn}:*"
        ]
      },
      {
        Action = [
          "sns:ListSubscriptionsByTopic"
        ]
        Effect   = "Allow"
        Resource = var.observability_alerts_topic_arn
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "api_lambda" {
  name              = "/aws/lambda/${var.lambda_function_name}"
  retention_in_days = 30
  tags              = local.common_tags
}

resource "aws_lambda_function" "api" {
  function_name    = var.lambda_function_name
  filename         = data.archive_file.api_bundle.output_path
  source_code_hash = data.archive_file.api_bundle.output_base64sha256
  role             = aws_iam_role.api.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  timeout          = 180
  memory_size      = 1024

  environment {
    variables = {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED = "1"
      DEPLOY_ENV                          = var.environment_name
      SUBMISSIONS_TABLE_NAME              = var.submission_table_name
      ARTIFACTS_BUCKET_NAME               = var.artifacts_bucket_name
      AUTH_DOMAIN                         = var.auth_domain
      BEDROCK_MODEL_IDS                   = join(",", var.bedrock_model_ids)
      CURRENT_FUNCTION_NAME               = var.lambda_function_name
      ADMIN_EMAIL_PARAMETER_NAME          = var.admin_email_parameter_name
      OBSERVABILITY_DASHBOARD_NAME        = var.observability_dashboard_name
      OBSERVABILITY_ALARM_NAMES           = join(",", local.observability_alarm_names)
      OBSERVABILITY_ALERTS_TOPIC_ARN      = var.observability_alerts_topic_arn
      OBSERVABILITY_API_ID                = aws_apigatewayv2_api.http.id
      OBSERVABILITY_API_STAGE_NAME        = "$default"
      OBSERVABILITY_LAMBDA_LOG_GROUP_NAME = var.observability_lambda_log_group_name
      OBSERVABILITY_API_LOG_GROUP_NAME    = var.observability_api_log_group_name
    }
  }

  depends_on = [aws_cloudwatch_log_group.api_lambda]

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "api_access" {
  name              = "/aws/apigateway/${var.environment_name}-infrastructure-as-words"
  retention_in_days = 30
  tags              = local.common_tags
}

resource "aws_apigatewayv2_api" "http" {
  name          = "infrastructure-as-words-${var.environment_name}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["authorization", "content-type"]
    allow_methods = ["GET", "OPTIONS", "POST", "PUT"]
    allow_origins = var.allowed_origins
    expose_headers = [
      "content-type"
    ]
    max_age = 3600
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 15000
}

resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id           = aws_apigatewayv2_api.http.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-jwt"

  jwt_configuration {
    audience = [var.cognito_user_pool_client_id]
    issuer   = var.cognito_issuer
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_access.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      integration    = "$context.integrationErrorMessage"
    })
  }

  default_route_settings {
    detailed_metrics_enabled = true
    throttling_burst_limit   = 100
    throttling_rate_limit    = 50
  }

  tags = local.common_tags
}

resource "aws_lambda_permission" "api" {
  statement_id  = "AllowExecutionFromApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

resource "aws_apigatewayv2_route" "health" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /health"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "list_submissions" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /v1/submissions"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  authorization_type = "JWT"
  authorization_scopes = [
    var.cognito_read_scope
  ]
}

resource "aws_apigatewayv2_route" "workspace_profile" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /v1/workspace"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  authorization_type = "JWT"
  authorization_scopes = [
    var.cognito_read_scope
  ]
}

resource "aws_apigatewayv2_route" "create_submission" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "POST /v1/submissions"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  authorization_type = "JWT"
  authorization_scopes = [
    var.cognito_write_scope
  ]
}

resource "aws_apigatewayv2_route" "get_submission" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /v1/submissions/{submissionId}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  authorization_type = "JWT"
  authorization_scopes = [
    var.cognito_read_scope
  ]
}

resource "aws_apigatewayv2_route" "get_admin_settings" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /v1/admin/settings"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  authorization_type = "JWT"
  authorization_scopes = [
    var.cognito_write_scope
  ]
}

resource "aws_apigatewayv2_route" "get_admin_observability" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /v1/admin/observability"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  authorization_type = "JWT"
  authorization_scopes = [
    var.cognito_write_scope
  ]
}

resource "aws_apigatewayv2_route" "put_admin_settings" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "PUT /v1/admin/settings"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  authorization_type = "JWT"
  authorization_scopes = [
    var.cognito_write_scope
  ]
}

resource "aws_acm_certificate" "api" {
  domain_name       = var.api_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = local.common_tags
}

resource "aws_route53_record" "api_validation" {
  for_each = {
    for option in aws_acm_certificate.api.domain_validation_options : option.domain_name => {
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

resource "aws_acm_certificate_validation" "api" {
  certificate_arn         = aws_acm_certificate.api.arn
  validation_record_fqdns = [for record in aws_route53_record.api_validation : record.fqdn]
}

resource "aws_apigatewayv2_domain_name" "api" {
  domain_name = var.api_domain

  domain_name_configuration {
    certificate_arn = aws_acm_certificate_validation.api.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_api_mapping" "api" {
  api_id      = aws_apigatewayv2_api.http.id
  domain_name = aws_apigatewayv2_domain_name.api.id
  stage       = aws_apigatewayv2_stage.default.id
}

resource "aws_route53_record" "api_a" {
  zone_id = data.aws_route53_zone.selected.zone_id
  name    = var.api_domain
  type    = "A"

  alias {
    name                   = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "api_aaaa" {
  zone_id = data.aws_route53_zone.selected.zone_id
  name    = var.api_domain
  type    = "AAAA"

  alias {
    name                   = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}
