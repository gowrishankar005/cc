#!/usr/bin/env bash
# Run pipeline + score for a lab package (evaluation only).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LAB="$ROOT/coe-lab"
PIPE="$ROOT/pipeline"
PKG="${1:?usage: run-eval.sh <packageId>}"
FIXTURE="$LAB/fixtures/monorepo/packages/$PKG"
GOLD="$LAB/gold/packages/$PKG.gold.json"
OUT="$LAB/eval-results/$PKG"

if [[ ! -d "$FIXTURE" ]]; then
  echo "Missing fixture: $FIXTURE" >&2
  exit 2
fi
if [[ ! -f "$GOLD" ]]; then
  echo "Missing gold: $GOLD" >&2
  exit 2
fi

mkdir -p "$OUT"
cd "$PIPE"
npm run build --silent
node dist/orchestration/run-slice.js "$FIXTURE" --out "$OUT"
node "$LAB/scripts/score-calm.mjs" --calm "$OUT/architecture.calm.json" --gold "$GOLD" --out "$OUT/score.json"
echo "Wrote $OUT/score.json"
