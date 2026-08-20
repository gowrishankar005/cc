import { TypedRelationship } from '../types/typed-facts';

/**
 * T-CL-1 (BACKLOG.md "Fact identity, incremental merge, and review
 * history") — a TypedRelationship's stable identity: fact type (kind) +
 * endpoint identities (from/to, already-stable TypedUnit.id values) +
 * discriminator (mechanism when a specialized detector set one, otherwise
 * source). Never file:line — no line number is even in scope for a
 * relationship. Never a run-scoped counter — replaces
 * relationship-builder.ts's old `rel-${i}` positional index, which changed
 * on rerun even when the relationship set itself was unchanged (the
 * mechanism-class bug this task exists to close, found while building it).
 *
 * A rename that changes an endpoint's own TypedUnit.id legitimately changes
 * this id too — the same "disappeared fact plus a new one, not a bug"
 * discipline TypedUnit.id's own doc comment states, not a special case here.
 */
export function computeRelationshipId(rel: Pick<TypedRelationship, 'kind' | 'from' | 'to' | 'mechanism' | 'source'>): string {
  const discriminator = rel.mechanism ?? rel.source;
  return `${rel.kind}|${rel.from}|${rel.to}|${discriminator}`;
}

/**
 * T-CL-1 — the single place every relationship a run produces gets its
 * stable id, run once after every relationship producer (see
 * analysis/passes.ts's factIdentityPass ordering note). Mutates in place,
 * same convention as status-assignment.ts's assignStatuses.
 */
export function assignFactIds(relationships: TypedRelationship[]): void {
  for (const rel of relationships) {
    rel.id = computeRelationshipId(rel);
  }
}
