import { GraphifyRun, parseSourceLocation } from '../../scanner/graphify-provider';
import { TypedUnit, TypedRelationship } from '../../types/typed-facts';

/**
 * Maps each Graphify node to the CodeGraph-typed unit it refers to (which
 * now includes persistence-detector.ts's database units, not just
 * route-derived service units — see run-slice.ts), then attaches every
 * Graphify edge connecting two DIFFERENT units as a relationship, tagging
 * crossPackage:true only when the two units came from different package
 * roots. Replaces a from-scratch FQN-stitcher (v0.6 §4 Option B) — see the
 * plan's Context section for why.
 *
 * Rewritten this session to work off ONE global GraphifyRun instead of a
 * Map<root, graph> — the earlier per-root-Map design could only ever look up
 * both endpoints of an edge under the SAME root prefix, which made
 * `crossPackage: true` structurally unreachable regardless of what Graphify
 * actually found (confirmed: real cross-module Fineract edges existed in a
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
export function reconcileCrossPackageEdges(run: GraphifyRun, unitsByRoot: Map<string, TypedUnit[]>): TypedRelationship[] {
  const nodeToUnit = new Map<string, { root: string; unit: TypedUnit }>();

  for (const node of run.graph.nodes) {
    const resolved = run.resolveRoot(node.source_file);
    if (!resolved) continue; // outside every given package root (real for a multi-root common-ancestor scan)
    const units = unitsByRoot.get(resolved.root) ?? [];
    const line = parseSourceLocation(node.source_location);
    const sameFileUnits = units.filter((u) => u.filePath === resolved.relativeFilePath);
    // Prefer a unit whose recorded span contains this line (disambiguates
    // when a file legitimately holds >1 unit, e.g. a route unit AND a
    // persistence unit in the same file). Bug found by actually running
    // this against real Bank of Anthos code: userservice.py's route unit
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

  const relationships: TypedRelationship[] = [];
  for (const edge of run.graph.edges) {
    const from = nodeToUnit.get(edge.source);
    const to = nodeToUnit.get(edge.target);
    if (!from || !to) continue;
    if (from.root === to.root && from.unit.id === to.unit.id) continue; // same unit, not a relationship

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
