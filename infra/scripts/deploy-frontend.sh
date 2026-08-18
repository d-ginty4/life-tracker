#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INFRA="$ROOT/infra"
DIST="$ROOT/apps/web/dist"
AWS_PROFILE="${AWS_PROFILE:-AdministratorAccess-590184097018}"
AWS_REGION="${AWS_REGION:-eu-west-1}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI not found." >&2
  exit 1
fi

tf_output() {
  local name="$1"
  if command -v tofu >/dev/null 2>&1; then
    tofu -chdir="$INFRA" output -raw "$name"
  elif command -v terraform >/dev/null 2>&1; then
    terraform -chdir="$INFRA" output -raw "$name"
  else
    echo "OpenTofu or Terraform not found — needed to read infra outputs." >&2
    exit 1
  fi
}

BUCKET="$(tf_output web_bucket)"
DISTRIBUTION_ID="$(tf_output cloudfront_distribution_id)"
APP_URL="$(tf_output app_url)"

echo "Building frontend..."
npm run build -w @health-tracker/shared --prefix "$ROOT"
npm run build -w @health-tracker/web --prefix "$ROOT"

if [[ ! -d "$DIST" ]]; then
  echo "Build output not found at $DIST" >&2
  exit 1
fi

echo "Uploading to s3://$BUCKET/ ..."
aws s3 sync "$DIST/" "s3://$BUCKET/" \
  --delete \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --exclude "index.html" \
  --cache-control "public, max-age=31536000, immutable"

aws s3 cp "$DIST/index.html" "s3://$BUCKET/index.html" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --cache-control "public, max-age=0, must-revalidate" \
  --content-type "text/html"

echo "Invalidating CloudFront cache ..."
INVALIDATION_ID="$(
  aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*" \
    --profile "$AWS_PROFILE" \
    --query 'Invalidation.Id' \
    --output text
)"

echo "Done."
