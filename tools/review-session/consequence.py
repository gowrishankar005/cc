"""consequence.py — T-RT-2: consequence-ranked queue (BACKLOG.md's own
acceptance wording: "highest-consequence first: PII-touching, external-
system identity, trust-boundary edges").

S7 (no sample hardcodes): every signal below is derived purely from facts
this pipeline already computes generically — TypedUnit.kind and
TypedRelationship.kind — never a repo/framework-specific name or pattern.

Honest scope, named not hidden: this pipeline has NO real PII/data-
classification detector (no such fact exists in typed-facts.ts) and no
distinct "external-system" unit kind — this module reuses this project's
own ALREADY-DOCUMENTED closest analogs for each, rather than inventing a
new detection mechanism:
  - "PII-touching" -> TypedUnit.kind == 'database'. A real data store is
    the closest proxy this pipeline can name for where PII is most likely
    to live; it is a coarse proxy, not a real data-classification result,
    and is reported as such (signal name says 'pii-proxy', not 'pii').
  - "external-system identity" -> TypedUnit.kind == 'unresolved' (this
    pipeline's own documented closest analog to an external system —
    Claim_Register.md's T-FS-6-status-vocabulary row: "this pipeline's
    closest analog to 'external system' is a kind: 'unresolved' unit") OR
    a residual in the 'security-authority-policy' class (S2, real evidence
    of an authenticated entry point with no detected security control —
    genuinely identity-adjacent).
  - "trust-boundary edges" -> TypedRelationship.kind == 'shares-secret'
    (T-X5-0's own real, named trust relationship — a k8s Secret/ConfigMap
    mounted by both sides, not a code-level calls/imports/connects edge)
    touching one of this residual's own unit ids.
"""

from __future__ import annotations

PII_PROXY_KIND = "database"
EXTERNAL_SYSTEM_PROXY_KIND = "unresolved"
TRUST_BOUNDARY_RELATIONSHIP_KIND = "shares-secret"
IDENTITY_ADJACENT_CLASS = "security-authority-policy"


def compute_consequence(residual: dict, unit_index: dict, relationships: list[dict]) -> dict:
    """Returns {"signals": [sorted, deduped signal names], "score": int}.
    Deterministic: same residual + same facts -> same result, always —
    same discipline as cards.py's option generation."""
    signals: set[str] = set()
    unit_ids = set(residual.get("unitIds", []))

    for uid in unit_ids:
        kind = unit_index.get(uid, {}).get("kind")
        if kind == PII_PROXY_KIND:
            signals.add("pii-proxy")
        if kind == EXTERNAL_SYSTEM_PROXY_KIND:
            signals.add("external-system-identity")

    if residual.get("class") == IDENTITY_ADJACENT_CLASS:
        signals.add("external-system-identity")

    for rel in relationships:
        if rel.get("kind") == TRUST_BOUNDARY_RELATIONSHIP_KIND and (rel.get("from") in unit_ids or rel.get("to") in unit_ids):
            signals.add("trust-boundary-edge")

    return {"signals": sorted(signals), "score": len(signals)}


def annotate_residuals(residuals: list[dict], unit_index: dict, relationships: list[dict]) -> list[dict]:
    """Attaches a real, computed 'consequence' field to every residual —
    additive per residuals-schema.json, never changes any existing field's
    shape."""
    for r in residuals:
        r["consequence"] = compute_consequence(r, unit_index, relationships)
    return residuals
