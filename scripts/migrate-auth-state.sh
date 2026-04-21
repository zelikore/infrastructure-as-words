#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_TERRAFORM_DIR="${ROOT_DIR}/infra/terraform"
AUTH_TERRAFORM_DIR="${ROOT_DIR}/infra/terraform-auth"
STATE_BUCKET="infrastructure-as-words-terraform-state-283107799662"
LOCK_TABLE="infrastructure-as-words-terraform-locks"
AWS_REGION="us-west-2"
TMP_DIR="$(mktemp -d)"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"
APP_STATE_FILE="${TMP_DIR}/prod.tfstate"
AUTH_STATE_FILE="${TMP_DIR}/auth.tfstate"
TERRAFORM_VERSION="$(
  terraform version -json | node -e 'let input=""; process.stdin.on("data",(chunk)=>{input+=chunk;}); process.stdin.on("end",()=>{process.stdout.write(JSON.parse(input).terraform_version);});'
)"
MIGRATION_ADDRESSES=(
  "aws_cognito_user_pool.main"
  "aws_cognito_resource_server.main"
  "aws_cognito_user_pool_domain.main"
  "aws_route53_record.auth_a"
  "aws_route53_record.auth_aaaa"
)

cleanup() {
  rm -rf "${TMP_DIR}"
}

trap cleanup EXIT

backup_state_object() {
  local key="$1"
  if aws s3api head-object --bucket "${STATE_BUCKET}" --key "${key}" >/dev/null 2>&1; then
    aws s3 cp \
      "s3://${STATE_BUCKET}/${key}" \
      "s3://${STATE_BUCKET}/backups/${TIMESTAMP}/$(basename "${key}")" >/dev/null
  fi
}

init_backend() {
  local terraform_dir="$1"
  local key="$2"

  terraform -chdir="${terraform_dir}" init \
    -input=false \
    -reconfigure \
    "-backend-config=bucket=${STATE_BUCKET}" \
    "-backend-config=key=${key}" \
    "-backend-config=region=${AWS_REGION}" \
    "-backend-config=dynamodb_table=${LOCK_TABLE}" >/dev/null
}

pushd "${ROOT_DIR}" >/dev/null

init_backend "${APP_TERRAFORM_DIR}" "prod/terraform.tfstate"
init_backend "${AUTH_TERRAFORM_DIR}" "auth/terraform.tfstate"

backup_state_object "prod/terraform.tfstate"
backup_state_object "auth/terraform.tfstate"

terraform -chdir="${APP_TERRAFORM_DIR}" state pull > "${APP_STATE_FILE}"

if aws s3api head-object --bucket "${STATE_BUCKET}" --key "auth/terraform.tfstate" >/dev/null 2>&1; then
  terraform -chdir="${AUTH_TERRAFORM_DIR}" state pull > "${AUTH_STATE_FILE}"
else
  cat > "${AUTH_STATE_FILE}" <<EOF
{
  "version": 4,
  "terraform_version": "${TERRAFORM_VERSION}",
  "serial": 1,
  "lineage": "$(uuidgen | tr '[:upper:]' '[:lower:]')",
  "outputs": {},
  "resources": []
}
EOF
fi

for address in "${MIGRATION_ADDRESSES[@]}"; do
  terraform -chdir="${AUTH_TERRAFORM_DIR}" state mv \
    -state="${APP_STATE_FILE}" \
    -state-out="${AUTH_STATE_FILE}" \
    "${address}" \
    "${address}" >/dev/null
done

terraform -chdir="${AUTH_TERRAFORM_DIR}" state push "${AUTH_STATE_FILE}" >/dev/null
terraform -chdir="${APP_TERRAFORM_DIR}" state push "${APP_STATE_FILE}" >/dev/null

popd >/dev/null
