"""Builds residuals.json from a run's review-queue.json (T-RS1-3, MVP scope).

S7 (no sample hardcodes): the trigger -> tier/class mapping below is keyed
purely on review-queue.json's own trigger names (S1/S2/S5/low-architecture-
coverage), which are themselves generic across every language/framework
this pipeline supports — nothing here references a specific repo, class
name, or framework.

MVP scope note (matches AGENT_TASKS_Residual_Review_Session.md's own T-RS1-2
/ T-RS1-3 split): this covers every trigger hitl-review-trigger.ts already
emits. It deliberately does NOT yet cover unmapped-signal-cluster ->
catalogue_candidate promotion or generic ontology-kind-conflict detection
beyond what S5 already names — those are real, separate T-RS1-3 extensions,
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
