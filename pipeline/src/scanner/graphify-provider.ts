import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logMem } from '../util/debug-mem';

/**
 * Real shape of graphify extract --code-only --no-cluster's graph.json,
 * confirmed by actually running it against a reference Python microservices
 * banking app's userservice package (66 nodes, 151 edges) — not assumed
 * from tool documentation. Notably: no `kind` field on nodes, and
 * source_location is a single-line string like "L19", not a start/end range.
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
 * REAL FINDING, not assumed — verified against a real reference
 * Java/JAX-RS banking platform (two modules within the same repo): running `graphify extract`
 * once PER ROOT, separately, structurally cannot produce a cross-root edge —
 * each invocation never sees the other root's files, so Graphify has nothing
 * to resolve a cross-module reference against (confirmed empirically: 0
 * cross-root edges, even after `graphify merge-graphs`, which concatenates
 * two already-separately-extracted graphs rather than re-resolving symbols
 * across them). Running ONE extraction covering the common ancestor of all
 * given roots — the ORIGINAL design rationale for choosing Graphify at all
 * ("a single whole-repo pass sidesteps the cross-root partitioning problem
 * structurally") — actually resolves it: verified 265 real cross-module
 * edges between two modules of the same reference platform in one combined
 * pass, including the exact evidenced case (`ChargesApiResource`
 * -references-> `PlatformSecurityContext`, at the correct source line).
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

// Exported for codeql-auto-detect.ts (--auto-codeql) — the "real,
// compilable root" a caller-independent build-file scan needs to check is
// the identical common ancestor this pass already computes for its own
// combined extraction, not a second, possibly-diverging implementation.
export function computeCommonAncestor(roots: string[]): string {
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
 * PERSISTENT cache dir, not a temp dir deleted after every run. Real finding:
 * `graphify extract` is already incremental on its own when
 * pointed at the SAME --out directory across runs — it hashes each file's
 * content and skips re-extracting anything unchanged (confirmed: a second
 * run against an unchanged fixture went from a full AST pass to "0 changed,
 * N unchanged" in ~0.1s, using `graphify-out/cache/` it writes itself). The
 * earlier `fs.mkdtempSync`/`fs.rmSync` pattern discarded that cache every
 * single run for no reason — this was a real, avoidable cost this whole
 * session paid on every a reference Java/JAX-RS banking platform/the reference Python app run without needing to.
 *
 * T-onboarding-2 (2026-08-21) — lives under `cacheBaseDir` (this run's
 * `--out`), NOT beside the scanned source as originally built. Real
 * beginner-usability finding: a scan silently dropped `.graphify-cache`
 * inside the TARGET repo with zero warning, surprising untracked-directory
 * noise for anyone pointing Weaver at their own real repository — the
 * primary use case. Deliberately diverges from `codegraph-provider.ts`'s
 * own `.codegraph/`-beside-source convention here rather than matching it:
 * that one is imposed by the third-party CodeGraph SDK itself (confirmed by
 * reading its own `InitOptions`/`OpenOptions` types — no location override
 * exists, only a same-directory rename via `CODEGRAPH_DIR`), so it's a
 * permanent constraint, not a choice; this cache is entirely OUR OWN
 * `--out` we already control, so there's no equivalent reason to keep it
 * beside the source. Real trade-off, not hidden: the incremental speedup
 * above now only applies across reruns into the SAME `--out` directory,
 * not any rerun against the same source regardless of `--out` — already the
 * convention T-CL-2's own incremental merge expects, and it eliminates a
 * real staleness bug class the old beside-source location had (a persistent
 * cache surviving hand-edits between separate local dev runs against the
 * same fixture path — the exact reason ~50 regression tests used to force
 * `fs.rmSync` it before every run; a `--out`-scoped cache is fresh by
 * construction, since test `--out` dirs are always freshly `mkdtempSync`'d).
 */
export function runGraphifyPass(packageRoots: string[], cacheBaseDir: string, graphifyBin = 'graphify'): GraphifyRun {
  const scanRoot = packageRoots.length === 1 ? path.resolve(packageRoots[0]) : computeCommonAncestor(packageRoots);
  const absRoots = packageRoots.map((r) => path.resolve(r));

  const cacheDir = path.join(cacheBaseDir, '.graphify-cache');
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
