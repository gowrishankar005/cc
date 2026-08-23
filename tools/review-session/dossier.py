#!/usr/bin/env python3
"""dossier.py — T-2's opt-in Evidence Dossier pass
(AGENT_TASKS_Residual_Dossier_Module.md).

Opt-in only — wired into pack.py behind a `--with-dossier` flag; `pack.py`
with no flag behaves exactly as it did before this file existed. Given a
residual (any tier — Tier A, B, or C alike) plus its unit_index/packs
context, calls the `claude` CLI and attaches an additive `dossier` field to
`residuals.json` (residuals-schema.json's own `dossier` property).

This is largely advisory.py's own build_advisory_prompt / SYSTEM_PROMPT /
parse_and_validate_response shape, generalized to run on any tier and to
report which evidence refs it actually used (`evidenceRefsUsed`) instead of
proposing a catalogue-rule candidate — a dossier is a per-residual evidence
summary, not the same lane as advisory.py's own catalogue-lane proposal.

Same hard boundary as advisory.py (T-RT-4): a dossier NEVER writes a fact.
Any response shaped like a decision/override is rejected outright. A human
accepting a dossier hypothesis via this residual's own card is ONE human
judgement — never a second, independent corroborating signal for a
hard-gated fact.

Backend is the `claude` CLI only — no `ANTHROPIC_API_KEY` fallback, ever
(see llm_common.py's own module docstring for why). No `claude` CLI on
PATH -> reports what would have been attempted, writes nothing.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import llm_common  # noqa: E402
from llm_common import _call_llm, _llm_backend_available, _strip_markdown_json_fence  # noqa: E402

DOSSIER_SYSTEM_PROMPT = """You are the Evidence Dossier assistant for a Weaver
residual review session. You are ADVISORY ONLY.

You never decide. You never write a Decision Record or an Override. You
never propose a decision/override pair, a node_add, a relationship_add, a
type_change, or any other fact. Your entire output is an evidence summary
and hypotheses for a human to weigh -- nothing you say is applied
automatically, and nothing you say counts as a second, independent
corroborating signal for a hard-gated fact (a human accepting your
hypothesis by picking a card option is ONE human judgement, not two).

You may be run on a residual of ANY tier (A, B, or C) -- your job is the
same regardless: summarize what the evidence actually shows and name which
of it you relied on, nothing more.

INPUTS you may read for this residual, and nothing else:
  - residuals.json entry for this residual ID
  - evidence/packs.json entries referenced by this residual's own unit ids
  - evidence/unit-index.json entries for the specific unit ids involved

HARD RULES (violating any of these means: say so plainly in "explanation",
propose no hypotheses, and leave evidenceRefsUsed empty):
  1. Never introduce a node, relationship, unit id, file path, or line
     number that does not already appear in your inputs.
  2. Never claim confidence beyond what the evidence supports -- if the
     evidence is thin, say so; do not manufacture a hypothesis to fill a
     gap.
  3. evidenceRefsUsed must list only file:line refs that already appear in
     this residual's own evidenceRefs -- never a ref you have not actually
     been given.
  4. Output format is fixed JSON, EXACTLY these top-level keys, nothing
     else:
     {"explanation": "<1-3 sentences, plain language, evidence-only>",
      "hypotheses": ["<hypothesis 1>", "<hypothesis 2>", ...],
      "evidenceRefsUsed": ["<file:line>", ...]}
     Never include a "decision" key or an "override" key -- a dossier never
     writes a fact.
     No prose outside these three fields.

You are being run on ONE residual for one dossier episode. Do not
summarize or comment on residuals outside this one."""


REQUIRED_DOSSIER_KEYS = {"explanation", "hypotheses", "evidenceRefsUsed"}
_EVIDENCE_REF_RE = re.compile(r"\b([\w./-]+\.[a-zA-Z]+):(\d+)\b")


def build_dossier_prompt(residual: dict, unit_index: dict, packs: dict) -> str:
    """Pure, testable -- same INPUTS-only assembly discipline advisory.py
    and draft_tier_b.py already established, via the shared
    llm_common.build_evidence_prompt."""
    return llm_common.build_evidence_prompt(residual, unit_index, packs)


def parse_and_validate_dossier_response(raw_text: str, residual: dict, unit_index: dict | None = None) -> dict:
    """Pure, fully testable without any network call -- the actual
    guardrail (hard rules 1-4 above). Returns
    {"outcome": "dossiered", "explanation": ..., "hypotheses": [...],
    "evidenceRefsUsed": [...]}
    or {"outcome": "invalid_response", "reason": ...} -- a REJECTION, never
    silently treated as a dossier, no matter how plausible-looking the
    response is.

    `unit_index` (optional, defaults to {}) is needed because
    residual.evidenceRefs is often EMPTY for a whole-unit trigger (e.g.
    S2-http-without-security-control) -- the real evidence that actually
    reached the model's prompt lives on the unit's own evidenceRefs
    instead (confirmed against a real live run, 2026-08-23: see
    llm_common.known_evidence_refs's own docstring). Without this, the
    guardrail would reject every real, evidence-grounded response for
    that whole (common) trigger class."""
    unit_index = unit_index or {}
    try:
        parsed = json.loads(_strip_markdown_json_fence(raw_text))
    except (json.JSONDecodeError, TypeError):
        return {"outcome": "invalid_response", "reason": "response was not valid JSON -- rejected, not guessed at"}

    if not isinstance(parsed, dict):
        return {"outcome": "invalid_response", "reason": "response JSON was not an object"}

    if "decision" in parsed or "override" in parsed:
        return {"outcome": "invalid_response", "reason": "dossier response must never contain a decision/override key -- a dossier never writes a fact"}

    missing = REQUIRED_DOSSIER_KEYS - parsed.keys()
    if missing:
        return {"outcome": "invalid_response", "reason": f"dossier response missing required field(s): {sorted(missing)}"}

    explanation = parsed["explanation"]
    if not isinstance(explanation, str) or not explanation.strip():
        return {"outcome": "invalid_response", "reason": "explanation must be a non-empty string"}

    hypotheses = parsed["hypotheses"]
    if not isinstance(hypotheses, list) or not all(isinstance(h, str) and h.strip() for h in hypotheses):
        return {"outcome": "invalid_response", "reason": "hypotheses must be a list of non-empty strings"}

    evidence_refs_used = parsed["evidenceRefsUsed"]
    if not isinstance(evidence_refs_used, list) or not all(isinstance(r, str) and r.strip() for r in evidence_refs_used):
        return {"outcome": "invalid_response", "reason": "evidenceRefsUsed must be a list of non-empty strings"}

    known_refs = llm_common.known_evidence_refs(residual, unit_index)
    for ref in evidence_refs_used:
        if ref not in known_refs:
            return {"outcome": "invalid_response", "reason": f"evidenceRefsUsed cites '{ref}', which is not one of this residual's own evidenceRefs {sorted(known_refs)} -- hard rule 1 (never introduce something not in the pack)"}

    # Hard rule 1, prose form -- same practical proxy advisory.py's own
    # guardrail already uses: any file:line-shaped token anywhere in the
    # free-text fields must already be a known evidence ref.
    free_text = explanation + " " + " ".join(hypotheses)
    for match in _EVIDENCE_REF_RE.finditer(free_text):
        ref = f"{match.group(1)}:{match.group(2)}"
        if ref not in known_refs:
            return {"outcome": "invalid_response", "reason": f"response cites '{ref}', which is not one of this residual's own evidenceRefs {sorted(known_refs)} -- hard rule 1 (never introduce something not in the pack)"}

    return {"outcome": "dossiered", "explanation": explanation, "hypotheses": hypotheses, "evidenceRefsUsed": evidence_refs_used}


def dossier_for_residual(residual: dict, unit_index: dict, packs: dict) -> dict:
    if not _llm_backend_available():
        return {"outcome": "no_key", "reason": "no LLM backend available (`claude` CLI not found on PATH) -- nothing dossiered"}
    user_prompt = build_dossier_prompt(residual, unit_index, packs)
    raw = _call_llm(DOSSIER_SYSTEM_PROMPT, user_prompt)
    return parse_and_validate_dossier_response(raw, residual, unit_index)


def process_dossier_batch(
    residuals: list[dict],
    unit_index: dict,
    packs: dict,
    dossier_fn=dossier_for_residual,
    now_fn=lambda: datetime.now(timezone.utc).isoformat(),
) -> tuple[list[dict], list[dict]]:
    """Runs dossier_fn over every residual, attaching dossier results in a
    NEW list (the input residuals are not mutated) -- same convention
    advisory.py's own process_advisory_batch already established. Returns
    (updated_residuals, episodes)."""
    updated: list[dict] = []
    episodes: list[dict] = []

    for residual in residuals:
        result = dossier_fn(residual, unit_index, packs)
        episode = {
            "residualId": residual["id"],
            "model": llm_common.DEFAULT_MODEL,
            "generatedAt": now_fn(),
            "outcome": result["outcome"],
        }

        r = dict(residual)
        if result["outcome"] == "dossiered":
            r["dossier"] = {
                "explanation": result["explanation"],
                "hypotheses": result["hypotheses"],
                "evidenceRefsUsed": result["evidenceRefsUsed"],
                "model": llm_common.DEFAULT_MODEL,
                "generatedAt": episode["generatedAt"],
            }
        else:
            episode["reason"] = result.get("reason", "")

        episodes.append(episode)
        updated.append(r)

    return updated, episodes
