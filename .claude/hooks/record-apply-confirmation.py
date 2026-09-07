#!/usr/bin/env python3
"""PostToolUse hook (matcher: "AskUserQuestion") -- the write side of the
apply-confirmation gate (see check-apply-confirmed.py for the block side
and the full rationale).

Fires only after the harness has ALREADY dispatched a real AskUserQuestion
to a real person and received a real answer back -- this script cannot run,
and the marker cannot exist, unless that round trip genuinely happened.
An LLM choosing to skip the interactive step skips this entirely; it
cannot fabricate the marker by any means short of actually asking and
getting a real human answer.

Matches specifically on the exact phrasing .claude/skills/review-session/SKILL.md's
Step 10 mandates ("apply now, or stop here") -- a distinctive substring, not a bare
"apply" keyword, so an unrelated question that happens to mention applying something
doesn't accidentally satisfy this. If that phrasing in SKILL.md is ever edited, this
match must be updated to stay in sync (named explicitly in both files' own comments so
neither drifts silently).

Never blocks anything -- always exits 0, regardless of outcome, since it runs after
the real tool call already completed.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

MARKER_PATH = Path(__file__).resolve().parents[1] / "hooks-state" / "apply-confirmed.json"
QUESTION_MATCH_SUBSTRING = "apply now, or stop here"
APPLY_LABEL_PREFIX = "Apply now"
STOP_LABEL_PREFIX = "Stop here"


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0

    tool_input = payload.get("tool_input", {})
    questions = tool_input.get("questions", [])
    answers = tool_input.get("answers", {})

    matched_question = next(
        (q for q in questions if QUESTION_MATCH_SUBSTRING in q.get("question", "")),
        None,
    )
    if matched_question is None:
        return 0  # not the apply-confirmation question -- nothing to record

    question_text = matched_question["question"]
    answer_text = answers.get(question_text, "")

    MARKER_PATH.parent.mkdir(parents=True, exist_ok=True)

    if answer_text.startswith(APPLY_LABEL_PREFIX):
        MARKER_PATH.write_text(
            json.dumps(
                {
                    "confirmed_at": datetime.now(timezone.utc).isoformat(),
                    "question": question_text,
                    "answer": answer_text,
                },
                indent=2,
            )
        )
    elif answer_text.startswith(STOP_LABEL_PREFIX):
        # An explicit decline must invalidate any earlier real "yes" -- a stale
        # marker from an abandoned prior confirmation must never satisfy a
        # later, different apply attempt.
        MARKER_PATH.unlink(missing_ok=True)
    # Any other answer text (e.g. "other: ...") is treated as non-consent --
    # never written as a marker, matching the same "no ambiguous yes" rule
    # SKILL.md's own Step 10 states.

    return 0


if __name__ == "__main__":
    sys.exit(main())
