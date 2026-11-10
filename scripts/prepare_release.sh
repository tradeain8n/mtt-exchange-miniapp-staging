#!/data/data/com.termux/files/usr/bin/bash
# Release only audited shared code, never the staging brand, bot token or config.
set -euo pipefail
STAGING="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="tradeain8n/mtt-exchange-miniapp"
BRANCH="release/giftmutant-$(date -u +%Y%m%d%H%M%S)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git clone -q "https://github.com/$TARGET.git" "$TMP/prod"
cd "$TMP/prod"
git checkout -q -b "$BRANCH"
# Explicit allowlist: staging branding and config never cross to production.
for file in docs/assets/chain.js docs/assets/quote.js tests/chain.test.mjs tests/quote.test.mjs; do
  if test -f "$STAGING/$file"; then
    mkdir -p "$(dirname "$file")"
    cp "$STAGING/$file" "$file"
  fi
done
if git diff --quiet; then
  echo "No shared-code changes to promote."
  exit 0
fi
npm test
npm run check
git add docs/assets/chain.js docs/assets/quote.js tests/chain.test.mjs tests/quote.test.mjs
git commit -m "Propose audited shared logic from GiftMutant staging"
git push -u origin "$BRANCH"
gh pr create -R "$TARGET" -B main -H "$BRANCH" \
  --title "Staging → production: reviewed shared exchange modules" \
  --body "Proposed from GiftMutant staging. No staging branding, configuration or tokens. Requires manual code review, CI, and operator acceptance. Does not change settlement signer or open payments."
echo "Pull request created; do not merge before review and production smoke tests."
