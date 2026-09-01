import * as fs from 'fs';
import * as path from 'path';
import { AnalysisContext } from '../analysis/pass-registry';
import { buildCoverageReport, CoverageReport } from '../analysis/coverage-report';
import { buildUnmappedSignalsReport, UnmappedSignalsReport } from '../analysis/unmapped-signals';

/**
 * coverage-report.json and unmapped-signals-report.json are
 * PLATFORM artefacts (every module reads the same typed-facts.json; these
 * describe the RUN, not one module's output), so they're written from
 * orchestration alongside typed-facts.json — not from inside
 * modules/calm-generator/write-artefacts.ts, which would make them look
 * CALM-generator-private the same way ignored-items-report.json already
 * does today (a pre-existing, unrelated placement this task doesn't touch).
 */
export function writePlatformArtefacts(ctx: AnalysisContext, outDir: string): { coverage: CoverageReport; unmapped: UnmappedSignalsReport } {
  fs.mkdirSync(outDir, { recursive: true });

  const coverage = buildCoverageReport(ctx);
  fs.writeFileSync(path.join(outDir, 'coverage-report.json'), JSON.stringify(coverage, null, 2));

  const unmapped = buildUnmappedSignalsReport(ctx.allIgnoredItems);
  fs.writeFileSync(path.join(outDir, 'unmapped-signals-report.json'), JSON.stringify(unmapped, null, 2));

  console.log(
    `[platform-artefacts] coverage: ${coverage.roots.length} root(s), cross-package ${coverage.crossPackageStatus}; unmapped: ${unmapped.clusterCount} signal cluster(s), ${unmapped.totalUnmappedOccurrences} occurrence(s)`
  );

  return { coverage, unmapped };
}
