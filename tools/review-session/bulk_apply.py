#!/usr/bin/env python3
"""bulk_apply.py — T-RT-1: bulk residual-decision authoring
(BACKLOG.md "Bulk residual-decision authoring" — "tens of near-identical
residuals from one module in a real dry run").

Design authority: Architect_Residual_Review_Session.md §2.1's own worked
example — "all NestJS `*.service.ts` extending a Prisma/TypeORM client ->
database" — and its "bulk-apply integrity" rule (found on review there):
accepting a bulk-apply option must still list every affected unit id
before commit, and must still write ONE Decision Record per residual, not
one blanket record for the batch, so any single item can later be
superseded/corrected on its own without touching the others. README.md's
non-negotiable rule 9 restates the same requirement.

How it works: the architect answers ONE residual's choice card the normal
way (by hand, per examples/README.md, or via draft_tier_b.py for a Tier B
card) — that already-written Decision Record (+ its Override, if any) in
drafts/decisions/ + drafts/overrides/ is the "anchor". This script finds
every OTHER open residual in the same (tier, class) group (cards.py's own
`group_by_class` — the same grouping already shown to the architect as
"Similar residuals this session" on every card) and writes each one its
own fresh Decision Record (+ Override, if the anchor had one), copying the
anchor's actual answer (final_decision / override new_value) but each
target's own target_ref and its own real evidence — never the anchor's
unit id or file:line snippet, per S5 (evidence-first, no node/relationship/
file/line introduced that isn't already in the pack's own evidence).

Scope, stated not hidden: only replicable when the anchor's answer does
NOT itself name a specific other unit as part of its value — a
`type_change` override (the design's own worked example) or a no-override
"leave open"/"accepted" decision are safe to recopy verbatim onto a
DIFFERENT residual's own target. `relationship_add` / `node_add` /
`node_remove` / `node_rename` / `boundary_change` name a specific target
unit or a brand-new node as part of the answer itself — blindly recopying
that onto a different residual's own unit would be exactly the "one wrong
first answer silently propagates to 49 others" failure §2.1 warns about,
not a real bulk answer, so this script refuses those up front rather than
guess.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cards import group_by_class  # noqa: E402
from validate_drafts import REQUIRED_DECISION_FIELDS, REQUIRED_OVERRIDE_FIELDS  # noqa: E402

REPLICABLE_OVERRIDE_TYPES = {"type_change"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_json_dir(dir_path: Path) -> dict[str, dict]:
    """Keyed by decision_id or override_id — whichever the file has."""
    if not dir_path.exists():
        return {}
    out = {}
    for f in sorted(dir_path.glob("*.json")):
        data = json.loads(f.read_text())
        key = data.get("decision_id") or data.get("override_id")
        if key:
            out[key] = data
    return out


def _residuals_by_id(session_dir: Path) -> dict[str, dict]:
    residuals_path = session_dir / "residuals.json"
    if not residuals_path.exists():
        raise SystemExit(f"[bulk_apply] {residuals_path} not found — is this a real Session Pack (built by pack.py)?")
    return {r["id"]: r for r in json.loads(residuals_path.read_text()).get("items", [])}


def find_anchor_decision(decisions: dict[str, dict], anchor_residual: dict) -> dict:
    """The anchor Decision Record is located by its target_ref matching the
    anchor residual's own (single) unit id — the same real link
    override-applier.ts itself relies on — never by parsing prose out of a
    rationale string."""
    unit_ids = anchor_residual.get("unitIds", [])
    if len(unit_ids) != 1:
        raise SystemExit(f"[bulk_apply] anchor residual {anchor_residual['id']} has {len(unit_ids)} unit id(s), not exactly 1 — cannot unambiguously locate its own Decision Record by target_ref")
    target = unit_ids[0]
    matches = [d for d in decisions.values() if d.get("target_ref") == target and d.get("status") == "active"]
    if not matches:
        raise SystemExit(f"[bulk_apply] no active Decision Record in drafts/decisions/ targets '{target}' (anchor residual {anchor_residual['id']}'s own unit) — author the anchor's answer first (see examples/README.md), then bulk-apply it")
    if len(matches) > 1:
        raise SystemExit(f"[bulk_apply] {len(matches)} active Decision Records target '{target}' — ambiguous anchor, refusing to guess which one to replicate")
    return matches[0]


def find_anchor_override(overrides: dict[str, dict], anchor_decision: dict) -> dict | None:
    matches = [o for o in overrides.values() if o.get("decision_record_ref") == anchor_decision["decision_id"] and o.get("status") == "active"]
    if len(matches) > 1:
        raise SystemExit(f"[bulk_apply] {len(matches)} active Overrides reference anchor decision '{anchor_decision['decision_id']}' — ambiguous, refusing to guess which one to replicate")
    return matches[0] if matches else None


def validate_anchor_shape(anchor_decision: dict, anchor_override: dict | None) -> None:
    """Real bug found on review: build_replica indexes anchor_decision/
    anchor_override fields directly (anchor_decision["module"], etc.) —
    a malformed anchor draft (a hand-authored file missing a required
    field) used to reach that unchecked, AFTER the confirmation prompt had
    already been shown and answered, crashing with a raw KeyError instead
    of a clean refusal. Same "never trust a stale prior validation"
    discipline apply.py's own docstring already states — checked here,
    before anything is printed or confirmed, not after."""
    missing_decision = REQUIRED_DECISION_FIELDS.keys() - anchor_decision.keys()
    if missing_decision:
        raise SystemExit(f"[bulk_apply] anchor Decision Record '{anchor_decision.get('decision_id', '<missing id>')}' is missing required field(s) {sorted(missing_decision)} — refusing to use as a bulk-apply template")
    if anchor_override is not None:
        missing_override = REQUIRED_OVERRIDE_FIELDS.keys() - anchor_override.keys()
        if missing_override:
            raise SystemExit(f"[bulk_apply] anchor Override '{anchor_override.get('override_id', '<missing id>')}' is missing required field(s) {sorted(missing_override)} — refusing to use as a bulk-apply template")


def select_targets(residuals_by_id: dict[str, dict], anchor_id: str, requested: list[str] | None) -> list[dict]:
    """Every OTHER open residual in the anchor's own (tier, class) group —
    the same grouping cards.py already shows the architect as 'Similar
    residuals this session'. A residual already carried_forward/applied is
    never re-asked/re-touched here, same discipline as pack.py's own
    askable filter."""
    anchor = residuals_by_id[anchor_id]
    groups = group_by_class(list(residuals_by_id.values()))
    siblings = [rid for rid in groups.get((anchor["tier"], anchor["class"]), []) if rid != anchor_id]

    if requested:
        unknown = set(requested) - set(residuals_by_id)
        if unknown:
            raise SystemExit(f"[bulk_apply] --targets names residual id(s) not in this pack's residuals.json: {sorted(unknown)}")
        not_siblings = set(requested) - set(siblings)
        if not_siblings:
            raise SystemExit(f"[bulk_apply] --targets names residual id(s) not in anchor {anchor_id}'s own (tier, class) group ({anchor['tier']}/{anchor['class']}): {sorted(not_siblings)} — bulk-apply only replicates within the same class, per design §2.1")
        target_ids = requested
    else:
        target_ids = siblings

    targets = [residuals_by_id[rid] for rid in target_ids]
    askable = [r for r in targets if r.get("status") not in ("carried_forward", "applied")]
    skipped_status = [r["id"] for r in targets if r not in askable]
    if skipped_status:
        print(f"[bulk_apply] skipping {skipped_status} — already carried_forward/applied, not re-asked", file=sys.stderr)
    return askable


def _own_evidence_snapshot(residual: dict, unit_index: dict, evidence_packs: dict) -> list[str]:
    """A target residual's OWN evidence, never the anchor's — S5 (no node/
    relationship/file/line introduced that isn't already in the pack's own
    evidence). Same dedup-by-ref discipline as cards.py's _evidence_lines."""
    seen = set()
    out = []
    for unit_id in residual.get("unitIds", []):
        for ref in unit_index.get(unit_id, {}).get("evidenceRefs", []):
            if ref in seen:
                continue
            seen.add(ref)
            snippet = evidence_packs.get(ref)
            if snippet is None:
                continue
            preview = next((line for line in snippet.splitlines() if line.strip()), "")
            out.append(f"{ref}: {preview}")
    return out


def build_replica(
    target: dict,
    anchor_decision: dict,
    anchor_override: dict | None,
    anchor_residual_id: str,
    batch_id: str,
    unit_index: dict,
    evidence_packs: dict,
    existing_decision_ids: set[str],
    existing_override_ids: set[str],
) -> tuple[dict, dict | None] | tuple[None, None]:
    """Returns (decision, override_or_None), or (None, None) if this
    target must be skipped (reported by the caller, never silently
    dropped)."""
    unit_ids = target.get("unitIds", [])
    if len(unit_ids) != 1:
        print(f"[bulk_apply] {target['id']}: skipping — has {len(unit_ids)} unit id(s), not exactly 1 (ambiguous bulk target)", file=sys.stderr)
        return None, None
    target_ref = unit_ids[0]

    decision_id = f"D-bulk-{batch_id}-{target['id']}"
    if decision_id in existing_decision_ids:
        print(f"[bulk_apply] {target['id']}: skipping — decision id '{decision_id}' already exists, refusing to overwrite", file=sys.stderr)
        return None, None

    decision = {
        "decision_id": decision_id,
        "module": anchor_decision["module"],
        "target_type": anchor_decision["target_type"],
        "target_ref": target_ref,
        "final_decision": dict(anchor_decision["final_decision"]),
        "rationale": (
            f"{anchor_decision['rationale']}\n\n"
            f"Bulk-applied from residual {anchor_residual_id}'s decision ({anchor_decision['decision_id']}) to residual "
            f"{target['id']} — same {target['tier']}/{target['class']} class. This residual's own evidence: "
            f"{'; '.join(_own_evidence_snapshot(target, unit_index, evidence_packs)) or 'none captured for this residual in this pack'}."
        ),
        "reviewer": anchor_decision["reviewer"],
        "reviewed_at": _now(),
        "source_run_id": anchor_decision.get("source_run_id"),
        "status": "active",
        "supersedes": None,
        "residual_id": target["id"],
    }
    evidence_snapshot = _own_evidence_snapshot(target, unit_index, evidence_packs)
    if evidence_snapshot:
        decision["evidence_snapshot"] = evidence_snapshot

    override = None
    if anchor_override is not None:
        override_id = f"O-bulk-{batch_id}-{target['id']}"
        if override_id in existing_override_ids:
            print(f"[bulk_apply] {target['id']}: skipping — override id '{override_id}' already exists, refusing to overwrite", file=sys.stderr)
            return None, None
        override = {
            "override_id": override_id,
            "module": anchor_override["module"],
            "target_ref": target_ref,
            "override_type": anchor_override["override_type"],
            "new_value": anchor_override["new_value"],
            "decision_record_ref": decision_id,
            "applied_since_run": None,
            "status": "active",
            "created_by": anchor_override["created_by"],
            "created_at": _now(),
        }

    return decision, override


def main() -> int:
    parser = argparse.ArgumentParser(description="T-RT-1: replicate one already-drafted residual decision across every similar open residual in the same Session Pack.")
    parser.add_argument("--session-dir", required=True)
    parser.add_argument("--anchor", required=True, help="residual id (e.g. R-014) whose Decision Record in drafts/decisions/ is the answer to replicate — author it first, the normal way")
    parser.add_argument("--targets", nargs="*", default=None, help="explicit residual ids to apply the anchor's answer to (must be in the anchor's own tier+class group). Default: every open, non-carried-forward sibling in that group")
    parser.add_argument("--i-confirm-bulk-apply", action="store_true", help="skip the interactive confirmation prompt — required for any non-interactive invocation")
    args = parser.parse_args()

    session_dir = Path(args.session_dir).resolve()
    residuals_by_id = _residuals_by_id(session_dir)
    if args.anchor not in residuals_by_id:
        print(f"[bulk_apply] anchor residual '{args.anchor}' not found in {session_dir}/residuals.json", file=sys.stderr)
        return 1
    anchor_residual = residuals_by_id[args.anchor]

    decisions_dir = session_dir / "drafts" / "decisions"
    overrides_dir = session_dir / "drafts" / "overrides"
    decisions = _load_json_dir(decisions_dir)
    overrides = _load_json_dir(overrides_dir)

    anchor_decision = find_anchor_decision(decisions, anchor_residual)
    anchor_override = find_anchor_override(overrides, anchor_decision)
    validate_anchor_shape(anchor_decision, anchor_override)

    if anchor_override is not None and anchor_override["override_type"] not in REPLICABLE_OVERRIDE_TYPES:
        print(
            f"[bulk_apply] REFUSING — anchor's override_type '{anchor_override['override_type']}' names a specific "
            f"target/endpoint as part of its own answer, so it cannot be safely recopied onto a different residual's "
            f"unit. Only {sorted(REPLICABLE_OVERRIDE_TYPES)} (or a no-override decision) are bulk-replicable — "
            f"author the rest of this class individually.",
            file=sys.stderr,
        )
        return 1

    targets = select_targets(residuals_by_id, args.anchor, args.targets)
    if not targets:
        print(f"[bulk_apply] no open sibling residuals to bulk-apply to (anchor {args.anchor}'s {anchor_residual['tier']}/{anchor_residual['class']} group has none left) — nothing to do")
        return 0

    unit_index_path = session_dir / "evidence" / "unit-index.json"
    packs_path = session_dir / "evidence" / "packs.json"
    unit_index = json.loads(unit_index_path.read_text()) if unit_index_path.exists() else {}
    evidence_packs = json.loads(packs_path.read_text()) if packs_path.exists() else {}

    affected_units = sorted({uid for t in targets for uid in t.get("unitIds", [])})
    print(f"[bulk_apply] anchor {args.anchor} ({anchor_decision['decision_id']}) -> {len(targets)} residual(s): {[t['id'] for t in targets]}")
    print(f"[bulk_apply] affected unit id(s), listed before commit (S9): {affected_units}")

    if not args.i_confirm_bulk_apply:
        if not sys.stdin.isatty():
            print("[bulk_apply] REFUSING: non-interactive invocation (no TTY) without --i-confirm-bulk-apply — this tool never auto-confirms a bulk write.", file=sys.stderr)
            return 1
        reply = input(f"This will write {len(targets)} new Decision Record(s) (one per residual, per S9). Type 'apply' to confirm: ")
        if reply.strip() != "apply":
            print("[bulk_apply] REFUSING — bulk-apply not confirmed.", file=sys.stderr)
            return 1

    decisions_dir.mkdir(parents=True, exist_ok=True)
    overrides_dir.mkdir(parents=True, exist_ok=True)
    existing_decision_ids = set(decisions)
    existing_override_ids = set(overrides)
    batch_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    written, skipped = [], []
    for target in targets:
        decision, override = build_replica(
            target, anchor_decision, anchor_override, args.anchor, batch_id, unit_index, evidence_packs, existing_decision_ids, existing_override_ids
        )
        if decision is None:
            skipped.append(target["id"])
            continue
        (decisions_dir / f"{decision['decision_id']}.json").write_text(json.dumps(decision, indent=2))
        existing_decision_ids.add(decision["decision_id"])
        if override is not None:
            (overrides_dir / f"{override['override_id']}.json").write_text(json.dumps(override, indent=2))
            existing_override_ids.add(override["override_id"])
        written.append(target["id"])

    print(f"[bulk_apply] wrote {len(written)} Decision Record(s) (+ {len(written) if anchor_override else 0} Override(s)) for {written}; skipped {skipped}")
    print("[bulk_apply] review every one of these under drafts/ before running apply.py — a bulk write is still just a draft, same as any other.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
