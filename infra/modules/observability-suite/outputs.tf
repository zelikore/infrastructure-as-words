output "dashboard_name" {
  value = aws_cloudwatch_dashboard.application.dashboard_name
}

output "alerts_topic_arn" {
  value = aws_sns_topic.alerts.arn
}

output "lambda_log_group_name" {
  value = var.lambda_log_group_name
}

output "api_access_log_group_name" {
  value = var.api_access_log_group_name
}

output "alarm_names" {
  value = [
    aws_cloudwatch_metric_alarm.lambda_errors.alarm_name,
    aws_cloudwatch_metric_alarm.lambda_throttles.alarm_name,
    aws_cloudwatch_metric_alarm.lambda_duration.alarm_name,
    aws_cloudwatch_metric_alarm.api_5xx.alarm_name,
    aws_cloudwatch_metric_alarm.api_latency.alarm_name,
    aws_cloudwatch_metric_alarm.dynamodb_read_throttles.alarm_name,
    aws_cloudwatch_metric_alarm.dynamodb_write_throttles.alarm_name
  ]
}
