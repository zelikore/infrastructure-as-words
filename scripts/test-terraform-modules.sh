#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODULES=(
  "${ROOT_DIR}/infra/modules/submission-data"
  "${ROOT_DIR}/infra/modules/cognito-web-client"
  "${ROOT_DIR}/infra/modules/shared-auth"
)

cleanup() {
  for module_dir in "${MODULES[@]}"; do
    rm -rf "${module_dir}/.terraform" "${module_dir}/.terraform.lock.hcl"
  done
}

trap cleanup EXIT

for module_dir in "${MODULES[@]}"; do
  terraform -chdir="${module_dir}" init -backend=false
  terraform -chdir="${module_dir}" test
done
