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
 * typed-facts.json by hand — exactly the "Fineract miss was exactly false
 * confidence without a flag" rationale review-flow-capability-map.md names.
 *
 * Robustness T-R4-1 added a THIRD trigger, `low-architecture-coverage`
 * (see the threshold constant below for why): the original T-E5 scope only
 * ever wired in S1/S2, but T-R4-1's own goal always named "S1 fires OR arch
 * coverage below threshold" — the second half was a real, unclosed gap
 * until this trigger was added, not a hypothetical extension.
 */

export interface ReviewQueueItem {
  trigger: 'S1-zero-service-touching-relationships' | 'S2-http-without-security-control' | 'low-architecture-coverage';
  unitId: string;
  unitKind: TypedUnit['kind'];
  confidence: number;
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
 * recalibrated" framing as every other weight/threshold in this project
 * (Gap_Closure_Build_Ready_Specs_v0.1.md §7's own confidence-band framing).
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

  if (silenceFlags.some((f) => f.startsWith('S1-zero-service-touching-relationships'))) {
    for (const unit of facts.units) {
      if (unit.kind !== 'service' && unit.kind !== 'database') continue;
      items.push({
        trigger: 'S1-zero-service-touching-relationships',
        unitId: unit.id,
        unitKind: unit.kind,
        confidence: unit.confidence,
        rationale: `Run has service+database units but 0 relationships touch a service unit. Review whether "${unit.id}" should connect to another unit in this run (see AREC R2 for why an automatic edge wasn't produced).`,
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
    console.error('Usage: hitl-review-trigger.js <run-slice-output-dir>\n\nReads typed-facts.json + coverage-report.json from a completed run-slice.js output directory and writes review-queue.json listing units an S1/S2 silence flag named for human review. Offline, deterministic, read-only over both inputs — never an LLM call, never writes TypedFacts.');
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
    console.log('[hitl-review-trigger] no S1/S2 silence flags fired for this run — nothing to review');
  } else {
    console.log(`[hitl-review-trigger] ${queue.items.length} review item(s) written to ${outPath}`);
    for (const item of queue.items) {
      console.log(`  - [${item.trigger}] ${item.unitId} (${item.unitKind}, confidence ${item.confidence})`);
    }
  }
}

if (require.main === module) {
  main();
}
