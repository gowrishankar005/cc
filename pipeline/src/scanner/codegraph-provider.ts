import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CodeGraph } = require('@colbymchenry/codegraph');
import { NativeRouteFact, DecoratorFact, CallFact, TypeReferenceFact, ExtendsFact, StructuralEngine } from './structural-engine';

// Re-exported for backward compatibility — the neutral definitions now live
// in structural-engine.ts (the vendor-agnostic contract), not here.
export type { NativeRouteFact, DecoratorFact, CallFact, TypeReferenceFact, ExtendsFact };

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
 * directly, then verified empirically). It gives the annotation NAME and its
 * exact line, never the string inside the parens. For JAX-RS-style path
 * assembly (class-level @Path + method-level @Path composing into one route),
 * that argument is exactly the missing piece — so it's read back from the
 * source line itself, scoped to that one line, not a general annotation
 * parser. Verified 19/19 real routes across 3 real resource files
 * (ChargesApiResource, SchedulerApiResource, DelinquencyApiResource) from a
 * reference Java/JAX-RS banking platform, using exactly this mechanism.
 */
function extractLiteralArgument(sourceLines: string[], line: number, annotationName: string): string | undefined {
  const lineText = sourceLines[line - 1] ?? '';
  const match = lineText.match(new RegExp(`@${annotationName}\\s*\\(\\s*"([^"]*)"\\s*\\)`));
  return match ? match[1] : undefined;
}

/**
 * The call-site sibling of extractLiteralArgument: extracts a call's raw
 * parenthesized TEXT, e.g. "RESOURCE_NAME_FOR_PERMISSIONS" for
 * `validateHasReadPermission(RESOURCE_NAME_FOR_PERMISSIONS)`. Deliberately
 * the last-open-paren-to-last-close-paren span on the line (not a full
 * balanced-parens parser) — same-line-only scoping, same honest limit
 * extractLiteralArgument already holds; never resolves an identifier to its
 * constant VALUE (would need cross-file/whole-file resolution this
 * mechanism doesn't do) — the raw source text itself is the expression
 * being captured, not an inferred value.
 */
function extractCallArgumentText(sourceLines: string[], line: number, calledMethodName: string): string | undefined {
  const lineText = sourceLines[line - 1] ?? '';
  const methodIdx = lineText.lastIndexOf(calledMethodName);
  if (methodIdx === -1) return undefined;
  const openParen = lineText.indexOf('(', methodIdx + calledMethodName.length);
  const closeParen = lineText.lastIndexOf(')');
  if (openParen === -1 || closeParen === -1 || closeParen <= openParen) return undefined;
  const arg = lineText.slice(openParen + 1, closeParen).trim();
  return arg.length > 0 ? arg : undefined;
}

/**
 * The resolved decorator-fact extraction mechanism.
 * Do NOT use node.decorators or persisted decorates edges — both were falsified.
 * extractFromSource() is file-scoped, gate-free, and independent of indexing/resolution.
 */
export function extractDecoratorFacts(cg: any, packageRoot: string, relativeFilePath: string): DecoratorFact[] {
  const absPath = path.join(packageRoot, relativeFilePath);
  const source = fs.readFileSync(absPath, 'utf8');
  const sourceLines = source.split('\n');
  const result = cg.extractFromSource(relativeFilePath, source);

  const nodeKindById = new Map<string, 'class' | 'method' | 'other'>();
  const nodeNameById = new Map<string, string>();
  for (const n of result.nodes) {
    if (n.kind === 'class') nodeKindById.set(n.id, 'class');
    else if (n.kind === 'method') nodeKindById.set(n.id, 'method');
    if (n.name) nodeNameById.set(n.id, n.name);
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
      fromNodeName: nodeNameById.get(r.fromNodeId),
      language: languageForFile(relativeFilePath),
    }));
}

/**
 * AREC Wave 3 T-D1 — the call-site sibling of extractDecoratorFacts(),
 * filtering the SAME extractFromSource() result for `referenceKind ===
 * 'calls'` instead of 'decorates'. Verified real (not assumed) against two
 * fixtures before building the catalogue rows: a reference Java/JAX-RS banking platform's
 * ChargesApiResource.java produces
 * "context.authenticatedUser().validateHasReadPermission" at the correct
 * lines (84/101/129); the lab py-jwt-gateway fixture's auth_gateway.py
 * produces "jwt.decode" at line 14 — both via this exact mechanism, no new
 * extraction API. Not pre-filtered by name here (mirrors
 * extractDecoratorFacts's own "return everything, let the catalogue decide"
 * convention) — every call CodeGraph sees becomes a CallFact, most land as
 * unmapped-signal ignored items, same as most decorators do today.
 *
 * Real, TS-specific finding caught by running this against the checked-in
 * NestJS fixture (not assumed safe): `@Controller('users')`/`@Get()` are
 * ALSO reported as `referenceKind: 'calls'` at the SAME (referenceName,
 * line) as their `decorates` entry — TypeScript decorator syntax IS a
 * function call at the AST level, unlike Java annotations or Python
 * decorators. Left unfiltered, this would both flood ignoredItems with
 * exact duplicates of already-matched decorator signals AND — the more
 * serious risk — double-count evidence weight for any future TS security
 * decorator whose name happens to also match a call-site catalogue row.
 * Fixed generically (no TS-specific code path): drop any `calls` entry that
 * shares an exact (referenceName, line) with a `decorates` entry from the
 * SAME extraction — the decorator path already captured it correctly.
 */
export function extractCallFacts(cg: any, packageRoot: string, relativeFilePath: string): CallFact[] {
  const absPath = path.join(packageRoot, relativeFilePath);
  const source = fs.readFileSync(absPath, 'utf8');
  const sourceLines = source.split('\n');
  const result = cg.extractFromSource(relativeFilePath, source);

  const nodeKindById = new Map<string, 'class' | 'method' | 'other'>();
  const nodeNameById = new Map<string, string>();
  for (const n of result.nodes) {
    if (n.kind === 'class') nodeKindById.set(n.id, 'class');
    else if (n.kind === 'method') nodeKindById.set(n.id, 'method');
    if (n.name) nodeNameById.set(n.id, n.name);
  }

  const decoratesKeys = new Set(
    result.unresolvedReferences.filter((r: any) => r.referenceKind === 'decorates').map((r: any) => `${r.referenceName}:${r.line}`)
  );

  return result.unresolvedReferences
    .filter((r: any) => r.referenceKind === 'calls' && !decoratesKeys.has(`${r.referenceName}:${r.line}`))
    .map((r: any) => {
      // referenceName can be a dotted call chain (e.g.
      // "context.authenticatedUser().validateHasReadPermission") — the
      // catalogue's word-boundary matching (findRule) already handles that
      // correctly (dots are non-word boundaries), but argument extraction
      // needs just the final method name to anchor on.
      const lastSegment = r.referenceName.split('.').pop() ?? r.referenceName;
      return {
        referenceName: r.referenceName,
        fromNodeId: r.fromNodeId,
        filePath: relativeFilePath,
        line: r.line,
        argument: extractCallArgumentText(sourceLines, r.line, lastSegment),
        fromNodeKind: nodeKindById.get(r.fromNodeId) ?? 'other',
        fromNodeName: nodeNameById.get(r.fromNodeId),
        language: languageForFile(relativeFilePath),
      };
    });
}

/**
 * AREC Wave 3 T-E1 — closes messaging-detection-catalogue.yml's
 * "typed-field-producer" gap (previously `status: not-implemented`,
 * honestly named as needing "call-based typed-field usage detection, a
 * mechanism this pipeline has never built"). Real evidence, verified via a
 * direct probe before writing the catalogue row: a reference Java/JAX-RS banking platform's
 * KafkaExternalEventProducer.java's `private KafkaTemplate<Long, byte[]>
 * externalEventsKafkaTemplate;` field produces a `referenceKind:
 * 'references'` entry with `referenceName: "KafkaTemplate"` — the field's
 * declared TYPE, not the field's own name (which is a reference Java/JAX-RS banking platform-specific,
 * "externalEventsKafkaTemplate" — matching on the TYPE name instead is what
 * keeps this catalogue-generic rather than tied to one variable-naming
 * convention). Deliberately does NOT also require finding a paired
 * `.send()` call in the same file — a KafkaTemplate-typed field is already
 * real, if weaker (import-only tier), evidence of producer capability, the
 * same tier persistence-detector.ts's driver-import strategy already uses
 * for the analogous "import alone, no call resolution" case.
 */
export function extractTypeReferenceFacts(cg: any, packageRoot: string, relativeFilePath: string): TypeReferenceFact[] {
  const absPath = path.join(packageRoot, relativeFilePath);
  const source = fs.readFileSync(absPath, 'utf8');
  const result = cg.extractFromSource(relativeFilePath, source);

  const nodeKindById = new Map<string, 'class' | 'method' | 'other'>();
  const nodeNameById = new Map<string, string>();
  for (const n of result.nodes) {
    if (n.kind === 'class') nodeKindById.set(n.id, 'class');
    else if (n.kind === 'method') nodeKindById.set(n.id, 'method');
    if (n.name) nodeNameById.set(n.id, n.name);
  }

  return result.unresolvedReferences
    .filter((r: any) => r.referenceKind === 'references')
    .map((r: any) => ({
      referenceName: r.referenceName,
      fromNodeId: r.fromNodeId,
      filePath: relativeFilePath,
      line: r.line,
      fromNodeKind: nodeKindById.get(r.fromNodeId) ?? 'other',
      fromNodeName: nodeNameById.get(r.fromNodeId),
      language: languageForFile(relativeFilePath),
    }));
}

/**
 * AREC Wave 3 T-E3 — closes persistence-detection-catalogue.yml's
 * `spring-data-repository` gap. Real evidence, verified via a direct probe
 * before writing the catalogue row: a reference Java/JAX-RS banking platform's `ChargeRepository.java`
 * (`interface ChargeRepository extends JpaRepository<Charge, Long>,
 * JpaSpecificationExecutor<Charge>`) produces two `referenceKind: 'extends'`
 * entries, `referenceName: "JpaRepository<Charge, Long>"` and
 * `"JpaSpecificationExecutor<Charge>"`, at the real `extends` clause line.
 *
 * Real,
 * empirically-verified finding: a Java `implements` clause (e.g.
 * `class TierService implements RequestHandler<...>`) produces its OWN
 * distinct `referenceKind: 'implements'`, NOT `'extends'` — confirmed by
 * calling `extractFromSource()` directly against a real Lambda-handler
 * fixture before writing this, not assumed by analogy to the extends case
 * above. Folded into the SAME extraction/evidence pipeline rather than a
 * parallel one — both are "supertype reference on a type declaration"
 * signals at the same abstraction level this project already treats
 * uniformly (e.g. `imports`/`references` in multi-hop-bridge-detector.ts);
 * a catalogue row for `RequestHandler` uses `matchSource: extends` like
 * any other extends-shaped signal, no new matchSource value needed.
 */
export function extractExtendsFacts(cg: any, packageRoot: string, relativeFilePath: string): ExtendsFact[] {
  const absPath = path.join(packageRoot, relativeFilePath);
  const source = fs.readFileSync(absPath, 'utf8');
  const result = cg.extractFromSource(relativeFilePath, source);

  const nodeKindById = new Map<string, 'class' | 'method' | 'other'>();
  const nodeNameById = new Map<string, string>();
  for (const n of result.nodes) {
    if (n.kind === 'class') nodeKindById.set(n.id, 'class');
    else if (n.kind === 'method') nodeKindById.set(n.id, 'method');
    if (n.name) nodeNameById.set(n.id, n.name);
  }

  return result.unresolvedReferences
    .filter((r: any) => r.referenceKind === 'extends' || r.referenceKind === 'implements')
    .map((r: any) => ({
      referenceName: r.referenceName,
      fromNodeId: r.fromNodeId,
      filePath: relativeFilePath,
      line: r.line,
      fromNodeKind: nodeKindById.get(r.fromNodeId) ?? 'other',
      fromNodeName: nodeNameById.get(r.fromNodeId),
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
  extractCallFacts: (handle: unknown, packageRoot: string, relativeFilePath: string) => extractCallFacts(handle, packageRoot, relativeFilePath),
  extractTypeReferenceFacts: (handle: unknown, packageRoot: string, relativeFilePath: string) => extractTypeReferenceFacts(handle, packageRoot, relativeFilePath),
  extractExtendsFacts: (handle: unknown, packageRoot: string, relativeFilePath: string) => extractExtendsFacts(handle, packageRoot, relativeFilePath),
  listIndexedFiles: (handle: unknown, extensions: string[]) => listIndexedFiles(handle, extensions),
};
