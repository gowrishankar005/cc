import * as path from 'path';
import { GraphifyRun, parseSourceLocation } from '../../scanner/graphify-provider';
import { IgnoredItem } from '../../types/typed-facts';
import { loadHttpClientDetectionCatalogue, importOnlyHttpClientLibraries } from '../../rules/http-client-detection-schema';
import { findLibraryImportEdges } from './graphify-import-strategy-detector';
import { isTestPath } from '../../rules/test-path';

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

    // Review finding (2026-08-09) — this detector shares findLibraryImportEdges
    // with persistence-detector.ts/messaging-detector.ts (via
    // detectUnitsByImportStrategy) but calls it directly, so it never
    // received the isTestPath() fix applied there (B-test-code-exclusion).
    // Confirmed real via a live re-scan: 2/13 real unresolved-http-target
    // items came from /test/-path files, polluting the HITL review queue
    // with test-code noise (a test helper importing an HTTP client for its
    // own setup is not a real outbound-HTTP architectural capability).
    // Lower severity than the original bug (this detector never creates a
    // TypedUnit, so no fabricated node was ever at risk), but the same
    // class of problem — re-categorized to TEST_CODE, not dropped, so the
    // real finding stays visible in ignored-items-report.json without
    // wasting a reviewer's attention as a genuine CROSS_DOMAIN_UNRESOLVED
    // candidate.
    if (isTestPath(resolved.relativeFilePath)) {
      ignoredItems.push({ ref: `${resolved.relativeFilePath}:${line}`, reason: 'TEST_CODE', detail: `Excluded from outbound-HTTP detection — matched a real test-path/filename convention (isTestPath()), despite importing a catalogued HTTP-client library "${edge.target}"` });
      continue;
    }

    ignoredItems.push({
      ref: `${resolved.relativeFilePath}:${line}`,
      reason: 'CROSS_DOMAIN_UNRESOLVED',
      detail: `unresolved-http-target: imports HTTP client "${edge.target}" — real outbound-HTTP capability, but no statically-resolvable target (candidate for relationship_add via HITL review, T-X6-1).`,
    });
  }

  return ignoredItems;
}
