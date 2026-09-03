#!/usr/bin/env python3
"""llm_common.py — shared evidence-assembly + network-boundary logic for
this suite's `claude`-CLI-backed passes (T-2, AGENT_TASKS_Residual_Dossier_Module.md).

Extracted from advisory.py and draft_tier_b.py, which used to each keep their
own near-identical copy of this. advisory.py, draft_tier_b.py, and the new
dossier.py all call this module instead of drifting three separate ways.

T-1 (AGENT_TASKS_Residual_Assist_Redesign.md, 2026-08-23): backend is the
`claude` CLI only, deliberately not a raw `ANTHROPIC_API_KEY` from the
environment — this project's own target-customer profile (fintechs) doesn't
leave API keys in environment variables for an LLM to pick up (owner
directive, 2026-08-23). No `claude` CLI on PATH -> callers report what would
be attempted and write nothing (the convention suggest-rules.ts/draft_tier_b.py/
advisory.py already established).

Each *caller*'s own response-shape validation (parse_and_validate_response,
draft_tier_b's decision/override guardrail, dossier's evidenceRefsUsed check)
stays in that caller's own file — only the call mechanism is shared here.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess

DEFAULT_MODEL = "claude-sonnet-4-5-20250929"

CLAUDE_CLI_TIMEOUT_SECONDS = 240
# T-1 real-run finding: a real Tier B drafting call against a synthetic
# multi-hop residual took 131.75s wall-clock (128,464ms reported by the CLI
# itself) — the original 120s timeout would have killed a real, in-progress,
# well-behaved call, not just a hung one. 240s is a real, measured margin
# above the one real data point we have, not a guess; revisit if a future
# real run needs more.


def build_evidence_prompt(residual: dict, unit_index: dict, packs: dict) -> str:
    """Pure, testable — assembles ONLY this residual's own unit ids and
    their evidence snippets (never anything from an unrelated residual),
    the same INPUTS-only discipline every caller of this needs. Identical
    logic advisory.py's build_advisory_prompt and draft_tier_b.py's
    build_user_prompt used to each keep their own copy of.

    Real, live bug found and fixed 2026-09-03 (the second half of
    BACKLOG.md's '_evidence_refs_for is a permanent stub' row, found
    verifying hand-rolled-resilience-candidate's own dossier addendum):
    this only ever pulled snippets via unitIds -> unit_index ->
    evidenceRefs, silently dropping any snippet pack.py's own
    _build_evidence_packs already captured directly from
    residual.evidenceRefs (real for any no-unit, Tier C residual — the
    ref never has a unit to route through). pack.py's own packing step
    was already correct; only this assembly step was missing the direct
    residual.evidenceRefs -> packs lookup."""
    relevant_units = {uid: info for uid, info in unit_index.items() if uid in residual.get("unitIds", [])}
    relevant_evidence = {ref: snippet for uid in relevant_units.values() for ref in uid.get("evidenceRefs", []) for r, snippet in packs.items() if r == ref}
    for ref in residual.get("evidenceRefs", []):
        if ref in packs:
            relevant_evidence[ref] = packs[ref]
    return json.dumps({"residual": residual, "unit_index": relevant_units, "evidence_snippets": relevant_evidence}, indent=2)


def known_evidence_refs(residual: dict, unit_index: dict) -> set[str]:
    """The full set of evidence refs actually available to a prompt built
    by build_evidence_prompt for this residual. residual.evidenceRefs is
    often EMPTY for a whole-unit trigger (e.g. S2-http-without-security-control
    -- confirmed against a real live pack.py --with-dossier run against the
    checked-in NestJS fixture, 2026-08-23), with the real evidence living
    on the unit's own evidenceRefs instead (same place cards.py's own
    per-unit evidence blockquote draws from). A guardrail that checks only
    residual.evidenceRefs would reject a response citing evidence that was
    genuinely part of its own prompt -- this is the set a caller's
    evidence-ref grounding check should actually compare against."""
    refs = set(residual.get("evidenceRefs", []))
    for uid in residual.get("unitIds", []):
        unit = unit_index.get(uid)
        if unit:
            refs.update(unit.get("evidenceRefs", []))
    return refs


def _llm_backend_available() -> bool:
    """The only real backend is the `claude` CLI, already authenticated in
    this environment. Deliberately not a raw ANTHROPIC_API_KEY (owner
    directive, 2026-08-23) — see module docstring."""
    return bool(shutil.which("claude"))


def _call_llm(system_prompt: str, user_prompt: str, model: str = DEFAULT_MODEL) -> str:
    """The only network/subprocess boundary in this whole tool suite — kept
    as one small, isolated function specifically so it can be swapped/mocked
    without touching any of the actually-testable logic around it. `claude`
    CLI only — see module docstring for why a raw API key is deliberately
    not supported.

    Security fix (found on review, T-1, 2026-08-23): `user_prompt` embeds
    real evidence snippets from the scanned repo's own source — piped via
    stdin (`input=`), never passed as an argv value, so it never lands in
    `ps`/`/proc/<pid>/cmdline` for another process on the machine to read.
    `claude -p` reads the prompt from stdin when none is given positionally
    (confirmed directly). `system_prompt` stays an argv value — it's each
    caller's own fixed, non-secret text, not derived from a scanned repo."""
    claude_path = shutil.which("claude")
    if not claude_path:
        raise RuntimeError("no LLM backend available (`claude` CLI not found on PATH)")
    result = subprocess.run(
        [claude_path, "-p", "--output-format", "json", "--model", model, "--system-prompt", system_prompt],
        input=user_prompt,
        capture_output=True,
        text=True,
        timeout=CLAUDE_CLI_TIMEOUT_SECONDS,
    )
    if result.returncode != 0:
        raise RuntimeError(f"claude CLI exited {result.returncode}: {result.stderr.strip()[:500]}")
    payload = json.loads(result.stdout)
    if payload.get("is_error"):
        raise RuntimeError(f"claude CLI reported an error: {str(payload.get('result'))[:500]}")
    return payload.get("result", "")


_FENCED_JSON_RE = re.compile(r"```(?:json)?\s*\n(.*?)```", re.DOTALL | re.IGNORECASE)


def _strip_markdown_json_fence(text: str) -> str:
    """T-1 real-run findings (AGENT_TASKS_Residual_Assist_Redesign.md), two
    rounds: (1) a live call wrapped its JSON answer in a bare ```json ... ```
    fence with nothing else — a leading/trailing-fence strip caught that.
    (2) A second live call, on a different residual, prefixed a full
    paragraph of prose BEFORE the fence — the leading-strip alone left that
    prose in front of the JSON and json.loads still failed. Fixed by
    searching for a fenced block ANYWHERE in the text first (handles both
    cases), falling back to the original leading/trailing-only strip, then
    to the raw text unchanged so a genuinely non-JSON response still fails
    json.loads and is rejected exactly as before — this never widens what
    counts as valid, only what counts as "the JSON, extracted from around
    it.\""""
    stripped = text.strip()
    fenced = _FENCED_JSON_RE.search(stripped)
    if fenced:
        return fenced.group(1).strip()
    if stripped.startswith("```"):
        lines = stripped.split("\n")
        if lines and lines[0].strip().lower() in ("```", "```json"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        stripped = "\n".join(lines).strip()
    return stripped
