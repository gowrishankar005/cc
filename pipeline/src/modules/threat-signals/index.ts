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
      // AREC Wave 3 T-D3 (S3, narrative honesty) — the original wording
      // ("no security-control evidence found") reads as "no auth exists in
      // source," which is a different, stronger, unverified claim. Even
      // with C-call built (T-D1), this pipeline's detection is bounded by
      // its own catalogue — absence here means "this pipeline's category
      // coverage found nothing," not "an auditor confirmed there is no
      // auth." Softened per S3 and pointed at the concrete pipeline
      // capability (Claim Register C-dec/C-call cells) rather than implying
      // a completeness guarantee this module was never built to make.
      rationale:
        'HTTP-entry-point evidence present; this pipeline found no security-control evidence (decorator or call-site) for this unit. This reflects the DETECTION CATALOGUE\'s coverage, not a confirmed absence of authorization in source — see docs/solution/Claim_Register.md (C-dec/C-call) for what is and is not detected today.',
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
  supportedMajorVersion: '8', // bumped for CONTRACT_VERSION 8.0.0 (T-Y3-1) — filters strictly on category === 'http-entry-point', re-verified this does NOT also match the new 'serverless-entry-point' category (intentional, named residual — scope-limitations.yml's serverless-http-java-only), not a silent gap
  run,
};
