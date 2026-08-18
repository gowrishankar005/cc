import { TypedUnit, TypedRelationship, IgnoredItem, FactStatus } from '../types/typed-facts';
import { bandFor } from './confidence-scorer';
import { CONTRADICTION_PREFIX } from './cross_package/contradiction-detector';

/**
 * T-FS-6 (BACKLOG.md "Status vocabulary", BR-40) — assigns FactStatus to
 * every unit and relationship from signals this run has already computed
 * (kind, confidence band, evidence source, relationship mechanism/source) —
 * no new extraction mechanism, same "derive from existing facts" class as
 * gradeRelationships. Never sets 'reviewed': that status is a human-
 * confirmation event, set only by override-applier.ts strictly after
 * Analysis, on the CALM element the override actually touched.
 */
export function assignStatuses(units: TypedUnit[], relationships: TypedRelationship[], ignoredItems: IgnoredItem[]): void {
  const contradictedUnitIds = new Set(
    ignoredItems.filter((i) => i.detail?.startsWith(CONTRADICTION_PREFIX)).map((i) => i.ref)
  );

  for (const unit of units) {
    unit.status = statusForUnit(unit, contradictedUnitIds);
  }

  const statusById = new Map(units.map((u) => [u.id, u.status]));
  for (const rel of relationships) {
    rel.status = statusForRelationship(rel, statusById);
  }
}

function statusForUnit(unit: TypedUnit, contradictedUnitIds: Set<string>): FactStatus {
  // Hard rule (typed-facts.ts's own doc comment on TypedUnit.status): an
  // unclassified counterpart carries no Evidence at all by construction —
  // never 'observed'/'externally-verified' from code alone.
  if (unit.kind === 'unresolved') return 'requires-review';
  // T-FS-4 (BACKLOG.md "Secondary sources may introduce facts, not only
  // corroborate") — a unit cdxgen-corroboration-pass.ts introduced with NO
  // primary/code evidence at all (its entire evidence array is
  // 'dependency-manifest'-sourced) stays at its own tier permanently, never
  // promoted by a confidence-band computation alone: introducing a fact
  // this way is explicitly weaker than even a single low-confidence code
  // signal, since no file:line exists to point a human at. Checked BEFORE
  // the openapi check below: a dependency-manifest-only unit by definition
  // has no openapi evidence either, so this never actually shadows it —
  // stated for the reader, not because the two conditions can both fire.
  if (unit.evidence.every((e) => e.source === 'dependency-manifest')) return 'requires-review';
  // T-FS-3 — a real, unresolved disagreement between two evidence sources
  // about the same fact overrides the confidence band: the band measures
  // HOW MUCH evidence exists, not whether it agrees with itself.
  if (contradictedUnitIds.has(unit.id)) return 'requires-review';
  // A real published external contract (OpenAPI/AsyncAPI spec) corroborating
  // this unit is verification against an artifact independent of this run's
  // own code reading, not a static-analysis inference.
  if (unit.evidence.some((e) => e.source === 'openapi')) return 'externally-verified';
  return bandFor(unit.confidence) === 'high' ? 'observed' : 'inferred';
}

function statusForRelationship(rel: TypedRelationship, statusById: Map<string, FactStatus | undefined>): FactStatus {
  // k8s-manifest-sourced (shares-secret) — confirmed against a real deployed
  // manifest, not inferred from static code reading.
  if (rel.source === 'k8s') return 'externally-verified';
  // T-P0-1 (E2) — admitted with a synthesized unresolved-endpoint placeholder
  // on one side; the same hard rule as an unresolved unit applies to the
  // edge that anchors to one.
  if (rel.mechanism === 'admitted-unresolved') return 'requires-review';
  // Either endpoint already carries a real 'requires-review' status
  // (contradiction, or an unresolved counterpart) — a relationship touching
  // a disputed or unclassified fact is itself not yet authoritative.
  if (statusById.get(rel.from) === 'requires-review' || statusById.get(rel.to) === 'requires-review') return 'requires-review';
  // Every multi-hop-bridge mechanism (r2-phase1/r2b/r2c/r2-stereotype) sets
  // a real but deliberately LOW, fixed confidence value — one or more
  // inference hops removed from a direct edge, matching 'inferred's own
  // definition exactly (scope-limitations.yml's own "never as certain as a
  // direct one-hop import" language for this mechanism class).
  if (rel.confidence !== undefined) return 'inferred';
  // No confidence field set at all — a direct Graphify reconciler edge
  // (R0/R1), i.e. direct high-confidence static evidence with no inference
  // hop.
  return 'observed';
}
