#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_ENV="${DEPLOY_ENV:-dev}"
SKIP_INSTALL="${DEPLOY_SKIP_INSTALL:-0}"
SKIP_CHECK="${DEPLOY_SKIP_CHECK:-0}"
SKIP_BUILD="${DEPLOY_SKIP_BUILD:-0}"
TERRAFORM_DIR="${ROOT_DIR}/infra/terraform"
GENERATED_DIR="${TERRAFORM_DIR}/.generated"
OUTPUT_FILE="$(mktemp)"
STATE_BUCKET="infrastructure-as-words-terraform-state-283107799662"
LOCK_TABLE="infrastructure-as-words-terraform-locks"
AWS_REGION="us-west-2"

cleanup() {
  rm -f "${OUTPUT_FILE}"
}

trap cleanup EXIT

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

npx tsx "${ROOT_DIR}/scripts/render-terraform-vars.ts" --env "${DEPLOY_ENV}"
bootstrap_backend

terraform_init_args=(
  -input=false
  -reconfigure
  "-backend-config=bucket=${STATE_BUCKET}"
  "-backend-config=key=${DEPLOY_ENV}/terraform.tfstate"
  "-backend-config=region=${AWS_REGION}"
  "-backend-config=dynamodb_table=${LOCK_TABLE}"
)

if [ -s "${TERRAFORM_DIR}/terraform.tfstate" ]; then
  terraform_init_args+=(-migrate-state -force-copy)
fi

terraform -chdir="${TERRAFORM_DIR}" init "${terraform_init_args[@]}"

terraform -chdir="${TERRAFORM_DIR}" apply \
  -auto-approve \
  -var-file="${GENERATED_DIR}/${DEPLOY_ENV}.tfvars.json"

terraform -chdir="${TERRAFORM_DIR}" output -json > "${OUTPUT_FILE}"
npx tsx "${ROOT_DIR}/scripts/write-runtime-config.ts" --env "${DEPLOY_ENV}" --outputs "${OUTPUT_FILE}"

WEB_BUCKET="$(node -e 'const fs=require("node:fs"); const parsed=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(parsed.web_bucket_name.value);' "${OUTPUT_FILE}")"
DISTRIBUTION_ID="$(node -e 'const fs=require("node:fs"); const parsed=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(parsed.web_distribution_id.value);' "${OUTPUT_FILE}")"

aws s3 sync "${ROOT_DIR}/web/out/${DEPLOY_ENV}/" "s3://${WEB_BUCKET}" --delete
aws cloudfront create-invalidation --distribution-id "${DISTRIBUTION_ID}" --paths "/*" >/dev/null

popd >/dev/null
