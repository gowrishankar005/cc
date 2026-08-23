#!/usr/bin/env python3
"""draft_tier_b.py — Optional Tier B LLM drafting.

Gated behind a real bar: the human apply path must work without an LLM
first. That bar is met (proven end-to-end).

UPDATE (T-FS-1, BACKLOG.md "Tier-B residual detection"): `triage.py`'s
trigger map now has one real Tier B producer —
`multi-hop-single-candidate-below-threshold`, sourced from
`multi-hop-bridge-detector.ts`'s own `tier-b-single-candidate` ignored-item
(exactly one real database/topic candidate found among a bridge
interface's several syntactic implementers).

T-1 (AGENT_TASKS_Residual_Assist_Redesign.md, 2026-08-23): the first
real live-model run of this file, closing the "never exercised" gap that
used to be documented here. **Backend is the `claude` CLI only — deliberately,
not a raw `ANTHROPIC_API_KEY` from the environment.** This project's own
target-customer profile (fintechs) doesn't leave API keys in environment
variables for an LLM to pick up; the realistic path is an already-
authenticated coding-assistant CLI (`claude`, or the in-chat Copilot path
this same drafting logic is bound to via `.github/chatmodes/`), never a
bare secret. No `claude` CLI on `PATH` -> for every Tier B residual found,
prints what would be attempted and writes nothing (matches
suggest-rules.ts's own established convention in this codebase for "LLM
backend optional"). The network/subprocess boundary (_call_llm) is a
single, thin, isolated function specifically so the surrounding logic
(prompt assembly, response parsing, and — critically — the guardrails that
decide whether to trust and write what a model returns) can be fully
tested without ever calling a real backend: see draft_for_residual's own
separation and test_draft_tier_b.py's synthetic-response fixtures.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import llm_common  # noqa: E402
from llm_common import _call_llm, _llm_backend_available, _strip_markdown_json_fence  # noqa: E402
from validate_drafts import validate as validate_drafts  # noqa: E402

SYSTEM_PROMPT = """You are the Tier B drafting assistant for a Weaver residual review session.
You draft ONLY. You never apply, never edit typed-facts.json, never touch
the catalogues. Every draft you write goes to drafts/ and is reviewed by
the architect before anything is applied.

INPUTS you may read for this residual, and nothing else:
  - residuals.json entry for this residual ID
  - evidence/packs.json entries referenced by this residual ID
  - evidence/unit-index.json entries for the specific unit ids involved
  - source file:line spans explicitly listed as this residual's evidence
    refs (bounded window; do not open any other file)

HARD RULES (violating any of these means: do not draft, return
"cannot_decide" instead):
  1. You may only propose a decision if EVERY evidence field required by
     this residual's Tier B class (see taxonomy) is present and
     unambiguous. Partial evidence is not evidence.
  2. You may never introduce a node, relationship, unit id, file path, or
     line number that does not already appear in your inputs. If the
     right answer requires something not in the pack, output
     "cannot_decide: missing <what>" instead of guessing.
  3. You may never use prior knowledge of this codebase, this framework,
     or "codebases like this" to fill a gap the evidence doesn't cover.
     Cite only what's in the pack.
  4. If more than one candidate fits the evidence equally well, output
     "cannot_decide: ambiguous between <candidates>" — do not pick one.
  5. Every draft must cite its evidence explicitly in the Decision
     Record's rationale field (residual id, evidence ref, one sentence).
  6. Never blend your own confidence into x-aac-confidence. That field is
     computed by the deterministic pipeline; you do not set it.
  7. Output format is fixed JSON, one of:
     {"decision": <DecisionRecord>, "override": <Override>}
     {"cannot_decide": "<reason>"}
     No prose outside the rationale field or the cannot_decide reason.

You are being run on a fixed, closed set of residuals for one session.
Do not summarize, do not suggest catalogue changes, do not comment on
residuals outside your assigned batch."""


def build_user_prompt(residual: dict, unit_index: dict, packs: dict) -> str:
    """Assembles ONLY the inputs §5.1 permits — pure, testable, no I/O.
    Delegates to llm_common.build_evidence_prompt -- the shared
    implementation both this file and advisory.py (and dossier.py) now
    call."""
    return llm_common.build_evidence_prompt(residual, unit_index, packs)


REQUIRED_DECISION_KEYS = {"decision_id", "module", "target_type", "target_ref", "final_decision", "rationale", "reviewer", "reviewed_at", "status"}
REQUIRED_OVERRIDE_KEYS = {"override_id", "module", "target_ref", "override_type", "decision_record_ref", "status", "created_by", "created_at"}
# Tier B (design §3) only ever drafts these — never node_remove/boundary_change/
# relationship_remove, which are architect-only judgment calls even when evidenced.
TIER_B_ALLOWED_OVERRIDE_TYPES = {"relationship_add", "type_change", "node_add"}


def parse_and_validate_response(raw_text: str, residual: dict, calm_node_ids: set[str] | None, calm_relationship_ids: set[str] | None) -> dict:
    """Pure, fully testable without any network call — this is the actual
    guardrail (hard rules 1-7), not the model's own good behavior, which
    this tool structurally cannot verify or trust on its own. Returns
    {"outcome": "drafted", "decision": ..., "override": ...}
    or {"outcome": "cannot_decide", "reason": ...}
    or {"outcome": "invalid_response", "reason": ...} — the last one is a
    REJECTION, never silently treated as drafted, no matter how
    plausible-looking the response is (S6: non-fabricate)."""
    try:
        parsed = json.loads(_strip_markdown_json_fence(raw_text))
    except (json.JSONDecodeError, TypeError):
        return {"outcome": "invalid_response", "reason": "response was not valid JSON — rejected, not guessed at"}

    if not isinstance(parsed, dict):
        return {"outcome": "invalid_response", "reason": "response JSON was not an object"}

    if "cannot_decide" in parsed:
        reason = parsed["cannot_decide"]
        if not isinstance(reason, str) or not reason.strip():
            return {"outcome": "invalid_response", "reason": "cannot_decide present but not a non-empty string"}
        return {"outcome": "cannot_decide", "reason": reason}

    decision = parsed.get("decision")
    override = parsed.get("override")
    if not isinstance(decision, dict) or not isinstance(override, dict):
        return {"outcome": "invalid_response", "reason": "response has neither a valid cannot_decide nor a {decision, override} pair"}

    missing_decision = REQUIRED_DECISION_KEYS - decision.keys()
    if missing_decision:
        return {"outcome": "invalid_response", "reason": f"decision missing required field(s): {sorted(missing_decision)}"}
    missing_override = REQUIRED_OVERRIDE_KEYS - override.keys()
    if missing_override:
        return {"outcome": "invalid_response", "reason": f"override missing required field(s): {sorted(missing_override)}"}

    # Hard rule 6, mechanically enforced, not just instructed: the model
    # must identify itself, never impersonate a human reviewer.
    reviewer = decision.get("reviewer", "")
    if not isinstance(reviewer, str) or not reviewer.startswith("llm-advisory:"):
        return {"outcome": "invalid_response", "reason": f"decision.reviewer must start with 'llm-advisory:', got: {reviewer!r} — an LLM draft must never claim to be an architect"}

    if override.get("override_type") not in TIER_B_ALLOWED_OVERRIDE_TYPES:
        return {"outcome": "invalid_response", "reason": f"override_type '{override.get('override_type')}' is not Tier-B-draftable (only {sorted(TIER_B_ALLOWED_OVERRIDE_TYPES)}) — architect-only judgment call"}

    if override.get("decision_record_ref") != decision.get("decision_id"):
        return {"outcome": "invalid_response", "reason": "override.decision_record_ref does not match decision.decision_id"}

    if decision.get("target_ref") not in residual.get("unitIds", []) and override.get("target_ref") not in residual.get("unitIds", []):
        # relationship_add's target is a NEW relationship id, not a unit id — only enforce this for node-targeting types.
        if override.get("override_type") in ("type_change", "node_add") and override.get("target_ref") not in residual.get("unitIds", []):
            return {"outcome": "invalid_response", "reason": f"target_ref '{override.get('target_ref')}' is not one of this residual's own unit ids {residual.get('unitIds')} — hard rule 2 (never introduce something not in the pack)"}

    # Defense in depth: run the SAME validator apply.py itself will run,
    # before ever trusting this draft is real. A response that passes every
    # check above but still fails real integrity rules (e.g. a dangling
    # relationship_add endpoint) must still be rejected here, not written.
    report = validate_drafts({decision["decision_id"]: decision}, [override], calm_node_ids, calm_relationship_ids)
    if not report.valid:
        return {"outcome": "invalid_response", "reason": f"drafted pair failed validate_drafts: {report.errors}"}

    return {"outcome": "drafted", "decision": decision, "override": override}


def draft_for_residual(residual: dict, unit_index: dict, packs: dict, calm_node_ids: set[str] | None, calm_relationship_ids: set[str] | None) -> dict:
    if not _llm_backend_available():
        return {"outcome": "no_key", "reason": "no LLM backend available (`claude` CLI not found on PATH) — nothing drafted"}
    user_prompt = build_user_prompt(residual, unit_index, packs)
    raw = _call_llm(SYSTEM_PROMPT, user_prompt)
    return parse_and_validate_response(raw, residual, calm_node_ids, calm_relationship_ids)


def main() -> int:
    parser = argparse.ArgumentParser(description="Optional Tier B LLM drafting. No API key -> reports what would be attempted, writes nothing.")
    parser.add_argument("--session-dir", required=True)
    args = parser.parse_args()

    session_dir = Path(args.session_dir).resolve()
    residuals_path = session_dir / "residuals.json"
    if not residuals_path.exists():
        print(f"[draft_tier_b] {residuals_path} not found — is this a real Session Pack?", file=sys.stderr)
        return 1
    residuals_doc = json.loads(residuals_path.read_text())
    residuals = residuals_doc.get("items", [])
    tier_b = [r for r in residuals if r.get("tier") == "B" and r.get("status") == "open"]

    if not tier_b:
        print("[draft_tier_b] no open Tier B residuals in this pack — nothing to draft this run. (T-FS-1 added a real Tier B producer, multi-hop-single-candidate-below-threshold; this pack's own scan just didn't trigger it.)")
        return 0

    unit_index = json.loads((session_dir / "evidence" / "unit-index.json").read_text()) if (session_dir / "evidence" / "unit-index.json").exists() else {}
    packs = json.loads((session_dir / "evidence" / "packs.json").read_text()) if (session_dir / "evidence" / "packs.json").exists() else {}
    manifest = json.loads((session_dir / "manifest.json").read_text()) if (session_dir / "manifest.json").exists() else {}

    calm_node_ids = None
    calm_relationship_ids = None
    out_dir = manifest.get("outDir")
    if out_dir:
        calm_path = Path(out_dir) / "architecture.calm.json"
        if calm_path.exists():
            calm = json.loads(calm_path.read_text())
            calm_node_ids = {n["unique-id"] for n in calm.get("nodes", [])}
            calm_relationship_ids = {r["unique-id"] for r in calm.get("relationships", [])}

    if not _llm_backend_available():
        print(f"[draft_tier_b] no LLM backend available (`claude` CLI not found on PATH) — would attempt to draft {len(tier_b)} residual(s), writing nothing: {[r['id'] for r in tier_b]}")
        return 0
    print("[draft_tier_b] backend: claude CLI")

    decisions_dir = session_dir / "drafts" / "decisions"
    overrides_dir = session_dir / "drafts" / "overrides"
    results = process_tier_b_batch(tier_b, unit_index, packs, calm_node_ids, calm_relationship_ids, decisions_dir, overrides_dir)
    for residual_id, outcome, detail in results:
        if outcome == "drafted":
            print(f"[draft_tier_b] {residual_id}: drafted {detail}")
        elif outcome == "collision":
            print(f"[draft_tier_b] {residual_id}: REFUSING — {detail}")
        else:
            print(f"[draft_tier_b] {residual_id}: {outcome} — {detail}")

    tier_b_by_id = {r["id"]: r for r in tier_b}
    if _apply_bar_not_met_outcomes(results, tier_b_by_id):
        residuals_path.write_text(json.dumps(residuals_doc, indent=2))

    return 0


def _apply_bar_not_met_outcomes(results: list[tuple[str, str, str]], tier_b_by_id: dict[str, dict]) -> bool:
    """§3's redesign: a Tier B residual whose evidence bar wasn't met
    (draft_for_residual's own "cannot_decide" outcome) must gain
    draftOutcome: "bar-not-met" in residuals.json -- otherwise it reads
    identically to a residual that was never Tier-B-eligible at all.
    Mutates the residual dicts in tier_b_by_id in place (they're the same
    objects held in residuals_doc's own items list); returns True if
    anything changed, so the caller knows whether residuals.json needs
    rewriting."""
    changed = False
    for residual_id, outcome, _detail in results:
        if outcome == "cannot_decide" and residual_id in tier_b_by_id:
            tier_b_by_id[residual_id]["draftOutcome"] = "bar-not-met"
            changed = True
    return changed


def process_tier_b_batch(
    tier_b: list[dict],
    unit_index: dict,
    packs: dict,
    calm_node_ids: set[str] | None,
    calm_relationship_ids: set[str] | None,
    decisions_dir: Path,
    overrides_dir: Path,
    draft_fn=draft_for_residual,
) -> list[tuple[str, str, str]]:
    """Drafts every residual in the batch, writing to disk on success.
    `draft_fn` is injectable (defaults to the real draft_for_residual) so
    this can be tested without a live network call — see
    test_draft_tier_b.py's TestCrossResidualCollision.

    Real bug found on review: nothing previously checked whether a model
    returned the same decision_id/override_id for two DIFFERENT residuals
    in this batch (e.g. a model defaulting to generic ids) — the second
    write would silently overwrite the first, the exact same class of bug
    already found and fixed in apply.py's _merge_drafts. Track what this
    run has already written and refuse a collision rather than silently
    clobber. Returns a list of (residual_id, outcome, detail) tuples,
    where outcome is one of "drafted" | "collision" | whatever
    draft_for_residual's own outcome was (cannot_decide/invalid_response/no_key).
    """
    written_decision_ids: dict[str, str] = {}  # decision_id -> residual id that claimed it
    written_override_ids: dict[str, str] = {}
    results: list[tuple[str, str, str]] = []
    for residual in tier_b:
        result = draft_fn(residual, unit_index, packs, calm_node_ids, calm_relationship_ids)
        if result["outcome"] != "drafted":
            results.append((residual["id"], result["outcome"], result["reason"]))
            continue

        decision_id = result["decision"]["decision_id"]
        override_id = result["override"]["override_id"]
        if decision_id in written_decision_ids or override_id in written_override_ids:
            claimant = written_decision_ids.get(decision_id) or written_override_ids.get(override_id)
            results.append((residual["id"], "collision", f"decision/override id collides with residual {claimant}'s draft in this same batch ({decision_id}/{override_id}) — not written, would silently overwrite"))
            continue

        written_decision_ids[decision_id] = residual["id"]
        written_override_ids[override_id] = residual["id"]
        (decisions_dir / f"{decision_id}.json").write_text(json.dumps(result["decision"], indent=2))
        (overrides_dir / f"{override_id}.json").write_text(json.dumps(result["override"], indent=2))
        results.append((residual["id"], "drafted", f"{decision_id} / {override_id}"))

    return results


if __name__ == "__main__":
    raise SystemExit(main())
