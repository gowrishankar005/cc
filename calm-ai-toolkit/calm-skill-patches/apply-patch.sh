#!/usr/bin/env bash
# Applies calm-ai-toolkit's control-creation.md fix over a repo's freshly-generated
# `calm init-ai` output. Run this AFTER `calm init-ai -p <provider>` in the target repo.
#
# Usage: ./apply-patch.sh <path-to-target-repo>
#   e.g. ./apply-patch.sh /path/to/some-other-repo

set -euo pipefail

TARGET_REPO="${1:?Usage: apply-patch.sh <path-to-target-repo>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# calm init-ai -p claude writes to .claude/skills/calm/calm-prompts/
# calm init-ai -p copilot writes to .github/agents/calm-prompts/ (same filenames)
# Patch whichever exists.
FOUND=0
for candidate in \
    "$TARGET_REPO/.claude/skills/calm/calm-prompts/control-creation.md" \
    "$TARGET_REPO/.github/agents/calm-prompts/control-creation.md"
do
    if [ -f "$candidate" ]; then
        cp "$candidate" "$candidate.pre-patch-backup"
        cp "$SCRIPT_DIR/control-creation.md" "$candidate"
        echo "Patched: $candidate (original backed up to $candidate.pre-patch-backup)"
        FOUND=1
    fi
done

if [ "$FOUND" -eq 0 ]; then
    echo "No calm-prompts/control-creation.md found under $TARGET_REPO — run 'calm init-ai -p <provider>' first." >&2
    exit 1
fi
