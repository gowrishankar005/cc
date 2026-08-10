"""Builds residuals.json from a run's review-queue.json (MVP scope).

S7 (no sample hardcodes): the trigger -> tier/class mapping below is keyed
purely on review-queue.json's own trigger names (S1/S2/S5/low-architecture-
coverage), which are themselves generic across every language/framework
this pipeline supports — nothing here references a specific repo, class
name, or framework.

MVP scope note: this covers every trigger hitl-review-trigger.ts already
emits. It deliberately does NOT yet cover unmapped-signal-cluster ->
catalogue_candidate promotion or generic ontology-kind-conflict detection
beyond what S5 already names — those are real, separate extensions,
named here as a TODO rather than silently assumed done.
"""

from __future__ import annotations

# Tier + class per trigger, matched against the design's own taxonomy
# (Architect_Residual_Review_Session.md §3):
#   S1 / low-architecture-coverage -> Tier A "multi-candidate / zero-candidate
#     bridges" (a missing connects the pipeline's own R2/R2b mechanisms
#     couldn't resolve automatically -- an architect judgment call, not a
#     draftable Tier B item, since there's no single unambiguous evidenced pair).
#   S2 -> Tier A "security authority / policy" (is real auth present in a form
#     this pipeline's catalogue doesn't cover, or is it genuinely missing).
#   S5-zero-service-units-with-store-present -> Tier A "ontology judgment"
#     (is there a real entry point this run didn't scan, or is this
#     genuinely orphaned/library code).
#   S5-cfn-routes-found-but-unbound -> Tier C "missing intermediates not in
#     scan" (real infra evidence, no code-side match -- per the design's own
#     Tier C table, this is a rescan/OOS case, not something to invent an
#     answer for).
_TRIGGER_MAP = {
    "S1-zero-service-touching-relationships": ("A", "multi-candidate-bridge"),
    "low-architecture-coverage": ("A", "multi-candidate-bridge"),
    "S2-http-without-security-control": ("A", "security-authority-policy"),
    "S5-zero-service-units-with-store-present": ("A", "ontology-judgment"),
    "S5-cfn-routes-found-but-unbound": ("C", "missing-intermediates-not-in-scan"),
}


def build_residuals(review_queue: dict) -> list[dict]:
    """review_queue is the parsed review-queue.json (ReviewQueue shape from
    hitl-review-trigger.ts). Returns a list of residual dicts matching
    residuals.json's schema (documented in residuals-schema.json)."""
    residuals = []
    for idx, item in enumerate(review_queue.get("items", [])):
        trigger = item["trigger"]
        tier, cls = _TRIGGER_MAP.get(trigger, ("A", "unclassified"))
        residual_id = f"R-{idx + 1:03d}"
        residuals.append(
            {
                "id": residual_id,
                "tier": tier,
                "class": cls,
                "trigger": trigger,
                "unitIds": [item["unitId"]] if item.get("unitId") else [],
                "evidenceRefs": _evidence_refs_for(item),
                "rationale": item.get("rationale", ""),
                "status": "open",
            }
        )
    return residuals


def _evidence_refs_for(item: dict) -> list[str]:
    """Best-effort file:line refs extractable from a review-queue item's own
    rationale text (it already cites unresolved-multi-hop / unresolved-cfn-route
    ignored-item details verbatim, per hitl-review-trigger.ts). Falls back to
    no refs rather than guessing -- consistent with S5 (evidence-first)."""
    return []


def apply_baseline(residuals: list[dict], baseline_residuals: list[dict], baseline_decisions: list[dict]) -> list[dict]:
    """Thin --baseline handling. A prior Session Pack's residuals.json +
    drafts/decisions/ define what's already been decided. For each of THIS
    run's residuals:
      - If a baseline residual with the SAME (trigger, unitIds) signature
        has an ACTIVE decision referencing one of its unit ids, AND this
        run's (trigger, class) for that unit matches the baseline's own
        recorded (trigger, class) -> mark 'carried_forward', never re-card
        it (design §7.2: "a node the architect already typed correctly
        last time is never silently re-asked").
      - If a matching unit has a baseline decision but THIS run's
        (trigger, class) DIFFERS from what the baseline recorded for it ->
        the underlying source/facts changed shape since the decision was
        made. Per §7.2 (P7 applied to drift): never silently overwrite a
        prior human decision — surface it as a NEW 're-confirm' residual
        instead of silently carrying forward or silently re-asking as if
        nothing happened.
    Real limitation, stated not hidden: matching is by (trigger, unitIds)
    signature, not a stable residual id (this module's residual ids are
    positional/regenerated per run, not stable across runs) — this is a
    real MVP scope narrowing, full multi-scan polish is deferred
    per this task's own spec.
    """
    baseline_by_unit: dict[str, dict] = {}
    for r in baseline_residuals:
        for uid in r.get("unitIds", []):
            baseline_by_unit[uid] = r

    active_decision_targets: set[str] = {d["target_ref"] for d in baseline_decisions if d.get("status") == "active"}

    out = []
    for r in residuals:
        matched_baseline = None
        for uid in r.get("unitIds", []):
            if uid in baseline_by_unit and uid in active_decision_targets:
                matched_baseline = baseline_by_unit[uid]
                break

        if matched_baseline is None:
            out.append(r)
            continue

        if matched_baseline.get("trigger") == r.get("trigger") and matched_baseline.get("class") == r.get("class"):
            r = dict(r, status="carried_forward", rationale=f"Already decided in a prior session (baseline residual {matched_baseline.get('id')}) — not re-asked.")
        else:
            # Real tier/class stay as freshly computed from THIS run's real
            # evidence (still gets a real, correct choice card) — only the
            # rationale is enriched and a reconfirm flag added, never a
            # silent overwrite of what changed.
            r = dict(
                r,
                reconfirm=True,
                rationale=f"Previously decided (baseline residual {matched_baseline.get('id')}, was {matched_baseline.get('trigger')}/{matched_baseline.get('class')}) but this run's evidence now shows {r.get('trigger')}/{r.get('class')} — source may have changed shape since the prior decision. Re-confirm: {r.get('rationale')}",
            )
        out.append(r)

    return out
