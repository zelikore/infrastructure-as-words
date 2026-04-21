locals {
  common_tags = merge(var.tags, {
    Module = "observability-suite"
  })
  system_name  = replace(lower(lookup(var.tags, "Project", "platform")), " ", "-")
  alarm_prefix = "${local.system_name}-${var.environment_name}"
}

resource "aws_sns_topic" "alerts" {
  name = var.alerts_topic_name
  tags = local.common_tags
}

resource "aws_sns_topic_subscription" "email" {
  for_each = toset(var.notification_email_endpoints)

  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = each.value
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${local.alarm_prefix}-lambda-errors"
  alarm_description   = "Lambda errors detected for ${var.lambda_function_name}."
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = 1
  period              = 300
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  statistic           = "Sum"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  dimensions = {
    FunctionName = var.lambda_function_name
  }
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  alarm_name          = "${local.alarm_prefix}-lambda-throttles"
  alarm_description   = "Lambda throttles detected for ${var.lambda_function_name}."
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = 1
  period              = 300
  namespace           = "AWS/Lambda"
  metric_name         = "Throttles"
  statistic           = "Sum"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  dimensions = {
    FunctionName = var.lambda_function_name
  }
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  alarm_name          = "${local.alarm_prefix}-lambda-duration-p95"
  alarm_description   = "Lambda p95 duration is elevated for ${var.lambda_function_name}."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  threshold           = 12000
  period              = 300
  namespace           = "AWS/Lambda"
  metric_name         = "Duration"
  extended_statistic  = "p95"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  dimensions = {
    FunctionName = var.lambda_function_name
  }
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "${local.alarm_prefix}-api-5xx"
  alarm_description   = "HTTP API is returning 5xx responses."
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = 1
  period              = 300
  namespace           = "AWS/ApiGateway"
  metric_name         = "5xx"
  statistic           = "Sum"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  dimensions = {
    ApiId = var.api_id
    Stage = var.api_stage_name
  }
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "${local.alarm_prefix}-api-latency-p95"
  alarm_description   = "HTTP API p95 latency is elevated."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  threshold           = 3000
  period              = 300
  namespace           = "AWS/ApiGateway"
  metric_name         = "Latency"
  extended_statistic  = "p95"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  dimensions = {
    ApiId = var.api_id
    Stage = var.api_stage_name
  }
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_read_throttles" {
  alarm_name          = "${local.alarm_prefix}-dynamodb-read-throttles"
  alarm_description   = "DynamoDB read throttles detected for ${var.submission_table_name}."
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = 1
  period              = 300
  namespace           = "AWS/DynamoDB"
  metric_name         = "ReadThrottleEvents"
  statistic           = "Sum"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  dimensions = {
    TableName = var.submission_table_name
  }
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_write_throttles" {
  alarm_name          = "${local.alarm_prefix}-dynamodb-write-throttles"
  alarm_description   = "DynamoDB write throttles detected for ${var.submission_table_name}."
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = 1
  period              = 300
  namespace           = "AWS/DynamoDB"
  metric_name         = "WriteThrottleEvents"
  statistic           = "Sum"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  dimensions = {
    TableName = var.submission_table_name
  }
  tags = local.common_tags
}

resource "aws_cloudwatch_dashboard" "application" {
  dashboard_name = var.dashboard_name
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "alarm"
        x      = 0
        y      = 0
        width  = 24
        height = 6
        properties = {
          title = "Alarm Status"
          alarms = [
            aws_cloudwatch_metric_alarm.lambda_errors.arn,
            aws_cloudwatch_metric_alarm.lambda_throttles.arn,
            aws_cloudwatch_metric_alarm.lambda_duration.arn,
            aws_cloudwatch_metric_alarm.api_5xx.arn,
            aws_cloudwatch_metric_alarm.api_latency.arn,
            aws_cloudwatch_metric_alarm.dynamodb_read_throttles.arn,
            aws_cloudwatch_metric_alarm.dynamodb_write_throttles.arn
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title   = "Lambda Service"
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          stat    = "Sum"
          period  = 300
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", var.lambda_function_name, { label = "Invocations" }],
            ["AWS/Lambda", "Errors", "FunctionName", var.lambda_function_name, { label = "Errors", color = "#dc2626", yAxis = "right" }],
            ["AWS/Lambda", "Throttles", "FunctionName", var.lambda_function_name, { label = "Throttles", color = "#f59e0b", yAxis = "right" }],
            ["AWS/Lambda", "Duration", "FunctionName", var.lambda_function_name, { label = "Duration p95 (ms)", stat = "p95", color = "#2563eb", yAxis = "right" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title   = "HTTP API"
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          stat    = "Sum"
          period  = 300
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiId", var.api_id, "Stage", var.api_stage_name, { label = "Requests" }],
            ["AWS/ApiGateway", "4xx", "ApiId", var.api_id, "Stage", var.api_stage_name, { label = "4xx", color = "#f59e0b", yAxis = "right" }],
            ["AWS/ApiGateway", "5xx", "ApiId", var.api_id, "Stage", var.api_stage_name, { label = "5xx", color = "#dc2626", yAxis = "right" }],
            ["AWS/ApiGateway", "Latency", "ApiId", var.api_id, "Stage", var.api_stage_name, { label = "Latency p95 (ms)", stat = "p95", color = "#2563eb", yAxis = "right" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6
        properties = {
          title   = "DynamoDB Throttles"
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          stat    = "Sum"
          period  = 300
          metrics = [
            ["AWS/DynamoDB", "ReadThrottleEvents", "TableName", var.submission_table_name, { label = "Read throttles", color = "#dc2626" }],
            ["AWS/DynamoDB", "WriteThrottleEvents", "TableName", var.submission_table_name, { label = "Write throttles", color = "#f59e0b" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 12
        width  = 12
        height = 6
        properties = {
          title   = "Request Throughput"
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          stat    = "Sum"
          period  = 300
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", var.submission_table_name, { label = "Read units" }],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", var.submission_table_name, { label = "Write units" }]
          ]
        }
      }
    ]
  })
}
