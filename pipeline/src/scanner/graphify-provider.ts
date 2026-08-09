import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logMem } from '../util/debug-mem';

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
 * A single Graphify extraction plus enough information to attribute each
 * node/edge back to which of the ORIGINAL package roots it came from.
 *
 * REAL FINDING, not assumed (docs/spikes/... — verified this session against
 * real Fineract fineract-charge + fineract-core): running `graphify extract`
 * once PER ROOT, separately, structurally cannot produce a cross-root edge —
 * each invocation never sees the other root's files, so Graphify has nothing
 * to resolve a cross-module reference against (confirmed empirically: 0
 * cross-root edges, even after `graphify merge-graphs`, which concatenates
 * two already-separately-extracted graphs rather than re-resolving symbols
 * across them). Running ONE extraction covering the common ancestor of all
 * given roots — the ORIGINAL design rationale for choosing Graphify at all
 * ("a single whole-repo pass sidesteps the cross-root partitioning problem
 * structurally") — actually resolves it: verified 265 real cross-module
 * edges between fineract-charge and fineract-core in one combined pass,
 * including the exact evidenced case (`ChargesApiResource` -references->
 * `PlatformSecurityContext`, at the correct source line).
 */
export interface GraphifyRun {
  graph: GraphifyGraph;
  /**
   * Resolves a node/edge's `source_file` (relative to whatever root the
   * extraction actually ran against — the common ancestor for multi-root
   * runs, or the single root itself) back to which requested package root
   * owns it, and the file path relative to THAT root — matching the
   * convention `TypedUnit.filePath` (from codegraph-provider.ts, itself
   * root-relative) already uses. Returns undefined for files outside every
   * given root (real for a multi-root common-ancestor scan: sibling
   * directories not in packageRoots get swept in too).
   */
  resolveRoot(sourceFile: string): { root: string; relativeFilePath: string } | undefined;
}

function computeCommonAncestor(roots: string[]): string {
  const segmentsList = roots.map((r) => path.resolve(r).split(path.sep));
  const minLen = Math.min(...segmentsList.map((s) => s.length));
  const common: string[] = [];
  for (let i = 0; i < minLen; i++) {
    const segment = segmentsList[0][i];
    if (segmentsList.every((s) => s[i] === segment)) common.push(segment);
    else break;
  }
  const ancestor = common.join(path.sep);
  return ancestor === '' ? path.sep : ancestor;
}

/**
 * ONE Graphify pass covering every given package root — the cross-package
 * structural-backbone source. For a single root this is unchanged from
 * before (one extraction, same as always). For multiple roots, this now
 * runs ONE extraction against their common ancestor directory instead of
 * one extraction per root (see GraphifyRun's doc comment for why that
 * matters) — Graphify has no multi-path `extract` invocation (confirmed:
 * passing two paths silently only processes the first), so a real common
 * ancestor is the only way to get one combined pass.
 *
 * --code-only --no-cluster is the exact flag combination the tool comparison
 * confirmed makes clean, network-call-free, no-API-key runs.
 *
 * PERSISTENT cache dir, not a temp dir deleted after every run. Real finding
 * this session: `graphify extract` is already incremental on its own when
 * pointed at the SAME --out directory across runs — it hashes each file's
 * content and skips re-extracting anything unchanged (confirmed: a second
 * run against an unchanged fixture went from a full AST pass to "0 changed,
 * N unchanged" in ~0.1s, using `graphify-out/cache/` it writes itself). The
 * earlier `fs.mkdtempSync`/`fs.rmSync` pattern discarded that cache every
 * single run for no reason — this was a real, avoidable cost this whole
 * session paid on every Fineract/BoA run without needing to. Mirrors
 * CodeGraph's own per-package-root `.codegraph/` persistent-cache
 * convention (same directory-inside-the-scanned-tree pattern, already
 * accepted in this codebase) rather than inventing a different convention
 * for Graphify alone.
 */
export function runGraphifyPass(packageRoots: string[], graphifyBin = 'graphify'): GraphifyRun {
  const scanRoot = packageRoots.length === 1 ? path.resolve(packageRoots[0]) : computeCommonAncestor(packageRoots);
  const absRoots = packageRoots.map((r) => path.resolve(r));

  const cacheDir = path.join(scanRoot, '.graphify-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  execFileSync(graphifyBin, ['extract', scanRoot, '--code-only', '--no-cluster', '--out', cacheDir], { stdio: 'pipe' });
  const graphPath = path.join(cacheDir, 'graphify-out', 'graph.json');
  const graph: GraphifyGraph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  if (process.env.WEAVER_DEBUG_MEM) {
    logMem(`after graph.json parse (${(fs.statSync(graphPath).size / 1e6).toFixed(1)}MB on disk, ${graph.nodes.length} nodes, ${graph.edges.length} edges)`);
  }
  // Deliberately NOT removed — kept for the next run's incremental benefit.

  const resolveRoot = (sourceFile: string): { root: string; relativeFilePath: string } | undefined => {
    const absPath = path.resolve(scanRoot, sourceFile);
    for (const absRoot of absRoots) {
      if (absPath === absRoot || absPath.startsWith(absRoot + path.sep)) {
        return { root: absRoot, relativeFilePath: path.relative(absRoot, absPath) };
      }
    }
    return undefined;
  };

  return { graph, resolveRoot };
}
