import * as fs from 'fs';
import * as path from 'path';
import { TypedFacts } from '../../types/typed-facts';
import { CalmDocument } from '../../types/calm';
import { Module } from '../registry';
import { buildCalm } from './build-calm';
import { applyOverrides } from './override-applier';

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
 */
export function writeArtefacts(facts: TypedFacts, outDir: string, overridesDir?: string, includeSystemNode = true): void {
  fs.mkdirSync(outDir, { recursive: true });
  const moduleDir = path.join(outDir, 'modules', 'calm-generator');
  fs.mkdirSync(moduleDir, { recursive: true });

  let calm: CalmDocument = buildCalm(facts, includeSystemNode);

  // Solution Design v2 §5.4 / Gap_Closure_Build_Ready_Specs_v0.1.md §6: a
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
  fs.writeFileSync(path.join(outDir, 'architecture.calm.json'), calmJson); // back-compat top-level
  fs.writeFileSync(path.join(moduleDir, 'architecture.calm.json'), calmJson); // namespaced

  fs.writeFileSync(path.join(outDir, 'ignored-items-report.json'), JSON.stringify(facts.ignoredItems, null, 2));

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
  fs.writeFileSync(path.join(outDir, 'typed-facts.json'), JSON.stringify(facts, null, 2));
}

/** CALM Generator as a real registry Module — the first, proving the boundary against its own real implementation above. */
export const calmGeneratorModule: Module = {
  name: 'calm-generator',
  supportedMajorVersion: '8', // bumped for CONTRACT_VERSION 8.0.0 (T-Y3-1) — control-builder.ts filters on 'security-control' only (unaffected); interface-builder.ts is fully catalogue-driven (node-type-mapping.yml's interfaceCategories), no hardcoded category list to update — re-verified the new 'serverless-entry-point' category is correctly excluded there, not just assumed
  run: (facts, ctx) => writeArtefacts(facts, ctx.outDir, ctx.overridesDir, ctx.includeSystemNode ?? true),
};
