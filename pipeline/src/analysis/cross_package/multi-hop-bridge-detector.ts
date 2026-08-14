import { GraphifyRun } from '../../scanner/graphify-provider';
import { TypedUnit, TypedRelationship, IgnoredItem } from '../../types/typed-facts';
import { buildNodeToUnitMap, NodeUnitMatch } from './graphify-reconciler';

/**
 * Produces architecture-grade relationships for the layered shape R0/R1
 * structurally cannot see: a `service` unit
 * references a BRIDGE (an interface/type with zero TypedUnits of its own —
 * no HTTP/persistence/messaging/security-control evidence, e.g. a reference Java/JAX-RS banking platform's
 * `ChargeReadPlatformService`), and that bridge is `implements`-ed by
 * EXACTLY ONE class within the scanned root set which is itself a real
 * `database`/`topic` unit.
 *
 * Deliberately NOT a name-suffix strategy (`*PlatformService`/`*Repository`)
 * — the design note found a reference Java/JAX-RS banking platform alone uses 3+ different suffixes for
 * this same architectural role, so a name list would be exactly the
 * per-repo patching this task forbids. The only test is structural: does
 * the target of a service's `imports` edge produce zero TypedUnits, and is
 * it `implements`-ed by exactly one persistence/messaging unit.
 */

/** Below every R1 same-package confidence value this pipeline emits — R2 is one inference layer removed from a direct import, must never look as certain as one. */
const R2_SAME_ROOT_CONFIDENCE = 15;
/** Lower again — the bridge's implementer was resolved in a DIFFERENT scanned root than the source service, a larger, Q11-labeled claim. */
const R2_CROSS_ROOT_CONFIDENCE = 10;
/**
 * The second-hop case: the sole
 * implementer is itself not a database/topic unit (a plain service/JDBC/
 * RowMapper-shaped class, real layered-Java shape), but it imports/references
 * EXACTLY ONE database/topic unit directly. Two inference layers deep (bridge
 * resolution + implementer-import chase), so below BOTH Phase 1 tiers.
 */
const R2B_SAME_ROOT_CONFIDENCE = 8;
/** Deepest, most-inferred tier this pipeline produces — implementer-import chase AND a root-boundary claim together. */
const R2B_CROSS_ROOT_CONFIDENCE = 5;
/**
 * T-LR-2 (BACKLOG.md "Direct-delegate bridge detection") — a concrete class
 * referenced directly, with no `implements`-based interface layer at all,
 * that itself imports/references exactly one database/topic unit. Real
 * evidence: 28 candidates found in a real public-sample scan, 0 resolved
 * before this. Below R2b's tier, deliberately: R2b's implementer is at
 * least corroborated by a real `implements` type-system fact (this class
 * genuinely implements that interface); a direct delegate has no such
 * corroboration at all — only "referenced directly, imports exactly one
 * store," a strictly weaker structural signal.
 */
const R2C_SAME_ROOT_CONFIDENCE = 6;
/** Weakest tier this pipeline produces — direct-delegate AND a root-boundary claim together. */
const R2C_CROSS_ROOT_CONFIDENCE = 3;

export interface MultiHopBridgeResult {
  relationships: TypedRelationship[];
  ignoredItems: IgnoredItem[];
  /**
   * T-P0-1 (E2) round 3 — every raw edge (`${edge.source}|${edge.target}`)
   * this detector took ownership of examining, whether it went on to
   * resolve (r2-phase1/r2b/r2c) or honestly refuse (an
   * `unresolved-multi-hop` ignored item). Consumed by
   * `reconcileCrossPackageEdges`'s graded-admission path so a blunter,
   * earlier-running catch-all never races this detector's own careful,
   * ambiguity-aware decision for the exact same edge — the generic fix for
   * the real conflict found running E2 against `r2b-implementer-hop-sample`
   * (round 2) and `r2c-direct-delegate-sample` (round 3): admission getting
   * to an edge first and admitting a low-confidence fact for something this
   * detector was about to examine far more carefully.
   */
  examinedPairs: Set<string>;
  /**
   * T-P0-1 (E2) round 3 continued — `examinedPairs` alone proved
   * insufficient against `r2c-direct-delegate-sample`: Graphify emits a
   * SEPARATE `calls` edge straight to the bridge candidate's individual
   * METHOD node (e.g. `ThingService.retrieveAll`), distinct from the
   * class-level `imports`/`references` edge this detector actually walks.
   * That edge's target never appears in examinedPairs, so pair-level
   * deferral missed it and E2 admitted it anyway. Source files of every
   * bridge candidate this detector examined (resolved or refused) — the
   * reconciler defers admission for ANY edge targeting a node in one of
   * these files, the same file-level granularity `implementsTargetFiles`
   * already used for a narrower case (BACKLOG.md "Direct-delegate bridge
   * detection" evidence).
   */
  examinedBridgeFiles: Set<string>;
}

export function detectMultiHopBridgeRelationships(run: GraphifyRun, unitsByRoot: Map<string, TypedUnit[]>): MultiHopBridgeResult {
  const nodeToUnit = buildNodeToUnitMap(run, unitsByRoot);
  const relationships: TypedRelationship[] = [];
  const ignoredItems: IgnoredItem[] = [];
  const examinedPairs = new Set<string>();
  const examinedBridgeFiles = new Set<string>();
  const seen = new Set<string>(); // dedupe: a service can reference the same bridge from multiple AST sites/methods

  // Real finding while building this against a reference Java/JAX-RS banking
  // platform: Graphify emits a node with `source_file: ""` for EVERY
  // unresolved external symbol a file references — framework annotation
  // types (`Operation`, `Schema`, `Parameter` — Swagger), and genuinely
  // external project types (`PlatformSecurityContext`, defined outside the
  // scanned module) alike. A bridge candidate (§2.1) must resolve to a REAL
  // scanned-root file — only then can its `implements`-ing class even
  // theoretically be found within scanned roots. Without this check, every
  // Swagger annotation import flooded ignoredItems as a bogus
  // "unresolved-multi-hop" candidate (34 of them on a single module alone,
  // only ~2 of which were real architectural bridges) — caught by running
  // this against the real platform before trusting it, not assumed safe.
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
  // Same imports/references edges bridge-discovery already reads
  // (line ~98 below), re-indexed by SOURCE this time: given an implementer
  // node, what does it itself import/reference? Reused, not re-derived, so
  // the second-hop "does the implementer import a store" test is the exact
  // same relation vocabulary as the first-hop "does the service import a
  // bridge" test — one mechanism, two hops, not two mechanisms.
  const importsBySource = new Map<string, string[]>();
  for (const edge of run.graph.edges) {
    if (edge.relation === 'implements') {
      if (!implementersByTarget.has(edge.target)) implementersByTarget.set(edge.target, []);
      implementersByTarget.get(edge.target)!.push(edge.source);
    } else if (edge.relation === 'imports' || edge.relation === 'references') {
      if (!importsBySource.has(edge.source)) importsBySource.set(edge.source, []);
      importsBySource.get(edge.source)!.push(edge.target);
    }
  }

  for (const edge of run.graph.edges) {
    // Real finding while proving this against a synthetic fixture (a
    // reference Java/JAX-RS banking platform's ChargesApiResource happens to
    // import ChargeReadPlatformService from a DIFFERENT Java package, which
    // masked this): Java does NOT require (or emit) an `import` statement
    // for a same-package type — Graphify correctly represents same-package
    // usage as a `references` edge instead, targeting the exact same
    // class-level node id an `implements` edge would target. Restricting to
    // `imports` alone would silently miss the very common same-package
    // controller+interface shape (arguably MORE common than the
    // cross-package one seen in that reference platform). Both
    // relations are accepted as bridge-discovery signals; `isRealBridgeCandidate`
    // below is what keeps this from re-admitting the earlier annotation-type
    // noise (Operation/Schema/Parameter etc. have empty source_file either way).
    if (edge.relation !== 'imports' && edge.relation !== 'references') continue;
    const fromMatch = nodeToUnit.get(edge.source);
    if (!fromMatch || fromMatch.unit.kind !== 'service') continue; // source-side candidate: only real service units (§2.1)

    const bridgeNodeId = edge.target;
    if (nodeToUnit.has(bridgeNodeId)) continue; // not a bridge — the imported thing already has its own evidence/unit (R1 handles this)
    if (!isRealBridgeCandidate(bridgeNodeId)) continue; // external/unresolved symbol (annotation type, out-of-root type) — not a real in-repo bridge, no ignored-item noise

    // From here on, this edge is this detector's own territory — recorded
    // regardless of what happens next (resolve or refuse).
    examinedPairs.add(`${edge.source}|${edge.target}`);
    const bridgeFile = nodeById.get(bridgeNodeId)?.source_file;
    if (bridgeFile) examinedBridgeFiles.add(bridgeFile);

    const implementers = implementersByTarget.get(bridgeNodeId) ?? [];
    if (implementers.length !== 1) {
      // T-LR-2 — 0 implementers doesn't only mean "the interface's
      // implementer isn't in scanned roots" (the case the ignored-item
      // below was originally written for). It's ALSO the exact shape a
      // concrete class referenced directly, with no interface at all,
      // produces: nothing has an `implements` edge targeting it, because
      // it isn't an interface. Before giving up, check whether the
      // candidate ITSELF (not an implementer of it — there is none)
      // imports/references exactly one database/topic unit, reusing the
      // exact same importsBySource lookup R2b's second hop already uses.
      // A genuine interface with a real implementer outside scanned roots
      // naturally fails this (interfaces don't import concrete stores in
      // their own declarations), so this doesn't need to structurally
      // distinguish "interface" from "concrete class" — the check is
      // self-limiting to the real shape by construction. 2+ implementers
      // (genuine ambiguity between real candidates) is untouched — that's
      // a different, already-correctly-handled case, never routed here.
      if (implementers.length === 0) {
        const delegateTargets = importsBySource.get(bridgeNodeId) ?? [];
        const delegateStoreCandidates = delegateTargets
          .map((targetId) => nodeToUnit.get(targetId))
          .filter((m): m is NodeUnitMatch => !!m && (m.unit.kind === 'database' || m.unit.kind === 'topic'));
        const uniqueDelegateStores = [...new Map(delegateStoreCandidates.map((m) => [m.unit.id, m])).values()];
        if (uniqueDelegateStores.length === 1) {
          emitBridgeRelationship(fromMatch, uniqueDelegateStores[0], R2C_SAME_ROOT_CONFIDENCE, R2C_CROSS_ROOT_CONFIDENCE, 'r2c');
          continue;
        }
      }

      // 0 (no implementer in scanned roots, AND (T-LR-2) not itself a
      // direct delegate either — the real single-module case seen in a
      // reference Java/JAX-RS banking platform, per the design note) or
      // 2+ (genuinely ambiguous) — never guess (§2.2/§2.4.1).
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
    if (implMatch && (implMatch.unit.kind === 'database' || implMatch.unit.kind === 'topic')) {
      emitBridgeRelationship(fromMatch, implMatch, R2_SAME_ROOT_CONFIDENCE, R2_CROSS_ROOT_CONFIDENCE, 'r2-phase1');
      continue;
    }

    // Phase 1's terminal check just failed (implementer is absent, or exists
    // but isn't itself a database/topic unit — the real JDBC-RowMapper/
    // plain-service-layer shape seen in a reference Java/JAX-RS banking
    // platform). Before giving up, chase ONE
    // more hop through what the implementer itself imports/references,
    // filtered to targets that are ALREADY a database/topic TypedUnit (no
    // new detection mechanism — reuses whatever R1/persistence-detector/
    // spring-data-repository/etc. already produced). Still bounded at 2
    // bridge hops total (service -> bridge -> implementer -> store) per
    // §2.4.2 — this is a filter added at the existing second hop, not a new
    // third hop; an implementer's implementer is never chased.
    const implNodeId = implementers[0];
    const implCandidateTargets = implNodeId ? importsBySource.get(implNodeId) ?? [] : [];
    const storeCandidates = implCandidateTargets
      .map((targetId) => nodeToUnit.get(targetId))
      .filter((m): m is NodeUnitMatch => !!m && (m.unit.kind === 'database' || m.unit.kind === 'topic'));
    // Dedupe by unit id — the same store can be imported via more than one edge.
    const uniqueStoreUnits = [...new Map(storeCandidates.map((m) => [m.unit.id, m])).values()];

    if (uniqueStoreUnits.length === 1) {
      emitBridgeRelationship(fromMatch, uniqueStoreUnits[0], R2B_SAME_ROOT_CONFIDENCE, R2B_CROSS_ROOT_CONFIDENCE, 'r2b');
      continue;
    }

    // Still unresolved after the R2b hop: 0 implementers, an implementer with
    // no store import, or 2+ ambiguous store imports — never guess (§2.4.1
    // unchanged, now also covers the R2b hop's own ambiguity case).
    const key = `${fromMatch.unit.id}|${bridgeNodeId}|no-terminal-unit`;
    if (!seen.has(key)) {
      seen.add(key);
      ignoredItems.push({
        ref: `${fromMatch.unit.filePath}`,
        reason: 'CROSS_DOMAIN_UNRESOLVED',
        detail: `unresolved-multi-hop: "${fromMatch.unit.id}" -> bridge "${bridgeNodeId}" -> implementer "${implNodeId}" is not a database/topic unit (${implMatch ? `kind: ${implMatch.unit.kind}` : 'no TypedUnit at all'}) and imports ${uniqueStoreUnits.length} candidate store unit(s) in scanned roots (need exactly 1, R2b) — hop bound reached, no architecture relationship emitted.`,
      });
    }
  }

  function emitBridgeRelationship(
    from: NodeUnitMatch,
    to: NodeUnitMatch,
    sameRootConfidence: number,
    crossRootConfidence: number,
    mechanism: 'r2-phase1' | 'r2b' | 'r2c'
  ): void {
    if (from.unit.id === to.unit.id) return; // degenerate: bridge resolves back to the source's own unit
    const dedupeKey = `${from.unit.id}|${to.unit.id}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    relationships.push({
      from: from.unit.id,
      to: to.unit.id,
      kind: 'calls', // distinct from R1's 'imports'/'connects' — this is an inferred call chain through a bridge, not a direct import (§2.2)
      crossPackage: from.root !== to.root,
      source: 'graphify',
      confidence: from.root === to.root ? sameRootConfidence : crossRootConfidence,
      mechanism, // T-L2-1 — r2-phase1 vs r2b, distinguishable without decoding the confidence value
    });
  }

  return { relationships, ignoredItems, examinedPairs, examinedBridgeFiles };
}
