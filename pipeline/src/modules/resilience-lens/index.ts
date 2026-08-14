import * as fs from 'fs';
import * as path from 'path';
import { TypedFacts } from '../../types/typed-facts';
import { Module, ModuleContext } from '../registry';

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
 * "fragile." This module has no gold-scored fitness declaration of its own
 * yet (see coe-lab/gold/modules/resilience-lens/ — authored alongside this
 * module, not after, following T-LM-0's own "do this before/with the first
 * new lens" instruction) but the SCOPE of what it detects (2 retry
 * annotations, 1 timeout-config shape) is narrow enough that its output is
 * measurable now, unlike a lens with no ground truth path at all.
 */
function run(facts: TypedFacts, ctx: ModuleContext): void {
  const findings = facts.units
    .map((u) => {
      const resilienceEvidence = u.evidence.filter((e) => e.category === 'resilience');
      if (resilienceEvidence.length === 0) return undefined;

      const hasRetry = resilienceEvidence.some((e) => e.source === 'decorator');
      const hasTimeout = resilienceEvidence.some((e) => e.source === 'structured-config');

      return {
        unitId: u.id,
        hasRetry,
        hasTimeout,
        rationale:
          'This pipeline found retry-annotation and/or timeout-config evidence for this unit — a descriptive fact, not a verdict. Coverage is narrow (Spring Retry @Retryable, Resilience4j @Retry, resilience4j timelimiter timeout-duration only); see docs/solution/Claim_Register.md for what is and is not detected.',
        evidenceRefs: resilienceEvidence.map((e) => e.ref),
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== undefined);

  // Namespaced (Module_Authoring_Guide.md's "output — namespace your files"),
  // same convention threat-signals already established.
  const moduleDir = path.join(ctx.outDir, 'modules', 'resilience-lens');
  fs.mkdirSync(moduleDir, { recursive: true });
  fs.writeFileSync(path.join(moduleDir, 'resilience-lens-report.json'), JSON.stringify({ findings }, null, 2));
  if (findings.length > 0) {
    console.log(`[resilience-lens] ${findings.length} unit(s) with real retry-annotation/timeout-config evidence`);
  }
}

export const resilienceLensModule: Module = {
  name: 'resilience-lens',
  supportedMajorVersion: '12', // CONTRACT_VERSION 12.0.0 — the version that introduced Evidence.category: 'resilience' this module depends on
  run,
};
