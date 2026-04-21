#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_ENV="${DEPLOY_ENV:-dev}"
SKIP_INSTALL="${DEPLOY_SKIP_INSTALL:-0}"
SKIP_CHECK="${DEPLOY_SKIP_CHECK:-0}"
SKIP_BUILD="${DEPLOY_SKIP_BUILD:-0}"
HASH_SCRIPT="${ROOT_DIR}/scripts/support/hash-paths.mjs"
HASH_DIR="${ROOT_DIR}/.cache/deploy"
HASH_FILE="${HASH_DIR}/${DEPLOY_ENV}.sha256"

mkdir -p "${HASH_DIR}"

if [[ "${SKIP_INSTALL}" != "1" ]]; then
  npm install --include-workspace-root --workspaces
fi

if [[ "${SKIP_CHECK}" != "1" ]]; then
  npm run check
fi

SOURCE_HASH="$(
  node "${HASH_SCRIPT}" \
    "${ROOT_DIR}/package.json" \
    "${ROOT_DIR}/package-lock.json" \
    "${ROOT_DIR}/tsconfig.base.json" \
    "${ROOT_DIR}/eslint.config.mjs" \
    "${ROOT_DIR}/packages" \
    "${ROOT_DIR}/services" \
    "${ROOT_DIR}/web" \
    "${ROOT_DIR}/infra" \
    "${ROOT_DIR}/scripts"
)"

PREVIOUS_HASH=""
if [[ -f "${HASH_FILE}" ]]; then
  PREVIOUS_HASH="$(cat "${HASH_FILE}")"
fi

if [[ "${SKIP_BUILD}" != "1" && "${SOURCE_HASH}" != "${PREVIOUS_HASH}" ]]; then
  npm run build:all
  printf '%s' "${SOURCE_HASH}" > "${HASH_FILE}"
fi

for artifact in \
  "${ROOT_DIR}/services/api/dist/lambda/index.js" \
  "${ROOT_DIR}/web/out/${DEPLOY_ENV}/index.html"; do
  if [[ ! -f "${artifact}" ]]; then
    echo "Missing deploy artifact: ${artifact}" >&2
    exit 1
  fi
done
