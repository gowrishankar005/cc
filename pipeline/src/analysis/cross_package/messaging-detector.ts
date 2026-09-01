import * as path from 'path';
import { CrossPackageGraphRun } from '../../scanner/codegraph-crossroot-provider';
import { loadMessagingDetectionCatalogue, importOnlyMessagingLibraries } from '../../rules/messaging-detection-schema';
import { loadWiringAnnotationCatalogue, wiringAnnotationNames } from '../../rules/wiring-annotation-schema';
import { detectUnitsByImportStrategy, ImportStrategyResult } from './graphify-import-strategy-detector';

/**
 * The import-only strategy from
 * messaging-detection-catalogue.yml. Mirrors persistence-detector.ts's own
 * mechanism (both now call the same shared
 * graphify-import-strategy-detector.ts, post-MVP consolidation).
 *
 * Deliberately LOW, fixed confidence (weight 20) — "import-only <=
 * medium/low confidence... don't emit
 * high-confidence network nodes from import alone") — same flat value
 * persistence-detector.ts's own driver-import strategy already uses for
 * the identical reason (an import proves capability, not actual usage).
 *
 * Known, named limitation (not hidden): uses the identical
 * `${relativeFilePath}::${className}` id scheme persistence-detector.ts
 * uses, so a class that imported BOTH a persistence library AND a
 * messaging library in the same file would collide on unique-id. No real
 * fixture exercises this today (SQS/SNS entries are all `evidenceLevel:
 * unverified` — no Node/TS messaging code has been run through this
 * pipeline yet), so this is a real but currently-unobserved risk, not
 * silently assumed safe — the existing unique-id-uniqueness regression
 * test would catch it the moment a real fixture triggers it.
 */
export function detectMessagingUnits(
  run: CrossPackageGraphRun,
  existingServiceFilePaths: Set<string> = new Set(),
  overridableServiceFilePaths: Set<string> = new Set()
): ImportStrategyResult {
  const rulesDir = path.join(__dirname, '..', '..', 'rules');
  const catalogue = loadMessagingDetectionCatalogue(rulesDir);
  const libraries = importOnlyMessagingLibraries(catalogue);
  const wiringOnlyAnnotations = wiringAnnotationNames(loadWiringAnnotationCatalogue(rulesDir));

  return detectUnitsByImportStrategy(
    run,
    libraries,
    {
      kind: 'topic',
      category: 'messaging',
      weight: 20,
      confidence: 20,
      unknownLibraryFallback: 'unknown-messaging-lib',
    },
    existingServiceFilePaths,
    new Map(),
    new Map(),
    wiringOnlyAnnotations,
    overridableServiceFilePaths
  );
}
