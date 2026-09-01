import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CodeGraph } = require('@colbymchenry/codegraph');

/**
 * Replaces graphify-provider.ts as the cross-package structural backbone
 * (see docs/solution/E6-cross-package-backbone-evaluation.md). Real finding,
 * verified against a reference Java/JAX-RS banking platform (its own charge + core modules): a
 * single CodeGraph index over the common-ancestor of all given package
 * roots, scoped via `ProjectConfig.exclude` (NOT `include` — `include` is
 * additive-only, "force in despite .gitignore", never restrictive; `exclude`
 * is CodeGraph's real scope-narrowing mechanism, confirmed empirically:
 * excluding every sibling of two target modules brought a 6,704-Java-file
 * monorepo's indexed file count down to 881, matching just those two
 * modules), resolves the same real cross-module edge
 * (`ChargesApiResource` -references-> `PlatformSecurityContext`) that
 * originally justified Graphify's combined-pass technique. This file
 * reproduces that technique against CodeGraph instead.
 *
 * Field names on the emitted node/edge shape intentionally match Graphify's
 * former `GraphifyNode`/`GraphifyEdge` shape exactly (`source_file`,
 * `source_location`, `relation`, `label`, `file_type`) — every downstream
 * consumer (reconciler, persistence/messaging/outbound-http detectors,
 * multi-hop bridge detector) reads these field names and has zero Graphify-
 * specific logic beyond that shape, so this keeps their code completely
 * untouched (see CrossPackageNode/CrossPackageEdge below, and the type
 * re-export at the bottom of this file for the neutral names those
 * consumers now import instead).
 *
 * Two synthetic conventions are reproduced deliberately, matching what
 * those consumers already walk today, since CodeGraph's own graph doesn't
 * have identical node/edge shapes natively:
 *  - One `file`-kind node per file at `source_location: 'L1'` (Graphify's
 *    per-file anchor node), with a `contains` edge from it to every
 *    top-level class/interface/enum declared in that file.
 *  - A `method`-relation edge from a class/interface node to each of its
 *    method members (CodeGraph itself uses a uniform `contains` edge for
 *    both class->field and class->method; the `method` relation name is
 *    reconstructed here by filtering `contains` edges to method-kind
 *    targets, matching the exact string graphify-import-strategy-detector.ts
 *    already filters on).
 */
export interface CrossPackageNode {
  id: string;
  label: string;
  file_type: string;
  source_file: string;
  source_location: string; // e.g. "L19"
  _origin: string;
}

export interface CrossPackageEdge {
  source: string;
  target: string;
  relation: string; // 'imports' | 'calls' | 'references' | 'contains' | 'implements' | 'extends' | 'instantiates' | 'method' | ...
  context: string;
  confidence: string;
  source_file: string;
  source_location: string;
  weight: number;
  _origin: string;
}

export interface CrossPackageGraph {
  nodes: CrossPackageNode[];
  edges: CrossPackageEdge[];
}

export function parseSourceLocation(loc: string): number | undefined {
  const m = /^L(\d+)/.exec(loc);
  return m ? parseInt(m[1], 10) : undefined;
}

/** Same contract graphify-provider.ts's GraphifyRun used — see its former doc comment for why resolveRoot exists. */
export interface CrossPackageGraphRun {
  graph: CrossPackageGraph;
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
 * Excludes every top-level sibling of scanRoot that isn't on the path to
 * one of the given roots — the real scope-narrowing mechanism (see this
 * file's doc comment). Mirrors Graphify's own accepted, documented
 * tolerance (graphify-provider.ts's former GraphifyRun comment): only
 * top-level siblings are excluded, so an extraneous subdirectory nested
 * under an included top-level branch can still get swept in. Not a
 * regression — this is the exact same limitation the prior mechanism had.
 */
function computeExcludePatterns(scanRoot: string, absRoots: string[]): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(scanRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && e.name !== '.git' && e.name !== '.codegraph')
    .map((e) => path.join(scanRoot, e.name))
    .filter((childAbs) => !absRoots.some((r) => r === childAbs || r.startsWith(childAbs + path.sep) || childAbs.startsWith(r + path.sep)))
    .map((childAbs) => `${path.relative(scanRoot, childAbs)}/**`);
}

/**
 * CodeGraph inserts an extra `namespace` (package-wrapper) node between a
 * Java file and the classes it declares — `file --contains--> namespace
 * --contains--> class` — unlike Graphify's flat `file->class` shape every
 * consumer (graphify-import-strategy-detector.ts's one-hop file-contains-
 * class walk) expects. Flattens `contains` edges through any number of
 * `namespace`-kind hops, re-parenting the namespace's own outgoing edges
 * onto the original requester. Real bug found running this against a real
 * a reference Java/JAX-RS banking platform fixture: `SqlInjectionPreventerServiceImpl` was unreachable via
 * the one-hop walk without this — the walk found the namespace and stopped.
 */
function expandOutgoingEdges(cg: any, nodeId: string): any[] {
  const result: any[] = [];
  for (const e of cg.getOutgoingEdges(nodeId)) {
    const targetNode = cg.getNode(e.target);
    if (e.kind === 'contains' && targetNode?.kind === 'namespace') {
      for (const inner of expandOutgoingEdges(cg, e.target)) {
        result.push({ ...inner, source: nodeId });
      }
    } else {
      result.push(e);
    }
  }
  return result;
}

/**
 * Real, evidenced gap (a reference Java/JAX-RS banking platform-scale multi-hop bridge resolution silently
 * losing the R2b "implementer imports a store" hop): CodeGraph attributes a
 * `references`/`imports`/`calls` edge to the specific FIELD or METHOD
 * declaration where the usage occurs, not the enclosing class — confirmed
 * directly (`WidgetReadServiceImpl`'s `WidgetEntity entity` field reference
 * edge sources from the FIELD node id, never the class id). Graphify's
 * flatter model attributed these at class/file granularity, and every
 * consumer (multi-hop-bridge-detector.ts's `importsBySource`, keyed by the
 * IMPLEMENTER CLASS id from its own `implements` edge) depends on that
 * granularity — a real edge existing between the right two classes is
 * invisible to a lookup keyed one level up. Re-parents `source` from any
 * field/method-kind node up to its enclosing class/interface/enum (via the
 * `contains`/`method` edges already collected), for every OTHER relation —
 * `contains`/`method` edges themselves describe that same containment and
 * must stay member-level, or reparenting would make them self-referential.
 * Scoped to field/method TARGETS only (checked via `nodeKindById`, not just
 * relation) — a `contains` edge also covers file->class containment,  and
 * naively reparenting every `contains` target would have re-parented a
 * class's own `implements` edge up onto its FILE (real bug caught building
 * this: the `implements` edge vanished from the class's own edge list,
 * looking like the whole fix had regressed something it never touched).
 */
function reparentMemberEdgesToEnclosingClass(nodes: CrossPackageNode[], edges: CrossPackageEdge[]): void {
  const memberKinds = new Set(['field', 'method']);
  const nodeKindById = new Map(nodes.map((n) => [n.id, n.file_type]));
  const enclosingClassByMember = new Map<string, string>();
  for (const e of edges) {
    if ((e.relation === 'contains' || e.relation === 'method') && memberKinds.has(nodeKindById.get(e.target) ?? '')) {
      enclosingClassByMember.set(e.target, e.source);
    }
  }
  for (const e of edges) {
    if (e.relation === 'contains' || e.relation === 'method') continue;
    const enclosingSource = enclosingClassByMember.get(e.source);
    if (enclosingSource) e.source = enclosingSource;
    // Real, evidenced gap (a reference Java governance platform's `UIDEndpoint -> WebUtilities.mkPath`, a
    // static-member import/call): CodeGraph resolved this MORE precisely
    // than Graphify did — a real `calls` edge straight to the `mkPath`
    // METHOD node, not the class — but `buildNodeToUnitMap` matches a node
    // to its TypedUnit by file+line-span, and a unit built from a narrow
    // evidence signal (here, WebUtilities' unit spans exactly its one
    // security-control evidence line) doesn't necessarily cover every
    // method's own line. Reparenting the TARGET the same way as the source
    // fixes it at the source of the ambiguity rather than patching the
    // line-span matcher itself.
    const enclosingTarget = enclosingClassByMember.get(e.target);
    if (enclosingTarget) e.target = enclosingTarget;
  }
}

/**
 * ONE CodeGraph index covering every given package root — the cross-package
 * structural-backbone source (replaces runGraphifyPass). For a single root
 * this indexes that root directly (unchanged CodeGraph behavior); for
 * multiple roots this indexes their common ancestor with every unrelated
 * top-level sibling excluded.
 */
export async function runCodegraphCrossrootPass(packageRoots: string[]): Promise<CrossPackageGraphRun> {
  const absRoots = packageRoots.map((r) => path.resolve(r));
  const scanRoot = absRoots.length === 1 ? absRoots[0] : computeCommonAncestor(absRoots);

  if (absRoots.length > 1) {
    const exclude = computeExcludePatterns(scanRoot, absRoots);
    fs.writeFileSync(path.join(scanRoot, 'codegraph.json'), JSON.stringify({ exclude }, null, 2));
  }

  const codegraphDir = path.join(scanRoot, '.codegraph');
  const alreadyInitialized = fs.existsSync(codegraphDir);
  const cg = alreadyInitialized ? await CodeGraph.open(scanRoot, { sync: true }) : await CodeGraph.init(scanRoot, { index: true });

  const nodes: CrossPackageNode[] = [];
  const edges: CrossPackageEdge[] = [];

  for (const file of cg.getFiles()) {
    // cg.getNodesInFile() already includes CodeGraph's own real file-kind
    // node for every source file (confirmed empirically: id
    // `file:<filePath>`, present for every file with a NodeKind other than
    // pure-manifest/YAML), whose own getOutgoingEdges below already yields
    // real `contains` edges to every class/interface/enum it declares — so
    // no separate synthetic file node or file->class edge is needed here.
    // An earlier version pushed both manually; that duplicated the SAME
    // node/edge CodeGraph already provides (real regression found running
    // this against a real fixture: duplicate `contains` edges produced two
    // persistence units with the same id for one class, caught by the "no
    // duplicate unique-id" check) — this loop only walks what's real.
    const fileNodes = cg.getNodesInFile(file.path);
    for (const n of fileNodes) {
      nodes.push({
        id: n.id,
        label: n.name,
        file_type: n.kind,
        source_file: n.filePath,
        source_location: `L${n.startLine}`,
        _origin: 'codegraph',
      });

      // A `namespace` node's own outgoing edges are already re-parented onto
      // its containing file by expandOutgoingEdges above (called once, from
      // the file's own node) — processing them again here from the
      // namespace's own id would re-emit the same facts a second time with
      // an unflattened source, the exact duplicate-edge regression class
      // already found and fixed once in this file (see the block comment
      // above cg.getNodesInFile).
      if (n.kind === 'namespace') continue;

      for (const e of expandOutgoingEdges(cg, n.id)) {
        const targetNode = cg.getNode(e.target);
        // CodeGraph only emits a semantic `imports` EDGE for imports it can
        // resolve to a file inside the index — a third-party/external
        // library import (e.g. `sqlalchemy`) is only ever reachable via the
        // file's `contains` edge to its `import`-kind child node, with no
        // separate resolved edge. Graphify's own `imports`/`imports_from`
        // relation covered BOTH cases (resolved or not) — the persistence/
        // messaging/outbound-http detectors filter on `relation === 'imports'`
        // expecting exactly that flattened semantics (real gap found running
        // this against a real fixture: `sqlalchemy` import silently
        // unreachable without this relabel). Real intra-project `imports`
        // edges CodeGraph does give natively pass through unchanged below.
        const isUnresolvedImport = e.kind === 'contains' && targetNode?.kind === 'import';
        const relation = e.kind === 'contains' && targetNode?.kind === 'method' ? 'method' : isUnresolvedImport ? 'imports' : e.kind;
        // Consumers match a library import via `libraries.has(edge.target)`
        // — Graphify's own convention for an external/unresolved symbol was
        // to use the bare name AS the node id (no separate definition node
        // exists for a third-party library). CodeGraph always uses an
        // opaque hash id, even for these import-kind child nodes, so the
        // literal id never matches a catalogued library name. Substituting
        // the import node's real `name` (e.g. "sqlalchemy") as the edge's
        // target ONLY for this unresolved-import case reproduces that exact
        // matching convention; every other edge (including a REAL resolved
        // intra-project import, which already targets a real, navigable
        // node id) is left untouched.
        const target = isUnresolvedImport && targetNode ? targetNode.name : e.target;
        // A plain `contains` edge carries no `.line` (only a REAL semantic
        // edge does) — for the unresolved-import case above, the import
        // NODE's own real `startLine` is the actual import-statement line
        // (needed by java-import-resolver.ts's resolveJavaImportPackage,
        // which re-reads the source file at this exact line to recover the
        // qualified package name); falling back to the containing node's
        // startLine instead (real bug found running this against a real
        // fixture) silently pointed Java resolution at the wrong line —
        // usually line 1, a license header or package declaration, so the
        // re-read import statement never matched anything.
        const location = e.line ?? (isUnresolvedImport && targetNode ? targetNode.startLine : n.startLine);
        edges.push({
          source: e.source,
          target,
          relation,
          context: typeof e.metadata?.resolvedBy === 'string' ? e.metadata.resolvedBy : '',
          confidence: typeof e.metadata?.confidence === 'number' ? String(e.metadata.confidence) : 'EXTRACTED',
          source_file: n.filePath,
          source_location: `L${location}`,
          weight: 1,
          _origin: 'codegraph',
        });
      }
    }
  }

  reparentMemberEdgesToEnclosingClass(nodes, edges);
  emitGenericTypeArgumentReferences(scanRoot, nodes, edges);

  const resolveRoot = (sourceFile: string): { root: string; relativeFilePath: string } | undefined => {
    const absPath = path.resolve(scanRoot, sourceFile);
    for (const absRoot of absRoots) {
      if (absPath === absRoot || absPath.startsWith(absRoot + path.sep)) {
        return { root: absRoot, relativeFilePath: path.relative(absRoot, absPath) };
      }
    }
    return undefined;
  };

  return { graph: { nodes, edges }, resolveRoot };
}

const JAVA_GENERIC_TYPE_ARG = /<([^<>]+)>/g;

function extractGenericTypeArgNames(declarationText: string): string[] {
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  JAVA_GENERIC_TYPE_ARG.lastIndex = 0;
  while ((m = JAVA_GENERIC_TYPE_ARG.exec(declarationText))) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/[\s<]/)[0];
      if (/^[A-Z][A-Za-z0-9_]*$/.test(name)) names.add(name);
    }
  }
  return [...names];
}

/**
 * Real, evidenced gap (a reference Java/JAX-RS banking platform's `ChargeRepository extends
 * JpaRepository<Charge, Long>`): CodeGraph emits NO `extends` edge at all
 * when the direct supertype is unresolvable (an external library type like
 * Spring Data's `JpaRepository`) — confirmed by reading `getOutgoingEdges`
 * directly for a real interface node: zero edges beyond its own method
 * containment. Graphify's simpler, naive-scan model surfaced the generic
 * TYPE ARGUMENT (`Charge`) as a reference regardless of whether the direct
 * supertype itself resolved, and downstream detection (spring-data-
 * repository -> entity relationships) depends on exactly that signal. Fixed
 * the same way this codebase already handles a construct CodeGraph's typed
 * extraction doesn't natively reach (codegraph-provider.ts's
 * extractLiteralArgument for JAX-RS decorator arguments,
 * java-import-resolver.ts's resolveJavaImportPackage): read the real
 * declaration line(s) back from source and extract what the type system
 * itself doesn't give an edge for. Java-only (the only evidenced language);
 * scoped to class/interface declarations whose generic type argument name
 * matches a REAL class/interface/enum elsewhere in this same run — never a
 * fabricated edge to a name with no real definition.
 */
function emitGenericTypeArgumentReferences(scanRoot: string, nodes: CrossPackageNode[], edges: CrossPackageEdge[]): void {
  const typeNodesByName = new Map<string, CrossPackageNode[]>();
  for (const n of nodes) {
    if (n.file_type === 'class' || n.file_type === 'interface' || n.file_type === 'enum') {
      if (!typeNodesByName.has(n.label)) typeNodesByName.set(n.label, []);
      typeNodesByName.get(n.label)!.push(n);
    }
  }

  const fileLineCache = new Map<string, string[]>();
  for (const n of nodes) {
    if ((n.file_type !== 'class' && n.file_type !== 'interface') || !n.source_file.endsWith('.java')) continue;
    const startLine = parseSourceLocation(n.source_location);
    if (!startLine) continue;

    const absPath = path.resolve(scanRoot, n.source_file);
    let lines = fileLineCache.get(absPath);
    if (!lines) {
      try {
        lines = fs.readFileSync(absPath, 'utf8').split('\n');
      } catch {
        continue;
      }
      fileLineCache.set(absPath, lines);
    }

    // The declaration (`class X extends Y<Z> {`) may wrap across a few
    // lines before its opening brace — a small, bounded window, not the
    // whole file.
    const declaration = lines
      .slice(startLine - 1, startLine + 4)
      .join(' ')
      .split('{')[0];
    if (!/\b(extends|implements)\b/.test(declaration)) continue;

    for (const typeArgName of extractGenericTypeArgNames(declaration)) {
      if (typeArgName === n.label) continue; // never a self-edge
      for (const target of typeNodesByName.get(typeArgName) ?? []) {
        edges.push({
          source: n.id,
          target: target.id,
          relation: 'references',
          context: 'generic-type-argument',
          confidence: 'EXTRACTED',
          source_file: n.source_file,
          source_location: n.source_location,
          weight: 1,
          _origin: 'codegraph',
        });
      }
    }
  }
}
