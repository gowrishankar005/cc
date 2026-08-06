/**
 * The neutral, engine-agnostic contract every structural-extraction engine
 * must satisfy — no dependency on CodeGraph or any other specific vendor
 * SDK. Named as a real risk since the original tool-comparison spike
 * (single-vendor CodeGraph coupling, no coded fallback), never actually
 * isolated until now. `codegraph-provider.ts` is the one real implementation
 * today (`codeGraphEngine`); a future engine (tree-sitter, scip-java, or
 * Graphify-as-fallback per the original spike's own recommendation) would
 * implement this same interface and be swapped in at the one call site in
 * run-slice.ts, without touching signal-mapper.ts, jaxrs-route-composer.ts,
 * or any other consumer — that's the actual test of "isolated," not an
 * assertion.
 *
 * Not a promise that every future engine fits this shape without change —
 * CodeGraph's own SDK is genuinely richer than this narrow slice. This is
 * the minimum surface every current consumer actually uses, extracted
 * deliberately narrow rather than speculatively broad (Simplicity First) —
 * broadened only when a second real engine needs more.
 */

export interface NativeRouteFact {
  filePath: string;
  startLine: number;
  name: string; // e.g. "GET /balances/{accountId}"
  qualifiedName: string;
}

export interface DecoratorFact {
  referenceName: string; // raw decorator/annotation name, e.g. "route", "Controller"
  fromNodeId: string;
  filePath: string;
  line: number;
  argument?: string; // decorator's own quoted string literal, e.g. "{chargeId}" for @Path("{chargeId}")
  fromNodeKind?: 'class' | 'method' | 'other';
  language?: string;
}

/**
 * `handle` is deliberately opaque (`unknown`) — whatever internal state an
 * engine needs between its own `indexPackage`/`extractDecoratorFacts`/
 * `listIndexedFiles` calls, consumers never introspect it, only pass it
 * through. This is what actually keeps run-slice.ts engine-agnostic, not a
 * documentation convention.
 */
export interface StructuralEngine {
  indexPackage(packageRoot: string): Promise<{ handle: unknown; nativeRoutes: NativeRouteFact[] }>;
  extractDecoratorFacts(handle: unknown, packageRoot: string, relativeFilePath: string): DecoratorFact[];
  listIndexedFiles(handle: unknown, extensions: string[]): string[];
}
