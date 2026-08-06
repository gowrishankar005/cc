import * as fs from 'fs';
import * as path from 'path';
import { TypedFacts } from '../../types/typed-facts';
import { Module, ModuleContext } from '../registry';

/**
 * The actual test of Goal A ("platform, not CALM-only script") — sketched
 * in Solution Design v2 §9, built for real this session as the second
 * module. Consumes typed-facts.json only — no change to Scanner, Rules,
 * Analysis, or CALM Generator was needed to write this file.
 *
 * Signal: a unit with http-entry-point evidence (an HTTP-facing surface)
 * but no security-control evidence (no auth annotation/call this pipeline
 * found for it) — a plausible spoofing/elevation candidate. This is the
 * inverse of the real DatatableWriteService finding from control-builder.ts
 * (a control with no HTTP route) — proof both directions of that
 * evidence-gap are visible from the same typed-facts.json, to two
 * completely independent modules.
 *
 * Deliberately narrow: this is a signal for a human to look at, not a
 * verdict — an http-entry-point unit legitimately having no auth (a public
 * health-check endpoint, say) is not automatically a real vulnerability.
 */
function run(facts: TypedFacts, ctx: ModuleContext): void {
  const findings = facts.units
    .filter((u) => u.evidence.some((e) => e.category === 'http-entry-point'))
    .filter((u) => !u.evidence.some((e) => e.category === 'security-control'))
    .map((u) => ({
      unitId: u.id,
      stride: 'spoofing' as const,
      rationale: 'HTTP-entry-point evidence present; no security-control evidence found for this unit.',
      evidenceRefs: u.evidence.map((e) => e.ref),
    }));

  // Namespaced (Wave M T-M2) — no top-level back-compat copy needed, unlike
  // calm-generator's architecture.calm.json, since nothing outside this
  // module has ever depended on this file's location.
  const moduleDir = path.join(ctx.outDir, 'modules', 'threat-signals');
  fs.mkdirSync(moduleDir, { recursive: true });
  fs.writeFileSync(path.join(moduleDir, 'threat-signals-report.json'), JSON.stringify({ findings }, null, 2));
  if (findings.length > 0) {
    console.log(`[threat-signals] ${findings.length} unit(s) flagged: http-entry-point evidence with no security-control evidence`);
  }
}

export const threatSignalsModule: Module = {
  name: 'threat-signals',
  supportedMajorVersion: '4', // bumped for CONTRACT_VERSION 4.0.0 (T-X7-1) — filters on Evidence.category only, unaffected by the new TypedUnit.kind: 'topic' value; re-verified, not just left stale
  run,
};
