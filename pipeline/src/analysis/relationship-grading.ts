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
    // T-MR-3 (found reviewing this task against coverage-report.ts/
    // hitl-review-trigger.ts's own `grade === 'architecture'` filters,
    // which they document as meaning specifically "R1 one-hop or R2
    // bridge-resolved, never structural/trust") — a k8s Deployment's
    // namespace placement is a real, verified fact, but it is not a
    // service->store/service connectivity claim, and letting it fall
    // through to the generic service-endpoint fallback below would silently
    // count as "real architecture-grade outbound coverage" for a service
    // whose ONLY relationship is where it runs, not who it talks to —
    // corrupting architectureOutboundCoverage and suppressing the
    // low-architecture-coverage/S1 review triggers for a genuinely
    // under-connected service. Same reasoning shares-secret already got its
    // own explicit branch for, reusing 'structural' (not a new grade value)
    // since nothing in this codebase branches on `grade === 'structural'`
    // specifically — only the 'architecture' filter above needs to exclude it.
    if (rel.kind === 'deployed-in') {
      rel.grade = 'structural';
      continue;
    }
    const fromKind = kindById.get(rel.from);
    const toKind = kindById.get(rel.to);
    // T-P0-1 (E2) — a relationship touching a graded-fact-admission
    // placeholder (kind: 'unresolved') must never grade 'architecture',
    // regardless of the other endpoint's kind: BACKLOG.md's own proposal
    // for this mechanism is explicit ("never architecture grade"), and an
    // unresolved-endpoint fact is by definition weaker evidence than a
    // real service->database one-hop edge, which is the only case
    // 'architecture' is meant to represent. Checked BEFORE the service
    // check below so a resolved service endpoint can't override it.
    if (fromKind === 'unresolved' || toKind === 'unresolved') {
      rel.grade = 'structural';
      continue;
    }
    rel.grade = fromKind === 'service' || toKind === 'service' ? 'architecture' : 'structural';
  }
}
