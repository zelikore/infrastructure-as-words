module "site" {
  source = "../docs-website"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  environment_name           = var.environment_name
  is_prod                    = var.is_prod
  hosted_zone_id             = var.hosted_zone_id
  app_domain                 = var.app_domain
  web_bucket_name            = var.web_bucket_name
  rewrite_function_code_path = var.rewrite_function_code_path
  tags = merge(var.tags, {
    Example = "static-website"
  })
}
