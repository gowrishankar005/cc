import { TypedRelationship, TypedUnit } from '../types/typed-facts';

/**
 * Product rule: structural (R0) relationships may always run, but output
 * should be graded or described so entity-entity mesh is not sold as
 * "service architecture." Generic
 * over TypedUnit.kind/TypedRelationship.kind — no relationship producer
 * (graphify-reconciler, k8s-trust-detector, env-soft-graph-detector,
 * outbound-http-detector) needs to know about grading; this runs once, last,
 * over whatever they collectively produced.
 */
export function gradeRelationships(relationships: TypedRelationship[], units: TypedUnit[]): void {
  const kindById = new Map(units.map((u) => [u.id, u.kind]));
  for (const rel of relationships) {
    if (rel.grade) continue; // a producer that already knows its own grade (none today) is not overridden
    if (rel.kind === 'shares-secret') {
      rel.grade = 'trust';
      continue;
    }
    const fromKind = kindById.get(rel.from);
    const toKind = kindById.get(rel.to);
    rel.grade = fromKind === 'service' || toKind === 'service' ? 'architecture' : 'structural';
  }
}
