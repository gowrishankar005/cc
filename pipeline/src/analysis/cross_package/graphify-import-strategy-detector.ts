import * as path from 'path';
import { CrossPackageGraphRun, CrossPackageEdge } from '../../scanner/codegraph-crossroot-provider';
import { TypedUnit, Evidence, PENDING_STATUS } from '../../types/typed-facts';
import { resolveJavaImportPackage, javaImportMatchesPackage } from '../../rules/java-import-resolver';
import { classExtendsBaseClass, classDeclaresFieldOfType, classHasAnnotation } from '../../rules/class-ownership-resolver';
import { isTestPath } from '../../rules/test-path';

/**
 * Shared by persistence-detector.ts, messaging-detector.ts, and
 * outbound-http-detector.ts — all three were independently-written copies
 * of the SAME two steps ("find files importing a known library, resolved
 * to a package root" + "walk file -contains-> class to build a unit"),
 * differing only in which library set, TypedUnit.kind, Evidence.category,
 * and confidence they used. GENERIC consolidation, not a per-detector
 * patch: extracted after three real, independent needs for the identical
 * logic existed (persistence, messaging, HTTP clients), not speculatively
 * ahead of a second use case (Simplicity First's own stated bar).
 */

/**
 * Java `imports`-relation edges target the bare, lowercased LAST
 * SYMBOL (`utils`), never the qualified package (`org.postgresql`), so a
 * plain `libraries.has(e.target)` check never matches a Java driver row
 * (`java-import-resolver.ts` has the full real-evidence writeup). This
 * resolves the edge's REAL qualified import by reading the source line at
 * its own `source_location` — same read-back technique already proven for
 * decorator/call arguments — and checks it against the catalogue's package
 * names as a package-or-member match, not a literal target-id match.
 *
 * `fileLineCache` is caller-supplied and shared across the whole detection
 * pass (not module-global — stays scoped to one run, no cross-test/cross-run
 * leakage) so a file with many matching import lines is only read once.
 *
 * Returns BOTH the real resolved qualified import (used as
 * evidence.signal, unchanged) AND which catalogue library name it matched
 * (`catalogueLib`). Real, generic gap this fixes: ownerBaseClasses/
 * ownerFieldTypes lookups are keyed by the catalogue's own library name
 * (e.g. "org.postgresql"), but the qualified import text a Java match
 * resolves to is never that literal string (e.g.
 * "org.postgresql.core.Utils") — a plain `map.get(qualified)` can never hit
 * for ANY Java driver-import library. Latent
 * until now because no Java catalogue row had ever set ownerBaseClass.
 */
function resolveJavaMatch(run: CrossPackageGraphRun, edge: CrossPackageEdge, libraries: Set<string>, fileLineCache: Map<string, string[]>): { qualified: string; catalogueLib: string } | undefined {
  if (!edge.source_file.endsWith('.java')) return undefined;
  const resolved = run.resolveRoot(edge.source_file);
  if (!resolved) return undefined;
  const absPath = path.join(resolved.root, resolved.relativeFilePath);
  const qualified = resolveJavaImportPackage(absPath, edge.source_location, fileLineCache);
  if (!qualified) return undefined;
  for (const lib of libraries) {
    if (javaImportMatchesPackage(qualified, lib)) return { qualified, catalogueLib: lib };
  }
  return undefined;
}

/**
 * Step 1, shared, at the lowest common granularity (raw matching EDGES, not
 * deduped files) — the two real consumers genuinely need different shapes
 * on top of it: outbound-http-detector.ts emits one ignored-item PER EDGE
 * (a file importing two different HTTP-client libraries is two real
 * findings), while detectUnitsByImportStrategy below dedupes to one unit
 * per FILE (a class is one architectural unit regardless of how many
 * matching import edges reference it). Returning raw edges lets each
 * consumer fold however its real semantics require, instead of forcing a
 * single dedup policy that would be wrong for one of them.
 */
export function findLibraryImportEdges(run: CrossPackageGraphRun, libraries: Set<string>, fileLineCache: Map<string, string[]> = new Map()): CrossPackageEdge[] {
  return run.graph.edges.filter((e) => {
    // Real false-positive, confirmed via a real fixture: Graphify parses
    // package.json's own JSON structure into synthetic 'imports' edges, one
    // per declared dependency name (`dependencies.pg` -> node "pg", relation
    // "imports") — indistinguishable, by relation/target alone, from a real
    // source file importing that same-named library. When a project's own
    // declared dependency name happens to match a catalogued persistence/
    // messaging/HTTP-client library, package.json itself would otherwise be
    // treated as an importing FILE, and its sibling top-level keys (name,
    // version, dependencies, ...) as "classes" it contains — one bogus unit
    // per top-level key. package.json is never real source, so it can never
    // be a legitimate import-strategy match. Not observed for Python
    // manifests (requirements.txt isn't parsed into synthetic edges).
    if (path.basename(e.source_file) === 'package.json') return false;
    if (e.relation !== 'imports_from' && e.relation !== 'imports') return false;
    if (libraries.has(e.target)) return true;
    return resolveJavaMatch(run, e, libraries, fileLineCache) !== undefined;
  });
}

/** Convenience wrapper over findLibraryImportEdges for consumers that only need the unique set of matching files (not per-edge detail). */
export function findFilesImportingLibraries(run: CrossPackageGraphRun, libraries: Set<string>): string[] {
  return [...new Set(findLibraryImportEdges(run, libraries).map((e) => e.source_file))];
}

/** excludedTestFiles is real, relative file paths skipped as test code despite matching a catalogued library import; the caller (persistence/messaging pass) turns each into a real IgnoredItem. */
export interface ImportStrategyResult {
  unitsByRoot: Map<string, TypedUnit[]>;
  excludedTestFiles: string[];
}

export interface ImportStrategyUnitConfig {
  kind: TypedUnit['kind'];
  category: Evidence['category'];
  weight: number;
  confidence: number;
  unknownLibraryFallback: string; // e.g. "unknown-persistence-lib" — preserves each detector's own real fallback text
}

/**
 * Step 2, shared: for each matched file, walk file -contains-> class and
 * build one TypedUnit per contained class, spanning from the class's own
 * line to its furthest method's line.
 *
 * `existingServiceFilePaths` — real bug found testing against a reference
 * Node/NestJS + Prisma fintech app: a Controller class importing
 * Prisma's generated TYPES purely for its own DTO typing (extremely common
 * in Prisma-based TypeScript, `import { Access as AccessModel } from
 * '@prisma/client'`) was being classified `database`, duplicating the
 * file's own correctly-detected `service` unit. GENERIC fix, not a Prisma
 * or Controller-name special case: any file the caller can show ALREADY
 * has a `service`-kind unit (from route/decorator evidence, which always
 * runs first — see passes.ts's pass ordering) is skipped here. This is the
 * same "service wins over a co-located weaker signal" principle
 * signal-mapper.ts's own node-type-vote tie-break already uses for
 * same-file evidence — extended here to cross-detector file-level
 * precedence, since persistence/messaging detection runs as a genuinely
 * separate pass over different evidence (Graphify imports, not decorators).
 */
export function detectUnitsByImportStrategy(
  run: CrossPackageGraphRun,
  libraries: Set<string>,
  config: ImportStrategyUnitConfig,
  existingServiceFilePaths: Set<string> = new Set(),
  /**
   * Q13 ontology fix — matched-library name -> required owner base class
   * (`persistence-detection-schema.ts`'s `driverImportOwnerBaseClasses()`).
   * Only libraries present here get the extra ownership check; every other
   * library's behavior is byte-for-byte unchanged (empty Map by default).
   */
  ownerBaseClasses: Map<string, string> = new Map(),
  /**
   * The composition-ownership counterpart to ownerBaseClasses
   * (persistence-detection-schema.ts's driverImportOwnerFieldTypes()).
   * Only libraries present here get the extra field-ownership check.
   */
  ownerFieldTypes: Map<string, string> = new Map(),
  /**
   * Class-level annotation names that mark a class as a
   * dependency-wiring factory, never a real user/owner of what it wires
   * (`wiring-annotation-catalogue.yml`, `wiringAnnotationNames()`). Data,
   * not code: adding a new ecosystem's equivalent convention is a catalogue
   * row, never a hardcoded name here — the check below is generic over
   * however many entries this list has, from zero to many, across any
   * language `classHasAnnotation`'s `@`-prefixed-annotation scan covers.
   */
  wiringOnlyAnnotations: string[] = [],
  /**
   * Real-data finding — a SUBSET of `existingServiceFilePaths`
   * (`pass-registry.ts`'s `overridableServiceFilePaths`): files whose only
   * `service` unit evidence is a bare, weak class-level stereotype (no real
   * route/security-control signal of its own). For these files, this
   * detector still builds its own unit as normal (does NOT skip via the
   * `existingServiceFilePaths` check below) — the calling pass
   * (detectPersistencePass/detectMessagingPass) then REPLACES the weak
   * unit with this one, rather than the two ever coexisting as separate
   * competing CALM nodes for one real class.
   */
  overridableServiceFilePaths: Set<string> = new Set()
): ImportStrategyResult {
  const { graph } = run;
  const unitsByRoot = new Map<string, TypedUnit[]>();
  const excludedTestFiles: string[] = [];
  const fileLineCache = new Map<string, string[]>();
  const files = [...new Set(findLibraryImportEdges(run, libraries, fileLineCache).map((e) => e.source_file))];

  for (const file of files) {
    const resolved = run.resolveRoot(file);
    if (!resolved) continue; // outside every given package root
    // Real, confirmed contamination: 17
    // real /test/-path files in one a reference Java/JAX-RS banking platform scan were typed as database
    // units purely because they happened to import a real catalogued
    // driver library (test setup/fixture code, not real persistence).
    // Excluded here, not silently — the caller reports each one as a real
    // IgnoredItem (reason TEST_CODE).
    if (isTestPath(resolved.relativeFilePath)) {
      excludedTestFiles.push(resolved.relativeFilePath);
      continue;
    }
    // Real-data finding — a file whose ONLY service evidence is a
    // weak, bare stereotype (overridableServiceFilePaths) is NOT skipped
    // here; the calling pass replaces that weak unit with whatever this
    // detector produces below, instead of silently losing real persistence/
    // messaging evidence for it.
    if (existingServiceFilePaths.has(resolved.relativeFilePath) && !overridableServiceFilePaths.has(resolved.relativeFilePath)) continue;

    const fileNodeId = graph.nodes.find((n) => n.source_file === file && n.source_location === 'L1')?.id;
    if (!fileNodeId) continue;

    const containsEdges = graph.edges.filter((e) => e.source === fileNodeId && e.relation === 'contains');
    for (const containsEdge of containsEdges) {
      const classNode = graph.nodes.find((n) => n.id === containsEdge.target);
      if (!classNode) continue;

      const memberEdges = graph.edges.filter((e) => e.source === classNode.id && e.relation === 'method');
      const memberLines = memberEdges
        .map((e) => graph.nodes.find((n) => n.id === e.target))
        .map((n) => (n ? parseInt(/^L(\d+)/.exec(n.source_location)?.[1] ?? '0', 10) : 0));
      const classLine = parseInt(/^L(\d+)/.exec(classNode.source_location)?.[1] ?? '0', 10);
      const endLine = memberLines.length > 0 ? Math.max(classLine, ...memberLines) : classLine;

      // Same fileNodeId-based lookup the original detectors used (not the
      // file-string-keyed match from findFilesImportingLibraries) — exact
      // parity with the pre-consolidation algorithm. Falls back to the Java
      // qualified-import resolution when no literal/ref_ target
      // matched — surfaces the REAL package name as evidence.signal (e.g.
      // "org.postgresql.core.Utils") instead of the generic unknown-lib text.
      const fileEdges = graph.edges.filter((e) => e.source === fileNodeId);
      const literalMatch = fileEdges.find((e) => libraries.has(e.target))?.target;
      const javaMatch = literalMatch === undefined ? fileEdges.map((e) => resolveJavaMatch(run, e, libraries, fileLineCache)).find((m) => m !== undefined) : undefined;
      const matchedLibrary = literalMatch ?? javaMatch?.qualified;
      // The catalogue's OWN library name (e.g. "org.postgresql"),
      // for ownerBaseClasses/ownerFieldTypes lookups. Distinct from
      // matchedLibrary (the evidence.signal text below) because a Java
      // match's resolved qualified import (e.g. "org.postgresql.core.Utils")
      // is never itself a catalogue key — see resolveJavaMatch's doc comment.
      const matchedCatalogueLibrary = literalMatch ?? javaMatch?.catalogueLib;

      // BACKLOG.md's "@Configuration classes mis-typed database via
      // driver-import evidence" — a class whose only relationship to a
      // matched library is via factory-wiring (any annotation in
      // wiringOnlyAnnotations, catalogue-driven, never a hardcoded name
      // here) is never a real owner/user of it, regardless of which
      // library or which kind (database/topic) this detector instance is
      // producing — it exists to WIRE the thing for something ELSE to use,
      // not to use it itself. Generic, unconditional on ownerBaseClasses
      // (unlike the Q13 check below, which only applies to
      // specifically-configured libraries) — this exclusion is real for
      // every driver-import library, for every catalogued wiring
      // annotation.
      if (
        wiringOnlyAnnotations.some((annotationName) =>
          classHasAnnotation(path.join(resolved.root, resolved.relativeFilePath), classNode.source_location, annotationName, fileLineCache)
        )
      )
        continue;

      // Q13 ontology fix — for a library that requires ownership proof
      // (e.g. @prisma/client), a plain import is no longer sufficient: THIS
      // class must itself declare `extends <ownerBaseClass>` (read back
      // from its own real source, multi-line-aware — class-ownership-resolver.ts).
      // A file importing the driver for its own TYPES only (real a reference Node/NestJS wealth-management app
      // AccessService shape) correctly produces no unit for that class here.
      const requiredBaseClass = matchedCatalogueLibrary ? ownerBaseClasses.get(matchedCatalogueLibrary) : undefined;
      if (requiredBaseClass) {
        const absPath = path.join(resolved.root, resolved.relativeFilePath);
        if (!classExtendsBaseClass(absPath, classNode.source_location, requiredBaseClass, fileLineCache)) continue;
      }

      // The composition-ownership counterpart: a library like the
      // AWS SDK's Dynamo clients is never subclassed, so ownership can only
      // be proven by a real field of the client's own type (see
      // class-ownership-resolver.ts's classDeclaresFieldOfType doc comment).
      const requiredFieldType = matchedCatalogueLibrary ? ownerFieldTypes.get(matchedCatalogueLibrary) : undefined;
      if (requiredFieldType) {
        const absPath = path.join(resolved.root, resolved.relativeFilePath);
        if (!classDeclaresFieldOfType(absPath, classNode.source_location, endLine, requiredFieldType, fileLineCache)) continue;
      }

      const unit: TypedUnit = {
        id: `${resolved.relativeFilePath}::${classNode.label}`,
        kind: config.kind,
        name: classNode.label,
        filePath: resolved.relativeFilePath,
        startLine: classLine,
        endLine,
        status: PENDING_STATUS,
        evidence: [
          {
            signal: matchedLibrary ?? config.unknownLibraryFallback,
            source: 'graphify-import',
            category: config.category,
            weight: config.weight,
            ref: `${resolved.relativeFilePath}:${classLine}`,
          },
        ],
        confidence: config.confidence,
      };

      if (!unitsByRoot.has(resolved.root)) unitsByRoot.set(resolved.root, []);
      unitsByRoot.get(resolved.root)!.push(unit);
    }
  }

  return { unitsByRoot, excludedTestFiles };
}
