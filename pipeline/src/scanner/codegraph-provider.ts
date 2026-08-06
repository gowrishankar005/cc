import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CodeGraph } = require('@colbymchenry/codegraph');
import { NativeRouteFact, DecoratorFact, StructuralEngine } from './structural-engine';

// Re-exported for backward compatibility — the neutral definitions now live
// in structural-engine.ts (the vendor-agnostic contract), not here.
export type { NativeRouteFact, DecoratorFact };

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.py': 'python',
  '.ts': 'typescript',
  '.java': 'java',
};

function languageForFile(relativeFilePath: string): string | undefined {
  const ext = path.extname(relativeFilePath);
  return EXTENSION_TO_LANGUAGE[ext];
}

/**
 * Indexes ONE package root with CodeGraph and pulls native `route` nodes.
 * Respects the detect() gate (requirements v0.6 §4): must be called with the
 * exact package root that owns the relevant manifest (pyproject.toml/package.json),
 * not a parent directory.
 */
export async function indexPackage(packageRoot: string): Promise<{ cg: any; nativeRoutes: NativeRouteFact[] }> {
  const codegraphDir = path.join(packageRoot, '.codegraph');
  const alreadyInitialized = fs.existsSync(codegraphDir);

  const cg = alreadyInitialized
    ? await CodeGraph.open(packageRoot, { sync: true })
    : await CodeGraph.init(packageRoot, { index: true });

  const routeNodes = cg.getNodesByKind('route');
  const nativeRoutes: NativeRouteFact[] = routeNodes.map((n: any) => ({
    filePath: n.filePath,
    startLine: n.startLine,
    name: n.name,
    qualifiedName: n.qualifiedName,
  }));

  return { cg, nativeRoutes };
}

/**
 * extractFromSource()'s UnresolvedReference has NO field for a decorator's own
 * argument (confirmed by reading node_modules/@colbymchenry/codegraph/dist/types.d.ts
 * directly, then verified empirically — docs/spikes/fineract-route-assembly-spike/).
 * It gives the annotation NAME and its exact line, never the string inside the
 * parens. For JAX-RS-style path assembly (class-level @Path + method-level
 * @Path composing into one route), that argument is exactly the missing piece
 * — so it's read back from the source line itself, scoped to that one line,
 * not a general annotation parser. Verified 19/19 real routes across 3 real
 * Fineract resource files (ChargesApiResource, SchedulerApiResource,
 * DelinquencyApiResource) using exactly this mechanism.
 */
function extractLiteralArgument(sourceLines: string[], line: number, annotationName: string): string | undefined {
  const lineText = sourceLines[line - 1] ?? '';
  const match = lineText.match(new RegExp(`@${annotationName}\\s*\\(\\s*"([^"]*)"\\s*\\)`));
  return match ? match[1] : undefined;
}

/**
 * The RESOLVED mechanism (requirements v0.6 §5 / docs/spikes/CodeGraph_Annotation_Extraction_Reconciliation_Spike.md).
 * Do NOT use node.decorators or persisted decorates edges — both were falsified.
 * extractFromSource() is file-scoped, gate-free, and independent of indexing/resolution.
 */
export function extractDecoratorFacts(cg: any, packageRoot: string, relativeFilePath: string): DecoratorFact[] {
  const absPath = path.join(packageRoot, relativeFilePath);
  const source = fs.readFileSync(absPath, 'utf8');
  const sourceLines = source.split('\n');
  const result = cg.extractFromSource(relativeFilePath, source);

  const nodeKindById = new Map<string, 'class' | 'method' | 'other'>();
  for (const n of result.nodes) {
    if (n.kind === 'class') nodeKindById.set(n.id, 'class');
    else if (n.kind === 'method') nodeKindById.set(n.id, 'method');
  }

  return result.unresolvedReferences
    .filter((r: any) => r.referenceKind === 'decorates')
    .map((r: any) => ({
      referenceName: r.referenceName,
      fromNodeId: r.fromNodeId,
      filePath: relativeFilePath,
      line: r.line,
      argument: extractLiteralArgument(sourceLines, r.line, r.referenceName),
      fromNodeKind: nodeKindById.get(r.fromNodeId) ?? 'other',
      language: languageForFile(relativeFilePath),
    }));
}

/** Enumerates source files CodeGraph indexed for this package, for the decorator pass. */
export function listIndexedFiles(cg: any, extensions: string[]): string[] {
  const files: any[] = cg.getFiles ? cg.getFiles() : [];
  return files
    .map((f) => f.path)
    .filter((p: string) => extensions.some((ext) => p.endsWith(ext)));
}

/**
 * CodeGraph's implementation of the neutral StructuralEngine contract
 * (structural-engine.ts) — the vendor-risk-isolation fix: run-slice.ts
 * depends on this object's shape, not on codegraph-provider.ts's specific
 * named exports, so a future fallback engine (tree-sitter, scip-java, or
 * Graphify-as-fallback per the original tool-comparison spike's own
 * recommendation) is a second implementation of the same interface, swapped
 * in at one call site — not a change to every consumer. `handle` here is
 * just `cg` under the interface's opaque naming; internal-only, never
 * exposed to callers as a CodeGraph-specific type.
 */
export const codeGraphEngine: StructuralEngine = {
  indexPackage: async (packageRoot: string) => {
    const { cg, nativeRoutes } = await indexPackage(packageRoot);
    return { handle: cg, nativeRoutes };
  },
  extractDecoratorFacts: (handle: unknown, packageRoot: string, relativeFilePath: string) =>
    extractDecoratorFacts(handle, packageRoot, relativeFilePath),
  listIndexedFiles: (handle: unknown, extensions: string[]) => listIndexedFiles(handle, extensions),
};
