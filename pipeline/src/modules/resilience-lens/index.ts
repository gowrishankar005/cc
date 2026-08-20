import * as fs from 'fs';
import * as path from 'path';
import { TypedFacts } from '../../types/typed-facts';
import { Module, ModuleContext } from '../registry';
import { loadModuleFitness } from '../fitness';

/**
 * T-LM-2 (AGENT_TASKS_Ext_Lens_Modules.md, Lens Modules lane) — the second
 * module proving the module boundary generalizes past threat-signals
 * (written without touching Scanner, Rules, Analysis, or the CALM
 * generator; consumes typed-facts.json only, per Module_Authoring_Guide.md).
 *
 * Deliberately narrow, per the lane file's own gate: retry-annotation and
 * timeout-config detection specifically, not "resilience" scoped whole.
 * Circuit-breaker/bulkhead/rate-limiter annotations and non-Spring timeout
 * shapes are real, named residuals — not silently claimed as covered.
 *
 * Signal source: Evidence.category === 'resilience' (CONTRACT_VERSION
 * 12.0.0) — a retry annotation (Spring Retry `@Retryable`, Resilience4j
 * `@Retry`, both decorator-sourced) or a resilience4j
 * `timelimiter.instances.*.timeout-duration` config value
 * (structured-config-sourced, spring-config-pass.ts's attachResilienceTimeout).
 *
 * Per BR-110 (AGENT_TASKS_Ext_Lens_Modules.md's pre-flight finding): this
 * module's findings are descriptive facts for a human to read, not a
 * verdict — a unit with retry evidence and no timeout evidence is not
 * automatically "misconfigured"; a unit with neither is not automatically
 * "fragile." This module DOES have a gold-scored fitness declaration
 * (`coe-lab/gold/modules/resilience-lens/*.gold.json` +
 * `coe-lab/scripts/score-module-resilience-lens.mjs`, built alongside this
 * module per T-LM-0's own "do this before/with the first new lens"
 * instruction) — surfaced machine-readably in this module's own report
 * (`fitness.json`/`fitness.ts`, T-LM-5), not only as Claim_Register.md
 * prose. See `docs/solution/Claim_Register.md`'s Module fitness section for
 * the full narrative.
 */
function run(facts: TypedFacts, ctx: ModuleContext): void {
  // Review fix (2026-08-16) — restructured to this file's sibling module's
  // own idiom (threat-signals/index.ts: filter, then filter, then map),
  // instead of map-then-filter with a manual NonNullable cast.
  const findings = facts.units
    .filter((u) => u.evidence.some((e) => e.category === 'resilience'))
    .map((u) => {
      const resilienceEvidence = u.evidence.filter((e) => e.category === 'resilience');
      return {
        unitId: u.id,
        hasRetry: resilienceEvidence.some((e) => e.source === 'decorator'),
        hasTimeout: resilienceEvidence.some((e) => e.source === 'structured-config'),
        rationale:
          'This pipeline found retry-annotation and/or timeout-config evidence for this unit — a descriptive fact, not a verdict. Coverage is narrow (Spring Retry @Retryable, Resilience4j @Retry, resilience4j timelimiter timeout-duration only); see docs/solution/Claim_Register.md for what is and is not detected.',
        evidenceRefs: resilienceEvidence.map((e) => e.ref),
      };
    });

  // Namespaced (Module_Authoring_Guide.md's "output — namespace your files"),
  // same convention threat-signals already established.
  const moduleDir = path.join(ctx.outDir, 'modules', 'resilience-lens');
  fs.mkdirSync(moduleDir, { recursive: true });
  // T-LM-5 (BR-110) — same machine-readable fitness declaration mechanism
  // as threat-signals; the second module proving it isn't module-specific.
  const fitness = loadModuleFitness('resilience-lens');
  fs.writeFileSync(path.join(moduleDir, 'resilience-lens-report.json'), JSON.stringify({ findings, fitness }, null, 2));
  if (findings.length > 0) {
    console.log(`[resilience-lens] ${findings.length} unit(s) with real retry-annotation/timeout-config evidence`);
  }
}

export const resilienceLensModule: Module = {
  name: 'resilience-lens',
  supportedMajorVersion: '14', // bumped for CONTRACT_VERSION 14.0.0 (T-CL-4) — TypedUnit.status/TypedRelationship.status/.id promoted required; this module never reads TypedUnit.status/TypedRelationship.id/.status at all, filters on category === 'resilience' only — reviewed, unaffected
  run,
};
