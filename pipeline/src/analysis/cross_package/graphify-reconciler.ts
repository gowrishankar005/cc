import * as path from 'path';
import { GraphifyRun, GraphifyEdge, parseSourceLocation } from '../../scanner/graphify-provider';
import { TypedUnit, TypedRelationship } from '../../types/typed-facts';
import { findJavaImportForBareName, getJavaPackageDeclaration } from '../../rules/java-import-resolver';

/**
 * Maps each Graphify node to the CodeGraph-typed unit it refers to (which
 * now includes persistence-detector.ts's database units, not just
 * route-derived service units — see run-slice.ts), then attaches every
 * Graphify edge connecting two DIFFERENT units as a relationship, tagging
 * crossPackage:true only when the two units came from different package
 * roots. Replaces a from-scratch FQN-stitcher (v0.6 §4 Option B) — see the
 * plan's Context section for why.
 *
 * Rewritten to work off ONE global GraphifyRun instead of a
 * Map<root, graph> — the earlier per-root-Map design could only ever look up
 * both endpoints of an edge under the SAME root prefix, which made
 * `crossPackage: true` structurally unreachable regardless of what Graphify
 * actually found (confirmed: real cross-module a reference Java/JAX-RS banking platform edges existed in a
 * combined extraction but were invisible to per-root buckets). Node ids
 * within one GraphifyRun's graph are already globally unique (one extraction
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

/**
 * AREC Wave 3 T-C1 — extracted so multi-hop-bridge-detector.ts (R2) can
 * reuse the EXACT same node->unit resolution reconcileCrossPackageEdges
 * already uses, instead of a second, potentially-drifting copy of the same
 * filePath/line-span matching logic. Behavior unchanged from before this
 * extraction (verified: full regression suite unchanged after the split).
 */
export function buildNodeToUnitMap(run: GraphifyRun, unitsByRoot: Map<string, TypedUnit[]>): Map<string, NodeUnitMatch> {
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
 * relationships on a real 918-relationship Fineract scan.
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
  edge: GraphifyEdge,
  from: NodeUnitMatch,
  to: NodeUnitMatch,
  nodeById: Map<string, { label: string }>,
  run: GraphifyRun,
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

export function reconcileCrossPackageEdges(run: GraphifyRun, unitsByRoot: Map<string, TypedUnit[]>): TypedRelationship[] {
  const nodeToUnit = buildNodeToUnitMap(run, unitsByRoot);
  const nodeById = new Map(run.graph.nodes.map((n) => [n.id, n]));
  const fileLineCache = new Map<string, string[]>();
  const collisionCache = new Map<string, boolean>();

  const relationships: TypedRelationship[] = [];
  for (const edge of run.graph.edges) {
    const from = nodeToUnit.get(edge.source);
    const to = nodeToUnit.get(edge.target);
    if (!from || !to) continue;
    if (from.root === to.root && from.unit.id === to.unit.id) continue; // same unit, not a relationship
    if (isBareNameCollision(edge, from, to, nodeById, run, fileLineCache, collisionCache)) continue;

    relationships.push({
      from: from.unit.id,
      to: to.unit.id,
      kind: edge.relation === 'imports' ? 'imports' : edge.relation === 'calls' ? 'calls' : 'connects',
      crossPackage: from.root !== to.root,
      source: 'graphify',
    });
  }

  // De-duplicate identical relationships (Graphify can report the same
  // logical edge from multiple AST sites).
  const seen = new Set<string>();
  return relationships.filter((r) => {
    const key = `${r.from}|${r.to}|${r.kind}|${r.crossPackage}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
