#!/usr/bin/env python3
"""validate_drafts.py — Pre-flight integrity checks on
drafts/decisions/ + drafts/overrides/, BEFORE apply.py ever calls the real
Node override-applier.ts. Mirrors override-applier.ts's own validation
logic (same field names, same rejection wording style) so a draft that
passes here is not a surprise when it's actually applied — but this tool
never applies anything itself (S1/S3: only override-applier.ts, via
run-slice, is a legal write path into CALM).

Real, checkable finding while building this (not assumed): the Session
Pack layout (Architect_Residual_Review_Session.md §4.1) splits
drafts/decisions/ and drafts/overrides/ into separate directories, but
override-applier.ts's own loadOverridesDir() scans ONE flat directory and
dispatches by which key each file has (decision_id vs override_id). Two
separate directories, as this pack layout produces, will never be seen by
override-applier.ts as-is — apply.py needs to merge/point both
into one directory before calling run-slice --overrides, matching that
task's own "copy/point overrides dir" phrasing. validate_drafts.py doesn't
need to replicate that merge — it validates the two directories directly,
independent of how apply.py later stages them for the real call.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REQUIRED_DECISION_FIELDS = {
    "decision_id": str,
    "module": str,
    "target_type": str,
    "target_ref": str,
    "final_decision": dict,
    "rationale": str,
    "reviewer": str,
    "reviewed_at": str,
    "status": str,
    # Which residual (residuals.json's own "id", e.g. "R-014") this decision
    # answers -- added so a Session Pack's completeness view (summarize_by_trigger,
    # below) has a real structured link instead of regexing an id out of free-text
    # rationale (the fragile approach a real completeness check needed before this
    # field existed).
    "residual_id": str,
}
VALID_TARGET_TYPES = {"node", "relationship", "ignored-item"}
VALID_DECISION_ACTIONS = {"accepted", "overridden", "added", "removed"}
VALID_DECISION_STATUSES = {"active", "superseded"}

REQUIRED_OVERRIDE_FIELDS = {
    "override_id": str,
    "module": str,
    "target_ref": str,
    "override_type": str,
    "decision_record_ref": str,
    "status": str,
    "created_by": str,
    "created_at": str,
}
VALID_OVERRIDE_TYPES = {"type_change", "relationship_add", "relationship_remove", "node_add", "node_remove", "node_rename", "boundary_change"}
NOT_YET_IMPLEMENTED_OVERRIDE_TYPES = {"boundary_change"}  # matches override-applier.ts's own real skip behavior


class ValidationReport:
    def __init__(self):
        self.errors: list[str] = []
        self.warnings: list[str] = []

    @property
    def valid(self) -> bool:
        return len(self.errors) == 0

    def to_dict(self) -> dict:
        return {"valid": self.valid, "errors": self.errors, "warnings": self.warnings}


def _check_required_fields(obj: dict, required: dict, label: str, report: ValidationReport) -> bool:
    ok = True
    for field, expected_type in required.items():
        if field not in obj:
            report.errors.append(f"{label}: missing required field '{field}'")
            ok = False
        elif not isinstance(obj[field], expected_type):
            report.errors.append(f"{label}: field '{field}' must be a {expected_type.__name__}, got {type(obj[field]).__name__}")
            ok = False
    return ok


def _validate_decision(decision: dict, report: ValidationReport) -> None:
    label = f"decision '{decision.get('decision_id', '<missing id>')}'"
    if not _check_required_fields(decision, REQUIRED_DECISION_FIELDS, label, report):
        return
    if decision["target_type"] not in VALID_TARGET_TYPES:
        report.errors.append(f"{label}: target_type '{decision['target_type']}' not one of {sorted(VALID_TARGET_TYPES)}")
    if decision["status"] not in VALID_DECISION_STATUSES:
        report.errors.append(f"{label}: status '{decision['status']}' not one of {sorted(VALID_DECISION_STATUSES)}")
    action = decision["final_decision"].get("action") if isinstance(decision.get("final_decision"), dict) else None
    if action not in VALID_DECISION_ACTIONS:
        report.errors.append(f"{label}: final_decision.action '{action}' not one of {sorted(VALID_DECISION_ACTIONS)}")


def _is_valid_calm_node(value) -> bool:
    return isinstance(value, dict) and all(isinstance(value.get(k), str) for k in ("unique-id", "node-type", "name", "description"))


def _is_valid_connects_relationship(value) -> bool:
    if not isinstance(value, dict):
        return False
    if not isinstance(value.get("unique-id"), str) or not isinstance(value.get("description"), str):
        return False
    rt = value.get("relationship-type")
    if not isinstance(rt, dict):
        return False
    connects = rt.get("connects")
    if not isinstance(connects, dict):
        return False
    source = connects.get("source")
    destination = connects.get("destination")
    return isinstance(source, dict) and isinstance(source.get("node"), str) and isinstance(destination, dict) and isinstance(destination.get("node"), str)


def _node_add_will_actually_apply(override: dict, decisions: dict[str, dict], calm_node_ids: set[str] | None) -> str | None:
    """Real gating logic a node_add override must pass to actually land in
    CALM at apply time — used to build the 'same batch' endpoint-existence
    exception (design §6). A real bug found on review: the original pre-scan
    counted ANY node_add override with a parseable shape as a future
    endpoint, even one that would itself be REJECTED (e.g. a dangling
    decision_record_ref) — masking a real dangling-endpoint problem in a
    relationship_add that referenced it. Returns the new node's unique-id if
    it will actually apply, else None."""
    if override.get("override_type") != "node_add" or override.get("status") != "active":
        return None
    decision = decisions.get(override.get("decision_record_ref"))
    if decision is None or decision.get("status") != "active":
        return None
    new_value = override.get("new_value")
    if not _is_valid_calm_node(new_value):
        return None
    uid = new_value["unique-id"]
    if uid != override.get("target_ref"):
        return None
    if calm_node_ids is not None and uid in calm_node_ids:
        return None
    return uid


def _validate_override(override: dict, decisions: dict[str, dict], calm_node_ids: set[str] | None, calm_relationship_ids: set[str] | None, added_node_ids: set[str], report: ValidationReport) -> None:
    label = f"override '{override.get('override_id', '<missing id>')}'"
    if not _check_required_fields(override, REQUIRED_OVERRIDE_FIELDS, label, report):
        return

    # Order matters and must match override-applier.ts's REAL order exactly
    # (status -> decision_record_ref resolution -> decision.status -> THEN
    # dispatch on override_type) — a real bug found on review: checking
    # override_type/not-implemented BEFORE status/decision_record_ref let a
    # boundary_change override with a completely dangling decision_record_ref
    # pass as "valid" here, when the real applier checks the ref first and
    # would REJECT it. The only exception is the unknown-override_type check
    # below, which stays first deliberately — it catches a class of error
    # (schema-invalid input) the real applier doesn't even report at all (an
    # unrecognized override_type silently falls through its switch with no
    # default case, never appearing in applied/rejected/skipped/orphans).
    override_type = override["override_type"]
    if override_type not in VALID_OVERRIDE_TYPES:
        report.errors.append(f"{label}: override_type '{override_type}' not one of {sorted(VALID_OVERRIDE_TYPES)}")
        return

    if override["status"] != "active":
        report.warnings.append(f"{label}: status is '{override['status']}', not 'active' — will be skipped at apply time")
        return

    decision = decisions.get(override["decision_record_ref"])
    if decision is None:
        report.errors.append(f"{label}: decision_record_ref '{override['decision_record_ref']}' does not resolve to any Decision Record in drafts/decisions/")
        return
    if decision.get("status") != "active":
        report.errors.append(f"{label}: decision_record_ref '{override['decision_record_ref']}' resolves to a Decision Record with status '{decision.get('status')}', not 'active'")
        return

    if override_type in NOT_YET_IMPLEMENTED_OVERRIDE_TYPES:
        report.warnings.append(f"{label}: override_type '{override_type}' is recognized but not yet implemented in override-applier.ts — will be skipped, not applied, at apply time")
        return

    target_ref = override["target_ref"]
    new_value = override.get("new_value")

    if override_type == "node_add":
        if not _is_valid_calm_node(new_value):
            report.errors.append(f"{label}: node_add new_value is not a valid CalmNode shape (needs unique-id, node-type, name, description)")
            return
        if new_value["unique-id"] != target_ref:
            report.errors.append(f"{label}: node_add target_ref '{target_ref}' does not match new_value's unique-id '{new_value['unique-id']}'")
            return
        if calm_node_ids is not None and target_ref in calm_node_ids:
            report.errors.append(f"{label}: node_add target_ref '{target_ref}' already exists in CALM — use type_change/node_rename instead")
        added_node_ids.add(target_ref)

    elif override_type in ("type_change", "node_rename"):
        if not isinstance(new_value, str):
            report.errors.append(f"{label}: {override_type} new_value must be a string")
        if calm_node_ids is not None and target_ref not in calm_node_ids and target_ref not in added_node_ids:
            report.errors.append(f"{label}: {override_type} target_ref '{target_ref}' not found among CALM nodes (orphan — was it renamed/removed since this draft was written?)")

    elif override_type == "node_remove":
        if calm_node_ids is not None and target_ref not in calm_node_ids and target_ref not in added_node_ids:
            report.errors.append(f"{label}: node_remove target_ref '{target_ref}' not found among CALM nodes (orphan)")

    elif override_type == "relationship_add":
        if not _is_valid_connects_relationship(new_value):
            report.errors.append(f"{label}: relationship_add new_value is not a valid connects-shaped CalmRelationship (needs unique-id, description, relationship-type.connects.source.node, relationship-type.connects.destination.node)")
            return
        if new_value["unique-id"] != target_ref:
            report.errors.append(f"{label}: relationship_add target_ref '{target_ref}' does not match new_value's unique-id '{new_value['unique-id']}'")
            return
        # Evidence rule (design §6): both endpoints must exist in this run's
        # facts/CALM, OR be node_add'd in the same draft pack.
        connects = new_value["relationship-type"]["connects"]
        for role, node_id in (("source", connects["source"]["node"]), ("destination", connects["destination"]["node"])):
            if calm_node_ids is not None and node_id not in calm_node_ids and node_id not in added_node_ids:
                report.errors.append(f"{label}: relationship_add {role} node '{node_id}' does not exist in CALM and is not node_add'd in this same draft batch — would create a dangling endpoint")

    elif override_type == "relationship_remove":
        if calm_relationship_ids is not None and target_ref not in calm_relationship_ids:
            report.errors.append(f"{label}: relationship_remove target_ref '{target_ref}' not found among CALM relationships (orphan)")


def validate(decisions_by_id: dict[str, dict], overrides: list[dict], calm_node_ids: set[str] | None, calm_relationship_ids: set[str] | None = None) -> ValidationReport:
    report = ValidationReport()
    for decision in decisions_by_id.values():
        _validate_decision(decision, report)

    # node_add overrides are collected first so relationship_add/type_change
    # in the SAME batch can reference a node this batch itself introduces
    # (design §6's own explicit exception) — order-independent within one
    # validate() call, matching override-applier.ts's own two-pass-safe
    # behavior (it processes overrides in file order but node_add always
    # extends the working `nodes` array before later overrides are checked).
    # Real bug fixed on review: only overrides that will ACTUALLY apply
    # (status active, decision resolves+active, valid shape) count here —
    # see _node_add_will_actually_apply's own docstring.
    added_node_ids: set[str] = set()
    for override in overrides:
        uid = _node_add_will_actually_apply(override, decisions_by_id, calm_node_ids)
        if uid is not None:
            added_node_ids.add(uid)

    for override in overrides:
        _validate_override(override, decisions_by_id, calm_node_ids, calm_relationship_ids, added_node_ids, report)

    referenced_ids = {o.get("override_id") for o in overrides if o.get("status") == "active" and o.get("override_type") not in NOT_YET_IMPLEMENTED_OVERRIDE_TYPES}
    if not overrides:
        report.warnings.append("no overrides found in drafts/overrides/ — nothing to apply yet")
    elif not referenced_ids:
        report.warnings.append("no active, implemented overrides found — every draft is either inactive or a not-yet-implemented override_type")

    return report


def _load_json_dir(dir_path: Path) -> list[dict]:
    if not dir_path.exists():
        return []
    items = []
    for f in sorted(dir_path.glob("*.json")):
        try:
            items.append(json.loads(f.read_text()))
        except json.JSONDecodeError as e:
            raise SystemExit(f"[validate_drafts] {f} is not valid JSON: {e}")
    return items


def load_decisions_by_id(decisions_list: list[dict]) -> tuple[dict[str, dict], list[str]]:
    """Real bug found live (Architect_Pilot_Feedback_Notes.md Entry 25): a
    decision file missing 'decision_id' used to be silently DROPPED from
    the dict passed into validate() instead of being reported as a real
    error. A real Copilot Chat session drafted 23 decision files using its
    own invented field names (residual_id/construct/option) instead of the
    real schema -- every single one was missing decision_id, so the old
    dict comprehension produced an EMPTY dict, and validate() reported "0
    errors" because there was trivially nothing left to check. Every
    decision file must now be accounted for: either it has a real,
    non-empty string decision_id and is validated normally, or it doesn't
    and that is itself a validation error, never a silent drop (the second
    return value -- prepend it to whatever ValidationReport.errors
    validate() later produces). Shared by validate_drafts.py's own main()
    and apply.py's _run_validation() -- this exact filter used to be
    duplicated (and duplicately wrong) in both places."""
    decisions_by_id: dict[str, dict] = {}
    errors: list[str] = []
    for d in decisions_list:
        decision_id = d.get("decision_id") if isinstance(d, dict) else None
        if isinstance(decision_id, str) and decision_id:
            decisions_by_id[decision_id] = d
        else:
            present = sorted(d.keys()) if isinstance(d, dict) else type(d).__name__
            errors.append(f"decision file missing required field 'decision_id' (or it is not a non-empty string) — cannot be identified or validated. Fields present: {present}")
    return decisions_by_id, errors


def summarize_by_trigger(residuals: list[dict], decisions_by_id: dict[str, dict]) -> dict[str, dict]:
    """Session Pack completeness view (found real, 2026-09-04, reviewing a
    real 51-residual, 5-trigger-class pack end to end): a review pass fully
    worked ONE trigger class and reported the result as a complete
    architecture -- nothing in pack.py's manifest.json, SESSION.md, or
    apply.py's own summary line broke that down by trigger class, so the
    gap was invisible. Returns {trigger: {"tier": str, "total": int,
    "decided": int}} -- "decided" counts a residual with >=1 active decision
    record whose residual_id names it (an active decision with no override
    still counts, e.g. an "accepted, no change" confirmation). Shared by
    apply.py (real drafts/decisions/ on disk) and pack.py's _render_session_md
    (may see an empty or partial decisions_by_id on a --baseline re-run,
    before any new decisions exist for this run) so the two inventories
    (Architect_Residual_Review_Session.md §3.1's own producer registry is
    the human-facing counterpart) can't silently drift the way that doc's
    own history already shows they can."""
    decided_residual_ids = {
        d.get("residual_id")
        for d in decisions_by_id.values()
        if d.get("status") == "active" and isinstance(d.get("residual_id"), str) and d.get("residual_id")
    }
    by_trigger: dict[str, dict] = {}
    for r in residuals:
        trigger = r.get("trigger", "<no trigger>")
        entry = by_trigger.setdefault(trigger, {"tier": r.get("tier"), "total": 0, "decided": 0})
        entry["total"] += 1
        if r.get("id") in decided_residual_ids:
            entry["decided"] += 1
    return by_trigger


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate drafts/decisions + drafts/overrides in a residual review Session Pack before apply.")
    parser.add_argument("--session-dir", required=True, help="Session Pack directory (contains drafts/decisions/, drafts/overrides/)")
    parser.add_argument("--calm", help="path to architecture.calm.json to check endpoint existence against (optional — without it, existence checks are skipped and a warning is emitted)")
    args = parser.parse_args()

    session_dir = Path(args.session_dir).resolve()
    decisions_list = _load_json_dir(session_dir / "drafts" / "decisions")
    overrides_list = _load_json_dir(session_dir / "drafts" / "overrides")
    decisions_by_id, load_errors = load_decisions_by_id(decisions_list)

    calm_node_ids = None
    calm_relationship_ids = None
    if args.calm:
        calm_path = Path(args.calm)
        if not calm_path.exists():
            print(f"[validate_drafts] --calm path {calm_path} does not exist", file=sys.stderr)
            return 1
        calm = json.loads(calm_path.read_text())
        calm_node_ids = {n["unique-id"] for n in calm.get("nodes", [])}
        calm_relationship_ids = {r["unique-id"] for r in calm.get("relationships", [])}

    report = validate(decisions_by_id, overrides_list, calm_node_ids, calm_relationship_ids)
    report.errors = load_errors + report.errors

    if calm_node_ids is None:
        report.warnings.insert(0, "no --calm given — node/relationship endpoint existence was NOT checked (pass --calm to check for real)")

    print(json.dumps(report.to_dict(), indent=2))
    if not report.valid:
        print(f"[validate_drafts] FAILED — {len(report.errors)} error(s)", file=sys.stderr)
        return 1
    print(f"[validate_drafts] OK — {len(report.warnings)} warning(s)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
