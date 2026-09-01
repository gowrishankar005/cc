import * as path from 'path';
import { NativeRouteFact, DecoratorFact } from '../scanner/structural-engine';
import { SignalCatalogue, findRule } from '../rules/rule-schema';
import { Evidence, TypedUnit, IgnoredItem, PENDING_STATUS } from '../types/typed-facts';
import { ignoreUnknownSignal } from './ignored-items';
import { scoreConfidence } from './confidence-scorer';

// mapSignalsPass
// used to hardcode every unit's `name` to its raw file path. Real fix: prefer
// the actual class name CodeGraph already extracted (DecoratorFact.fromNodeName,
// only trusted when fromNodeKind === 'class'), falling back to the file's own
// basename (still far more readable than a full path) when no single,
// unambiguous class name exists for that file — e.g. a file with 2+ real
// classes (Entry 12's ChargeConfiguration.java shape) or no class evidence at
// all (a bare Python/JS module). Never guesses between multiple candidates.
function deriveUnitName(filePath: string, classNamesByFile: Map<string, Set<string>>): string {
  const names = classNamesByFile.get(filePath);
  if (names && names.size === 1) {
    return [...names][0];
  }
  return path.basename(filePath).replace(/\.[^./]+$/, '');
}

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
  callFacts: DecoratorFact[] = [], // optional/defaulted so every existing caller (tests, --from-facts paths) keeps compiling unchanged
  typeReferenceFacts: DecoratorFact[] = [], // same reason
  extendsFacts: DecoratorFact[] = [] // same reason
): { units: TypedUnit[]; ignoredItems: IgnoredItem[] } {
  const evidenceByFile = new Map<string, Evidence[]>();
  const linesByFile = new Map<string, { start: number; end: number }>();
  const ignoredItems: IgnoredItem[] = [];

  // Real class names seen per file, collected from every fact array
  // that carries fromNodeKind/fromNodeName (decorators/calls/type-refs/
  // extends all share the DecoratorFact shape). Native routes carry no
  // class info (NativeRouteFact has no fromNode fields) — files typed only
  // via native routes fall through to deriveUnitName()'s basename fallback.
  const classNamesByFile = new Map<string, Set<string>>();
  for (const fact of [...decoratorFacts, ...callFacts, ...typeReferenceFacts, ...extendsFacts]) {
    if (fact.fromNodeKind === 'class' && fact.fromNodeName) {
      if (!classNamesByFile.has(fact.filePath)) classNamesByFile.set(fact.filePath, new Set());
      classNamesByFile.get(fact.filePath)!.add(fact.fromNodeName);
    }
  }

  // Node kind is now decided once, at the end, directly from the CATEGORY
  // of a file's aggregated evidence (see the priority order below) — not
  // from a per-evidence rule.calmNodeType vote collected here. Found the
  // old per-evidence-vote design gave a wrong answer the
  // moment a real file had BOTH persistence AND security-control evidence
  // (a reference Java/JAX-RS banking platform's AppUser.java: a real @Entity that also calls
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
  // T-onboarding-1b — every native route's own file:startLine, so the
  // decoratorFacts loop below can tell "a raw decorator with no catalogue
  // rule" apart from "the exact same annotation CodeGraph's native route
  // resolver already consumed on this line" (e.g. Spring MVC's
  // @GetMapping/@PostMapping: real, fully-detected HTTP-entry-point
  // evidence via the native-route path above, never itself catalogued as a
  // decorator rule, since that would double-detect the same fact through
  // two independent paths). Same "mark it consumed, don't report it as an
  // unexplained gap" idea route-composer-registry.ts's own `consumed` set
  // already established for JAX-RS-style composition — this is the
  // equivalent for native-route-typed frameworks, which never went through
  // that composer at all.
  const nativeRouteLines = new Set(nativeRoutes.map((r) => `${r.filePath}:${r.startLine}`));
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
      // T-onboarding-1b — a method-level decorator on the exact file:line a
      // native route already consumed is a real, fully-detected fact, not
      // an unexplained one; skip it silently rather than record it as
      // unmapped. Scoped to fromNodeKind === 'method' deliberately: a
      // class-level decorator's own line never coincides with a route's
      // startLine in practice (confirmed directly against real CodeGraph
      // output — a class-level @RestController and its methods' @GetMapping
      // report distinct line numbers), so this check is a no-op for
      // class-level facts and never suppresses a genuinely-unmapped
      // class-level signal.
      if (dec.fromNodeKind === 'method' && nativeRouteLines.has(ref)) continue;
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
        // Real gap found while wiring this
        // through for call facts: DecoratorFact has carried `argument`
        // since the original JAX-RS route-assembly work, but it was never
        // threaded into Evidence, so it never reached control-builder.ts
        // either (e.g. @PreAuthorize's own argument, when it has one).
        ...(dec.argument !== undefined ? { argument: dec.argument } : {}),
      }
    );
  }

  // SAME loop shape as decoratorFacts above,
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

  // SAME loop shape again: a field-type signal (source:
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

  // SAME loop shape again: an extends signal (source:
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
    // Extended to a third vote value, additive not a rewrite (per
    // Contract_Evolution_Policy.md §4's own dry run of this exact change).
    //
    // Real bug found and fixed the moment call-site
    // evidence made the previously-untested combination actually happen:
    // a reference Java/JAX-RS banking platform's AppUser.java is a genuine @Entity that ALSO calls
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
    // 'serverless-entry-point' (Lambda `implements RequestHandler`)
    // treated identically to 'http-entry-point' here: both are decisive,
    // structural entry-point evidence for the kind tie-break. Kept as a
    // DISTINCT category from 'http-entry-point' only for interface-building
    // purposes (interface-builder.ts/node-type-mapping.yml) — the raw
    // signal text isn't a path, so it must not win interfaceCategories the
    // way a real route signal does.
    const hasEntryPointEvidence = categories.has('http-entry-point') || categories.has('serverless-entry-point');
    const kind = hasEntryPointEvidence
      ? 'service'
      : categories.has('persistence')
        ? 'database'
        : categories.has('messaging')
          ? 'topic'
          : 'service';
    units.push({
      id: filePath,
      kind,
      name: deriveUnitName(filePath, classNamesByFile),
      filePath,
      startLine: span.start,
      endLine: span.end,
      status: PENDING_STATUS,
      evidence,
      confidence,
    });
  }

  return { units, ignoredItems };
}
