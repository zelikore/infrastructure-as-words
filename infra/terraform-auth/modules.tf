module "shared_auth" {
  source = "../modules/shared-auth"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  aws_region                 = var.aws_region
  hosted_zone_id             = var.hosted_zone_id
  auth_domain                = var.auth_domain
  admin_email                = var.admin_email
  admin_email_parameter_name = var.admin_email_parameter_name
  tags                       = local.common_tags
}
