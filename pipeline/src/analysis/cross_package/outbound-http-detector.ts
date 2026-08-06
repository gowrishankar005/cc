import * as path from 'path';
import { GraphifyRun, parseSourceLocation } from '../../scanner/graphify-provider';
import { IgnoredItem } from '../../types/typed-facts';
import { loadHttpClientDetectionCatalogue, importOnlyHttpClientLibraries } from '../../rules/http-client-detection-schema';
import { findLibraryImportEdges } from './graphify-import-strategy-detector';

/**
 * T-X8-3 (G-L2-13) — the import-only strategy from
 * http-client-detection-catalogue.yml. Unlike persistence-detector.ts/
 * messaging-detector.ts, this does NOT create a new TypedUnit — an HTTP
 * client import doesn't describe a new architectural component, it
 * describes an EXISTING unit's outbound capability with an unknown target.
 * Per the task's own instruction ("resolvable target -> low/medium
 * connects; else ignored unresolved-http-target with evidence for HITL")
 * and this catalogue's own real-evidence finding (neither BoA's Python
 * `requests` calls nor Fineract's Java `RestTemplate` calls have a literal,
 * statically-resolvable target — both are runtime-constructed), every
 * detection here is the "else" branch: a CROSS_DOMAIN_UNRESOLVED
 * IgnoredItem, real evidence for a human to complete via the already-real
 * relationship_add override (T-X6-1) — never a fabricated relationship.
 *
 * Import-edge finding is shared with persistence-detector.ts/
 * messaging-detector.ts via graphify-import-strategy-detector.ts (post-MVP
 * consolidation) — this file uses the raw per-EDGE primitive (one finding
 * per matching import edge), not the per-file-deduped one those two use,
 * since a file importing two different HTTP-client libraries is two real
 * findings here, not one unit.
 */
export function detectOutboundHttpClients(run: GraphifyRun): IgnoredItem[] {
  const catalogue = loadHttpClientDetectionCatalogue(path.join(__dirname, '..', '..', 'rules'));
  const libraries = importOnlyHttpClientLibraries(catalogue);

  const ignoredItems: IgnoredItem[] = [];
  const clientImportEdges = findLibraryImportEdges(run, libraries);

  for (const edge of clientImportEdges) {
    const resolved = run.resolveRoot(edge.source_file);
    if (!resolved) continue;
    const line = parseSourceLocation(edge.source_location) ?? 1;
    ignoredItems.push({
      ref: `${resolved.relativeFilePath}:${line}`,
      reason: 'CROSS_DOMAIN_UNRESOLVED',
      detail: `unresolved-http-target: imports HTTP client "${edge.target}" — real outbound-HTTP capability, but no statically-resolvable target (candidate for relationship_add via HITL review, T-X6-1).`,
    });
  }

  return ignoredItems;
}
