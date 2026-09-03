#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { TypedFacts, TypedUnit, TypedRelationship } from '../../types/typed-facts';
import { CoverageReport } from '../coverage-report';
import { UNRESOLVED_MULTI_HOP_PREFIX, TIER_B_SINGLE_CANDIDATE_PREFIX } from '../cross_package/multi-hop-bridge-detector';
import { CONTRADICTION_PREFIX } from '../cross_package/contradiction-detector';
import { UNRESOLVED_HTTP_TARGET_PREFIX } from '../cross_package/outbound-http-detector';
import { UNRESOLVED_ENV_TARGET_PREFIX } from '../cross_package/env-soft-graph-detector';
import { findUnitForDeployment } from '../cross_package/deployment-correlation';
import { CONFIDENCE_FLOOR } from '../passes';

/**
 * OFFLINE ONLY, deterministic, no LLM call anywhere in this file — stricter
 * than suggest-rules.ts (which at least offers an LLM backend behind an env
 * var). Never imported by orchestration/run-slice.ts or anything in its
 * call graph. A human (or a future separate LLM step reading this file's
 * OUTPUT, never writing TypedFacts directly) runs this deliberately, after
 * a scan, over that scan's own artifacts. Read-only over
 * typed-facts.json/coverage-report.json — never writes to either; only
 * ever writes a NEW file (review-queue.json).
 *
 * Turns "S1/S2 fired" (a boolean-ish flag buried in coverage-report.json,
 * easy to miss) into a concrete, actionable list: WHICH units triggered it,
 * so a human reviewing a run doesn't have to re-derive that from
 * typed-facts.json by hand.
 *
 * A later pass added a THIRD trigger, `low-architecture-coverage`
 * (see the threshold constant below for why): the original scope only
 * ever wired in S1/S2, but the stated goal always named "S1 fires OR arch
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
    | 'S5-cfn-routes-found-but-unbound'
    // multi-hop-bridge-detector.ts's own 'tier-b-single-candidate'
    // ignored-item class: exactly one real
    // database/topic candidate found among a bridge's several syntactic
    // implementers, distinct from genuine multi-candidate ambiguity (which
    // still routes through S1/low-architecture-coverage above, unchanged).
    | 'multi-hop-single-candidate-below-threshold'
    // contradiction-detector.ts's own 'contradiction:' ignored-item
    // class: two evidence sources assert DIFFERENT values for
    // the same real-world fact (e.g. a k8s deployment manifest naming one
    // datastore engine, the live spring-config naming another). Forces a
    // review decision; the conflicting unit's own confidence is never
    // touched or averaged by this trigger.
    | 'contradicting-evidence-force-review'
    // §3.2 (Architect_Residual_Review_Session.md) — a real, citable piece
    // of evidence (an HTTP-client import site, or a ConfigMap value
    // shaped like a service address) that a deterministic correlation
    // mechanism refused to fabricate into a relationship. Distinct from
    // unresolved-multi-hop/unresolved-k8s-deployed-in (genuine
    // absence/ambiguity, no specific evidence to cite) — those stay
    // filtered as noise, unchanged, per design doc §7.1's
    // evidence-specificity eligibility rule.
    | 'unresolved-outbound-target'
    // §3.3 (Architect_Residual_Review_Session.md) — a genuinely different
    // problem from unresolved-outbound-target above: not a relationship
    // that was refused, but one that's already sitting in the canonical
    // architecture.calm.json today at low confidence (fixed 20 from the
    // opt-in env-soft-graph mechanism, --enable-env-soft-graph) with
    // nothing ever surfacing it for a second look. Reads TypedRelationship[]
    // directly, never an IgnoredItem — a third kind of producer.
    | 'low-confidence-emitted-relationship'
    // BACKLOG.md "Messaging-producer usage verification" — coverage-report.ts's
    // new S3 flag. A topic unit typed purely from field-type/import-only
    // messaging evidence, never paired with a real .send()/.publish()
    // call-site check (no such mechanism exists in this pipeline yet).
    // Same shape as S2: a completely silent gap before this trigger
    // existed, an architect judgment call, not a draftable action.
    | 'S3-messaging-producer-unverified';
  /** Absent for a genuinely run-level residual (S5-cfn-routes-found-but-unbound) — no unit was matched, so none can be named. */
  unitId?: string;
  unitKind?: TypedUnit['kind'];
  confidence?: number;
  rationale: string;
}

/**
 * The original goal named TWO triggers ("when S1 fires OR arch coverage
 * below threshold"), but only S1 was ever wired in (this trigger shipped
 * before coverage-report.ts's architectureOutboundCoverage metric existed
 * at all). Real gap, not just a doc-sync item: S1 only fires
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

  // Real perf/style fix (code review 2026-08-16): built once here and
  // reused by every block below that needs "look up a unit by id" — the
  // tier-b and contradiction blocks previously called `facts.units.find()`
  // INSIDE a loop over facts.ignoredItems (O(n×m)), when this exact
  // Map-based O(1) pattern already existed a few lines below for the
  // analogous unresolved-multi-hop case. One lookup structure, reused.
  const unitsById = new Map(facts.units.map((u) => [u.id, u]));

  // A real S1 unit often already has a SPECIFIC, named reason on file: the multi-hop
  // detector's own honest `unresolved-multi-hop` ignored-item (bridge id,
  // candidate count). Surfacing that specific detail instead of a generic
  // pointer is what makes a review-queue item actually actionable without a
  // human re-deriving it from typed-facts.json by hand — no new detection,
  // just reading a fact this run already produced.
  const unresolvedMultiHopByUnitId = new Map<string, string>();
  for (const item of facts.ignoredItems) {
    if (item.reason !== 'CROSS_DOMAIN_UNRESOLVED' || !item.detail?.startsWith(UNRESOLVED_MULTI_HOP_PREFIX)) continue;
    const unitId = item.detail.slice(UNRESOLVED_MULTI_HOP_PREFIX.length).split('"')[0];
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
          : `Run has service+database units but 0 relationships touch a service unit. Review whether "${unit.id}" should connect to another unit in this run — the multi-hop bridge mechanism did not find enough evidence to produce an edge automatically.`,
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
        rationale: `"${unit.id}" has HTTP-entry-point evidence but no security-control evidence found by this pipeline's catalogue. Review whether real auth exists in source that this run's mechanisms don't cover.`,
      });
    }
  }

  if (silenceFlags.some((f) => f.startsWith('S3-messaging-producer-unverified'))) {
    for (const unit of facts.units) {
      if (unit.kind !== 'topic' || !unit.evidence.some((e) => e.category === 'messaging')) continue;
      items.push({
        trigger: 'S3-messaging-producer-unverified',
        unitId: unit.id,
        unitKind: unit.kind,
        confidence: unit.confidence,
        rationale: `"${unit.id}" is typed as a messaging producer purely from field-type/import-only evidence — no .send()/.publish() call-site check exists in this pipeline yet. Review whether the code actually uses this field/import to send or publish, or whether it's declared-but-unused / a different client entirely.`,
      });
    }
  }

  // Always surfaced when present, unlike S1/S2/S5 above: this is a real
  // fact about ONE specific edge (multi-hop-bridge-detector.ts found
  // exactly one real store candidate among several syntactic implementers),
  // not a run-wide completeness gap that only matters when a silence flag
  // also fired. The detail text is the review tooling's own actionable
  // class distinction — "one high-confidence candidate obscured by noise"
  // vs. "genuinely many candidates" (the latter stays under
  // S1/low-architecture-coverage, unchanged).
  for (const item of facts.ignoredItems) {
    if (item.reason !== 'CROSS_DOMAIN_UNRESOLVED' || !item.detail?.startsWith(TIER_B_SINGLE_CANDIDATE_PREFIX)) continue;
    const sourceUnitId = item.detail.slice(TIER_B_SINGLE_CANDIDATE_PREFIX.length).split('"')[0];
    const sourceUnit = unitsById.get(sourceUnitId);
    items.push({
      trigger: 'multi-hop-single-candidate-below-threshold',
      unitId: sourceUnitId,
      unitKind: sourceUnit?.kind,
      confidence: sourceUnit?.confidence,
      rationale: item.detail,
    });
  }

  // §3.2 — same always-on convention as the tier-b block above: a real,
  // citable outbound-target hypothesis matters regardless of this run's
  // overall silence-flag state. Best-effort unitId recovery, since neither
  // detector's own ignored-item shape gives one directly:
  //  - unresolved-http-target: item.ref is "relativeFilePath:line"
  //    (outbound-http-detector.ts's own convention) — match by filePath
  //    against the unit that owns that file (Slice 1's one-unit-per-file
  //    granularity makes this exact, not a heuristic).
  //  - unresolved-env-target: item.ref is a synthetic "k8s:configmap:..."
  //    key, not a unit id at all — the real referencing deployment's name
  //    is the first quoted string in detail; reuse
  //    deployment-correlation.ts's own findUnitForDeployment (the same
  //    matcher env-soft-graph-detector.ts itself already uses) instead of
  //    a second, drifting name-matching heuristic here.
  const unitsByFilePath = new Map(facts.units.map((u) => [u.filePath, u]));
  for (const item of facts.ignoredItems) {
    if (item.reason !== 'CROSS_DOMAIN_UNRESOLVED') continue;
    const isHttp = item.detail?.startsWith(UNRESOLVED_HTTP_TARGET_PREFIX);
    const isEnv = item.detail?.startsWith(UNRESOLVED_ENV_TARGET_PREFIX);
    if (!isHttp && !isEnv) continue;

    let unit: TypedUnit | undefined;
    if (isHttp) {
      const filePath = item.ref.replace(/:\d+$/, '');
      unit = unitsByFilePath.get(filePath);
    } else {
      const referencerName = item.detail!.match(/"([^"]+)"/)?.[1];
      unit = referencerName ? findUnitForDeployment(facts.units, referencerName) : undefined;
    }

    items.push({
      trigger: 'unresolved-outbound-target',
      unitId: unit?.id,
      unitKind: unit?.kind,
      confidence: unit?.confidence,
      rationale: item.detail!,
    });
  }

  // §3.3 — reads facts.relationships directly, never an IgnoredItem (a
  // relationship that WAS emitted, at low confidence, not one that was
  // refused). undefined confidence must never be treated as low — same
  // "no confidence claim, not zero" convention TypedRelationship.confidence's
  // own doc comment states; a bare `< CONFIDENCE_FLOOR` comparison would
  // incorrectly pass for every relationship with no confidence claim at all
  // (JS: `undefined < 40` is false, but relying on that coercion instead of
  // an explicit check is exactly the implicit behavior this repo avoids).
  // unitsById built once, reused here (same map already built above for the
  // tier-b/contradiction blocks).
  for (const rel of facts.relationships) {
    if (rel.grade !== 'architecture') continue;
    if (rel.confidence === undefined || rel.confidence >= CONFIDENCE_FLOOR) continue;
    const fromUnit = unitsById.get(rel.from);
    items.push({
      trigger: 'low-confidence-emitted-relationship',
      unitId: rel.from,
      unitKind: fromUnit?.kind,
      confidence: fromUnit?.confidence,
      rationale: `relationship "${rel.id}" (${rel.from} -> ${rel.to}, confidence ${rel.confidence}) is already emitted in this run's architecture.calm.json but has never been reviewed. ${
        rel.evidenceNote ?? 'No further evidence captured for this relationship.'
      }`,
    });
  }

  // Same always-on convention as the tier-b block above: a real
  // contradiction about one specific unit matters regardless of this run's
  // overall silence-flag state. item.ref IS the contradicted unit's own id
  // (contradiction-detector.ts sets it that way), so no text-parsing is
  // needed to recover it, unlike the tier-b block above.
  for (const item of facts.ignoredItems) {
    if (item.reason !== 'AMBIGUOUS_BOUNDARY' || !item.detail?.startsWith(CONTRADICTION_PREFIX)) continue;
    const unit = unitsById.get(item.ref);
    items.push({
      trigger: 'contradicting-evidence-force-review',
      unitId: item.ref,
      unitKind: unit?.kind,
      confidence: unit?.confidence,
      rationale: item.detail,
    });
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
