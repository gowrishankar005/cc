import * as path from 'path';
import { GraphifyRun } from '../../scanner/graphify-provider';
import { loadPersistenceDetectionCatalogue, driverImportLibraries, driverImportOwnerBaseClasses, driverImportOwnerFieldTypes } from '../../rules/persistence-detection-schema';
import { loadWiringAnnotationCatalogue, wiringAnnotationNames } from '../../rules/wiring-annotation-schema';
import { detectUnitsByImportStrategy, ImportStrategyResult } from './graphify-import-strategy-detector';

/**
 * Real gap found by auditing pipeline output against a reference Python microservices banking app source
 * (userservice/db.py, contacts/db.py): CodeGraph gives no persistence signal
 * at all (confirmed repeatedly across this project — Java JPA and now Python
 * SQLAlchemy). Graphify's raw `imports_from` edges already carry this signal
 * for free — no new extraction engine needed, just reading what's already
 * there instead of discarding it in the cross-package-only reconciler.
 *
 * Wave M T-M9: this is now a dispatcher over `persistence-detection-catalogue.yml`'s
 * `driver-import` strategy — the ONLY one of the four named persistence
 * strategies this function actually implements (`jpa-entity` is a real,
 * working, but SEPARATE mechanism — signal-catalogue.yml's decorator path;
 * `spring-data-repository`/`jooq` are not implemented anywhere yet). Adding
 * a new driver library is now a catalogue row, not a code change — the
 * genericity fix named since `docs/solution/language/java.md` §3.1, done
 * for real here, not just designed.
 *
 * The actual file->contains->class walk is shared with messaging-detector.ts
 * and outbound-http-detector.ts via graphify-import-strategy-detector.ts
 * (post-MVP consolidation — all three were independently-written copies of
 * the identical two-step algorithm before this).
 */
export function detectPersistenceUnits(
  run: GraphifyRun,
  existingServiceFilePaths: Set<string> = new Set(),
  overridableServiceFilePaths: Set<string> = new Set()
): ImportStrategyResult {
  const rulesDir = path.join(__dirname, '..', '..', 'rules');
  const catalogue = loadPersistenceDetectionCatalogue(rulesDir);
  const libraries = driverImportLibraries(catalogue);
  const ownerBaseClasses = driverImportOwnerBaseClasses(catalogue);
  const ownerFieldTypes = driverImportOwnerFieldTypes(catalogue);
  const wiringOnlyAnnotations = wiringAnnotationNames(loadWiringAnnotationCatalogue(rulesDir));

  return detectUnitsByImportStrategy(
    run,
    libraries,
    {
      kind: 'database',
      category: 'persistence',
      weight: 20, // persistence signal weight
      confidence: 20,
      unknownLibraryFallback: 'unknown-persistence-lib',
    },
    existingServiceFilePaths,
    ownerBaseClasses,
    ownerFieldTypes,
    wiringOnlyAnnotations,
    overridableServiceFilePaths
  );
}
