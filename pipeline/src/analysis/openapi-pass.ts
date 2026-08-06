import { AnalysisContext, AnalysisPass } from './pass-registry';
import { CONFIDENCE_FLOOR } from './passes';
import { discoverOpenApiDocuments } from '../scanner/openapi-provider';
import { ignoreLowConfidence } from './ignored-items';
import { Evidence, TypedUnit } from '../types/typed-facts';
import { scoreConfidence } from './confidence-scorer';

const ROUTE_WEIGHT = 40; // matches nativeRouteWeight's convention in signal-mapper.ts — a structured OpenAPI operation is as decisive as a native-typed route
const SECURITY_SCHEME_WEIGHT = 20; // corroboration tier, matches jpa-table's weight — a securityScheme names an auth mechanism but isn't itself proof it's enforced on a given operation

/**
 * T-X4-1 — turns discoverOpenApiDocuments()'s raw parse into TypedUnits +
 * Evidence, the "Scanner provider -> TypedFacts" flow this task requires
 * (not a calm-only parse — CALM Generator never touches openapi-provider.ts
 * directly). One TypedUnit per discovered OpenAPI/Swagger file — genuinely
 * new content with no existing code-based unit to attach to (path-to-unit
 * correlation is real future work, not built here — MVP scope).
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
        for (const schemeName of doc.securitySchemeNames) {
          evidence.push({
            signal: schemeName,
            source: 'openapi',
            category: 'security-control',
            weight: SECURITY_SCHEME_WEIGHT,
            ref: `${doc.filePath}:components.securitySchemes.${schemeName}`,
          });
        }
        if (evidence.length === 0) continue;

        const confidence = scoreConfidence(evidence);
        const unit: TypedUnit = {
          id: doc.filePath,
          kind: 'service',
          name: doc.title ?? doc.filePath,
          filePath: doc.filePath,
          startLine: 1,
          endLine: 1, // no line numbers available from a parsed YAML/JSON document — honest limitation, not a guess
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
