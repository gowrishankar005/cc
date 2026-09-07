#!/bin/bash
# Real, repeatable micro-benchmark for check-apply-confirmed.py's own
# execution cost -- the dominant, controllable factor in what this
# PreToolUse hook adds to every Bash tool call. Does NOT measure Claude
# Code's own harness-level process-dispatch overhead (a small, roughly
# fixed cost that applies to any hook regardless of content, and isn't
# something this implementation changes) -- that scope limitation is
# deliberate, not an oversight; see the hook's own header comment.
#
# Usage: .claude/hooks/benchmark.sh [N]   (default N=100)

set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
N="${1:-100}"

NONMATCH_PAYLOAD='{"tool_name":"Bash","tool_input":{"command":"git status"}}'
MATCH_PAYLOAD='{"tool_name":"Bash","tool_input":{"command":"python3 tools/review-session/apply.py --session-dir x --out y --i-confirm-apply"}}'

# A fresh marker so the "match" case exercises the full read+parse+freshness
# check, not just the early-exit path -- the real, representative worst case.
MARKER="$HERE/../hooks-state/apply-confirmed.json"
mkdir -p "$(dirname "$MARKER")"
python3 -c "
import json
from datetime import datetime, timezone
json.dump({'confirmed_at': datetime.now(timezone.utc).isoformat(), 'question': 'bench', 'answer': 'Apply now'}, open('$MARKER', 'w'))
"

time_runs() {
  local payload="$1"
  local n="$2"
  python3 -c "
import subprocess, time, statistics
payload = '''$payload'''
times = []
for _ in range($n):
    start = time.perf_counter()
    subprocess.run(['$HERE/check-apply-confirmed.py'], input=payload, capture_output=True, text=True)
    times.append((time.perf_counter() - start) * 1000)
times.sort()
print(f'  mean:   {statistics.mean(times):.2f} ms')
print(f'  median: {statistics.median(times):.2f} ms')
print(f'  p95:    {times[int(len(times)*0.95)]:.2f} ms')
print(f'  min/max: {min(times):.2f} / {max(times):.2f} ms')
"
}

echo "=== check-apply-confirmed.py -- non-matching command (fast path, fires on nearly every real Bash call), N=$N ==="
time_runs "$NONMATCH_PAYLOAD" "$N"
echo ""
echo "=== check-apply-confirmed.py -- matching command + fresh marker (full check, fires once per real apply), N=$N ==="
time_runs "$MATCH_PAYLOAD" "$N"
echo ""

rm -f "$MARKER"

echo "=== estimated total added latency for one real /review-session run ==="
echo "A typical run issues roughly: 1 run-slice + 1 pack.py + 1 draft_tier_b.py + 1 validate_drafts.py"
echo "+ 1-2 fetch-span calls + 1 apply.py + 1 npm-run-validate + a handful of Read/find/ls-shaped Bash"
echo "calls this skill's own steps use -- call it ~10-15 real Bash tool calls per run, of which"
echo "exactly ONE ever matches (the apply.py call itself)."
echo "So: total added latency ≈ (N-1) × [fast-path mean] + 1 × [full-check mean], both measured above."
