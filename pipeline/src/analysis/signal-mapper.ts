import { NativeRouteFact, DecoratorFact } from '../scanner/structural-engine';
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
  catalogue: SignalCatalogue,
  callFacts: DecoratorFact[] = [], // AREC Wave 3 T-D1 — optional/defaulted so every existing caller (tests, --from-facts paths) keeps compiling unchanged
  typeReferenceFacts: DecoratorFact[] = [], // AREC Wave 3 T-E1 — same reason
  extendsFacts: DecoratorFact[] = [] // AREC Wave 3 T-E3 — same reason
): { units: TypedUnit[]; ignoredItems: IgnoredItem[] } {
  const evidenceByFile = new Map<string, Evidence[]>();
  const linesByFile = new Map<string, { start: number; end: number }>();
  const ignoredItems: IgnoredItem[] = [];

  // Node kind is now decided once, at the end, directly from the CATEGORY
  // of a file's aggregated evidence (see the priority order below) — not
  // from a per-evidence rule.calmNodeType vote collected here. AREC Wave 3
  // T-D1 found the old per-evidence-vote design gave a wrong answer the
  // moment a real file had BOTH persistence AND security-control evidence
  // (Fineract's AppUser.java: a real @Entity that also calls
  // validateHasPermission() internally) — "service wins any tie" silently
  // discarded its persistence identity. `rule.calmNodeType` is no longer
  // read here as a result; still a valid catalogue field (not removed —
  // narrower cleanup than a catalogue-schema change), simply unconsumed by
  // this function now, same "specified but not currently exercised" status
  // interface-builder.ts's own SOURCE_PRECEDENCE already holds for
  // 'graphify-import'.
  const record = (filePath: string, line: number, ev: Evidence) => {
    if (!evidenceByFile.has(filePath)) evidenceByFile.set(filePath, []);
    evidenceByFile.get(filePath)!.push(ev);
    const span = linesByFile.get(filePath) ?? { start: line, end: line };
    span.start = Math.min(span.start, line);
    span.end = Math.max(span.end, line);
    linesByFile.set(filePath, span);
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
      }
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
        // AREC Wave 3 T-D2 (C-rich) — real gap found while wiring this
        // through for call facts: DecoratorFact has carried `argument`
        // since the original JAX-RS route-assembly work, but it was never
        // threaded into Evidence, so it never reached control-builder.ts
        // either (e.g. @PreAuthorize's own argument, when it has one).
        ...(dec.argument !== undefined ? { argument: dec.argument } : {}),
      }
    );
  }

  // AREC Wave 3 T-D1 (C-call) — SAME loop shape as decoratorFacts above,
  // deliberately: a call-site signal (source: 'call') is evidence exactly
  // like a decorator signal, just from a different extraction reference
  // kind. No pre-filtering by signal name here either — an unmatched call
  // lands in ignoredItems the same way an unmatched decorator does.
  for (const call of callFacts) {
    const rule = findRule(catalogue, call.referenceName, 'call', call.language);
    const ref = `${call.filePath}:${call.line}`;
    if (!rule) {
      ignoredItems.push(ignoreUnknownSignal(ref, call.referenceName));
      continue;
    }
    record(
      call.filePath,
      call.line,
      {
        signal: call.referenceName,
        source: 'call',
        category: rule.category,
        weight: rule.weight,
        ref,
        ...(call.argument !== undefined ? { argument: call.argument } : {}),
      }
    );
  }

  // AREC Wave 3 T-E1 — SAME loop shape again: a field-type signal (source:
  // 'field-type') is evidence exactly like a decorator/call signal, just
  // from CodeGraph's `referenceKind: 'references'` entries instead.
  for (const typeRef of typeReferenceFacts) {
    const rule = findRule(catalogue, typeRef.referenceName, 'field-type', typeRef.language);
    const ref = `${typeRef.filePath}:${typeRef.line}`;
    if (!rule) {
      ignoredItems.push(ignoreUnknownSignal(ref, typeRef.referenceName));
      continue;
    }
    record(
      typeRef.filePath,
      typeRef.line,
      {
        signal: typeRef.referenceName,
        source: 'field-type',
        category: rule.category,
        weight: rule.weight,
        ref,
      }
    );
  }

  // AREC Wave 3 T-E3 — SAME loop shape again: an extends signal (source:
  // 'extends') is evidence exactly like field-type/call/decorator signals,
  // just from CodeGraph's `referenceKind: 'extends'` entries.
  for (const ext of extendsFacts) {
    const rule = findRule(catalogue, ext.referenceName, 'extends', ext.language);
    const ref = `${ext.filePath}:${ext.line}`;
    if (!rule) {
      ignoredItems.push(ignoreUnknownSignal(ref, ext.referenceName));
      continue;
    }
    record(
      ext.filePath,
      ext.line,
      {
        signal: ext.referenceName,
        source: 'extends',
        category: rule.category,
        weight: rule.weight,
        ref,
      }
    );
  }

  const units: TypedUnit[] = [];
  for (const [filePath, evidence] of evidenceByFile) {
    const span = linesByFile.get(filePath)!;
    const confidence = scoreConfidence(evidence);
    const categories = new Set(evidence.map((e) => e.category));
    // T-X7-1/2 — extended to a third vote value, additive not a rewrite (per
    // Contract_Evolution_Policy.md §4's own dry run of this exact change).
    //
    // AREC Wave 3 T-D1 — real bug found and fixed the moment call-site
    // evidence made the previously-untested combination actually happen:
    // Fineract's AppUser.java is a genuine @Entity that ALSO calls
    // validateHasPermission() internally. The OLD rule ("service wins any
    // tie") typed it 'service', silently discarding its persistence
    // identity — the original comment for that rule even flagged this
    // exact scenario as "hasn't been seen in practice," and now it has.
    // Fix: an ACTUAL http-entry-point signal is still decisive (the real,
    // tested ChargesApiResource-class case); but a security-control vote
    // ALONE (no http-entry-point) must not outrank a real persistence
    // signal — a database entity with an internal auth check is still a
    // database entity architecturally. security-control-only (no http, no
    // persistence, no messaging) still correctly resolves to 'service' —
    // the real, proven DatatableWriteService case (a pure RBAC-enforcing
    // interface with no HTTP surface at all).
    // security-control-only (no http/persistence/messaging) falls through to
    // the 'service' default below — the real, proven DatatableWriteService
    // case (a pure RBAC-enforcing interface with no HTTP surface at all).
    const kind = categories.has('http-entry-point')
      ? 'service'
      : categories.has('persistence')
        ? 'database'
        : categories.has('messaging')
          ? 'topic'
          : 'service';
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
