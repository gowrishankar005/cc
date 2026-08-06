import { NativeRouteFact, DecoratorFact } from '../scanner/codegraph-provider';
import { SignalCatalogue, findRule } from '../rules/rule-schema';
import { Evidence, TypedUnit, IgnoredItem } from '../types/typed-facts';
import { ignoreUnknownSignal } from './ignored-items';
import { scoreConfidence } from './confidence-scorer';

/**
 * requirements v0.6 §3 Slice-1 table, now data-driven off rules/signal-catalogue.yml
 * instead of hardcoded. Groups evidence by file (Slice 1 granularity: one
 * Flask/FastAPI/NestJS entrypoint file == one service unit) and looks every
 * raw signal up in the catalogue. A signal with no matching rule is logged
 * to ignoredItems (INSUFFICIENT_EVIDENCE) instead of silently dropped —
 * this log is exactly what rules/suggest-rules.ts consumes offline later.
 */
export function mapSignalsToUnits(
  nativeRoutes: NativeRouteFact[],
  decoratorFacts: DecoratorFact[],
  catalogue: SignalCatalogue
): { units: TypedUnit[]; ignoredItems: IgnoredItem[] } {
  const evidenceByFile = new Map<string, Evidence[]>();
  const linesByFile = new Map<string, { start: number; end: number }>();
  // Which CALM node-type each file's evidence points at, per rule.calmNodeType
  // (catalogue-driven, not the hardcoded `kind: 'service'` this function used
  // to assign unconditionally — a real bug this Fineract run surfaced: a bare
  // JPA @Entity class was being typed 'service' because nothing here ever
  // read the matched rule's calmNodeType field at all). 'service' wins ties
  // (an HTTP-entry-point signal is decisive over a co-located persistence
  // annotation, though that combination hasn't been seen in practice).
  const nodeTypeVotesByFile = new Map<string, Set<'service' | 'database'>>();
  const ignoredItems: IgnoredItem[] = [];

  const record = (filePath: string, line: number, ev: Evidence, calmNodeType: 'service' | 'database') => {
    if (!evidenceByFile.has(filePath)) evidenceByFile.set(filePath, []);
    evidenceByFile.get(filePath)!.push(ev);
    const span = linesByFile.get(filePath) ?? { start: line, end: line };
    span.start = Math.min(span.start, line);
    span.end = Math.max(span.end, line);
    linesByFile.set(filePath, span);
    if (!nodeTypeVotesByFile.has(filePath)) nodeTypeVotesByFile.set(filePath, new Set());
    nodeTypeVotesByFile.get(filePath)!.add(calmNodeType);
  };

  // Native routes are already framework-confirmed by CodeGraph's own resolver
  // (kind === 'route' only exists because Flask/FastAPI/NestJS detect() fired
  // and matched a real route pattern) — there's no separate "which framework
  // said this" name to look up in the catalogue; the route.name field is the
  // HTTP method+path (e.g. "GET /users"), not a decorator/framework token.
  // Every native route is HTTP-entry-point evidence at the catalogue's
  // standard weight for that category.
  const nativeRouteWeight = catalogue.rules.find((r) => r.matchSource === 'native-route')?.weight ?? 40;
  for (const route of nativeRoutes) {
    const ref = `${route.filePath}:${route.startLine}`;
    record(
      route.filePath,
      route.startLine,
      {
        signal: route.name,
        source: 'native-route',
        category: 'http-entry-point', // a native `route` node from CodeGraph IS an entry point by definition
        weight: nativeRouteWeight,
        ref,
      },
      'service'
    );
  }

  for (const dec of decoratorFacts) {
    const rule = findRule(catalogue, dec.referenceName, 'decorator', dec.language);
    const ref = `${dec.filePath}:${dec.line}`;
    if (!rule) {
      ignoredItems.push(ignoreUnknownSignal(ref, dec.referenceName));
      continue;
    }
    record(
      dec.filePath,
      dec.line,
      {
        signal: dec.referenceName,
        source: 'decorator',
        category: rule.category, // catalogue-driven, not a hardcoded signal-name check downstream
        weight: rule.weight,
        ref,
      },
      rule.calmNodeType
    );
  }

  const units: TypedUnit[] = [];
  for (const [filePath, evidence] of evidenceByFile) {
    const span = linesByFile.get(filePath)!;
    const confidence = scoreConfidence(evidence);
    const votes = nodeTypeVotesByFile.get(filePath) ?? new Set();
    const kind = votes.has('service') ? 'service' : votes.has('database') ? 'database' : 'service';
    units.push({
      id: filePath,
      kind,
      name: filePath,
      filePath,
      startLine: span.start,
      endLine: span.end,
      evidence,
      confidence,
    });
  }

  return { units, ignoredItems };
}
