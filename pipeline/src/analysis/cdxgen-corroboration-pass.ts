import * as path from 'path';
import { AnalysisContext, AnalysisPass } from './pass-registry';
import { discoverCdxgenComponents } from '../scanner/cdxgen-provider';
import { loadPersistenceDetectionCatalogue } from '../rules/persistence-detection-schema';
import { loadMessagingDetectionCatalogue } from '../rules/messaging-detection-schema';
import { scoreConfidence } from './confidence-scorer';
import { TypedUnit, PENDING_STATUS } from '../types/typed-facts';

const CORROBORATION_WEIGHT = 10; // same corroboration tier as jpa-table's weight

/**
 * Raw, UNEXPANDED catalogue library names (deliberately not
 * driverImportLibraries()/importOnlyMessagingLibraries()'s Graphify
 * ref_-transformed sets — those exist to match Graphify EDGE targets, a
 * different data source; cdxgen's component names are real, literal
 * package names read from a manifest/lockfile, never Graphify's mangled
 * ref_ form). Maps each name to the unit KIND it would introduce — a flat
 * Set lost which catalogue (persistence vs. messaging) a name came from,
 * which introduction needs to pick database vs. topic.
 */
function corroboratingLibraryKinds(rulesDir: string): Map<string, 'database' | 'topic'> {
  const persistence = loadPersistenceDetectionCatalogue(rulesDir);
  const messaging = loadMessagingDetectionCatalogue(rulesDir);
  const kinds = new Map<string, 'database' | 'topic'>();
  for (const strategy of persistence.strategies) {
    if (strategy.id !== 'driver-import') continue;
    for (const lib of strategy.libraries ?? []) kinds.set(lib.name, 'database');
  }
  for (const strategy of messaging.strategies) {
    if (strategy.id !== 'import-only-cloud-client') continue;
    for (const lib of strategy.libraries ?? []) kinds.set(lib.name, 'topic');
  }
  return kinds;
}

/**
 * Secondary sources may introduce facts, not only corroborate: cdxgen's
 * SBOM sees a real, structural fact (this root
 * genuinely depends on a persistence/messaging library) that the primary
 * code-reading engines can miss entirely (a driver used only via reflection,
 * a dependency declared but its usage sitting in a file/pattern this
 * pipeline's catalogues don't yet recognize). Before this, that signal was
 * simply mute whenever no code-derived unit existed to corroborate — a real
 * fact the pipeline could see and chose to discard. Introduces a real,
 * distinctly-tagged unit instead: no file:line exists for a manifest-only
 * fact, so its id/filePath are synthetic (same honest convention
 * springConfigPass's synthetic config-derived units already established —
 * Graphify reconciliation structurally can't match these ids either way).
 * Deliberately NEVER promoted past its own weight-10 corroboration tier —
 * `status-assignment.ts`'s own hard rule (a unit whose entire evidence is
 * 'dependency-manifest'-sourced always reads `requires-review`, matching
 * this task's own acceptance bar) enforces "introduced, not promoted" in
 * the review-state vocabulary, not just in the confidence number.
 */
function introducedUnit(root: string, matchName: string, matchVersion: string | undefined, matchPurl: string | undefined, kind: 'database' | 'topic'): TypedUnit {
  const category = kind === 'database' ? 'persistence' : 'messaging';
  return {
    id: `cdxgen:${root}:${matchName}`,
    kind,
    name: matchName,
    filePath: `dependency-manifest:${matchName}`,
    startLine: 1,
    endLine: 1,
    status: PENDING_STATUS,
    evidence: [
      {
        signal: `cdxgen:${matchName}${matchVersion ? `@${matchVersion}` : ''}`,
        source: 'dependency-manifest',
        category,
        weight: CORROBORATION_WEIGHT,
        ref: matchPurl ?? `${root}:cdxgen:${matchName}`,
      },
    ],
    confidence: CORROBORATION_WEIGHT,
  };
}

/**
 * Real, deterministic dependency-name corroboration: raises confidence on
 * an ALREADY-detected persistence/messaging unit when cdxgen's real SBOM
 * for that root also names one of the same catalogue libraries — never a
 * primary detection source. Same never-guess discipline
 * `spring-config-pass.ts`'s server.port ambiguity fix already established:
 * corroboration only attaches when exactly ONE persistence/messaging unit
 * exists in the root; 2+ candidates record a real, named ignored item
 * instead of guessing. When exactly ZERO candidates exist, a
 * single unambiguous match introduces a new unit at its own tier instead of
 * staying mute — still never guesses: 2+ matches with zero candidate units
 * is exactly as ambiguous as 2+ matches against one candidate, and stays a
 * named ignored item either way.
 */
export const cdxgenCorroborationPass: AnalysisPass = {
  name: 'cdxgenCorroboration',
  run(ctx: AnalysisContext) {
    if (ctx.disableCdxgen) {
      console.log('[cdxgen-corroboration] --no-cdxgen: skipping dependency-manifest corroboration for this run');
      return;
    }
    const rulesDir = path.join(__dirname, '..', 'rules');
    const libraryKinds = corroboratingLibraryKinds(rulesDir);

    for (const root of ctx.packageRoots) {
      const components = discoverCdxgenComponents(root);
      if (components.length === 0) continue;

      const matches = components.filter((c) => libraryKinds.has(c.name));
      if (matches.length === 0) continue;

      const candidates = (ctx.unitsByRoot.get(root) ?? []).filter((u) => u.kind === 'database' || u.kind === 'topic');

      if (candidates.length === 0) {
        // Nothing to corroborate; introduce a fact instead of
        // staying mute, but only when exactly one real match exists (the
        // same "never guess which one" discipline as every other branch
        // here).
        if (matches.length !== 1) {
          ctx.allIgnoredItems.push({
            ref: `${root}:cdxgen-dependency-corroboration`,
            reason: 'AMBIGUOUS_BOUNDARY',
            detail: `cdxgen found ${matches.length} real corroborating dependencies (${matches.map((m) => m.name).join(', ')}) but no persistence/messaging unit exists in this root and no interface-mapping mechanism resolves which one to introduce a fact for — never guessing`,
          });
          continue;
        }
        const match = matches[0];
        const kind = libraryKinds.get(match.name)!;
        const unit = introducedUnit(root, match.name, match.version, match.purl, kind);
        ctx.allUnits.push(unit);
        const rootUnits = ctx.unitsByRoot.get(root) ?? [];
        rootUnits.push(unit);
        ctx.unitsByRoot.set(root, rootUnits);
        continue;
      }

      if (candidates.length !== 1) {
        ctx.allIgnoredItems.push({
          ref: `${root}:cdxgen-dependency-corroboration`,
          reason: 'AMBIGUOUS_BOUNDARY',
          detail: `cdxgen found real corroborating dependencies but ${candidates.length} persistence/messaging units exist in this root — never guessing which one`,
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
