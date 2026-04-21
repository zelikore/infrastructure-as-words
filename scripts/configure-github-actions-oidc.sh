#!/usr/bin/env bash

set -euo pipefail

readonly OIDC_URL="https://token.actions.githubusercontent.com"
readonly DEFAULT_DEPLOY_ROLE_NAME="GitHubActionsInfrastructureAsWordsDeploy"
readonly DEFAULT_REVIEW_ROLE_NAME="GitHubActionsInfrastructureAsWordsReview"
readonly DEFAULT_AWS_REGION="us-west-2"
readonly DEFAULT_HOSTED_ZONE_ID="Z04489831QPP59H15P0H0"

repo_slug_from_git() {
  git remote get-url origin \
    | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##'
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

ensure_oidc_provider() {
  local provider_arn

  provider_arn="$(
    aws iam list-open-id-connect-providers \
      --query "OpenIDConnectProviderList[?contains(Arn, 'token.actions.githubusercontent.com')].Arn | [0]" \
      --output text
  )"

  if [[ "${provider_arn}" == "None" || -z "${provider_arn}" ]]; then
    provider_arn="$(
      aws iam create-open-id-connect-provider \
        --url "${OIDC_URL}" \
        --client-id-list sts.amazonaws.com \
        --query 'OpenIDConnectProviderArn' \
        --output text
    )"
  fi

  printf '%s\n' "${provider_arn}"
}

write_deploy_trust_policy() {
  local path="$1"
  local provider_arn="$2"
  local repo_slug="$3"

  cat > "${path}" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "${provider_arn}"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": [
            "repo:${repo_slug}:ref:refs/heads/dev",
            "repo:${repo_slug}:ref:refs/heads/prod"
          ]
        }
      }
    }
  ]
}
EOF
}

write_review_trust_policy() {
  local path="$1"
  local provider_arn="$2"
  local repo_slug="$3"

  cat > "${path}" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "${provider_arn}"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:${repo_slug}:pull_request"
        }
      }
    }
  ]
}
EOF
}

write_deploy_permissions_policy() {
  local path="$1"
  local account_id="$2"
  local aws_region="$3"
  local hosted_zone_id="$4"

  local state_bucket="infrastructure-as-words-terraform-state-${account_id}"
  local web_bucket_dev="infrastructure-as-words-web-dev-${account_id}"
  local web_bucket_prod="infrastructure-as-words-web-prod-${account_id}"
  local artifacts_bucket_dev="infrastructure-as-words-artifacts-dev-${account_id}"
  local artifacts_bucket_prod="infrastructure-as-words-artifacts-prod-${account_id}"
  local lock_table="infrastructure-as-words-terraform-locks"
  local submission_table_dev="infrastructure-as-words-submissions-dev"
  local submission_table_prod="infrastructure-as-words-submissions-prod"
  local lambda_dev="infrastructure-as-words-api-dev"
  local lambda_prod="infrastructure-as-words-api-prod"
  local lambda_role_dev="${lambda_dev}-role"
  local lambda_role_prod="${lambda_prod}-role"
  local admin_parameter_arn="arn:aws:ssm:${aws_region}:${account_id}:parameter/infrastructure-as-words/admin-email"
  local dev_dashboard_arn="arn:aws:cloudwatch::${account_id}:dashboard/infrastructure-as-words-dev-observability"
  local prod_dashboard_arn="arn:aws:cloudwatch::${account_id}:dashboard/infrastructure-as-words-prod-observability"
  local dev_alarm_arn="arn:aws:cloudwatch:${aws_region}:${account_id}:alarm:infrastructure-as-words-dev-*"
  local prod_alarm_arn="arn:aws:cloudwatch:${aws_region}:${account_id}:alarm:infrastructure-as-words-prod-*"
  local dev_topic_arn="arn:aws:sns:${aws_region}:${account_id}:infrastructure-as-words-dev-alerts"
  local prod_topic_arn="arn:aws:sns:${aws_region}:${account_id}:infrastructure-as-words-prod-alerts"
  local route53_zone_arn="arn:aws:route53:::hostedzone/${hosted_zone_id}"

  # Exact ARNs are used for mutable data and identity resources. Control-plane
  # services with coarse IAM support are constrained with explicit action lists.

  cat > "${path}" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadCallerIdentity",
      "Effect": "Allow",
      "Action": "sts:GetCallerIdentity",
      "Resource": "*"
    },
    {
      "Sid": "BucketDiscovery",
      "Effect": "Allow",
      "Action": [
        "s3:ListAllMyBuckets",
        "s3:GetBucketLocation"
      ],
      "Resource": "*"
    },
    {
      "Sid": "TerraformStateAndApplicationBuckets",
      "Effect": "Allow",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::${state_bucket}",
        "arn:aws:s3:::${state_bucket}/*",
        "arn:aws:s3:::${web_bucket_dev}",
        "arn:aws:s3:::${web_bucket_dev}/*",
        "arn:aws:s3:::${web_bucket_prod}",
        "arn:aws:s3:::${web_bucket_prod}/*",
        "arn:aws:s3:::${artifacts_bucket_dev}",
        "arn:aws:s3:::${artifacts_bucket_dev}/*",
        "arn:aws:s3:::${artifacts_bucket_prod}",
        "arn:aws:s3:::${artifacts_bucket_prod}/*"
      ]
    },
    {
      "Sid": "TerraformLockAndSubmissionTables",
      "Effect": "Allow",
      "Action": "dynamodb:*",
      "Resource": [
        "arn:aws:dynamodb:${aws_region}:${account_id}:table/${lock_table}",
        "arn:aws:dynamodb:${aws_region}:${account_id}:table/${submission_table_dev}",
        "arn:aws:dynamodb:${aws_region}:${account_id}:table/${submission_table_prod}"
      ]
    },
    {
      "Sid": "DynamoTableDiscovery",
      "Effect": "Allow",
      "Action": [
        "dynamodb:DescribeLimits",
        "dynamodb:ListTables"
      ],
      "Resource": "*"
    },
    {
      "Sid": "LambdaFunctions",
      "Effect": "Allow",
      "Action": "lambda:*",
      "Resource": [
        "arn:aws:lambda:${aws_region}:${account_id}:function:${lambda_dev}",
        "arn:aws:lambda:${aws_region}:${account_id}:function:${lambda_dev}:*",
        "arn:aws:lambda:${aws_region}:${account_id}:function:${lambda_prod}",
        "arn:aws:lambda:${aws_region}:${account_id}:function:${lambda_prod}:*"
      ]
    },
    {
      "Sid": "ManageLambdaExecutionRolesOnly",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:ListRolePolicies",
        "iam:PassRole",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:TagRole",
        "iam:UntagRole",
        "iam:UpdateAssumeRolePolicy"
      ],
      "Resource": [
        "arn:aws:iam::${account_id}:role/${lambda_role_dev}",
        "arn:aws:iam::${account_id}:role/${lambda_role_prod}"
      ]
    },
    {
      "Sid": "ManageProjectLogGroups",
      "Effect": "Allow",
      "Action": "logs:*",
      "Resource": [
        "arn:aws:logs:${aws_region}:${account_id}:log-group:/aws/lambda/${lambda_dev}",
        "arn:aws:logs:${aws_region}:${account_id}:log-group:/aws/lambda/${lambda_dev}:*",
        "arn:aws:logs:${aws_region}:${account_id}:log-group:/aws/lambda/${lambda_prod}",
        "arn:aws:logs:${aws_region}:${account_id}:log-group:/aws/lambda/${lambda_prod}:*",
        "arn:aws:logs:${aws_region}:${account_id}:log-group:/aws/apigateway/dev-infrastructure-as-words",
        "arn:aws:logs:${aws_region}:${account_id}:log-group:/aws/apigateway/dev-infrastructure-as-words:*",
        "arn:aws:logs:${aws_region}:${account_id}:log-group:/aws/apigateway/prod-infrastructure-as-words",
        "arn:aws:logs:${aws_region}:${account_id}:log-group:/aws/apigateway/prod-infrastructure-as-words:*"
      ]
    },
    {
      "Sid": "LogGroupDiscovery",
      "Effect": "Allow",
      "Action": [
        "logs:DescribeLogGroups",
        "logs:DescribeResourcePolicies"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ObservabilityDashboardsAndAlarms",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:DeleteAlarms",
        "cloudwatch:DeleteDashboards",
        "cloudwatch:GetDashboard",
        "cloudwatch:ListTagsForResource",
        "cloudwatch:PutDashboard",
        "cloudwatch:PutMetricAlarm",
        "cloudwatch:TagResource",
        "cloudwatch:UntagResource"
      ],
      "Resource": [
        "${dev_dashboard_arn}",
        "${prod_dashboard_arn}",
        "${dev_alarm_arn}",
        "${prod_alarm_arn}"
      ]
    },
    {
      "Sid": "CloudWatchAlarmDiscovery",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:DescribeAlarms",
        "cloudwatch:GetMetricData"
      ],
      "Resource": "*"
    },
    {
      "Sid": "NotificationsAndAdminParameter",
      "Effect": "Allow",
      "Action": "sns:*",
      "Resource": [
        "${dev_topic_arn}",
        "${prod_topic_arn}"
      ]
    },
    {
      "Sid": "SsmAdminParameter",
      "Effect": "Allow",
      "Action": [
        "ssm:AddTagsToResource",
        "ssm:DeleteParameter",
        "ssm:GetParameter",
        "ssm:ListTagsForResource",
        "ssm:PutParameter",
        "ssm:RemoveTagsFromResource"
      ],
      "Resource": "${admin_parameter_arn}"
    },
    {
      "Sid": "DnsHostedZoneControl",
      "Effect": "Allow",
      "Action": [
        "route53:ChangeResourceRecordSets",
        "route53:ChangeTagsForResource",
        "route53:GetChange",
        "route53:GetHostedZone",
        "route53:ListHostedZonesByName",
        "route53:ListResourceRecordSets",
        "route53:ListTagsForResource"
      ],
      "Resource": [
        "${route53_zone_arn}",
        "arn:aws:route53:::change/*"
      ]
    },
    {
      "Sid": "CertificateAndEdgeControlPlane",
      "Effect": "Allow",
      "Action": [
        "acm:AddTagsToCertificate",
        "acm:DeleteCertificate",
        "acm:DescribeCertificate",
        "acm:ListCertificates",
        "acm:RemoveTagsFromCertificate",
        "acm:RequestCertificate",
        "cloudfront:CreateCachePolicy",
        "cloudfront:CreateDistribution",
        "cloudfront:CreateFunction",
        "cloudfront:CreateOriginAccessControl",
        "cloudfront:CreateResponseHeadersPolicy",
        "cloudfront:DeleteCachePolicy",
        "cloudfront:DeleteDistribution",
        "cloudfront:DeleteFunction",
        "cloudfront:DeleteOriginAccessControl",
        "cloudfront:DeleteResponseHeadersPolicy",
        "cloudfront:DescribeFunction",
        "cloudfront:GetCachePolicy",
        "cloudfront:GetCachePolicyConfig",
        "cloudfront:GetDistribution",
        "cloudfront:GetDistributionConfig",
        "cloudfront:GetFunction",
        "cloudfront:GetOriginAccessControl",
        "cloudfront:GetOriginAccessControlConfig",
        "cloudfront:GetResponseHeadersPolicy",
        "cloudfront:GetResponseHeadersPolicyConfig",
        "cloudfront:ListCachePolicies",
        "cloudfront:ListDistributions",
        "cloudfront:ListDistributionsByOriginRequestPolicyId",
        "cloudfront:ListFunctions",
        "cloudfront:ListOriginAccessControls",
        "cloudfront:ListResponseHeadersPolicies",
        "cloudfront:ListTagsForResource",
        "cloudfront:PublishFunction",
        "cloudfront:TagResource",
        "cloudfront:TestFunction",
        "cloudfront:UntagResource",
        "cloudfront:UpdateCachePolicy",
        "cloudfront:UpdateDistribution",
        "cloudfront:UpdateFunction",
        "cloudfront:UpdateOriginAccessControl",
        "cloudfront:UpdateResponseHeadersPolicy"
      ],
      "Resource": "*"
    },
    {
      "Sid": "HttpApiControlPlane",
      "Effect": "Allow",
      "Action": [
        "apigateway:DELETE",
        "apigateway:GET",
        "apigateway:PATCH",
        "apigateway:POST",
        "apigateway:PUT",
        "apigateway:TAG",
        "apigateway:UNTAG"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CognitoControlPlane",
      "Effect": "Allow",
      "Action": [
        "cognito-idp:AdminCreateUser",
        "cognito-idp:AdminDeleteUser",
        "cognito-idp:AdminGetUser",
        "cognito-idp:AdminResetUserPassword",
        "cognito-idp:AdminSetUserPassword",
        "cognito-idp:AdminUpdateUserAttributes",
        "cognito-idp:CreateResourceServer",
        "cognito-idp:CreateUserPool",
        "cognito-idp:CreateUserPoolClient",
        "cognito-idp:CreateUserPoolDomain",
        "cognito-idp:DeleteResourceServer",
        "cognito-idp:DeleteUserPool",
        "cognito-idp:DeleteUserPoolClient",
        "cognito-idp:DeleteUserPoolDomain",
        "cognito-idp:DescribeUserPool",
        "cognito-idp:DescribeUserPoolClient",
        "cognito-idp:DescribeUserPoolDomain",
        "cognito-idp:GetResourceServer",
        "cognito-idp:ListResourceServers",
        "cognito-idp:ListTagsForResource",
        "cognito-idp:ListUserPoolClients",
        "cognito-idp:ListUserPools",
        "cognito-idp:ListUsers",
        "cognito-idp:TagResource",
        "cognito-idp:UntagResource",
        "cognito-idp:UpdateResourceServer",
        "cognito-idp:UpdateUserPool",
        "cognito-idp:UpdateUserPoolClient"
      ],
      "Resource": "*"
    }
  ]
}
EOF
}

write_review_permissions_policy() {
  local path="$1"

  cat > "${path}" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockReviewAccess",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "*"
    }
  ]
}
EOF
}

upsert_role() {
  local role_name="$1"
  local trust_policy_path="$2"

  if aws iam get-role --role-name "${role_name}" >/dev/null 2>&1; then
    aws iam update-assume-role-policy \
      --role-name "${role_name}" \
      --policy-document "file://${trust_policy_path}" >/dev/null
  else
    aws iam create-role \
      --role-name "${role_name}" \
      --assume-role-policy-document "file://${trust_policy_path}" >/dev/null
  fi
}

put_inline_policy() {
  local role_name="$1"
  local policy_name="$2"
  local policy_path="$3"

  aws iam put-role-policy \
    --role-name "${role_name}" \
    --policy-name "${policy_name}" \
    --policy-document "file://${policy_path}" >/dev/null
}

main() {
  require_command aws
  require_command gh
  require_command git

  gh auth status >/dev/null

  local repo_slug="${REPO_SLUG:-$(repo_slug_from_git)}"
  local deploy_role_name="${DEPLOY_ROLE_NAME:-${DEFAULT_DEPLOY_ROLE_NAME}}"
  local review_role_name="${REVIEW_ROLE_NAME:-${DEFAULT_REVIEW_ROLE_NAME}}"
  local aws_region="${AWS_REGION:-${DEFAULT_AWS_REGION}}"
  local hosted_zone_id="${HOSTED_ZONE_ID:-${DEFAULT_HOSTED_ZONE_ID}}"
  local account_id
  local temp_dir
  local provider_arn
  local deploy_role_arn
  local review_role_arn

  temp_dir="$(mktemp -d)"
  trap "rm -rf '${temp_dir}'" EXIT

  account_id="$(aws sts get-caller-identity --query 'Account' --output text)"
  provider_arn="$(ensure_oidc_provider)"

  write_deploy_trust_policy "${temp_dir}/deploy-trust.json" "${provider_arn}" "${repo_slug}"
  write_review_trust_policy "${temp_dir}/review-trust.json" "${provider_arn}" "${repo_slug}"
  write_deploy_permissions_policy "${temp_dir}/deploy-policy.json" "${account_id}" "${aws_region}" "${hosted_zone_id}"
  write_review_permissions_policy "${temp_dir}/review-policy.json"

  upsert_role "${deploy_role_name}" "${temp_dir}/deploy-trust.json"
  upsert_role "${review_role_name}" "${temp_dir}/review-trust.json"

  put_inline_policy \
    "${deploy_role_name}" \
    "InfrastructureAsWordsGitHubDeploy" \
    "${temp_dir}/deploy-policy.json"
  put_inline_policy \
    "${review_role_name}" \
    "InfrastructureAsWordsGitHubReview" \
    "${temp_dir}/review-policy.json"

  deploy_role_arn="$(
    aws iam get-role \
      --role-name "${deploy_role_name}" \
      --query 'Role.Arn' \
      --output text
  )"
  review_role_arn="$(
    aws iam get-role \
      --role-name "${review_role_name}" \
      --query 'Role.Arn' \
      --output text
  )"

  gh variable set AWS_DEPLOY_ROLE_ARN --body "${deploy_role_arn}" --repo "${repo_slug}"
  gh variable set AWS_REVIEW_ROLE_ARN --body "${review_role_arn}" --repo "${repo_slug}"

  echo "Configured GitHub Actions OIDC for ${repo_slug}."
  echo "AWS_DEPLOY_ROLE_ARN=${deploy_role_arn}"
  echo "AWS_REVIEW_ROLE_ARN=${review_role_arn}"
}

main "$@"
