import { TypedRelationship, TypedUnit } from '../../types/typed-facts';
import { CalmNode, CalmRelationship, CalmRelationshipTypeShape } from '../../types/calm';
import { RelationshipTypeMapping, findRelationshipTypeMapping } from '../../rules/construct-mapping-schema';

/**
 * B-duplicate-relationship-objects — identifies a relationship by its FINAL
 * CALM shape (post node-type mapping), not the pre-mapping TypedRelationship
 * kind. graphify-reconciler.ts's own dedup only collapses duplicates within
 * ONE raw Graphify relation bucket ('imports'/'calls'/'connects'); since
 * relationship-type-mapping.yml maps every real row to the same final
 * `connects` shape, a source/destination pair reachable via more than one
 * raw kind (e.g. both an 'imports' edge and a 'references'/'calls' edge —
 * the exact real shape B-stereotype-name-collision's own repro produced)
 * survives that earlier dedup as 2+ separate CalmRelationship objects.
 * Confirmed on a real 918-relationship Fineract scan: 162 real,
 * otherwise-correct source/destination pairs produced 182 redundant objects.
 * Only `connects` is reachable today (see this file's own header comment);
 * the other three branches are written defensively so a future
 * actor-detection row can't silently reintroduce this bug.
 */
function relationshipIdentityKey(rt: CalmRelationshipTypeShape): string {
  if ('connects' in rt) return `connects|${rt.connects.source.node}|${rt.connects.destination.node}`;
  if ('interacts' in rt) return `interacts|${rt.interacts.actor}|${rt.interacts.nodes.slice().sort().join(',')}`;
  if ('deployed-in' in rt) return `deployed-in|${rt['deployed-in'].container}|${rt['deployed-in'].nodes.slice().sort().join(',')}`;
  return `composed-of|${rt['composed-of'].container}|${rt['composed-of'].nodes.slice().sort().join(',')}`;
}

/**
 * Merges a group of 2+ CalmRelationship objects that share the same real
 * identity into one. `unique-id` and `x-aac-cross-package` use
 * first-encountered-wins (deterministic, and these never meaningfully
 * diverge within a real duplicate group). Every OTHER metadata field
 * (`x-aac-provenance`, `x-aac-mechanism`, `x-aac-confidence`,
 * `x-aac-relationship-grade`, `x-aac-status`) collects the DISTINCT values actually present
 * across the group instead — "first wins" would silently drop real
 * information whenever two duplicates disagree, which is reachable: e.g. a
 * plain graphify-reconciler.ts 'calls' edge and a multi-hop-bridge-detector.ts
 * 'calls' edge (same kind, same source: 'graphify') can land on the same
 * pair, differing only in `mechanism` ('r2-phase1'/'r2b' vs unset) — silently
 * keeping the first's (possibly unset) mechanism would drop a real,
 * traceable fact about how the relationship was resolved. A field absent
 * from every group member stays absent (no fake value invented); present on
 * some but not others, only the present values are collected.
 */
function mergeDuplicateRelationships(group: Array<{ calmRel: CalmRelationship; kind: string }>): CalmRelationship {
  const first = group[0].calmRel;
  const distinctKinds = [...new Set(group.map((g) => g.kind))];

  const distinctValuesFor = (key: string): unknown[] => {
    const values = group.map((g) => g.calmRel.metadata!.find((m) => m.key === key)?.value).filter((v) => v !== undefined);
    return [...new Set(values)];
  };
  const mergedEntry = (key: string): { key: string; value: unknown } | undefined => {
    const distinct = distinctValuesFor(key);
    if (distinct.length === 0) return undefined;
    return { key, value: distinct.length === 1 ? distinct[0] : distinct };
  };

  const distinctProvenance = distinctValuesFor('x-aac-provenance') as string[];
  const metadata = ['x-aac-provenance', 'x-aac-cross-package', 'x-aac-confidence', 'x-aac-relationship-grade', 'x-aac-mechanism', 'x-aac-status']
    .map((key) => (key === 'x-aac-cross-package' ? first.metadata!.find((m) => m.key === key) : mergedEntry(key)))
    .filter((entry): entry is { key: string; value: unknown } => entry !== undefined);

  const crossPackage = first.metadata!.find((m) => m.key === 'x-aac-cross-package')!.value as boolean;
  return {
    ...first,
    description:
      distinctKinds.length === 1 && distinctProvenance.length === 1
        ? first.description
        : `${distinctKinds.join('+')} relationship (${crossPackage ? 'cross-package' : 'same-package'}, source: ${distinctProvenance.join('+')})`,
    metadata,
  };
}

/**
 * THE interacts/connects BUG FIX (requirements v0.9 §1, Solution Design v2 §5.3).
 * The relationship-type-mapping.yml catalogue decides the CALM shape — this
 * builder no longer contains an `isDbEdge ? connects : interacts` conditional
 * to widen per new case. Every relationship kind this pipeline currently
 * produces resolves to `connects` via the catalogue; `interacts` is never
 * constructed here because no row asks for it (no actor-node detection
 * exists yet) — adding actor detection later is a catalogue row, not a code
 * change to this file.
 *
 * T-X7-4 — protocol comes from the catalogue row first (rule.protocol,
 * always null today — no row sets one); when that's absent, falls back to
 * `protocolBySignal` (built from persistence-detection-catalogue.yml's
 * per-library `protocol` field, e.g. org.postgresql -> JDBC) by checking
 * whether EITHER endpoint unit's own evidence names a library with a known
 * protocol. Still null, not invented, when neither source has one — the
 * exact discipline this pipeline has held since the original interacts/
 * connects fix (v0.9 §1: "leave null honestly").
 */
export function buildRelationships(
  relationships: TypedRelationship[],
  nodes: CalmNode[],
  mapping: RelationshipTypeMapping,
  units: TypedUnit[] = [],
  protocolBySignal: Map<string, string> = new Map()
): CalmRelationship[] {
  const nodeIds = new Set(nodes.map((n) => n['unique-id']));
  const nodeTypeById = new Map(nodes.map((n) => [n['unique-id'], n['node-type']]));
  const unitById = new Map(units.map((u) => [u.id, u]));

  const inferredProtocol = (unitId: string): string | undefined => {
    const unit = unitById.get(unitId);
    if (!unit) return undefined;
    for (const evidence of unit.evidence) {
      const protocol = protocolBySignal.get(evidence.signal);
      if (protocol) return protocol;
    }
    return undefined;
  };

  const built = relationships
    .filter((r) => nodeIds.has(r.from) && nodeIds.has(r.to))
    .map((rel, i) => {
      const sourceType = nodeTypeById.get(rel.from)!;
      const targetType = nodeTypeById.get(rel.to)!;
      const rule = findRelationshipTypeMapping(mapping, rel.kind, sourceType, targetType);

      let relationshipType: CalmRelationshipTypeShape;
      switch (rule.calmRelationshipType) {
        case 'connects':
          relationshipType = { connects: { source: { node: rel.from }, destination: { node: rel.to } } };
          break;
        case 'interacts':
          // Not reachable today (no mapping row requests it — see header comment),
          // kept exhaustive so a future actor-detection row is type-checked
          // correctly rather than silently mis-shaped like the original bug.
          relationshipType = { interacts: { actor: rel.from, nodes: [rel.to] } };
          break;
        case 'deployed-in':
          relationshipType = { 'deployed-in': { container: rel.to, nodes: [rel.from] } };
          break;
        case 'composed-of':
          relationshipType = { 'composed-of': { container: rel.from, nodes: [rel.to] } };
          break;
      }

      const calmRel: CalmRelationship = {
        'unique-id': `rel-${i}`,
        description: `${rel.kind} relationship (${rel.crossPackage ? 'cross-package' : 'same-package'}, source: ${rel.source})`,
        'relationship-type': relationshipType,
        metadata: [
          { key: 'x-aac-provenance', value: rel.source },
          { key: 'x-aac-cross-package', value: rel.crossPackage },
          // T-X9-1 — only present for relationships a producer explicitly
          // scored (today: the env soft-graph detector's name-correlation
          // edges); every other producer leaves rel.confidence unset, so no
          // x-aac-confidence entry is added for them — absence, not a fake 0.
          ...(rel.confidence !== undefined ? [{ key: 'x-aac-confidence', value: rel.confidence }] : []),
          // AREC T-A2 — 'structural' | 'architecture' | 'trust', set by
          // gradeRelationshipsPass for every relationship a real run
          // produces. Exists so a dual-unit Graphify entity<->entity edge
          // (structural) is never visually indistinguishable in the
          // generated CALM from a real service->database architecture link.
          ...(rel.grade !== undefined ? [{ key: 'x-aac-relationship-grade', value: rel.grade }] : []),
          // T-L2-1 — only present on multi-hop-bridge-detector.ts output
          // ('r2-phase1' | 'r2b'); every other producer leaves it unset.
          ...(rel.mechanism !== undefined ? [{ key: 'x-aac-mechanism', value: rel.mechanism }] : []),
          // T-FS-6 — set by assignStatusPass (the true last Analysis pass)
          // for every relationship a real run produces; absent only for a
          // typed-facts.json predating this field.
          ...(rel.status !== undefined ? [{ key: 'x-aac-status', value: rel.status }] : []),
        ],
      };
      const protocol = rule.protocol ?? inferredProtocol(rel.to) ?? inferredProtocol(rel.from);
      if (protocol) {
        calmRel.protocol = protocol;
      }
      return { calmRel, kind: rel.kind };
    });

  // B-duplicate-relationship-objects — final dedup keyed on the real CALM
  // shape (see relationshipIdentityKey's doc comment above). `Map` preserves
  // insertion order, so grouping here already gives "first-encountered"
  // ordering for free — no extra sort needed.
  const groups = new Map<string, Array<{ calmRel: CalmRelationship; kind: string }>>();
  for (const entry of built) {
    const key = relationshipIdentityKey(entry.calmRel['relationship-type']);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  return [...groups.values()].map((group) => (group.length === 1 ? group[0].calmRel : mergeDuplicateRelationships(group)));
}
