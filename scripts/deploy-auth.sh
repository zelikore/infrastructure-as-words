#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKIP_INSTALL="${DEPLOY_SKIP_INSTALL:-0}"
SKIP_CHECK="${DEPLOY_SKIP_CHECK:-0}"
SKIP_BUILD="${DEPLOY_SKIP_BUILD:-0}"
TERRAFORM_DIR="${ROOT_DIR}/infra/terraform-auth"
GENERATED_DIR="${TERRAFORM_DIR}/.generated"
STATE_BUCKET="infrastructure-as-words-terraform-state-283107799662"
LOCK_TABLE="infrastructure-as-words-terraform-locks"
AWS_REGION="us-west-2"
ADMIN_EMAIL_PARAMETER_NAME="/infrastructure-as-words/admin-email"

resolve_admin_email() {
  if [[ -n "${IAW_ADMIN_EMAIL:-}" ]]; then
    export IAW_ADMIN_EMAIL="${IAW_ADMIN_EMAIL,,}"
    return
  fi

  local current_admin_email=""
  current_admin_email="$(
    aws ssm get-parameter \
      --name "${ADMIN_EMAIL_PARAMETER_NAME}" \
      --query 'Parameter.Value' \
      --output text \
      2>/dev/null || true
  )"

  if [[ -n "${current_admin_email}" && "${current_admin_email}" != "None" ]]; then
    export IAW_ADMIN_EMAIL="${current_admin_email,,}"
    return
  fi

  cat >&2 <<EOF
IAW_ADMIN_EMAIL is required for the first shared auth deployment.
Set it explicitly or create ${ADMIN_EMAIL_PARAMETER_NAME} in SSM before rerunning.
EOF
  exit 1
}

bootstrap_backend() {
  if ! aws s3api head-bucket --bucket "${STATE_BUCKET}" >/dev/null 2>&1; then
    aws s3api create-bucket \
      --bucket "${STATE_BUCKET}" \
      --region "${AWS_REGION}" \
      --create-bucket-configuration "LocationConstraint=${AWS_REGION}" >/dev/null
    aws s3api put-bucket-versioning \
      --bucket "${STATE_BUCKET}" \
      --versioning-configuration Status=Enabled >/dev/null
    aws s3api put-bucket-encryption \
      --bucket "${STATE_BUCKET}" \
      --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' >/dev/null
  fi

  if ! aws dynamodb describe-table --table-name "${LOCK_TABLE}" --region "${AWS_REGION}" >/dev/null 2>&1; then
    aws dynamodb create-table \
      --region "${AWS_REGION}" \
      --table-name "${LOCK_TABLE}" \
      --attribute-definitions AttributeName=LockID,AttributeType=S \
      --key-schema AttributeName=LockID,KeyType=HASH \
      --billing-mode PAY_PER_REQUEST >/dev/null
    aws dynamodb wait table-exists --region "${AWS_REGION}" --table-name "${LOCK_TABLE}"
  fi
}

pushd "${ROOT_DIR}" >/dev/null

export DEPLOY_SKIP_INSTALL="${SKIP_INSTALL}"
export DEPLOY_SKIP_CHECK="${SKIP_CHECK}"
export DEPLOY_SKIP_BUILD="${SKIP_BUILD}"
bash "${ROOT_DIR}/scripts/support/prepare-deploy.sh"

resolve_admin_email
npx tsx "${ROOT_DIR}/scripts/render-auth-terraform-vars.ts"
bootstrap_backend

terraform -chdir="${TERRAFORM_DIR}" init \
  -input=false \
  -reconfigure \
  "-backend-config=bucket=${STATE_BUCKET}" \
  "-backend-config=key=auth/terraform.tfstate" \
  "-backend-config=region=${AWS_REGION}" \
  "-backend-config=dynamodb_table=${LOCK_TABLE}"

terraform -chdir="${TERRAFORM_DIR}" apply \
  -auto-approve \
  -var-file="${GENERATED_DIR}/auth.tfvars.json"

popd >/dev/null
