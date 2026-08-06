import * as fs from 'fs';
import * as path from 'path';
import { TypedFacts } from '../../types/typed-facts';
import { CalmDocument } from '../../types/calm';
import { buildCalm } from './build-calm';
import { applyOverrides } from './override-applier';

export function writeArtefacts(facts: TypedFacts, outDir: string, overridesDir?: string): void {
  fs.mkdirSync(outDir, { recursive: true });

  let calm: CalmDocument = buildCalm(facts);

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
    fs.writeFileSync(path.join(outDir, 'overrides-applied-report.json'), JSON.stringify(result, null, 2));
    if (result.applied.length > 0 || result.rejected.length > 0 || result.skipped.length > 0) {
      console.log(
        `[write-artefacts] overrides: ${result.applied.length} applied, ${result.rejected.length} rejected, ${result.skipped.length} skipped (see overrides-applied-report.json)`
      );
    }
  }

  fs.writeFileSync(path.join(outDir, 'architecture.calm.json'), JSON.stringify(calm, null, 2));

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
