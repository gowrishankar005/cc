import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
import { expandWithGraphifyRefTargets, toGraphifyRefTarget } from './graphify-import-target';

export interface PersistenceLibraryEntry {
  name: string;
  language: string;
  evidenceLevel: 'verified' | 'unverified';
  /** A real CALM protocol enum value (core.json#/defs/protocol), set ONLY when the library name unambiguously implies it (e.g. org.postgresql IS the Postgres JDBC driver -> "JDBC"). Absent, not guessed, for anything that doesn't map to a real enum value (Mongo/DynamoDB have no CALM protocol entry at all). */
  protocol?: string;
  /**
   * Q13 ontology fix — set ONLY for libraries where "imports the driver" and
   * "owns the client" are real, evidenced, distinct things (confirmed for
   * @prisma/client: PrismaService extends PrismaClient owns it,
   * AccessService merely imports Prisma's TYPES). When set, a matched file's
   * class only becomes a database unit if THAT class's own source declares
   * `extends <ownerBaseClass>` (class-ownership-resolver.ts) — plain import
   * alone is no longer sufficient for this library. Absent for every other
   * library: their existing plain-import behavior is UNCHANGED (the reference Python app
   * SQLAlchemy, a reference Java/JAX-RS banking platform driver-import rows never re-verified against this
   * rule, per Q13's own explicit deferral — scoped narrowly, not applied
   * blanket).
   */
  ownerBaseClass?: string;
  /**
   * The composition-style counterpart to ownerBaseClass, for
   * libraries where real ownership is a FIELD holding the client, never an
   * `extends` relationship (the AWS SDK's Dynamo clients are never
   * subclassed; a store class holds one as a field/constructor-injected
   * dependency instead). Set ONLY where import-vs-ownership ambiguity is
   * real and evidenced (Claim_Register.md's U-persist-import counterexample:
   * a handler importing DynamoDbClient purely to pass it through, vs. a
   * store class that actually holds it). When set, a matched file's class
   * only becomes a database unit if THAT class's own source declares a
   * field of this type (class-ownership-resolver.ts's
   * classDeclaresFieldOfType) — plain import alone is no longer sufficient.
   * Absent for every other library: unchanged plain-import behavior.
   */
  ownerFieldType?: string;
}

export interface PersistenceStrategy {
  id: string;
  description: string;
  status: 'dispatched' | 'implemented-elsewhere' | 'not-implemented';
  libraries?: PersistenceLibraryEntry[];
  mechanism?: string;
  deferredTo?: string; // e.g. "X7" — names which future wave owns this strategy, when not-implemented
}

export interface PersistenceDetectionCatalogue {
  version: string;
  strategies: PersistenceStrategy[];
}

export function loadPersistenceDetectionCatalogue(catalogueDir: string = __dirname): PersistenceDetectionCatalogue {
  const filePath = path.join(catalogueDir, 'persistence-detection-catalogue.yml');
  const raw = fs.readFileSync(filePath, 'utf8');
  const doc = parseYaml(raw) as PersistenceDetectionCatalogue;
  if (!doc.version || !Array.isArray(doc.strategies)) {
    throw new Error(`persistence-detection-catalogue.yml at ${filePath} is malformed: missing version or strategies array`);
  }
  return doc;
}

/**
 * The one strategy persistence-detector.ts actually dispatches — its
 * library set, as a lookup Set. Expanded with each library's Graphify
 * `ref_`-transformed form (graphify-import-target.ts) — real finding from
 * testing against a reference Node/NestJS+Prisma fintech wealth-management
 * app: Graphify never uses the literal `@prisma/client` as an edge
 * target, only `ref_prisma_client`. Without this, every Node/TS entry here
 * was unreachable, not just unverified.
 */
export function driverImportLibraries(catalogue: PersistenceDetectionCatalogue): Set<string> {
  const strategy = catalogue.strategies.find((s) => s.id === 'driver-import');
  return expandWithGraphifyRefTargets(new Set((strategy?.libraries ?? []).map((lib) => lib.name)));
}

/** Library name -> real CALM protocol enum value, for the subset of driver-import libraries where that mapping is unambiguous (verified against core.json#/defs/protocol, not guessed). */
export function driverImportProtocols(catalogue: PersistenceDetectionCatalogue): Map<string, string> {
  const strategy = catalogue.strategies.find((s) => s.id === 'driver-import');
  const map = new Map<string, string>();
  for (const lib of strategy?.libraries ?? []) {
    if (lib.protocol) map.set(lib.name, lib.protocol);
  }
  return map;
}

/**
 * Q13 ontology fix — library name -> required owner base class, for the
 * subset of driver-import libraries where import alone is insufficient
 * (see PersistenceLibraryEntry.ownerBaseClass). Keyed by BOTH the literal
 * catalogue name and its Graphify ref_-transformed form (graphify-import-target.ts)
 * — findLibraryImportEdges's matched-library value can be either, depending
 * on which one matched the real edge target, so the lookup must work for both.
 */
export function driverImportOwnerBaseClasses(catalogue: PersistenceDetectionCatalogue): Map<string, string> {
  const strategy = catalogue.strategies.find((s) => s.id === 'driver-import');
  const map = new Map<string, string>();
  for (const lib of strategy?.libraries ?? []) {
    if (!lib.ownerBaseClass) continue;
    map.set(lib.name, lib.ownerBaseClass);
    map.set(toGraphifyRefTarget(lib.name), lib.ownerBaseClass);
  }
  return map;
}

/**
 * Library name -> required owner field type (see
 * PersistenceLibraryEntry.ownerFieldType). Same lookup shape as
 * driverImportOwnerBaseClasses (keyed by both the literal catalogue name
 * and its Graphify ref_-transformed form), for the composition-ownership
 * counterpart to the extends-based check.
 */
export function driverImportOwnerFieldTypes(catalogue: PersistenceDetectionCatalogue): Map<string, string> {
  const strategy = catalogue.strategies.find((s) => s.id === 'driver-import');
  const map = new Map<string, string>();
  for (const lib of strategy?.libraries ?? []) {
    if (!lib.ownerFieldType) continue;
    map.set(lib.name, lib.ownerFieldType);
    map.set(toGraphifyRefTarget(lib.name), lib.ownerFieldType);
  }
  return map;
}
