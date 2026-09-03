"""Builds residuals.json from a run's review-queue.json plus leftover
artefacts (unmapped-signal clusters, ignored INSUFFICIENT_EVIDENCE /
AMBIGUOUS_BOUNDARY).

S7 (no sample hardcodes): the trigger -> tier/class mapping below is keyed
purely on review-queue.json's own trigger names (S1/S2/S5/low-architecture-
coverage), which are themselves generic across every language/framework
this pipeline supports — nothing here references a specific repo, class
name, or framework.

Unmapped clusters and ignored items are generic the same way: they use
the report's own `signal` / `reason` fields, never a class/framework name.
"""

from __future__ import annotations

import re

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
#   multi-hop-single-candidate-below-threshold -> Tier B
#     "single-candidate-below-threshold" (T-FS-1, BACKLOG.md "Tier-B
#     residual detection"). Real, distinguishable input this trigger map
#     never had before: multi-hop-bridge-detector.ts found exactly ONE real
#     database/topic candidate among a bridge interface's several syntactic
#     implementers -- structurally different from the S1/low-architecture-
#     coverage "many/zero real candidates" shape above (which stays Tier A,
#     an architect judgment call with no single standout answer). A single
#     obscured-but-real candidate is close enough to a draftable decision
#     that Tier B (draft_tier_b.py's own architecture) is the right class --
#     see draft_tier_b.py's module docstring, which named "no trigger
#     produces Tier B yet" as a real, standing gap. This closes it.
#   contradicting-evidence-force-review -> Tier A "contradicting-evidence"
#     (T-FS-3, BACKLOG.md "Contradiction detection between evidence
#     sources"). Deliberately Tier A, not B: draft_tier_b.py's own hard
#     rule 4 (system prompt, §5.1) already refuses to pick between two
#     equally-evidenced candidates ("cannot_decide: ambiguous between...")
#     -- a genuine value-level contradiction between two real sources is
#     exactly that shape, so it is never draftable, only an architect
#     judgment call.
#   unresolved-outbound-target -> Tier B "unresolved-outbound-target"
#     (Architect_Residual_Review_Session.md §3.2, priority #1 of the
#     2026-09-02 LLM-assist consolidated plan). A real, citable piece of
#     evidence (an HTTP-client import site, or a ConfigMap value shaped
#     like a service address) that outbound-http-detector.ts/
#     env-soft-graph-detector.ts's own "never guess" rule correctly
#     refused to turn into a relationship -- Tier B because the evidence
#     itself usually names a real candidate target, matching
#     single-candidate-below-threshold's own shape more than a genuine
#     multi-candidate judgment call. Falls through to bar-not-met exactly
#     like any other Tier B item when no real candidate correlates.
_TRIGGER_MAP = {
    "S1-zero-service-touching-relationships": ("A", "multi-candidate-bridge"),
    "low-architecture-coverage": ("A", "multi-candidate-bridge"),
    "S2-http-without-security-control": ("A", "security-authority-policy"),
    "S5-zero-service-units-with-store-present": ("A", "ontology-judgment"),
    "S5-cfn-routes-found-but-unbound": ("C", "missing-intermediates-not-in-scan"),
    "multi-hop-single-candidate-below-threshold": ("B", "single-candidate-below-threshold"),
    "contradicting-evidence-force-review": ("A", "contradicting-evidence"),
    "unresolved-outbound-target": ("B", "unresolved-outbound-target"),
    # low-confidence-emitted-relationship -> Tier A "low-confidence-emitted-
    # relationship" (Architect_Residual_Review_Session.md §3.3, priority #3
    # of the 2026-09-02 LLM-assist consolidated plan). A genuinely different
    # problem from unresolved-outbound-target above: not a relationship that
    # was refused, but one that's ALREADY sitting in the canonical
    # architecture.calm.json today at low confidence (env-soft-graph's fixed
    # 20), with nothing ever surfacing it for a second look. Tier A, not B:
    # there's no new candidate to draft, only a confirm/reject decision on
    # something already claimed -- matches contradicting-evidence's own
    # shape (an architect judgment call) more than a single-candidate draft.
    "low-confidence-emitted-relationship": ("A", "low-confidence-emitted-relationship"),
}

# Same pattern unmapped-signals.ts uses to recognise catalogue misses.
_UNMAPPED_DETAIL_RE = re.compile(r'No signal-catalogue\.yml rule matched raw signal "([^"]*)"')
_CONTRADICTION_PREFIX = "contradiction:"
_IGNORED_REASONS = frozenset({"INSUFFICIENT_EVIDENCE", "AMBIGUOUS_BOUNDARY"})
_FILE_LINE_RE = re.compile(r"^.+:\d+$")

# Pack-time caps (token-conscious). unmapped-signals.ts already caps
# clusters at 100 / 5 samples; the pack takes a tighter slice so Copilot
# is not handed the whole leftover dump.
MAX_UNMAPPED_CLUSTERS_IN_PACK = 20
MAX_IGNORED_IN_PACK = 30


def build_residuals(
    review_queue: dict,
    unmapped: dict | None = None,
    ignored: list | None = None,
) -> list[dict]:
    """review_queue is the parsed review-queue.json (ReviewQueue shape from
    hitl-review-trigger.ts). unmapped is unmapped-signals-report.json (or
    None). ignored is ignored-items-report.json (a list, or None).

    Returns residual dicts matching residuals.json's schema. Queue items
    come first (stable R-001… ids for existing tests); leftover classes
    append after."""
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

    claimed_refs = _claimed_refs(residuals)
    next_n = len(residuals) + 1
    extra, next_n = _residuals_from_unmapped(unmapped, next_n)
    residuals.extend(extra)
    claimed_refs.update(_claimed_refs(extra))
    extra, _next_n = _residuals_from_ignored(ignored, next_n, claimed_refs)
    residuals.extend(extra)
    return residuals


def _claimed_refs(residuals: list[dict]) -> set[str]:
    claimed: set[str] = set()
    for r in residuals:
        claimed.update(r.get("unitIds") or [])
        claimed.update(r.get("evidenceRefs") or [])
    return claimed


def _file_line_refs(values: list[str] | None) -> list[str]:
    return [v for v in (values or []) if isinstance(v, str) and _FILE_LINE_RE.match(v)]


def _residuals_from_unmapped(unmapped: dict | None, next_n: int) -> tuple[list[dict], int]:
    """One residual per unmapped-signal cluster (capped). Tier A: HITL
    picks catalogue-lane vs one-off construct vs leave-open. Never
    auto-merge signal-catalogue.yml (S11)."""
    if not unmapped:
        return [], next_n
    clusters = unmapped.get("clusters") or []
    out = []
    for cluster in clusters[:MAX_UNMAPPED_CLUSTERS_IN_PACK]:
        signal = cluster.get("signal") or "(unnamed signal)"
        count = cluster.get("count", 0)
        samples = cluster.get("sampleRefs") or []
        refs = _file_line_refs(samples)
        out.append(
            {
                "id": f"R-{next_n:03d}",
                "tier": "A",
                "class": "catalogue-candidate",
                "trigger": "unmapped-signal-cluster",
                "unitIds": [],
                "evidenceRefs": refs,
                "rationale": (
                    f'Unmapped signal "{signal}" clustered {count} time(s) '
                    f"({len(samples)} sample ref(s) in the report). Catalogue-promotion "
                    "candidate (suggest-rules / a signal-catalogue.yml row) — not an "
                    "auto-merge. A one-off node_add/relationship_add is only in play if "
                    "a packed sample names a real unit."
                ),
                "status": "open",
            }
        )
        next_n += 1
    return out, next_n


def _residuals_from_ignored(ignored: list | None, next_n: int, claimed_refs: set[str]) -> tuple[list[dict], int]:
    """INSUFFICIENT_EVIDENCE / AMBIGUOUS_BOUNDARY leftovers that are not
    already a review-queue item, unmapped cluster, or contradiction
    (contradictions are T-FS-3 queue triggers)."""
    if not ignored:
        return [], next_n
    items = ignored if isinstance(ignored, list) else ignored.get("items") or []
    out = []
    for item in items:
        if len(out) >= MAX_IGNORED_IN_PACK:
            break
        reason = item.get("reason")
        if reason not in _IGNORED_REASONS:
            continue
        detail = item.get("detail") or ""
        if _UNMAPPED_DETAIL_RE.search(detail):
            continue
        if detail.startswith(_CONTRADICTION_PREFIX):
            continue
        ref = item.get("ref") or ""
        if ref and ref in claimed_refs:
            continue
        refs = _file_line_refs([ref]) if ref else []
        cls = "insufficient-evidence" if reason == "INSUFFICIENT_EVIDENCE" else "ambiguous-boundary"
        trigger = f"ignored-{reason.lower().replace('_', '-')}"
        out.append(
            {
                "id": f"R-{next_n:03d}",
                "tier": "A",
                "class": cls,
                "trigger": trigger,
                "unitIds": [ref] if ref and not refs else [],
                "evidenceRefs": refs,
                "rationale": detail or f"{reason} ignored-item with no detail",
                "status": "open",
            }
        )
        if ref:
            claimed_refs.add(ref)
        next_n += 1
    return out, next_n


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
