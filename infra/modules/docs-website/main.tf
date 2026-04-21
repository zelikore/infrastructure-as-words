module "site" {
  source = "../static-website"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  environment_name           = var.environment_name
  is_prod                    = var.is_prod
  hosted_zone_id             = var.hosted_zone_id
  app_domain                 = var.app_domain
  web_bucket_name            = var.web_bucket_name
  content_security_policy    = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none';"
  cloudfront_zone_id         = "Z2FDTNDATAQYW2"
  rewrite_function_code_path = var.rewrite_function_code_path
  tags = merge(var.tags, {
    Profile = "docs-website"
  })
}
