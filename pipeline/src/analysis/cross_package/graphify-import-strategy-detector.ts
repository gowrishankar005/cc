import { GraphifyRun, GraphifyEdge } from '../../scanner/graphify-provider';
import { TypedUnit, Evidence } from '../../types/typed-facts';

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
export function findLibraryImportEdges(run: GraphifyRun, libraries: Set<string>): GraphifyEdge[] {
  return run.graph.edges.filter((e) => (e.relation === 'imports_from' || e.relation === 'imports') && libraries.has(e.target));
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
  existingServiceFilePaths: Set<string> = new Set()
): Map<string, TypedUnit[]> {
  const { graph } = run;
  const unitsByRoot = new Map<string, TypedUnit[]>();
  const files = findFilesImportingLibraries(run, libraries);

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
      // parity with the pre-consolidation algorithm.
      const matchedLibrary = graph.edges.find((e) => e.source === fileNodeId && libraries.has(e.target))?.target;

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
