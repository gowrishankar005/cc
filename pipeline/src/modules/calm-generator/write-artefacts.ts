import * as fs from 'fs';
import * as path from 'path';
import { TypedFacts } from '../../types/typed-facts';
import { CalmDocument } from '../../types/calm';
import { Module } from '../registry';
import { buildCalm } from './build-calm';
import { applyOverrides } from './override-applier';
import { logMem } from '../../util/debug-mem';
import { buildEmissionCoverageReport, EmissionCoverageGap } from './emission-coverage';

/**
 * Output layout (Wave M T-M2 — namespaced module outputs, so a second/third
 * module can never collide with this one's filenames):
 *
 * - `outDir/typed-facts.json`, `ignored-items-report.json`, `provenance.json`
 *   stay TOP-LEVEL — these describe the RUN and its facts, not this module's
 *   own output; every module reads the same `typed-facts.json`, so it isn't
 *   calm-generator-private.
 * - `outDir/architecture.calm.json` is written BOTH at top level (back-compat
 *   — this is the flagship deliverable this whole project exists to
 *   produce; existing tooling, tests, and `npm run validate`'s documented
 *   usage all expect it there) AND namespaced at
 *   `outDir/modules/calm-generator/architecture.calm.json` (the module's own
 *   private copy, per the new convention).
 * - `overrides-applied-report.json` is genuinely calm-generator-private (no
 *   other module applies overrides) — namespaced only, no top-level copy.
 * - `emission-coverage-report.json` (T-CL-5) is also calm-generator-private
 *   — only this module's own builders decide CALM representability, unlike
 *   `coverage-report.json`/`unmapped-signals-report.json` (analysis-time,
 *   pre-CALM completeness, written as top-level platform artefacts by
 *   `orchestration/platform-artefacts.ts` since every module reads them).
 */
export function writeArtefacts(facts: TypedFacts, outDir: string, overridesDir?: string, includeSystemNode = true): void {
  fs.mkdirSync(outDir, { recursive: true });
  const moduleDir = path.join(outDir, 'modules', 'calm-generator');
  fs.mkdirSync(moduleDir, { recursive: true });

  const emissionGaps: EmissionCoverageGap[] = [];
  let calm: CalmDocument = buildCalm(facts, includeSystemNode, emissionGaps);
  logMem('write-artefacts after buildCalm');

  // T-CL-5 — "what the representation could not carry, and why" as a
  // required emission output, computed from the same gaps the builders
  // recorded inline above (never re-derived independently). Written before
  // overrides are applied: overrides patch already-emitted CALM output and
  // never change what the deterministic builders concluded, so they can't
  // create or resolve an emission-coverage gap.
  const emissionCoverage = buildEmissionCoverageReport(facts.units, facts.relationships, emissionGaps);
  fs.writeFileSync(path.join(moduleDir, 'emission-coverage-report.json'), JSON.stringify(emissionCoverage, null, 2));
  console.log(
    `[write-artefacts] emission coverage: ${(emissionCoverage.coverageRatio * 100).toFixed(1)}% (${emissionCoverage.gaps.length} gap(s) — see modules/calm-generator/emission-coverage-report.json)`
  );

  // Solution Design v2 §5.4: a
  // final, auditable pass over the DETERMINISTIC output above — never
  // changes what the deterministic core concluded, only patches its output
  // when a human (or the bounded LLM advisory layer) has recorded a real,
  // traceable Decision Record for the correction. Optional: most runs won't
  // have an overrides directory at all, and behavior is identical to before
  // this existed when they don't.
  if (overridesDir) {
    const { calm: patchedCalm, result } = applyOverrides(calm, overridesDir);
    calm = patchedCalm;
    fs.writeFileSync(path.join(moduleDir, 'overrides-applied-report.json'), JSON.stringify(result, null, 2));
    if (result.applied.length > 0 || result.rejected.length > 0 || result.skipped.length > 0) {
      console.log(
        `[write-artefacts] overrides: ${result.applied.length} applied, ${result.rejected.length} rejected, ${result.skipped.length} skipped (see modules/calm-generator/overrides-applied-report.json)`
      );
    }
  }

  const calmJson = JSON.stringify(calm, null, 2);
  logMem('write-artefacts after calm stringify');
  fs.writeFileSync(path.join(outDir, 'architecture.calm.json'), calmJson); // back-compat top-level
  fs.writeFileSync(path.join(moduleDir, 'architecture.calm.json'), calmJson); // namespaced

  const ignoredItemsJson = JSON.stringify(facts.ignoredItems, null, 2);
  logMem('write-artefacts after ignoredItems stringify (1st)');
  fs.writeFileSync(path.join(outDir, 'ignored-items-report.json'), ignoredItemsJson);

  const provenance = {
    runVersion: facts.runVersion,
    generatedAt: facts.generatedAt,
    packageRoots: facts.packageRoots,
    unitCount: facts.units.length,
    relationshipCount: facts.relationships.length,
    ignoredItemCount: facts.ignoredItems.length,
  };
  fs.writeFileSync(path.join(outDir, 'provenance.json'), JSON.stringify(provenance, null, 2));

  // typed-facts.json itself, for auditability (the module contract, not just its output)
  const typedFactsJson = JSON.stringify(facts, null, 2);
  logMem('write-artefacts after typed-facts stringify (2nd, includes ignoredItems again)');
  fs.writeFileSync(path.join(outDir, 'typed-facts.json'), typedFactsJson);
  logMem('write-artefacts after all writes');
}

/** CALM Generator as a real registry Module — the first, proving the boundary against its own real implementation above. */
export const calmGeneratorModule: Module = {
  name: 'calm-generator',
  supportedMajorVersion: '17', // bumped for CONTRACT_VERSION 17.0.0 (JPA entity->table CodeQL candidate) — Evidence.source gained 'codeql-jpa-table'; reviewed, real code change already shipped in the SAME commit (interface-builder.ts's SOURCE_PRECEDENCE table gained the new key, ordered last — never contributes an interface, matching 'dependency-manifest'/'codeql-di''s existing corroboration-only precedent)
  run: (facts, ctx) => writeArtefacts(facts, ctx.outDir, ctx.overridesDir, ctx.includeSystemNode ?? true),
};
