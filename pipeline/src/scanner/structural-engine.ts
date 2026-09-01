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
  fromNodeName?: string; // the real class/method name (CodeGraph's own Node.name), used to derive a human-readable TypedUnit.name instead of the raw file path
  language?: string;
}

/**
 * A call-SITE fact (e.g. Java's
 * `context.authenticatedUser().validateHasReadPermission(RESOURCE)`,
 * Python's `jwt.decode(token, ...)`), same shape as DecoratorFact
 * deliberately reused rather than duplicated: both come from the same
 * extractFromSource() API, differ only in which `referenceKind` was
 * filtered for (`decorates` vs `calls`), and both flow through the same
 * signal-catalogue.yml matching / Evidence construction path downstream —
 * only `matchSource`/`Evidence.source` distinguish them from here on.
 * `argument` here is the call's raw parenthesized TEXT (e.g.
 * "RESOURCE_NAME_FOR_PERMISSIONS"), never a resolved constant value — same
 * same-line-only, no-cross-file-resolution scoping limit
 * extractLiteralArgument() already holds for decorators.
 */
export type CallFact = DecoratorFact;

/**
 * A field/variable TYPE reference (e.g. `private
 * KafkaTemplate<Long, byte[]> externalEventsKafkaTemplate;`), from the same
 * extractFromSource() API, filtered on referenceKind: 'references' instead
 * of 'decorates'/'calls'. Real evidence this was built for: a reference Java/JAX-RS banking platform's
 * KafkaExternalEventProducer.java — messaging-detection-catalogue.yml's own
 * "typed-field-producer" strategy was named `not-implemented` because no
 * mechanism to detect a class's field TYPE (as opposed to a decorator or a
 * call) existed; this closes that specific, previously-honestly-disclosed
 * gap. Same DecoratorFact shape reused deliberately, same reasons as CallFact.
 */
export type TypeReferenceFact = DecoratorFact;

/**
 * An `extends`/`implements` supertype reference (e.g.
 * `interface ChargeRepository extends JpaRepository<Charge, Long>`), from
 * the same extractFromSource() API, filtered on referenceKind: 'extends'
 * instead of 'references'/'calls'/'decorates'. Closes
 * persistence-detection-catalogue.yml's `spring-data-repository` strategy,
 * previously `status: not-implemented`. `referenceName` includes the
 * generic type argument text (e.g. "JpaRepository<Charge, Long>") — the
 * existing word-boundary catalogue matcher (findRule) still matches the
 * base type name correctly since `<` is a non-word character.
 */
export type ExtendsFact = DecoratorFact;

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
  /** Call-site facts (referenceKind: 'calls'), same handle/scoping contract as extractDecoratorFacts. */
  extractCallFacts(handle: unknown, packageRoot: string, relativeFilePath: string): CallFact[];
  /** Field/variable type-reference facts (referenceKind: 'references'), same handle/scoping contract. */
  extractTypeReferenceFacts(handle: unknown, packageRoot: string, relativeFilePath: string): TypeReferenceFact[];
  /** Extends/implements supertype facts (referenceKind: 'extends'), same handle/scoping contract. */
  extractExtendsFacts(handle: unknown, packageRoot: string, relativeFilePath: string): ExtendsFact[];
  listIndexedFiles(handle: unknown, extensions: string[]): string[];
}
