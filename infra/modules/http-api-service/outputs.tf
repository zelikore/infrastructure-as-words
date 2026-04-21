output "api_url" {
  value = "https://${var.api_domain}"
}

output "http_api_id" {
  value = aws_apigatewayv2_api.http.id
}

output "http_api_endpoint" {
  value = aws_apigatewayv2_api.http.api_endpoint
}

output "lambda_function_name" {
  value = aws_lambda_function.api.function_name
}

output "lambda_role_arn" {
  value = aws_iam_role.api.arn
}

output "lambda_log_group_name" {
  value = aws_cloudwatch_log_group.api_lambda.name
}

output "api_access_log_group_name" {
  value = aws_cloudwatch_log_group.api_access.name
}
