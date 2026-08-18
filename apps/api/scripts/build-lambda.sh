#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
STALE_PKG="$ROOT/infra/components/lambda/pkg"
ZIP="$ROOT/infra/components/lambda/lambda.zip"
BETTER_SQLITE3_VERSION="11.7.0"
LAMBDA_NODE_VERSION="24" # must match runtime in infra/components/lambda.tf
ESBUILD="$ROOT/node_modules/.bin/esbuild"

if [[ ! -x "$ESBUILD" ]]; then
  echo "esbuild not found — run 'npm install' from the repo root first." >&2
  exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
  echo "zip not found — install it (e.g. apt install zip)." >&2
  exit 1
fi

if [[ -d "$STALE_PKG" ]] && ! rm -rf "$STALE_PKG" 2>/dev/null; then
  echo "Warning: could not remove stale $STALE_PKG (root-owned from an earlier build)."
  echo "Building in a temp dir instead. To clean up later: sudo rm -rf $STALE_PKG"
fi

PKG="$(mktemp -d "${TMPDIR:-/tmp}/life-tracker-lambda.XXXXXX")"
cleanup() {
  rm -rf "$PKG"
}
trap cleanup EXIT

npm run build -w @health-tracker/shared --prefix "$ROOT"
npm run build -w @health-tracker/api --prefix "$ROOT"

"$ESBUILD" "$ROOT/apps/api/src/lambda.ts" \
  --bundle \
  --platform=node \
  --target=node${LAMBDA_NODE_VERSION} \
  --format=cjs \
  --log-level=error \
  --outfile="$PKG/index.js" \
  --external:better-sqlite3

cp -r "$ROOT/apps/api/drizzle" "$PKG/"
cp -r "$ROOT/node_modules/@fastify/swagger-ui/static" "$PKG/static"

install_native_deps() {
  if docker info >/dev/null 2>&1; then
    docker run --rm --platform linux/amd64 \
      -v "$PKG":/var/task \
      -w /var/task \
      "public.ecr.aws/sam/build-nodejs${LAMBDA_NODE_VERSION}.x" \
      bash -lc "npm init -y >/dev/null 2>&1 && npm install better-sqlite3@${BETTER_SQLITE3_VERSION} --omit=dev"

    # Docker runs as root; fix ownership so the host user owns the output.
    docker run --rm --platform linux/amd64 \
      --entrypoint chown \
      -v "$PKG":/var/task \
      alpine:3 \
      -R "$(id -u):$(id -g)" /var/task
    return
  fi

  echo "Docker not available; cannot build better-sqlite3 for Node ${LAMBDA_NODE_VERSION}." >&2
  echo "Install Docker or match LAMBDA_NODE_VERSION to a runtime npm can cross-compile for." >&2
  exit 1
}

install_native_deps

mkdir -p "$(dirname "$ZIP")" || {
  echo "Cannot create $(dirname "$ZIP") — directory may be root-owned." >&2
  echo "Run once: sudo mkdir -p $(dirname "$ZIP") && sudo chown -R $(id -u):$(id -g) $(dirname "$ROOT/infra/components/lambda")" >&2
  exit 1
}

rm -f "$ZIP"
(
  cd "$PKG"
  zip -qr "$ZIP" .
)

echo "Built $ZIP"
