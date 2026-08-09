import * as path from 'path';
import { AnalysisContext, AnalysisPass } from './pass-registry';
import { discoverCdxgenComponents } from '../scanner/cdxgen-provider';
import { loadPersistenceDetectionCatalogue } from '../rules/persistence-detection-schema';
import { loadMessagingDetectionCatalogue } from '../rules/messaging-detection-schema';
import { scoreConfidence } from './confidence-scorer';

const CORROBORATION_WEIGHT = 10; // same corroboration tier as jpa-table's weight

/**
 * T-CDX-3 (B-cdxgen-reuse) — raw, UNEXPANDED catalogue library names
 * (deliberately not driverImportLibraries()/importOnlyMessagingLibraries()'s
 * Graphify ref_-transformed sets — those exist to match Graphify EDGE
 * targets, a different data source; cdxgen's component names are real,
 * literal package names read from a manifest/lockfile, never Graphify's
 * mangled ref_ form).
 */
function corroboratingLibraryNames(rulesDir: string): Set<string> {
  const persistence = loadPersistenceDetectionCatalogue(rulesDir);
  const messaging = loadMessagingDetectionCatalogue(rulesDir);
  const names = new Set<string>();
  for (const strategy of persistence.strategies) {
    if (strategy.id !== 'driver-import') continue;
    for (const lib of strategy.libraries ?? []) names.add(lib.name);
  }
  for (const strategy of messaging.strategies) {
    if (strategy.id !== 'import-only-cloud-client') continue;
    for (const lib of strategy.libraries ?? []) names.add(lib.name);
  }
  return names;
}

/**
 * Real, deterministic dependency-name corroboration: raises confidence on
 * an ALREADY-detected persistence/messaging unit when cdxgen's real SBOM
 * for that root also names one of the same catalogue libraries — never a
 * primary detection source, never creates a competing unit. Same
 * never-guess discipline `spring-config-pass.ts`'s server.port ambiguity
 * fix already established: corroboration only attaches when exactly ONE
 * persistence/messaging unit exists in the root; 0 or 2+ candidates record
 * a real, named ignored item instead of guessing.
 */
export const cdxgenCorroborationPass: AnalysisPass = {
  name: 'cdxgenCorroboration',
  run(ctx: AnalysisContext) {
    const rulesDir = path.join(__dirname, '..', 'rules');
    const catalogueNames = corroboratingLibraryNames(rulesDir);

    for (const root of ctx.packageRoots) {
      const components = discoverCdxgenComponents(root);
      if (components.length === 0) continue;

      const matches = components.filter((c) => catalogueNames.has(c.name));
      if (matches.length === 0) continue;

      const candidates = (ctx.unitsByRoot.get(root) ?? []).filter((u) => u.kind === 'database' || u.kind === 'topic');
      if (candidates.length !== 1) {
        ctx.allIgnoredItems.push({
          ref: `${root}:cdxgen-dependency-corroboration`,
          reason: 'AMBIGUOUS_BOUNDARY',
          detail:
            candidates.length === 0
              ? `cdxgen found real corroborating dependencies (${matches.map((m) => m.name).join(', ')}) but no persistence/messaging unit exists in this root to corroborate`
              : `cdxgen found real corroborating dependencies but ${candidates.length} persistence/messaging units exist in this root — never guessing which one`,
        });
        continue;
      }

      // Review finding (2026-08-09) — a real, confirmed misattribution bug:
      // with exactly one candidate UNIT but 2+ real MATCHING dependencies
      // (e.g. a root declaring both psycopg2 and pymongo, but the unit was
      // only ever built from a psycopg2 import), every match used to be
      // attached regardless of relevance — a specific, wrong claim
      // ("this unit is corroborated by pymongo"), not just an incomplete
      // one. Fixed: the same never-guess discipline already applied to
      // "which unit" now applies to "which dependency" too — only attach
      // when exactly one real match exists; 2+ matches record a real,
      // named ignored item instead of guessing which one is relevant.
      if (matches.length !== 1) {
        ctx.allIgnoredItems.push({
          ref: `${root}:cdxgen-dependency-corroboration`,
          reason: 'AMBIGUOUS_BOUNDARY',
          detail: `cdxgen found ${matches.length} real corroborating dependencies (${matches.map((m) => m.name).join(', ')}) for the one persistence/messaging unit in this root — never guessing which one actually corroborates it`,
        });
        continue;
      }

      const unit = candidates[0];
      const category = unit.kind === 'database' ? 'persistence' : 'messaging';
      const match = matches[0];
      unit.evidence.push({
        signal: `cdxgen:${match.name}${match.version ? `@${match.version}` : ''}`,
        source: 'dependency-manifest',
        category,
        weight: CORROBORATION_WEIGHT,
        ref: match.purl ?? `${root}:cdxgen:${match.name}`,
      });
      unit.confidence = scoreConfidence(unit.evidence);
    }
  },
};
