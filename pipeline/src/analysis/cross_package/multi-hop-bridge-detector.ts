import { CrossPackageGraphRun, CrossPackageEdge } from '../../scanner/codegraph-crossroot-provider';
import { TypedUnit, TypedRelationship, IgnoredItem, PENDING_STATUS, PENDING_RELATIONSHIP_ID } from '../../types/typed-facts';
import { buildNodeToUnitMap, NodeUnitMatch, isBareNameCollision, isBareNameCollisionForBridgeCandidate } from './graphify-reconciler';
import { relationshipTrust } from '../fact-trust-matrix';

/**
 * Shared ignoredItem-detail prefixes, exported so a reader (hitl-review-
 * trigger.ts) can recover the source unit id it needs without re-deriving
 * or hardcoding a second copy of the literal text this file emits. Real
 * bug class named on code review (2026-08-16): a free-text detail string
 * with no shared constant is one accidental copy-edit away from silently
 * breaking id recovery (a `facts.units.find()` that just stops matching,
 * no error) — applies to BOTH the pre-existing `unresolved-multi-hop`
 * prefix and the newer tier-b one, not only the one this review named.
 */
export const UNRESOLVED_MULTI_HOP_PREFIX = 'unresolved-multi-hop: "';
export const TIER_B_SINGLE_CANDIDATE_PREFIX = 'tier-b-single-candidate: "';

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

/**
 * The actual confidence values for r2-phase1/r2b/r2c/r2-stereotype
 * (same-root and cross-root) live in `fact-trust-matrix.ts`, not as
 * local constants here — the ordering this file's mechanisms rely on (R2
 * below R1's implicit primary tier; R2-stereotype above R2b above R2c;
 * cross-root always below its same-root pairing) is asserted there, in one
 * place, alongside CodeQL's own tier, rather than recoverable only by
 * reading prose comments scattered across producer files.
 */

export interface MultiHopBridgeResult {
  relationships: TypedRelationship[];
  ignoredItems: IgnoredItem[];
  /**
   * Every raw edge (`${edge.source}|${edge.target}`)
   * this detector took ownership of examining, whether it went on to
   * resolve (r2-phase1/r2b/r2c) or honestly refuse (an
   * `unresolved-multi-hop` ignored item). Consumed by
   * `reconcileCrossPackageEdges`'s graded-admission path so a blunter,
   * earlier-running catch-all never races this detector's own careful,
   * ambiguity-aware decision for the exact same edge — the generic fix for
   * the real conflict found testing against `r2b-implementer-hop-sample`
   * and `r2c-direct-delegate-sample`: admission getting
   * to an edge first and admitting a low-confidence fact for something this
   * detector was about to examine far more carefully.
   */
  examinedPairs: Set<string>;
  /**
   * `examinedPairs` alone proved
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

/**
 * Dedupe a list of NodeUnitMatch candidates by their REAL underlying unit id
 * — Graphify can emit more than one raw edge for the same real target
 * (confirmed necessary by `uniqueStoreUnits`/`uniqueDelegateStores` below,
 * both pre-existing). One shared helper, not three copies of the same
 * `[...new Map(...).values()]` idiom.
 */
function dedupeByUnitId(matches: NodeUnitMatch[]): NodeUnitMatch[] {
  return [...new Map(matches.map((m) => [m.unit.id, m])).values()];
}

export function detectMultiHopBridgeRelationships(
  run: CrossPackageGraphRun,
  unitsByRoot: Map<string, TypedUnit[]>,
  /**
   * Raw signal names (e.g. "Service") that count as bridge-
   * disambiguating stereotype evidence, read from signal-catalogue.yml's
   * `bridgeStereotype: true` rows (rule-schema.ts's bridgeStereotypeSignals()).
   * Catalogue-driven, never a hardcoded name here — same discipline the
   * `wiringOnlyAnnotations` parameter established for
   * graphify-import-strategy-detector.ts, after that file's first pass
   * hardcoded `'Configuration'` as a literal and was flagged on review.
   * Defaults to empty so a caller that hasn't wired the catalogue through
   * degrades to "no disambiguation," never a crash.
   */
  bridgeStereotypeSignals: string[] = []
): MultiHopBridgeResult {
  const nodeToUnit = buildNodeToUnitMap(run, unitsByRoot);
  const relationships: TypedRelationship[] = [];
  const ignoredItems: IgnoredItem[] = [];
  const examinedPairs = new Set<string>();
  const examinedBridgeFiles = new Set<string>();
  const seen = new Set<string>(); // dedupe: a service can reference the same bridge from multiple AST sites/methods
  // The stereotype-disambiguation filter (below) is invariant per
  // bridge, but this detector's outer loop examines a bridge once per
  // service that references it (potentially many). Memoized here so a
  // bridge referenced from N call sites computes its stereotype candidates
  // once, not N times.
  const stereotypeCandidatesByBridge = new Map<string, NodeUnitMatch[]>();

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
  //
  // Stores the real CrossPackageEdge objects (not just target node ids) —
  // real bug found live, second instance of the same root cause
  // graphify-reconciler.ts's isBareNameCollision was built for (a reference
  // Java microservices banking sample, 2026-09-02): this second hop used to
  // trust `importsBySource`'s target ids blindly, with no collision check
  // at all, fabricating an r2c 'calls' edge from a service straight to an
  // unrelated OTHER service's own same-named store class whenever the real
  // delegate was a no-import same-package reference. Needs the real edge
  // object (not just the target id) so isBareNameCollision can be reused
  // here exactly as graphify-reconciler.ts already uses it, not a second,
  // drifting copy of the same check.
  const importsBySource = new Map<string, CrossPackageEdge[]>();
  for (const edge of run.graph.edges) {
    if (edge.relation === 'implements') {
      if (!implementersByTarget.has(edge.target)) implementersByTarget.set(edge.target, []);
      implementersByTarget.get(edge.target)!.push(edge.source);
    } else if (edge.relation === 'imports' || edge.relation === 'references') {
      if (!importsBySource.has(edge.source)) importsBySource.set(edge.source, []);
      importsBySource.get(edge.source)!.push(edge);
    }
  }
  const fileLineCache = new Map<string, string[]>();
  const collisionCache = new Map<string, boolean>();

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
    // Real, live, third instance of the same bare-name-collision root cause
    // isBareNameCollision was built for (a reference Java microservices
    // banking sample, 2026-09-02): the service's own bare reference to what
    // it thinks is ITS bridge candidate can itself resolve to a DIFFERENT
    // service's own, unrelated same-named class — one hop before either of
    // isBareNameCollision's two call sites below ever run, so their checks
    // pass cleanly (correctly, relative to the WRONG file) while the overall
    // chain still fabricates a cross-service relationship. Same "never guess
    // when it's provably wrong, never reject from missing data" discipline —
    // see isBareNameCollisionForBridgeCandidate's own doc comment for why
    // this needs a separate entry point rather than reusing
    // isBareNameCollision directly (a bridge candidate structurally has no
    // resolved TypedUnit yet).
    if (isBareNameCollisionForBridgeCandidate(edge, nodeById, run, fileLineCache, collisionCache)) continue;

    // From here on, this edge is this detector's own territory — recorded
    // regardless of what happens next (resolve or refuse).
    examinedPairs.add(`${edge.source}|${edge.target}`);
    const bridgeFile = nodeById.get(bridgeNodeId)?.source_file;
    if (bridgeFile) examinedBridgeFiles.add(bridgeFile);

    // Dedupe by resolved unit id (falling back to the raw node id when a
    // candidate resolves to no TypedUnit at all) BEFORE implementers.length
    // is used as the ambiguity signal — a genuinely non-ambiguous single
    // real implementer must never be miscounted as 2+ because Graphify
    // happened to emit two raw `implements` edges for it, which would
    // wrongly route a real R2-Phase-1 case into the (weaker-confidence)
    // disambiguation branch below with a fabricated "resolved from
    // ambiguity" trail.
    const rawImplementers = implementersByTarget.get(bridgeNodeId) ?? [];
    const seenImplementerKeys = new Set<string>();
    const implementers = rawImplementers.filter((id) => {
      const key = nodeToUnit.get(id)?.unit.id ?? id;
      if (seenImplementerKeys.has(key)) return false;
      seenImplementerKeys.add(key);
      return true;
    });
    if (implementers.length !== 1) {
      // 0 implementers doesn't only mean "the interface's
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
        const delegateEdges = importsBySource.get(bridgeNodeId) ?? [];
        const delegateStoreCandidates = delegateEdges
          .filter((edge) => {
            const targetMatch = nodeToUnit.get(edge.target);
            return !!targetMatch && !isBareNameCollision(edge, fromMatch, targetMatch, nodeById, run, fileLineCache, collisionCache);
          })
          .map((edge) => nodeToUnit.get(edge.target))
          .filter((m): m is NodeUnitMatch => !!m && (m.unit.kind === 'database' || m.unit.kind === 'topic'));
        const uniqueDelegateStores = dedupeByUnitId(delegateStoreCandidates);
        if (uniqueDelegateStores.length === 1) {
          emitBridgeRelationship(fromMatch, uniqueDelegateStores[0], 'r2c');
          continue;
        }
      }

      // 2+ implementers is not automatically ambiguous when
      // exactly one of them carries real, catalogue-recognized `@Service`
      // stereotype evidence and the rest don't. This narrows genuine
      // ambiguity using an extra real fact (the same disambiguation-by-
      // corroboration approach the CodeQL DI-resolution experiment verified
      // against real, messy Spring wiring, including cases with 2+
      // stereotype-carrying implementers that correctly stay refused —
      // E1b-codeql-di-resolution-experiment.md). Never applies to the
      // implementers.length === 0 case above (there is nothing to
      // disambiguate among). Runs BEFORE the tier-b check below: this
      // branch can auto-resolve a real relationship (stronger evidence);
      // that check only ever produces a human-review item, so it must
      // never shadow an auto-resolvable case.
      //
      // disambiguatedNonTerminal, set only in the exactly-one-stereotype
      // case below, exists so the ignored-item message can honestly say
      // WHICH real class was found and singled out, distinct from genuine
      // multi-candidate ambiguity — verified against a real second instance
      // (2026-08-16): a real 3-root scan of a reference Java/JAX-RS banking
      // platform's charge + provider + core modules correctly narrows a
      // real command-source-write-platform bridge interface's 2 real
      // `implements` candidates (the real implementation, carrying `@Service`;
      // a test-double with no stereotype at all, confirmed via direct source
      // read) down to the real one — but correctly still refuses, because
      // that real implementer's own kind is 'service', not database/topic
      // (it is a command-dispatch coordinator, not a persistence layer —
      // this IS the real chain Architect_Pilot_Feedback_Notes.md Entry 11/13 traced by
      // hand, and Entry 14's own finding that the deepest hop is a SEPARATE,
      // still-open JDBC-ownership ambiguity holds here too).
      let disambiguatedNonTerminal: NodeUnitMatch | undefined;
      if (implementers.length >= 2 && bridgeStereotypeSignals.length > 0) {
        let uniqueStereotypeUnits = stereotypeCandidatesByBridge.get(bridgeNodeId);
        if (!uniqueStereotypeUnits) {
          const stereotypeImplementers = implementers
            .map((id) => nodeToUnit.get(id))
            .filter((m): m is NodeUnitMatch => !!m && m.unit.evidence.some((e) => e.source === 'decorator' && bridgeStereotypeSignals.includes(e.signal)));
          uniqueStereotypeUnits = dedupeByUnitId(stereotypeImplementers);
          stereotypeCandidatesByBridge.set(bridgeNodeId, uniqueStereotypeUnits);
        }
        if (uniqueStereotypeUnits.length === 1) {
          const stereotypeMatch = uniqueStereotypeUnits[0];
          if (stereotypeMatch.unit.kind === 'database' || stereotypeMatch.unit.kind === 'topic') {
            emitBridgeRelationship(fromMatch, stereotypeMatch, 'r2-stereotype');
            continue;
          }
          // Disambiguated to one real implementer, but it isn't itself a
          // database/topic unit — deliberately does NOT also chase R2b's
          // store-import hop here (see the mechanism field's doc comment
          // in typed-facts.ts): stacking a second inferred hop onto an
          // already-disambiguated edge goes beyond what E1b's evidence
          // covers. Falls through to the same honest refusal below, but
          // with a message that names what was actually found.
          disambiguatedNonTerminal = stereotypeMatch;
        }
      }

      // The Tier-B residual class (BACKLOG.md "Tier-B residual
      // detection"): implementers.length >= 2 is SYNTACTIC ambiguity (N
      // classes implement this bridge interface). That is not always
      // SEMANTIC ambiguity: Phase 1's own terminal test (is the implementer
      // itself a real database/topic TypedUnit?) already tells apart a real
      // store implementation from a plain class with no persistence/
      // messaging evidence of its own (a mock, a stub, an alternate
      // in-memory implementation — a common real Java pattern). Reusing
      // that existing test here, not a new extraction mechanism: if exactly
      // ONE of the N syntactic implementers is itself a store unit, this is
      // "one high-confidence candidate obscured by noise," a genuinely
      // different, weaker-but-real signal than "N candidates, 2+ of them
      // real stores" (true ambiguity — falls through to the generic refusal
      // below, unchanged). Still never emits a relationship (the "never
      // guess" rule is untouched) — this only changes what gets WRITTEN to
      // ignoredItems, so a downstream reader (hitl-review-trigger.ts) can
      // tell the two shapes apart and route the single-candidate case to a
      // human decision instead of silence. Reached only when the
      // stereotype disambiguation above did NOT already auto-resolve a
      // relationship (checked on the raw implementers list either way —
      // the two checks look at different evidence, stereotype vs.
      // store-kind, and can legitimately disagree on which single
      // candidate they each single out).
      if (implementers.length >= 2) {
        const storeImplementers = implementers
          .map((implId) => nodeToUnit.get(implId))
          .filter((m): m is NodeUnitMatch => !!m && (m.unit.kind === 'database' || m.unit.kind === 'topic'));
        const uniqueStoreImplementers = [...new Map(storeImplementers.map((m) => [m.unit.id, m])).values()];
        if (uniqueStoreImplementers.length === 1) {
          const candidate = uniqueStoreImplementers[0];
          const wouldBeConfidence = relationshipTrust('codegraph', 'r2-phase1', fromMatch.root === candidate.root ? 'same-root' : 'cross-root');
          const key = `${fromMatch.unit.id}|${bridgeNodeId}|tier-b-single-candidate`;
          if (!seen.has(key)) {
            seen.add(key);
            ignoredItems.push({
              ref: `${fromMatch.unit.filePath}`,
              reason: 'CROSS_DOMAIN_UNRESOLVED',
              detail: `${TIER_B_SINGLE_CANDIDATE_PREFIX}${fromMatch.unit.id}" references bridge "${bridgeNodeId}" which has ${implementers.length} candidate implementation(s) in scanned roots, but exactly 1 ("${candidate.unit.id}") is itself a real database/topic unit — the other ${implementers.length - 1} carry no persistence/messaging evidence of their own. A single high-confidence candidate obscured by syntactic ambiguity, not genuine multi-candidate ambiguity (would resolve at confidence ${wouldBeConfidence}, r2-phase1 tier, if unambiguous) — needs a human decision, not an automatic edge, per R2's "never guess" rule.`,
            });
          }
          continue;
        }
      }

      // 0 (no implementer in scanned roots, and not itself a
      // direct delegate either — the real single-module case seen in a
      // reference Java/JAX-RS banking platform, per the design note), 2+
      // with no stereotype disambiguation possible and no single
      // store candidate, or 2+ with a disambiguated implementer
      // that still isn't a store — never guess.
      const key = `${fromMatch.unit.id}|${bridgeNodeId}|unresolved`;
      if (!seen.has(key)) {
        seen.add(key);
        const detail = disambiguatedNonTerminal
          ? `${UNRESOLVED_MULTI_HOP_PREFIX}${fromMatch.unit.id}" references bridge "${bridgeNodeId}" which stereotype-disambiguation narrowed to a sole real implementer ("${disambiguatedNonTerminal.unit.id}", kind: ${disambiguatedNonTerminal.unit.kind}) among ${implementers.length} candidates — but that implementer is not itself a database/topic unit, and the implementer-import hop is not chased after disambiguation — no architecture relationship emitted, per R2's "never guess" rule.`
          : `${UNRESOLVED_MULTI_HOP_PREFIX}${fromMatch.unit.id}" references bridge "${bridgeNodeId}" which has ${implementers.length} candidate implementation(s) in scanned roots (need exactly 1) — no architecture relationship emitted, per R2's "never guess" rule.`;
        ignoredItems.push({
          ref: `${fromMatch.unit.filePath}`,
          reason: 'CROSS_DOMAIN_UNRESOLVED',
          detail,
        });
      }
      continue;
    }

    const implMatch = nodeToUnit.get(implementers[0]);
    if (implMatch && (implMatch.unit.kind === 'database' || implMatch.unit.kind === 'topic')) {
      emitBridgeRelationship(fromMatch, implMatch, 'r2-phase1');
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
    const implCandidateEdges = implNodeId ? importsBySource.get(implNodeId) ?? [] : [];
    const storeCandidates = implCandidateEdges
      .filter((edge) => {
        const targetMatch = nodeToUnit.get(edge.target);
        return !!targetMatch && !isBareNameCollision(edge, fromMatch, targetMatch, nodeById, run, fileLineCache, collisionCache);
      })
      .map((edge) => nodeToUnit.get(edge.target))
      .filter((m): m is NodeUnitMatch => !!m && (m.unit.kind === 'database' || m.unit.kind === 'topic'));
    // Dedupe by unit id — the same store can be imported via more than one edge.
    const uniqueStoreUnits = dedupeByUnitId(storeCandidates);

    if (uniqueStoreUnits.length === 1) {
      emitBridgeRelationship(fromMatch, uniqueStoreUnits[0], 'r2b');
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
        detail: `${UNRESOLVED_MULTI_HOP_PREFIX}${fromMatch.unit.id}" -> bridge "${bridgeNodeId}" -> implementer "${implNodeId}" is not a database/topic unit (${implMatch ? `kind: ${implMatch.unit.kind}` : 'no TypedUnit at all'}) and imports ${uniqueStoreUnits.length} candidate store unit(s) in scanned roots (need exactly 1, R2b) — hop bound reached, no architecture relationship emitted.`,
      });
    }
  }

  function emitBridgeRelationship(from: NodeUnitMatch, to: NodeUnitMatch, mechanism: 'r2-phase1' | 'r2b' | 'r2c' | 'r2-stereotype'): void {
    if (from.unit.id === to.unit.id) return; // degenerate: bridge resolves back to the source's own unit
    const dedupeKey = `${from.unit.id}|${to.unit.id}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    const sameRoot = from.root === to.root;
    relationships.push({
      from: from.unit.id,
      to: to.unit.id,
      kind: 'calls', // distinct from R1's 'imports'/'connects' — this is an inferred call chain through a bridge, not a direct import (§2.2)
      crossPackage: !sameRoot,
      source: 'codegraph',
      confidence: relationshipTrust('codegraph', mechanism, sameRoot ? 'same-root' : 'cross-root'), // fact-trust-matrix.ts — the single source of truth for this tier
      mechanism, // r2-phase1 vs r2b, distinguishable without decoding the confidence value
      status: PENDING_STATUS,
      id: PENDING_RELATIONSHIP_ID,
    });
  }

  return { relationships, ignoredItems, examinedPairs, examinedBridgeFiles };
}
