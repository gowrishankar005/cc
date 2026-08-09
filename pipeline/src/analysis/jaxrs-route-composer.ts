import { DecoratorFact } from '../scanner/structural-engine';

/**
 * CodeGraph natively types routes only for Spring MVC/Play — confirmed
 * (resolution/frameworks/index.js only registers those two Java frameworks).
 * JAX-RS (@Path/@GET/etc.) has no native `route` typing at all, so unlike
 * Spring MVC there is no ready-made full-path string anywhere — it has to be
 * composed from class-level + method-level @Path decorator facts, using the
 * literal-argument extraction added to codegraph-provider.ts this session.
 *
 * Verified against 3 real Fineract JAX-RS resources (docs/spikes/fineract-route-assembly-spike/):
 * 19/19 real routes correctly assembled, including the hardest case found —
 * a method-level @Path literal ("buckets/{delinquencyBucketId}") reused
 * verbatim across 3 different HTTP-verb methods in the same class, correctly
 * disambiguated by verb each time, not by path alone.
 */

const HTTP_VERBS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);

export interface JaxRsComposeResult {
  /** Synthetic decorator facts, one per composed route: referenceName = "GET /v1/charges/{chargeId}". */
  composed: DecoratorFact[];
  /** The raw per-annotation facts (HTTP-verb + Path) that were consumed into a composed route — filter these out of the main decoratorFacts list to avoid double-evidencing the same route once raw, once composed (the same precedence discipline already applied to CodeGraph-native vs. decorator-fallback routes for NestJS). */
  consumed: Set<DecoratorFact>;
}

/**
 * Scoped to ONE file's decorator facts at a time (called per-file in
 * run-slice.ts, same granularity as extractDecoratorFacts) — deliberately not
 * run across a whole package's facts at once, to avoid any risk of pairing a
 * class in one file with methods in another if node ids ever collided.
 */
export function composeJaxRsRoutes(fileDecoratorFacts: DecoratorFact[]): JaxRsComposeResult {
  const byNode = new Map<string, DecoratorFact[]>();
  for (const fact of fileDecoratorFacts) {
    if (!byNode.has(fact.fromNodeId)) byNode.set(fact.fromNodeId, []);
    byNode.get(fact.fromNodeId)!.push(fact);
  }

  const consumed = new Set<DecoratorFact>();

  // T-TC2-1 (B-jaxrs-composer-class-scoping) — real, confirmed bug, fixed.
  // Previously took the FIRST class-level @Path found anywhere in the file
  // and applied it, unconditionally, to every method in the file — correct
  // only for the real, common "one resource class per file" production
  // shape this was originally proven against (19/19 real Fineract routes),
  // but silently wrong the moment a file has 2+ classes each carrying their
  // own @Path (rare in production JAX-RS, common in test-fixture files —
  // confirmed via a real Fineract test with 5 nested resource classes, all
  // 5 methods wrongly composed to the first class's path, at confidence
  // 100). Fixed: each method resolves to the NEAREST PRECEDING class-level
  // @Path by source line, not the file's first one — correct for standard
  // top-to-bottom Java layout including nested classes, and reproduces the
  // exact original behavior when only one class-level @Path exists in the
  // file (the single-class production case, still verified below). A
  // method with no class-level @Path preceding it anywhere (a genuinely
  // malformed/unusual case) falls back to method-path-only or no compose —
  // never guesses the wrong class's path, which the old code effectively
  // did for this case too.
  const classPathFacts = fileDecoratorFacts
    .filter((f) => f.fromNodeKind === 'class' && f.referenceName === 'Path' && f.argument !== undefined)
    .sort((a, b) => a.line - b.line);
  for (const f of classPathFacts) consumed.add(f);

  const resolveClassPath = (methodLine: number): string | undefined => {
    let resolved: string | undefined;
    for (const f of classPathFacts) {
      if (f.line > methodLine) break;
      resolved = f.argument;
    }
    return resolved;
  };

  const composed: DecoratorFact[] = [];
  for (const facts of byNode.values()) {
    const httpFact = facts.find((f) => f.fromNodeKind === 'method' && HTTP_VERBS.has(f.referenceName));
    if (!httpFact) continue;

    const methodPathFact = facts.find((f) => f.fromNodeKind === 'method' && f.referenceName === 'Path');
    const methodPath = methodPathFact?.argument;
    const classPath = resolveClassPath(httpFact.line);
    const fullPath = [classPath, methodPath].filter(Boolean).join('/');
    if (!fullPath) continue; // no @Path anywhere at all — not a reachable JAX-RS route, don't guess one

    composed.push({
      referenceName: `${httpFact.referenceName} ${fullPath}`,
      fromNodeId: httpFact.fromNodeId,
      filePath: httpFact.filePath,
      line: httpFact.line,
      fromNodeKind: 'method',
      language: httpFact.language,
    });

    consumed.add(httpFact);
    if (methodPathFact) consumed.add(methodPathFact);
  }

  return { composed, consumed };
}
