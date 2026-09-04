#!/usr/bin/env python3
"""PreToolUse hook (matcher: "Bash") -- the real, code-enforced backstop for
apply.py's own confirmation gate, added because /review-session's SKILL.md
can only enforce "ask before applying" through natural-language
instructions, and nothing in that layer stops an LLM from just skipping the
interactive steps. This is real: the structurally identical VS Code
chat-mode system this design is built on already had exactly this failure
happen for real (Architect_Pilot_Feedback_Notes.md Entry 24 -- asked to
"start the review," it silently decided all 23 residuals itself with no
cards shown).

Blocks (exit 2 -- a real, non-overridable hard block, confirmed via direct
doc fetch: "even a JSON permissionDecision of allow can't override it")
any Bash command reaching this codebase's one real write path into CALM
without an explicit --i-confirm-apply/--i-confirm-bulk-apply/--overrides
flag UNLESS a fresh marker exists proving a real human already answered a
real apply-confirmation AskUserQuestion -- written only by
record-apply-confirmation.py's own PostToolUse hook, which only fires when
the harness itself dispatches AskUserQuestion to a real person. An LLM
cannot fabricate this marker by choosing to skip a step; it can only exist
because a real question-and-answer round trip already happened.

DISCLOSED, NOT SILENTLY ASSUMED: whether this hard-block still applies
under --dangerously-skip-permissions is undocumented (checked directly
against the real docs, 2026-09-05) -- this gate's guarantee is conditional
on not running in that mode.
"""

import json
import shlex
import sys
import time
from pathlib import Path

MARKER_PATH = Path(__file__).resolve().parents[1] / "hooks-state" / "apply-confirmed.json"
MARKER_FRESHNESS_SECONDS = 15 * 60  # confirmed real answer, this session, 2026-09-04

GATED_FLAGS = ("--i-confirm-apply", "--i-confirm-bulk-apply")


def is_gated_command(command: str) -> bool:
    """Real, live-found false positive fixed 2026-09-05: a naive substring
    check matched this exact feature's own commit message (which quotes
    these flags in prose to describe them), blocking a legitimate `git
    commit`. Fixed by requiring the flag to appear as a real, standalone
    SHELL TOKEN via shlex, not merely a substring anywhere in the command
    text -- a real invocation has `--i-confirm-apply` as its own bare
    argument; prose describing it lives inside a quoted -m string (or
    heredoc), which shlex folds into one bigger token, not a standalone
    `--i-confirm-apply` token. If shlex can't parse the command at all
    (unbalanced quotes, etc.), fail safe -- fall back to the substring
    check rather than silently allowing an unparseable command through."""
    try:
        tokens = shlex.split(command)
    except ValueError:
        return any(f in command for f in GATED_FLAGS) or ("run-slice" in command and "--overrides" in command)

    if any(t in GATED_FLAGS for t in tokens):
        return True
    # A raw run-slice.js --overrides call bypasses apply.py/bulk_apply.py
    # entirely but reaches the exact same real write path (override-applier.ts).
    return any("run-slice" in t for t in tokens) and "--overrides" in tokens


def marker_is_fresh() -> tuple[bool, str]:
    if not MARKER_PATH.exists():
        return False, f"no confirmation marker found at {MARKER_PATH}"
    age = time.time() - MARKER_PATH.stat().st_mtime
    if age > MARKER_FRESHNESS_SECONDS:
        return False, f"confirmation marker is {int(age)}s old, older than the {MARKER_FRESHNESS_SECONDS}s freshness window"
    try:
        marker = json.loads(MARKER_PATH.read_text())
    except (OSError, json.JSONDecodeError) as e:
        return False, f"confirmation marker exists but could not be read: {e}"
    if not marker.get("confirmed_at"):
        return False, "confirmation marker is malformed (missing confirmed_at)"
    return True, ""


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        # Never let a hook itself become a source of failure for unrelated
        # tool calls -- if we can't even parse the input, allow and move on.
        return 0

    if payload.get("tool_name") != "Bash":
        return 0
    command = payload.get("tool_input", {}).get("command", "")
    if not is_gated_command(command):
        return 0  # fast path -- the overwhelming majority of real Bash calls exit here

    fresh, reason = marker_is_fresh()
    if fresh:
        return 0

    print(
        "[check-apply-confirmed] BLOCKED: this command reaches Weaver's one real "
        f"write path into CALM ({command!r}) without a fresh, real human confirmation. "
        f"Reason: {reason}. A genuine AskUserQuestion asking the exact Step 10 phrasing "
        "in .claude/skills/review-session/SKILL.md must be answered 'apply now' first.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
