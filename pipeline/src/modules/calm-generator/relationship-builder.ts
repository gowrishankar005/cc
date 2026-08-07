import { TypedRelationship, TypedUnit } from '../../types/typed-facts';
import { CalmNode, CalmRelationship, CalmRelationshipTypeShape } from '../../types/calm';
import { RelationshipTypeMapping, findRelationshipTypeMapping } from '../../rules/construct-mapping-schema';

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

  return relationships
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
        ],
      };
      const protocol = rule.protocol ?? inferredProtocol(rel.to) ?? inferredProtocol(rel.from);
      if (protocol) {
        calmRel.protocol = protocol;
      }
      return calmRel;
    });
}
