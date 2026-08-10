#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { TypedFacts, TypedUnit } from '../../types/typed-facts';
import { CoverageReport } from '../coverage-report';

/**
 * AREC Wave 3 T-E5 (review-flow-capability-map.md's own "Decision: empty-
 * neighborhood review trigger" — recommended AFTER Wave 3-S metrics exist,
 * i.e. after T-A1 shipped `coverage-report.json`'s `completeness.silenceFlags`).
 *
 * OFFLINE ONLY, deterministic, no LLM call anywhere in this file — the
 * "no core-path LLM" acceptance bar for this task, and stricter than
 * suggest-rules.ts (which at least offers an LLM backend behind an env var).
 * Never imported by orchestration/run-slice.ts or anything in its call
 * graph. A human (or, per the review-flow doc's own "LLM proposes, never
 * writes TypedFacts" rule of thumb, a FUTURE separate LLM step reading this
 * file's OUTPUT) runs this deliberately, after a scan, over that scan's own
 * artifacts. Read-only over typed-facts.json/coverage-report.json — never
 * writes to either; only ever writes a NEW file (review-queue.json).
 *
 * Turns "S1/S2 fired" (a boolean-ish flag buried in coverage-report.json,
 * easy to miss) into a concrete, actionable list: WHICH units triggered it,
 * so a human reviewing a run doesn't have to re-derive that from
 * typed-facts.json by hand — exactly the "a reference Java/JAX-RS banking platform miss was exactly false
 * confidence without a flag" rationale review-flow-capability-map.md names.
 *
 * Robustness T-R4-1 added a THIRD trigger, `low-architecture-coverage`
 * (see the threshold constant below for why): the original T-E5 scope only
 * ever wired in S1/S2, but T-R4-1's own goal always named "S1 fires OR arch
 * coverage below threshold" — the second half was a real, unclosed gap
 * until this trigger was added, not a hypothetical extension.
 *
 * Found during the Architect_Residual_Review_Session.md review (2026-08-09,
 * not hypothetical — this file's own §4.2 lists review-queue.json as a key
 * residual-session input, and S5 already existed in coverage-report.json
 * the same day RS-0 was signed off, but was never wired in here): S5's two
 * conditions are now real triggers too. `S5-zero-service-units-with-store-present`
 * has natural unit candidates (every database/topic unit, same "list every
 * plausible unit" pattern as S1). `S5-cfn-routes-found-but-unbound` does
 * NOT — by definition, no unit was matched, so `unitId`/`unitKind` are
 * optional here (a genuine run-level residual, not per-unit).
 */

export interface ReviewQueueItem {
  trigger:
    | 'S1-zero-service-touching-relationships'
    | 'S2-http-without-security-control'
    | 'low-architecture-coverage'
    | 'S5-zero-service-units-with-store-present'
    | 'S5-cfn-routes-found-but-unbound';
  /** Absent for a genuinely run-level residual (S5-cfn-routes-found-but-unbound) — no unit was matched, so none can be named. */
  unitId?: string;
  unitKind?: TypedUnit['kind'];
  confidence?: number;
  rationale: string;
}

/**
 * T-R4-1 (Robustness Phase R4) — the task's own original goal named TWO
 * triggers ("when S1 fires OR arch coverage below threshold"), but only S1
 * was ever wired in (T-E5 shipped before T-R0-2's architectureOutboundCoverage
 * metric existed at all). Real gap, not just a doc-sync item: S1 only fires
 * on ZERO service-touching relationships — a run with SOME but SPARSE
 * architecture coverage (say 20%) never trips S1 at all, yet is exactly the
 * "residual human completion" case this task exists for. Closed here by
 * reusing coverage-report.ts's own already-computed rate, no new detection.
 *
 * 50% is a real, reviewable starting threshold (below half of a run's
 * services having ANY real outbound architecture edge is a reasonable bar
 * for "worth a human look"), same "draft, not physics, expected to be
 * recalibrated" framing as every other weight/threshold in this project.
 */
const LOW_ARCHITECTURE_COVERAGE_THRESHOLD = 0.5;

export interface ReviewQueue {
  generatedAt: string;
  sourceRun: { typedFactsGeneratedAt: string; contractVersion: string };
  items: ReviewQueueItem[];
}

/**
 * S1 flags a RUN (zero service-touching relationships anywhere), not one
 * unit — so every service and database unit is a legitimate review
 * candidate; a human decides which pair should have connected. S2 flags
 * SPECIFIC units (http-entry-point evidence, no security-control evidence)
 * — those are named precisely, not the whole run.
 */
export function buildReviewQueue(facts: TypedFacts, coverage: CoverageReport): ReviewQueue {
  const items: ReviewQueueItem[] = [];
  const silenceFlags = coverage.completeness.silenceFlags;

  // A real S1 unit often already has a SPECIFIC, named reason on file: the multi-hop
  // detector's own honest `unresolved-multi-hop` ignored-item (bridge id,
  // candidate count). Surfacing that specific detail instead of a generic
  // "see AREC R2" pointer is what makes a review-queue item actually
  // actionable without a human re-deriving it from typed-facts.json by
  // hand — no new detection, just reading a fact this run already produced.
  const unresolvedMultiHopByUnitId = new Map<string, string>();
  for (const item of facts.ignoredItems) {
    if (item.reason !== 'CROSS_DOMAIN_UNRESOLVED' || !item.detail?.startsWith('unresolved-multi-hop: "')) continue;
    const unitId = item.detail.slice('unresolved-multi-hop: "'.length).split('"')[0];
    if (unitId && !unresolvedMultiHopByUnitId.has(unitId)) {
      unresolvedMultiHopByUnitId.set(unitId, item.detail);
    }
  }

  if (silenceFlags.some((f) => f.startsWith('S1-zero-service-touching-relationships'))) {
    for (const unit of facts.units) {
      if (unit.kind !== 'service' && unit.kind !== 'database') continue;
      const specific = unresolvedMultiHopByUnitId.get(unit.id);
      items.push({
        trigger: 'S1-zero-service-touching-relationships',
        unitId: unit.id,
        unitKind: unit.kind,
        confidence: unit.confidence,
        rationale: specific
          ? `Run has service+database units but 0 relationships touch a service unit. "${unit.id}" has a specific, named residual: ${specific}`
          : `Run has service+database units but 0 relationships touch a service unit. Review whether "${unit.id}" should connect to another unit in this run (see AREC R2 for why an automatic edge wasn't produced).`,
      });
    }
  }

  // low-architecture-coverage — only when S1 did NOT already fire (S1's own
  // items already cover the degenerate 0%-coverage case more directly;
  // this trigger is specifically for the SPARSE-but-nonzero case S1 misses)
  // and only when the rate is even defined (same precondition as S1/S0 —
  // undefined means no store units exist, nothing to review).
  const s1Fired = silenceFlags.some((f) => f.startsWith('S1-zero-service-touching-relationships'));
  const rate = coverage.completeness.architectureOutboundCoverage;
  if (!s1Fired && rate !== undefined && rate < LOW_ARCHITECTURE_COVERAGE_THRESHOLD) {
    const architectureSourceIds = new Set(facts.relationships.filter((r) => r.grade === 'architecture').map((r) => r.from));
    for (const unit of facts.units) {
      if (unit.kind !== 'service') continue;
      if (architectureSourceIds.has(unit.id)) continue; // this one already has real architecture-grade outbound coverage
      items.push({
        trigger: 'low-architecture-coverage',
        unitId: unit.id,
        unitKind: unit.kind,
        confidence: unit.confidence,
        rationale: `Run-wide architecture coverage is ${Math.round(rate * 100)}% (below the ${Math.round(LOW_ARCHITECTURE_COVERAGE_THRESHOLD * 100)}% review threshold) and "${unit.id}" has no real outbound architecture-grade relationship. Review whether it should connect to a store/service this run's mechanisms (R1/R2/R2b) didn't resolve.`,
      });
    }
  }

  if (silenceFlags.some((f) => f.startsWith('S5-zero-service-units-with-store-present'))) {
    for (const unit of facts.units) {
      if (unit.kind !== 'database' && unit.kind !== 'topic') continue;
      items.push({
        trigger: 'S5-zero-service-units-with-store-present',
        unitId: unit.id,
        unitKind: unit.kind,
        confidence: unit.confidence,
        rationale: `Run has real persistence/messaging evidence for "${unit.id}" but 0 service units anywhere in this run — no entry point (HTTP route, Lambda handler, …) was found to own it. Review whether the owning code lives in a package root not scanned this run, or uses an entry-point shape this pipeline doesn't yet recognize.`,
      });
    }
  }

  // S5-cfn-routes-found-but-unbound is genuinely run-level, not per-unit —
  // by the flag's own definition, 0 bindings resolved to any scanned unit,
  // so there is no unitId to name. Same enrichment pattern as the
  // unresolved-multi-hop detail above: cite the real unresolved-cfn-route
  // ignored-items (cfn-route-pass.ts) instead of only the bare count.
  if (silenceFlags.some((f) => f.startsWith('S5-cfn-routes-found-but-unbound'))) {
    const unresolvedCfnRoutes = facts.ignoredItems.filter((item) => item.detail?.startsWith('unresolved-cfn-route:'));
    const flagText = silenceFlags.find((f) => f.startsWith('S5-cfn-routes-found-but-unbound'))!;
    items.push({
      trigger: 'S5-cfn-routes-found-but-unbound',
      rationale:
        unresolvedCfnRoutes.length > 0
          ? `${flagText} Specific unresolved bindings: ${unresolvedCfnRoutes
              .slice(0, 5)
              .map((i) => i.detail)
              .join(' | ')}${unresolvedCfnRoutes.length > 5 ? ` (+${unresolvedCfnRoutes.length - 5} more)` : ''}`
          : flagText,
    });
  }

  if (silenceFlags.some((f) => f.startsWith('S2-http-without-security-control'))) {
    for (const unit of facts.units) {
      const hasHttp = unit.evidence.some((e) => e.category === 'http-entry-point');
      const hasControl = unit.evidence.some((e) => e.category === 'security-control');
      if (!hasHttp || hasControl) continue;
      items.push({
        trigger: 'S2-http-without-security-control',
        unitId: unit.id,
        unitKind: unit.kind,
        confidence: unit.confidence,
        rationale: `"${unit.id}" has HTTP-entry-point evidence but no security-control evidence found by this pipeline's catalogue (see AREC C-call for what is/isn't detected). Review whether real auth exists in source that this run's mechanisms don't cover.`,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceRun: { typedFactsGeneratedAt: facts.generatedAt, contractVersion: facts.contractVersion },
    items,
  };
}

function main() {
  const outDir = process.argv[2];
  if (!outDir) {
    console.error('Usage: hitl-review-trigger.js <run-slice-output-dir>\n\nReads typed-facts.json + coverage-report.json from a completed run-slice.js output directory and writes review-queue.json listing units an S1/S2/S5/low-architecture-coverage silence flag named for human review. Offline, deterministic, read-only over both inputs — never an LLM call, never writes TypedFacts.');
    process.exit(2);
  }

  const factsPath = path.join(outDir, 'typed-facts.json');
  const coveragePath = path.join(outDir, 'coverage-report.json');
  if (!fs.existsSync(factsPath) || !fs.existsSync(coveragePath)) {
    console.error(`[hitl-review-trigger] missing typed-facts.json or coverage-report.json in ${outDir} — run run-slice.js first`);
    process.exit(1);
  }

  const facts: TypedFacts = JSON.parse(fs.readFileSync(factsPath, 'utf8'));
  const coverage: CoverageReport = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  const queue = buildReviewQueue(facts, coverage);

  const outPath = path.join(outDir, 'review-queue.json');
  fs.writeFileSync(outPath, JSON.stringify(queue, null, 2));

  if (queue.items.length === 0) {
    console.log('[hitl-review-trigger] no silence flags fired for this run — nothing to review');
  } else {
    console.log(`[hitl-review-trigger] ${queue.items.length} review item(s) written to ${outPath}`);
    for (const item of queue.items) {
      const target = item.unitId ? `${item.unitId} (${item.unitKind}, confidence ${item.confidence})` : '(run-level, no unit matched)';
      console.log(`  - [${item.trigger}] ${target}`);
    }
  }
}

if (require.main === module) {
  main();
}
