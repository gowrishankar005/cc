import { GraphifyRun } from '../../scanner/graphify-provider';
import { TypedUnit, TypedRelationship, IgnoredItem } from '../../types/typed-facts';
import { buildNodeToUnitMap } from './graphify-reconciler';

/**
 * AREC Wave 3 T-C1 (docs/solution/AREC_R2_MultiHop_Strategy.md — the R2
 * design note this implements). Produces architecture-grade relationships
 * for the layered shape R0/R1 structurally cannot see: a `service` unit
 * references a BRIDGE (an interface/type with zero TypedUnits of its own —
 * no HTTP/persistence/messaging/security-control evidence, e.g. Fineract's
 * `ChargeReadPlatformService`), and that bridge is `implements`-ed by
 * EXACTLY ONE class within the scanned root set which is itself a real
 * `database`/`topic` unit.
 *
 * Deliberately NOT a name-suffix strategy (`*PlatformService`/`*Repository`)
 * — the design note found Fineract alone uses 3+ different suffixes for
 * this same architectural role, so a name list would be exactly the
 * per-repo patching this task forbids. The only test is structural: does
 * the target of a service's `imports` edge produce zero TypedUnits, and is
 * it `implements`-ed by exactly one persistence/messaging unit.
 */

/** Below every R1 same-package confidence value this pipeline emits — R2 is one inference layer removed from a direct import, must never look as certain as one. */
const R2_SAME_ROOT_CONFIDENCE = 15;
/** Lower again — the bridge's implementer was resolved in a DIFFERENT scanned root than the source service, a larger, Q11-labeled claim. */
const R2_CROSS_ROOT_CONFIDENCE = 10;

export interface MultiHopBridgeResult {
  relationships: TypedRelationship[];
  ignoredItems: IgnoredItem[];
}

export function detectMultiHopBridgeRelationships(run: GraphifyRun, unitsByRoot: Map<string, TypedUnit[]>): MultiHopBridgeResult {
  const nodeToUnit = buildNodeToUnitMap(run, unitsByRoot);
  const relationships: TypedRelationship[] = [];
  const ignoredItems: IgnoredItem[] = [];
  const seen = new Set<string>(); // dedupe: a service can reference the same bridge from multiple AST sites/methods

  // Real finding while building this against real Fineract: Graphify emits a
  // node with `source_file: ""` for EVERY unresolved external symbol a file
  // references — framework annotation types (`Operation`, `Schema`,
  // `Parameter` — Swagger), and genuinely external project types
  // (`PlatformSecurityContext`, defined outside fineract-charge) alike. A
  // bridge candidate (§2.1) must resolve to a REAL scanned-root file — only
  // then can its `implements`-ing class even theoretically be found within
  // scanned roots. Without this check, every Swagger annotation import
  // flooded ignoredItems as a bogus "unresolved-multi-hop" candidate (34 of
  // them on fineract-charge alone, only ~2 of which were real architectural
  // bridges) — caught by running this against real Fineract before trusting
  // it, not assumed safe.
  const nodeById = new Map(run.graph.nodes.map((n) => [n.id, n]));
  const isRealBridgeCandidate = (nodeId: string): boolean => {
    const node = nodeById.get(nodeId);
    if (!node || !node.source_file) return false;
    return run.resolveRoot(node.source_file) !== undefined;
  };

  // Every real `implements` edge, indexed by target (bridge) node id, so a
  // bridge's implementer count is a single lookup, not an O(edges) scan per
  // bridge candidate.
  const implementersByTarget = new Map<string, string[]>();
  for (const edge of run.graph.edges) {
    if (edge.relation !== 'implements') continue;
    if (!implementersByTarget.has(edge.target)) implementersByTarget.set(edge.target, []);
    implementersByTarget.get(edge.target)!.push(edge.source);
  }

  for (const edge of run.graph.edges) {
    // Real finding while proving this against a synthetic fixture (real
    // Fineract's ChargesApiResource happens to import ChargeReadPlatformService
    // from a DIFFERENT Java package, which masked this): Java does NOT
    // require (or emit) an `import` statement for a same-package type —
    // Graphify correctly represents same-package usage as a `references`
    // edge instead, targeting the exact same class-level node id an
    // `implements` edge would target. Restricting to `imports` alone would
    // silently miss the very common same-package controller+interface shape
    // (arguably MORE common than Fineract's cross-package one). Both
    // relations are accepted as bridge-discovery signals; `isRealBridgeCandidate`
    // below is what keeps this from re-admitting the earlier annotation-type
    // noise (Operation/Schema/Parameter etc. have empty source_file either way).
    if (edge.relation !== 'imports' && edge.relation !== 'references') continue;
    const fromMatch = nodeToUnit.get(edge.source);
    if (!fromMatch || fromMatch.unit.kind !== 'service') continue; // source-side candidate: only real service units (§2.1)

    const bridgeNodeId = edge.target;
    if (nodeToUnit.has(bridgeNodeId)) continue; // not a bridge — the imported thing already has its own evidence/unit (R1 handles this)
    if (!isRealBridgeCandidate(bridgeNodeId)) continue; // external/unresolved symbol (annotation type, out-of-root type) — not a real in-repo bridge, no ignored-item noise

    const implementers = implementersByTarget.get(bridgeNodeId) ?? [];
    if (implementers.length !== 1) {
      // 0 (no implementer in scanned roots — the real Fineract fineract-charge-alone
      // case per the design note) or 2+ (genuinely ambiguous) — never guess (§2.2/§2.4.1).
      const key = `${fromMatch.unit.id}|${bridgeNodeId}|unresolved`;
      if (!seen.has(key)) {
        seen.add(key);
        ignoredItems.push({
          ref: `${fromMatch.unit.filePath}`,
          reason: 'CROSS_DOMAIN_UNRESOLVED',
          detail: `unresolved-multi-hop: "${fromMatch.unit.id}" references bridge "${bridgeNodeId}" which has ${implementers.length} candidate implementation(s) in scanned roots (need exactly 1) — no architecture relationship emitted, per R2's "never guess" rule.`,
        });
      }
      continue;
    }

    const implMatch = nodeToUnit.get(implementers[0]);
    if (!implMatch || (implMatch.unit.kind !== 'database' && implMatch.unit.kind !== 'topic')) {
      // Implementer exists but is not itself a persistence/messaging unit
      // (e.g. it's a plain service, or has no catalogue evidence of its
      // own either — Fineract's real JDBC-RowMapper impl shape, which
      // imports no known persistence-driver library). Bounded at 2 hops
      // total (service -> bridge -> implementer) per §2.4.2 — do not chase
      // a third hop.
      const key = `${fromMatch.unit.id}|${bridgeNodeId}|no-terminal-unit`;
      if (!seen.has(key)) {
        seen.add(key);
        ignoredItems.push({
          ref: `${fromMatch.unit.filePath}`,
          reason: 'CROSS_DOMAIN_UNRESOLVED',
          detail: `unresolved-multi-hop: "${fromMatch.unit.id}" -> bridge "${bridgeNodeId}" -> implementer "${implementers[0]}" is not a database/topic unit (${implMatch ? `kind: ${implMatch.unit.kind}` : 'no TypedUnit at all'}) — hop bound reached, no architecture relationship emitted.`,
        });
      }
      continue;
    }

    if (fromMatch.unit.id === implMatch.unit.id) continue; // degenerate: bridge resolves back to the source's own unit

    const dedupeKey = `${fromMatch.unit.id}|${implMatch.unit.id}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    relationships.push({
      from: fromMatch.unit.id,
      to: implMatch.unit.id,
      kind: 'calls', // distinct from R1's 'imports'/'connects' — this is an inferred call chain through a bridge, not a direct import (§2.2)
      crossPackage: fromMatch.root !== implMatch.root,
      source: 'graphify',
      confidence: fromMatch.root === implMatch.root ? R2_SAME_ROOT_CONFIDENCE : R2_CROSS_ROOT_CONFIDENCE,
    });
  }

  return { relationships, ignoredItems };
}
