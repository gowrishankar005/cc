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

  // Slice 1/2 granularity: one JAX-RS resource class per file, so at most one
  // class-level @Path applies to every method in the file.
  let classPath: string | undefined;
  for (const facts of byNode.values()) {
    const classPathFact = facts.find((f) => f.fromNodeKind === 'class' && f.referenceName === 'Path' && f.argument !== undefined);
    if (classPathFact) {
      classPath = classPathFact.argument;
      consumed.add(classPathFact);
      break;
    }
  }

  const composed: DecoratorFact[] = [];
  for (const facts of byNode.values()) {
    const httpFact = facts.find((f) => f.fromNodeKind === 'method' && HTTP_VERBS.has(f.referenceName));
    if (!httpFact) continue;

    const methodPathFact = facts.find((f) => f.fromNodeKind === 'method' && f.referenceName === 'Path');
    const methodPath = methodPathFact?.argument;
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
