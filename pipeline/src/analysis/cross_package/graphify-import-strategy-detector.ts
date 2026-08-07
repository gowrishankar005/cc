import * as path from 'path';
import { GraphifyRun, GraphifyEdge } from '../../scanner/graphify-provider';
import { TypedUnit, Evidence } from '../../types/typed-facts';
import { resolveJavaImportPackage, javaImportMatchesPackage } from '../../rules/java-import-resolver';
import { classExtendsBaseClass } from '../../rules/class-ownership-resolver';

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
 * T-R1-3 — Java `imports`-relation edges target the bare, lowercased LAST
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
 */
function resolveJavaMatch(run: GraphifyRun, edge: GraphifyEdge, libraries: Set<string>, fileLineCache: Map<string, string[]>): string | undefined {
  if (!edge.source_file.endsWith('.java')) return undefined;
  const resolved = run.resolveRoot(edge.source_file);
  if (!resolved) return undefined;
  const absPath = path.join(resolved.root, resolved.relativeFilePath);
  const qualified = resolveJavaImportPackage(absPath, edge.source_location, fileLineCache);
  if (!qualified) return undefined;
  for (const lib of libraries) {
    if (javaImportMatchesPackage(qualified, lib)) return qualified;
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
export function findLibraryImportEdges(run: GraphifyRun, libraries: Set<string>, fileLineCache: Map<string, string[]> = new Map()): GraphifyEdge[] {
  return run.graph.edges.filter((e) => {
    if (e.relation !== 'imports_from' && e.relation !== 'imports') return false;
    if (libraries.has(e.target)) return true;
    return resolveJavaMatch(run, e, libraries, fileLineCache) !== undefined;
  });
}

/** Convenience wrapper over findLibraryImportEdges for consumers that only need the unique set of matching files (not per-edge detail). */
export function findFilesImportingLibraries(run: GraphifyRun, libraries: Set<string>): string[] {
  return [...new Set(findLibraryImportEdges(run, libraries).map((e) => e.source_file))];
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
 * `existingServiceFilePaths` — real bug found testing against
 * ghostfolio/ghostfolio (NestJS + Prisma): a Controller class importing
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
  run: GraphifyRun,
  libraries: Set<string>,
  config: ImportStrategyUnitConfig,
  existingServiceFilePaths: Set<string> = new Set(),
  /**
   * Q13 ontology fix — matched-library name -> required owner base class
   * (`persistence-detection-schema.ts`'s `driverImportOwnerBaseClasses()`).
   * Only libraries present here get the extra ownership check; every other
   * library's behavior is byte-for-byte unchanged (empty Map by default).
   */
  ownerBaseClasses: Map<string, string> = new Map()
): Map<string, TypedUnit[]> {
  const { graph } = run;
  const unitsByRoot = new Map<string, TypedUnit[]>();
  const fileLineCache = new Map<string, string[]>();
  const files = [...new Set(findLibraryImportEdges(run, libraries, fileLineCache).map((e) => e.source_file))];

  for (const file of files) {
    const resolved = run.resolveRoot(file);
    if (!resolved) continue; // outside every given package root
    if (existingServiceFilePaths.has(resolved.relativeFilePath)) continue; // already established as a service — don't also emit a competing database/topic unit for the same file

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
      // qualified-import resolution (T-R1-3) when no literal/ref_ target
      // matched — surfaces the REAL package name as evidence.signal (e.g.
      // "org.postgresql.core.Utils") instead of the generic unknown-lib text.
      const fileEdges = graph.edges.filter((e) => e.source === fileNodeId);
      const matchedLibrary =
        fileEdges.find((e) => libraries.has(e.target))?.target ??
        fileEdges.map((e) => resolveJavaMatch(run, e, libraries, fileLineCache)).find((m) => m !== undefined);

      // Q13 ontology fix — for a library that requires ownership proof
      // (e.g. @prisma/client), a plain import is no longer sufficient: THIS
      // class must itself declare `extends <ownerBaseClass>` (read back
      // from its own real source, multi-line-aware — class-ownership-resolver.ts).
      // A file importing the driver for its own TYPES only (real Ghostfolio
      // AccessService shape) correctly produces no unit for that class here.
      const requiredBaseClass = matchedLibrary ? ownerBaseClasses.get(matchedLibrary) : undefined;
      if (requiredBaseClass) {
        const absPath = path.join(resolved.root, resolved.relativeFilePath);
        if (!classExtendsBaseClass(absPath, classNode.source_location, requiredBaseClass, fileLineCache)) continue;
      }

      const unit: TypedUnit = {
        id: `${resolved.relativeFilePath}::${classNode.label}`,
        kind: config.kind,
        name: classNode.label,
        filePath: resolved.relativeFilePath,
        startLine: classLine,
        endLine,
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

  return unitsByRoot;
}
