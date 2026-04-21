#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for deploy_target in auth prod dev; do
  (
    cd "${ROOT_DIR}"
    if [[ "${deploy_target}" == "auth" ]]; then
      bash "./scripts/deploy-auth.sh"
    else
      DEPLOY_ENV="${deploy_target}" bash "./scripts/deploy.sh"
    fi
  )
done
