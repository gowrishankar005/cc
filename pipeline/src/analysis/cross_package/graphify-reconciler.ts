import * as path from 'path';
import { CrossPackageGraphRun, CrossPackageEdge, parseSourceLocation } from '../../scanner/codegraph-crossroot-provider';
import { TypedUnit, TypedRelationship, PENDING_STATUS, PENDING_RELATIONSHIP_ID } from '../../types/typed-facts';
import { findJavaImportForBareName, getJavaPackageDeclaration } from '../../rules/java-import-resolver';
import { relationshipTrust } from '../fact-trust-matrix';

/**
 * Maps each Graphify node to the CodeGraph-typed unit it refers to (which
 * now includes persistence-detector.ts's database units, not just
 * route-derived service units — see run-slice.ts), then attaches every
 * Graphify edge connecting two DIFFERENT units as a relationship, tagging
 * crossPackage:true only when the two units came from different package
 * roots. Replaces a from-scratch FQN-stitcher (v0.6 §4 Option B) — see the
 * plan's Context section for why.
 *
 * Rewritten to work off ONE global CrossPackageGraphRun instead of a
 * Map<root, graph> — the earlier per-root-Map design could only ever look up
 * both endpoints of an edge under the SAME root prefix, which made
 * `crossPackage: true` structurally unreachable regardless of what Graphify
 * actually found (confirmed: real cross-module a reference Java/JAX-RS banking platform edges existed in a
 * combined extraction but were invisible to per-root buckets). Node ids
 * within one CrossPackageGraphRun's graph are already globally unique (one extraction
 * pass), so no root-prefixing is needed for the lookup itself — only
 * `resolveRoot()` to know which root a matched unit's node came from, for
 * the crossPackage flag.
 *
 * Matching strategy: filePath equality (via `resolveRoot`, root-relative,
 * matching TypedUnit.filePath's convention) + best-effort line overlap.
 * Falls back to filePath-only match when Graphify's single-line
 * source_location doesn't fall inside the unit's [startLine, endLine] span
 * (real for Slice 1's one-unit-per-file granularity — a Graphify node deep
 * in a file still belongs to that file's unit).
 */
export interface NodeUnitMatch {
  root: string;
  unit: TypedUnit;
}

// T-P0-1 (E2, graded fact admission) — BACKLOG.md's "Graded fact admission
// (dual-unit gate)" row. Below multi-hop-bridge-detector.ts's R2b tier
// (8/5), the lowest confidence this pipeline emits before this change: an
// admitted edge is weaker evidence than a 2-hop bridge inference — it's a
// raw structural reference to a target this pipeline could not classify at
// all, not an inference chained through units it DID classify.
// Values live in `fact-trust-matrix.ts` (T-LR-6, mechanism 'admitted-unresolved')
// — re-exported here so this is the only import site that changes if the
// tier moves, not a second hardcoded copy of the number.
export const ADMITTED_SAME_ROOT_CONFIDENCE = relationshipTrust('codegraph', 'admitted-unresolved', 'same-root');
export const ADMITTED_CROSS_ROOT_CONFIDENCE = relationshipTrust('codegraph', 'admitted-unresolved', 'cross-root');

/**
 * AREC Wave 3 T-C1 — extracted so multi-hop-bridge-detector.ts (R2) can
 * reuse the EXACT same node->unit resolution reconcileCrossPackageEdges
 * already uses, instead of a second, potentially-drifting copy of the same
 * filePath/line-span matching logic. Behavior unchanged from before this
 * extraction (verified: full regression suite unchanged after the split).
 */
export function buildNodeToUnitMap(run: CrossPackageGraphRun, unitsByRoot: Map<string, TypedUnit[]>): Map<string, NodeUnitMatch> {
  const nodeToUnit = new Map<string, NodeUnitMatch>();

  for (const node of run.graph.nodes) {
    const resolved = run.resolveRoot(node.source_file);
    if (!resolved) continue; // outside every given package root (real for a multi-root common-ancestor scan)
    const units = unitsByRoot.get(resolved.root) ?? [];
    const line = parseSourceLocation(node.source_location);
    const sameFileUnits = units.filter((u) => u.filePath === resolved.relativeFilePath);
    // Prefer a unit whose recorded span contains this line (disambiguates
    // when a file legitimately holds >1 unit, e.g. a route unit AND a
    // persistence unit in the same file). Bug found by actually running
    // this against real a reference Python microservices banking app code: userservice.py's route unit
    // only spans its decorator lines (52-162), but Graphify's
    // userservice_create_app node sits at L42 (the wrapping factory
    // function's def line) — outside that span. Slice 1's granularity is
    // one unit per file, so ANY node in the file belongs to it; only fall
    // back to span-matching when there's more than one candidate.
    const match =
      sameFileUnits.length <= 1
        ? sameFileUnits[0]
        : sameFileUnits.find((u) => line !== undefined && line >= u.startLine && line <= u.endLine) ?? sameFileUnits[0];
    if (match) {
      nodeToUnit.set(node.id, { root: resolved.root, unit: match });
    }
  }

  return nodeToUnit;
}

/**
 * B-stereotype-name-collision — Graphify resolves a bare identifier (e.g. an
 * `@Component` annotation's simple class name) against ANY same-named class
 * node anywhere in the whole combined-extraction graph, regardless of what
 * the referencing class's own real import statement actually names.
 * Confirmed via a live repro against the real graphify CLI: a class
 * annotated `@Component` (importing `org.springframework.stereotype.Component`,
 * a framework marker) produces both an `imports` edge AND a `references`
 * edge to an unrelated, same-named in-repo class — quantified at 32.4% of
 * relationships on a real 918-relationship scan of a reference Java/JAX-RS
 * banking platform.
 *
 * Java-only (the only evidenced language) — rejects an edge only on a
 * POSITIVE, CONFIRMED disagreement: the source class has a real import for
 * this bare name, and that import's qualified package does not match the
 * destination unit's own real `package` declaration. No import found at all
 * (the legitimate same-package-reference case, which needs no Java import)
 * or an unreadable/unpackaged destination both degrade to "can't disprove
 * this edge, leave it" — never a false rejection from missing data.
 *
 * `collisionCache` is keyed on (source file, bare name, destination unit) —
 * not just source+dest — since one file can bare-reference multiple
 * different names against different destinations, and multiple raw Graphify
 * edges (imports + references, in the evidenced repro) commonly land on the
 * exact same false-positive pair.
 */
function isBareNameCollision(
  edge: CrossPackageEdge,
  from: NodeUnitMatch,
  to: NodeUnitMatch,
  nodeById: Map<string, { label: string }>,
  run: CrossPackageGraphRun,
  fileLineCache: Map<string, string[]>,
  collisionCache: Map<string, boolean>
): boolean {
  if (!edge.source_file.endsWith('.java')) return false;
  const bareName = nodeById.get(edge.target)?.label;
  if (!bareName) return false;

  const srcResolved = run.resolveRoot(edge.source_file);
  if (!srcResolved) return false;
  const srcAbsPath = path.join(srcResolved.root, srcResolved.relativeFilePath);

  const cacheKey = `${srcAbsPath}|${bareName}|${to.unit.id}`;
  const cached = collisionCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const qualifiedImport = findJavaImportForBareName(srcAbsPath, bareName, fileLineCache);
  let result = false;
  if (qualifiedImport) {
    const destAbsPath = path.join(to.root, to.unit.filePath);
    const destPackage = getJavaPackageDeclaration(destAbsPath, fileLineCache);
    result = destPackage !== undefined && qualifiedImport !== `${destPackage}.${bareName}`;
  }
  collisionCache.set(cacheKey, result);
  return result;
}

/**
 * T-P0-1 (E2) — synthesizes a NodeUnitMatch for a raw Graphify node that
 * didn't resolve to any real TypedUnit, so an edge touching it can be
 * admitted instead of silently dropped. Only ever built from REAL data
 * already on the node (source_file/source_location/label) — never a fake
 * filePath or a guessed root. Returns undefined (never admitted) when the
 * node's file falls outside every given package root: `resolveRoot`
 * failing means this pipeline genuinely doesn't know what root/file this
 * is, and admitting a fact with a fabricated location would violate the
 * same "never guess" discipline this codebase already holds everywhere
 * else (v0.9 §1). Memoized by raw node id so the same unresolved node
 * referenced by multiple edges gets exactly one placeholder unit, not one
 * per edge.
 */
function buildPlaceholderMatch(
  nodeId: string,
  run: CrossPackageGraphRun,
  placeholders: Map<string, NodeUnitMatch>,
  implementsTargetFiles: Set<string>
): NodeUnitMatch | undefined {
  const cached = placeholders.get(nodeId);
  if (cached) return cached;

  const node = run.graph.nodes.find((n) => n.id === nodeId);
  if (!node) return undefined;
  // T-P0-1 (E2) — real, evidenced regression found while building this:
  // a node whose FILE also declares a real `implements`-edge target (e.g.
  // an interface something in the repo implements, or any other member —
  // a method node, say — in that same interface's file) is exactly a
  // multi-hop-bridge-detector.ts (R2/R2b) bridge candidate's territory —
  // reserved for that detector's own careful, ambiguity-aware resolution,
  // which sometimes correctly refuses to emit anything at all (an
  // ambiguous 2-implementer case, per the r2b-implementer-hop-sample
  // fixture's own regression test — first caught on the interface node
  // itself, then again on one of its method nodes, both real Graphify
  // nodes for the exact same file). File-level, not node-id-level: a
  // node-id-only check missed the method-node case, since Graphify emits
  // a separate node per method, not just per type. Admitting a blunt
  // low-confidence placeholder relationship here for any node in that file
  // would create a second, competing "fact" for an edge R2b deliberately
  // left unresolved — never admitted; defer entirely to the specialized
  // detector.
  if (node.source_file && implementsTargetFiles.has(node.source_file)) return undefined;
  // T-P0-1 (E2) — real, evidenced regression found while building this:
  // Graphify emits `source_file: ''`/`source_location: ''` for a bare
  // symbol it could never attribute to a real file at all (confirmed via
  // test/fixtures/nestjs-sample's checked-in graph.json — 'Controller',
  // 'Get', 'Param', 'Post', 'Body', the decorator names imported from
  // '@nestjs/common', all carry empty source_file). `resolveRoot('')`
  // incorrectly resolves an empty path to the scan root itself
  // (`path.resolve(scanRoot, '')` collapses to `scanRoot`, which then
  // equality-matches `absRoot`) — without this guard, every external
  // library/framework symbol a repo merely imports gets admitted as a fake
  // architectural node. A symbol with no real source location is not
  // evidence of anything in this repo; never admitted.
  if (!node.source_file) return undefined;
  const resolved = run.resolveRoot(node.source_file);
  if (!resolved) return undefined;

  const line = parseSourceLocation(node.source_location) ?? 0;
  const unit: TypedUnit = {
    id: `unresolved:${nodeId}`,
    kind: 'unresolved',
    name: node.label,
    filePath: resolved.relativeFilePath,
    startLine: line,
    endLine: line,
    status: PENDING_STATUS,
    evidence: [],
    confidence: ADMITTED_SAME_ROOT_CONFIDENCE,
  };
  const match: NodeUnitMatch = { root: resolved.root, unit };
  placeholders.set(nodeId, match);
  return match;
}

export function reconcileCrossPackageEdges(
  run: CrossPackageGraphRun,
  unitsByRoot: Map<string, TypedUnit[]>,
  /**
   * T-P0-1 (E2) round 3 — `${edge.source}|${edge.target}` pairs a more
   * specialized detector (today: `multi-hop-bridge-detector.ts`) has
   * already taken ownership of examining, whether it resolved or honestly
   * refused. Real conflict found running E2 against both
   * `r2b-implementer-hop-sample` (round 2) and `r2c-direct-delegate-sample`
   * (round 3): this pass runs before that detector in the default pass
   * order, so without this, admission reaches an edge first and admits a
   * blunt, low-confidence fact for exactly the edge the specialized
   * detector was about to examine far more carefully — never guess when a
   * more specialized mechanism already owns the decision. Empty by default
   * so every existing caller/test not yet updated is unaffected.
   */
  reservedPairs: Set<string> = new Set(),
  /**
   * T-P0-1 (E2) round 3 continued — source files of every bridge candidate
   * `multi-hop-bridge-detector.ts` examined. `reservedPairs` alone proved
   * insufficient against `r2c-direct-delegate-sample`: Graphify emits a
   * SEPARATE `calls` edge straight to the bridge candidate's individual
   * method node, distinct from the class-level `imports`/`references` edge
   * the detector actually walks — that edge's target is never in
   * reservedPairs. Deferring admission for the whole file (not just the
   * exact examined edge) closes that gap, same file-level granularity
   * `implementsTargetFiles` already uses above for a narrower case.
   */
  reservedFiles: Set<string> = new Set()
): { relationships: TypedRelationship[]; unresolvedUnits: TypedUnit[] } {
  const nodeToUnit = buildNodeToUnitMap(run, unitsByRoot);
  const nodeById = new Map(run.graph.nodes.map((n) => [n.id, n]));
  const fileLineCache = new Map<string, string[]>();
  const collisionCache = new Map<string, boolean>();
  const placeholders = new Map<string, NodeUnitMatch>();
  // T-P0-1 (E2) — file-level, not node-id-level; see buildPlaceholderMatch's
  // doc comment for why. Built from the same `implements` edges
  // multi-hop-bridge-detector.ts's `implementersByTarget` uses. Kept
  // alongside the new edge-pair-level `reservedPairs` check above, not
  // replaced by it — the two catch overlapping but not identical risk
  // shapes (this one is file-wide, the other is exact-edge and relation-scoped
  // to what the specialized detector itself actually walks).
  const implementsTargetFiles = new Set(
    run.graph.edges
      .filter((e) => e.relation === 'implements')
      .map((e) => nodeById.get(e.target)?.source_file)
      .filter((f): f is string => !!f)
  );

  const relationships: TypedRelationship[] = [];
  for (const edge of run.graph.edges) {
    let from = nodeToUnit.get(edge.source);
    let to = nodeToUnit.get(edge.target);
    // T-P0-1 (E2) — previously `if (!from || !to) continue` dropped the
    // edge outright whenever EITHER side didn't resolve. Now: if exactly
    // one side is missing, try to admit it via a synthesized placeholder;
    // if BOTH are missing, there's no real endpoint to anchor a fact to at
    // all — still dropped, unchanged from before. Never admits an edge a
    // more specialized detector already claimed (reservedPairs).
    let admitted = false;
    const targetFile = !to ? nodeById.get(edge.target)?.source_file : undefined;
    const sourceFile = !from ? nodeById.get(edge.source)?.source_file : undefined;
    const reserved =
      reservedPairs.has(`${edge.source}|${edge.target}`) ||
      (targetFile !== undefined && reservedFiles.has(targetFile)) ||
      (sourceFile !== undefined && reservedFiles.has(sourceFile));
    if (reserved) {
      // fall through to the normal !from || !to drop below, unchanged
    } else if (!from && to) {
      from = buildPlaceholderMatch(edge.source, run, placeholders, implementsTargetFiles);
      admitted = !!from;
    } else if (from && !to) {
      to = buildPlaceholderMatch(edge.target, run, placeholders, implementsTargetFiles);
      admitted = !!to;
    }
    if (!from || !to) continue;
    if (from.root === to.root && from.unit.id === to.unit.id) continue; // same unit, not a relationship
    if (isBareNameCollision(edge, from, to, nodeById, run, fileLineCache, collisionCache)) continue;

    const crossPackage = from.root !== to.root;
    relationships.push({
      from: from.unit.id,
      to: to.unit.id,
      kind: edge.relation === 'imports' ? 'imports' : edge.relation === 'calls' ? 'calls' : 'connects',
      crossPackage,
      source: 'codegraph',
      status: PENDING_STATUS,
      id: PENDING_RELATIONSHIP_ID,
      ...(admitted
        ? { confidence: crossPackage ? ADMITTED_CROSS_ROOT_CONFIDENCE : ADMITTED_SAME_ROOT_CONFIDENCE, mechanism: 'admitted-unresolved' as const }
        : {}),
    });
  }

  // De-duplicate identical relationships (Graphify can report the same
  // logical edge from multiple AST sites).
  const seen = new Set<string>();
  const dedupedRelationships = relationships.filter((r) => {
    const key = `${r.from}|${r.to}|${r.kind}|${r.crossPackage}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { relationships: dedupedRelationships, unresolvedUnits: [...placeholders.values()].map((m) => m.unit) };
}
