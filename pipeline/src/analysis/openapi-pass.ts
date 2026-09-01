import { AnalysisContext, AnalysisPass, pushAll } from './pass-registry';
import { CONFIDENCE_FLOOR } from './passes';
import { discoverOpenApiDocuments, OpenApiSecurityScheme } from '../scanner/openapi-provider';
import { ignoreLowConfidence } from './ignored-items';
import { Evidence, TypedUnit, PENDING_STATUS } from '../types/typed-facts';
import { scoreConfidence } from './confidence-scorer';

const ROUTE_WEIGHT = 40; // matches nativeRouteWeight's convention in signal-mapper.ts — a structured OpenAPI operation is as decisive as a native-typed route
const SECURITY_SCHEME_WEIGHT = 20; // corroboration tier, matches jpa-table's weight — a securityScheme names an auth mechanism but isn't itself proof it's enforced on a given operation

/**
 * Derives a generic, spec-vocabulary
 * signal from a securityScheme's real `type`/`scheme` fields, e.g.
 * "http-bearer" for `{type: http, scheme: bearer}`, "apiKey" for
 * `{type: apiKey}`. Falls back to the scheme's own type string (or
 * "unknown-security-scheme") when it's a real OpenAPI type this pipeline
 * hasn't named a catalogue row for yet — never invents a value, always
 * reflects the spec's own real field.
 */
function openApiSecuritySchemeSignal(scheme: OpenApiSecurityScheme): string {
  if (scheme.type === 'http' && scheme.scheme) return `http-${scheme.scheme.toLowerCase()}`;
  return scheme.type ?? 'unknown-security-scheme';
}

/**
 * Trap card T8 (coe-lab/docs/trap-gold-backlog.md) —
 * normalizes a route path so a code-derived signal ("GET /users/:id",
 * NestJS/Express-style) and an OpenAPI signal ("GET /users/{id}") can be
 * compared for real overlap without caring whether the param NAME matches
 * (":id" vs "{id}" vs "{userId}" are all real, legitimate spellings for
 * the same path shape) — only the STATIC segments have to match exactly,
 * never guessed.
 */
function normalizeRouteSignal(signal: string): string {
  return signal
    .replace(/:[^/\s]+/g, '{param}')
    .replace(/\{[^}]+\}/g, '{param}')
    .trim()
    .toUpperCase();
}

/**
 * Turns discoverOpenApiDocuments()'s raw parse into TypedUnits +
 * Evidence (not a calm-only parse — CALM Generator never touches
 * openapi-provider.ts directly).
 *
 * Closes the "path-to-unit correlation is real future
 * work" gap this pass's own header comment used to name (trap card T8: a
 * package with both openapi.yaml AND a real NestJS controller implementing
 * the same routes produced TWO standalone `service` nodes for one real
 * service — a genuine unit-level false positive, verified against the real
 * checked-in lab ts-nestjs-users fixture, not assumed). Merge policy,
 * generic (no NestJS-specific code): if this document's route signals
 * overlap (by normalized method+path) with EXACTLY ONE existing code-derived
 * unit in the SAME package root, attach this document's evidence to THAT
 * unit instead of creating a competing one. Zero overlap (a pure spec-first
 * package, no code yet) or ambiguous overlap (2+ candidate units — never
 * guess which one) both fall back to the original standalone-unit behavior.
 */
export const openApiPass: AnalysisPass = {
  name: 'openapi',
  run(ctx: AnalysisContext) {
    for (const root of ctx.packageRoots) {
      const documents = discoverOpenApiDocuments(root);
      ctx.openApiDocumentsByRoot = ctx.openApiDocumentsByRoot ?? new Map();
      ctx.openApiDocumentsByRoot.set(root, documents);

      for (const doc of documents) {
        const evidence: Evidence[] = [];
        for (const op of doc.operations) {
          evidence.push({
            signal: `${op.method} ${op.path}`,
            source: 'openapi',
            category: 'http-entry-point',
            weight: ROUTE_WEIGHT,
            ref: `${doc.filePath}:paths.${op.path}.${op.method.toLowerCase()}`,
          });
        }
        for (const scheme of doc.securitySchemes) {
          evidence.push({
            // T-E4 (C-contract expand) — matched against the scheme's real
            // STRUCTURAL type/scheme (openApiSecuritySchemeSignal below),
            // never its author-chosen NAME (kept only in `ref` for
            // provenance) — a catalogue row for "http-bearer" generalizes
            // across every spec that uses bearer auth, regardless of
            // whether the author called it "bearerAuth", "jwt", or "auth".
            signal: openApiSecuritySchemeSignal(scheme),
            source: 'openapi',
            category: 'security-control',
            weight: SECURITY_SCHEME_WEIGHT,
            ref: `${doc.filePath}:components.securitySchemes.${scheme.name}`,
          });
        }
        if (evidence.length === 0) continue;

        // T-E4 merge check: does this document's route set overlap with
        // EXACTLY ONE existing code-derived unit already in this root?
        const docRouteSignals = new Set(
          doc.operations.map((op) => normalizeRouteSignal(`${op.method} ${op.path}`))
        );
        const rootUnits = ctx.unitsByRoot.get(root) ?? [];
        const overlappingUnits = rootUnits.filter((u) =>
          u.evidence.some((e) => e.category === 'http-entry-point' && docRouteSignals.has(normalizeRouteSignal(e.signal)))
        );

        if (overlappingUnits.length === 1) {
          // Real overlap with exactly one code-derived unit — attach this
          // document's evidence there instead of spawning a competing
          // service node for the same real service (trap card T8 fix).
          pushAll(overlappingUnits[0].evidence, evidence);
          overlappingUnits[0].confidence = scoreConfidence(overlappingUnits[0].evidence);
          continue;
        }
        // 0 overlap (spec-first, no code yet) or 2+ (ambiguous — never
        // guess which unit owns this spec) both keep the original
        // standalone-unit behavior below, unchanged.

        const confidence = scoreConfidence(evidence);
        const unit: TypedUnit = {
          id: doc.filePath,
          kind: 'service',
          name: doc.title ?? doc.filePath,
          filePath: doc.filePath,
          startLine: 1,
          endLine: 1, // no line numbers available from a parsed YAML/JSON document — honest limitation, not a guess
          status: PENDING_STATUS,
          evidence,
          confidence,
        };

        if (confidence < CONFIDENCE_FLOOR) {
          ctx.allIgnoredItems.push(ignoreLowConfidence(unit.id, confidence));
        } else {
          ctx.allUnits.push(unit);
          ctx.unitsByRoot.set(root, [...(ctx.unitsByRoot.get(root) ?? []), unit]);
        }
      }
    }
  },
};
