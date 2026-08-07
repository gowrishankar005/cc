import * as path from 'path';
import { GraphifyRun } from '../../scanner/graphify-provider';
import { TypedUnit } from '../../types/typed-facts';
import { loadPersistenceDetectionCatalogue, driverImportLibraries, driverImportOwnerBaseClasses } from '../../rules/persistence-detection-schema';
import { detectUnitsByImportStrategy } from './graphify-import-strategy-detector';

/**
 * Real gap found by auditing pipeline output against Bank of Anthos source
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
export function detectPersistenceUnits(run: GraphifyRun, existingServiceFilePaths: Set<string> = new Set()): Map<string, TypedUnit[]> {
  const catalogue = loadPersistenceDetectionCatalogue(path.join(__dirname, '..', '..', 'rules'));
  const libraries = driverImportLibraries(catalogue);
  const ownerBaseClasses = driverImportOwnerBaseClasses(catalogue);

  return detectUnitsByImportStrategy(
    run,
    libraries,
    {
      kind: 'database',
      category: 'persistence',
      weight: 20, // persistence signal weight, Gap_Closure_Build_Ready_Specs_v0.1.md §7
      confidence: 20,
      unknownLibraryFallback: 'unknown-persistence-lib',
    },
    existingServiceFilePaths,
    ownerBaseClasses
  );
}
