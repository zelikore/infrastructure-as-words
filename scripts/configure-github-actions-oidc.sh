#!/usr/bin/env bash

set -euo pipefail

readonly OIDC_URL="https://token.actions.githubusercontent.com"
readonly OIDC_THUMBPRINT="6938fd4d98bab03faadb97b34396831e3780aea1"
readonly DEFAULT_DEPLOY_ROLE_NAME="GitHubActionsInfrastructureAsWordsDeploy"
readonly DEFAULT_REVIEW_ROLE_NAME="GitHubActionsInfrastructureAsWordsReview"

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
        --thumbprint-list "${OIDC_THUMBPRINT}" \
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
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
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
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
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

  cat > "${path}" <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TerraformManagedServiceAccess",
      "Effect": "Allow",
      "Action": [
        "acm:*",
        "apigateway:*",
        "cloudfront:*",
        "cloudwatch:*",
        "cognito-idp:*",
        "dynamodb:*",
        "iam:*",
        "lambda:*",
        "logs:*",
        "route53:*",
        "s3:*",
        "sns:*",
        "ssm:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ReadCallerIdentity",
      "Effect": "Allow",
      "Action": "sts:GetCallerIdentity",
      "Resource": "*"
    }
  ]
}
EOF
}

write_review_permissions_policy() {
  local path="$1"

  cat > "${path}" <<'EOF'
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
  local temp_dir
  local provider_arn
  local deploy_role_arn
  local review_role_arn

  temp_dir="$(mktemp -d)"
  trap "rm -rf '${temp_dir}'" EXIT

  provider_arn="$(ensure_oidc_provider)"

  write_deploy_trust_policy "${temp_dir}/deploy-trust.json" "${provider_arn}" "${repo_slug}"
  write_review_trust_policy "${temp_dir}/review-trust.json" "${provider_arn}" "${repo_slug}"
  write_deploy_permissions_policy "${temp_dir}/deploy-policy.json"
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
