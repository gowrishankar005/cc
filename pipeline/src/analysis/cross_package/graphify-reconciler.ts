import { GraphifyGraph, parseSourceLocation } from '../../scanner/graphify-provider';
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
 * Matching strategy: filePath equality (Graphify's source_file is relative
 * to the package root it was run against; our TypedUnit.filePath is the
 * same relative path from codegraph-provider.ts) + best-effort line overlap.
 * Falls back to filePath-only match when Graphify's single-line
 * source_location doesn't fall inside the unit's [startLine, endLine] span
 * (real for Slice 1's one-unit-per-file granularity — a Graphify node deep
 * in a file still belongs to that file's unit).
 */
export function reconcileCrossPackageEdges(
  graphsByRoot: Map<string, GraphifyGraph>,
  unitsByRoot: Map<string, TypedUnit[]>
): TypedRelationship[] {
  // nodeId -> { root, unit }
  const nodeToUnit = new Map<string, { root: string; unit: TypedUnit }>();

  for (const [root, graph] of graphsByRoot) {
    const units = unitsByRoot.get(root) ?? [];
    for (const node of graph.nodes) {
      const line = parseSourceLocation(node.source_location);
      const sameFileUnits = units.filter((u) => u.filePath === node.source_file);
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
        nodeToUnit.set(`${root}::${node.id}`, { root, unit: match });
      }
    }
  }

  const relationships: TypedRelationship[] = [];
  for (const [root, graph] of graphsByRoot) {
    for (const edge of graph.edges) {
      const from = nodeToUnit.get(`${root}::${edge.source}`);
      const to = nodeToUnit.get(`${root}::${edge.target}`);
      if (!from || !to) continue;
      if (from.root === to.root && from.unit.id === to.unit.id) continue; // same unit, not a relationship

      const crossPackage = from.root !== to.root;
      relationships.push({
        from: from.unit.id,
        to: to.unit.id,
        kind: edge.relation === 'imports' ? 'imports' : edge.relation === 'calls' ? 'calls' : 'connects',
        crossPackage,
        source: 'graphify',
      });
    }
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
