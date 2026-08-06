import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Real shape of graphify extract --code-only --no-cluster's graph.json,
 * confirmed by actually running it against spikes/boa/repo/src/accounts/userservice
 * (66 nodes, 151 edges) — not assumed from the original tool comparison doc.
 * Notably: no `kind` field on nodes (confirms docs/spikes/CodeGraph_vs_Graphify_Comparison.md §5),
 * and source_location is a single-line string like "L19", not a start/end range.
 */
export interface GraphifyNode {
  id: string;
  label: string;
  file_type: string;
  source_file: string;
  source_location: string; // e.g. "L19"
  _origin: string;
}

export interface GraphifyEdge {
  source: string;
  target: string;
  relation: string; // 'imports' | 'calls' | 'references' | 'contains' | 'inherits' | 'implements' | ...
  context: string;
  confidence: string; // 'EXTRACTED' | 'INFERRED'
  source_file: string;
  source_location: string;
  weight: number;
  _origin: string;
}

export interface GraphifyGraph {
  nodes: GraphifyNode[];
  edges: GraphifyEdge[];
}

export function parseSourceLocation(loc: string): number | undefined {
  const m = /^L(\d+)/.exec(loc);
  return m ? parseInt(m[1], 10) : undefined;
}

/**
 * ONE Graphify pass across all given package roots — the cross-package
 * structural-backbone source (requirements/plan: replaces a from-scratch
 * FQN-stitcher). Runs `graphify extract <root> --code-only --no-cluster`
 * per root (Graphify has no multi-root invocation; results are merged in
 * memory here, tagged by which root each node/edge came from, since the
 * cross-package question is "does an edge connect nodes from two different
 * roots").
 *
 * --code-only --no-cluster is the exact flag combination the tool comparison
 * confirmed makes clean, network-call-free, no-API-key runs.
 */
export function runGraphifyPass(packageRoots: string[], graphifyBin = 'graphify'): Map<string, GraphifyGraph> {
  const results = new Map<string, GraphifyGraph>();
  for (const root of packageRoots) {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graphify-run-'));
    execFileSync(graphifyBin, ['extract', root, '--code-only', '--no-cluster', '--out', outDir], {
      stdio: 'pipe',
    });
    const graphPath = path.join(outDir, 'graphify-out', 'graph.json');
    const graph: GraphifyGraph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
    results.set(root, graph);
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  return results;
}
