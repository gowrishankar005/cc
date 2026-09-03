import { AnalysisContext } from './pass-registry';
import { TypedUnit, TypedRelationship } from '../types/typed-facts';

/**
 * Without counts, a high confidence score reads as "complete" and a
 * zero-route package reads as "no architecture here" instead of "detect()
 * gate silently failed" (see detect-gate-smoketest.ts). This is the per-run
 * antidote: a real count of what was looked at vs. what became a unit,
 * per package root.
 *
 * Integrity home: platform artefact writer (orchestration/platform-artefacts.ts),
 * not calm-generator — every module downstream of TypedFacts benefits from
 * this, it is not a CALM-only concern.
 *
 * Honest limitation, stated rather than silently over-precise: IgnoredItem
 * has no root attribution (ref is a bare "file:line", and two roots can
 * share a relative path), so `ignoredByReason` is a RUN-LEVEL total, not
 * split per root — narrower than the per-root ideal, correct as far as it
 * goes.
 */
export interface RootCoverage {
  packageRoot: string;
  filesByExt: Record<string, number>;
  nativeRouteCount: number;
  decoratorFactCount: number;
  crossPackageNodeCount: number;
  crossPackageEdgeCount: number;
  unitsByKind: Record<string, number>;
  /** "Absent file -> coverage openapi: absent" — never silently omit the status. */
  openapiStatus: 'present' | 'absent';
  /** Real, previously-invisible coverage: a root can ship a deployable manifest and still produce 0 architectural units (e.g. a shared library with no HTTP route) — this makes that visible instead of silently indistinguishable from "nothing here." */
  deployableManifests: string[]; // manifest type names found at this root, e.g. ["package.json", "Dockerfile"]
}

export interface CoverageReport {
  generatedAt: string;
  crossPackageStatus: 'ok' | 'failed' | 'skipped';
  crossPackageError?: string;
  roots: RootCoverage[];
  ignoredByReason: Record<string, number>;
  unmappedSignalCount: number;
  /** Top-level (not per-root) since --k8s-manifests is one shared directory, not scoped to a package root. */
  k8sManifestsStatus: 'provided' | 'not-provided';
  /**
   * Cross-cutting (not per-root) breakdown of every relationship this run
   * produced, by TypedRelationship.kind and .source — generic dimensions
   * every relationship already carries, not a name list of mechanisms.
   * This is what makes k8s-trust (`shares-secret`/`k8s`) and env-soft-graph
   * (`connects`/`k8s`) counts visible without coverage-report.ts needing to
   * know either mechanism's name specifically.
   */
  relationshipsByKind: Record<string, number>;
  relationshipsBySource: Record<string, number>;
  /**
   * Breakdown of RESOLVED multi-hop edges by `TypedRelationship.mechanism`
   * ('r2-phase1' | 'r2b'), read generically from whatever value is present —
   * this file never hardcodes the two mechanism names. Relationships from
   * every other producer (R0/R1/k8s/env-soft-graph) leave `mechanism`
   * unset and are correctly absent from this breakdown, not bucketed under
   * a fake "other" (see `unresolvedByMechanism` above for the UNRESOLVED
   * side of the same story — this is the resolved side).
   */
  relationshipsByMechanism: Record<string, number>;
  /**
   * Cross-cutting breakdown of CROSS_DOMAIN_UNRESOLVED ignored-items by
   * their detail's own `<mechanism>: ...` prefix convention (established by
   * outbound-http-detector.ts/env-soft-graph-detector.ts/k8s-trust-detector.ts)
   * — GENERIC: any future detector that follows the same "prefix: message"
   * convention is counted automatically, this file never lists mechanism
   * names. Items with no recognized prefix are bucketed under "other".
   */
  unresolvedByMechanism: Record<string, number>;
  /**
   * S1/S2 completeness signals, distinct from confidence. A package can have high-confidence
   * units and still be an architecturally silent/incomplete run (a reference Java/JAX-RS banking platform
   * charge/core: 64 relationships, 0 touching a service unit). These fields
   * make that visible without a hand audit, using dimensions every
   * TypedUnit/TypedRelationship already carries — no a reference Java/JAX-RS banking platform-specific or
   * any other repo-specific logic here.
   */
  completeness: {
    serviceUnitCount: number;
    databaseUnitCount: number;
    /** Relationships where `from` or `to` resolves to a unit with kind 'service'. Zero here, with services and databases both present, is exactly the silent-incompleteness shape S1 names. */
    serviceTouchingRelationshipCount: number;
    /**
     * Units with http-entry-point evidence and no security-control evidence
     * — the SAME definition threat-signals module uses (deliberately kept
     * in sync so the two never silently diverge; see S3 — this is a count,
     * not a claim that no auth exists in source).
     */
    httpUnitsWithoutSecurityControlCount: number;
    /**
     * Topic-kind units typed purely from field-type/import-only messaging
     * evidence (BACKLOG.md "Messaging-producer usage verification") — see
     * S3-messaging-producer-unverified's own definition above for the
     * exact eligibility rule.
     */
    messagingProducerUnverifiedCount: number;
    /**
     * S4 (confidence-not-completeness) is a documentation invariant, not a
     * computed field — deliberately not modelled here; see
     * scope-limitations.yml / metadata-builder.ts for where it's asserted.
     */
    silenceFlags: string[];
    /**
     * Beyond S1's binary "zero vs non-zero", a
     * RATE: of the run's service units, how many have at least one real
     * OUTBOUND architecture-grade relationship (`grade === 'architecture'`
     * — R1 one-hop or R2 bridge-resolved, never `structural`/`trust`).
     * Same precondition spirit as S1 (only meaningful when the run also has
     * store units to potentially connect to) — `undefined` when there are 0
     * store units or 0 service units, never a fake 0/0 ratio.
     */
    topicUnitCount: number;
    servicesWithArchitectureOutbound: number;
    architectureOutboundCoverage?: number;
    /**
     * S6 — BACKLOG.md "Isolated-node completeness flag". A node with zero
     * real relationships touching it (neither `from` nor `to` references
     * its id). Deliberately never counts the synthetic `system`-node
     * `composed-of` edge (`system-node-builder.ts`) as a relationship —
     * that edge is built directly from `TypedUnit[]` at CALM-generation
     * time, strictly AFTER this function runs on `typed-facts.json`'s own
     * `relationships`, so it structurally cannot appear here; no explicit
     * exclusion code was needed. Soft flag by default, same posture as
     * S1/S2/S5 — a lone node is sometimes honestly correct (a newly
     * detected unit whose relationships haven't been recovered yet), so
     * this never fails a run on its own; `--strict-isolated-nodes`
     * (run-slice.ts) is the opt-in gate.
     */
    isolatedNodeCount: number;
  };
}

/**
 * Extracted so `--from-facts` reconstruct-only mode (run-slice.ts) can
 * compute real S1/S2 numbers from a frozen typed-facts.json without a
 * rescan — the same definition used for a live run, not a second one that
 * could silently drift.
 */
export function computeCompleteness(units: TypedUnit[], relationships: TypedRelationship[]): CoverageReport['completeness'] {
  const serviceUnitIds = new Set(units.filter((u) => u.kind === 'service').map((u) => u.id));
  const databaseUnitCount = units.filter((u) => u.kind === 'database').length;
  const topicUnitCount = units.filter((u) => u.kind === 'topic').length;
  const serviceTouchingRelationshipCount = relationships.filter(
    (rel) => serviceUnitIds.has(rel.from) || serviceUnitIds.has(rel.to)
  ).length;
  const httpUnitsWithoutSecurityControlCount = units.filter(
    (u) => u.evidence.some((e) => e.category === 'http-entry-point') && !u.evidence.some((e) => e.category === 'security-control')
  ).length;
  // §5 (BACKLOG.md "Messaging-producer usage verification"): category
  // 'messaging' is set only by two deliberately weak, uncorroborated
  // sources today — field-type (a KafkaTemplate-typed field) and
  // graphify-import (an SQS/SNS import) — neither paired with a
  // .send()/.publish() call-site check. No stronger messaging-category
  // source exists in this pipeline (spring-config-broker, a real
  // config-declared broker address, uses category: 'spring-config'
  // instead, a structurally different unit) — so every topic-kind unit
  // with 'messaging' evidence is eligible here, not a narrower subset.
  //
  // Naming note: the flag below is 'S3' in the silenceFlags NUMBERING
  // ONLY (this file's own S0/S1/S2/S5/S6 sequence — S3/S4 were the next
  // free numbers here). Checked before picking it: several tools/review-session/
  // files separately cite bare "S1"/"S3"/"S4"/"S7" (e.g. apply.py's "S3/S4"
  // deliberate-chokepoint note, triage.py's "S7: no sample hardcodes") as
  // shorthand for a DIFFERENT, unrelated numbered safety/DoD-rule list —
  // not a real string collision (that citation style never uses the
  // trailing-hyphen 'S3-...' shape a real silenceFlag does), but worth
  // flagging so a reader grepping "S3" across the repo isn't confused
  // about which numbering this is.
  const messagingProducerUnverifiedCount = units.filter((u) => u.kind === 'topic' && u.evidence.some((e) => e.category === 'messaging')).length;

  const silenceFlags: string[] = [];
  if (serviceUnitIds.size >= 1 && databaseUnitCount >= 1 && serviceTouchingRelationshipCount === 0) {
    silenceFlags.push(
      `S1-zero-service-touching-relationships: ${serviceUnitIds.size} service unit(s) and ${databaseUnitCount} database unit(s) present, but 0 relationships touch a service unit — likely a multi-hop/layered architecture story not yet recovered, not "no architecture here"`
    );
  }
  if (httpUnitsWithoutSecurityControlCount > 0) {
    silenceFlags.push(
      `S2-http-without-security-control: ${httpUnitsWithoutSecurityControlCount} HTTP-entry-point unit(s) have no security-control evidence — may reflect a missing detection mechanism, not necessarily "no auth in source"`
    );
  }
  if (messagingProducerUnverifiedCount > 0) {
    silenceFlags.push(
      `S3-messaging-producer-unverified: ${messagingProducerUnverifiedCount} messaging-producer unit(s) typed from field-type/import-only evidence alone — no .send()/.publish() call-site check exists in this pipeline yet, so this may be a declared-but-unused field or a different client entirely`
    );
  }
  // The original, still-real gap S1 structurally cannot catch: S1 requires
  // >=1 service unit to even look at relationship count, so a run with ZERO
  // service units (a real serverless-tier-service before Lambda handler
  // detection shipped: 0 services, N Dynamo-import database units,
  // silenceFlags: []) passes through S1 completely silent — the degenerate,
  // LOUDEST-should-be case was the one this project's own silence
  // invariants missed. Real, generic condition (no framework/language
  // name): 0 service units but >=1 database/topic unit exists — that
  // persistence signal proves real architectural code exists, so an
  // entirely absent service surface is suspicious, not "nothing here."
  // Still fires for Node/Python Lambda handlers (deferred, no sample yet)
  // or any handler shape this pipeline's catalogue doesn't recognize.
  if (serviceUnitIds.size === 0 && databaseUnitCount + topicUnitCount >= 1) {
    silenceFlags.push(
      `S5-zero-service-units-with-store-present: 0 service units but ${databaseUnitCount} database + ${topicUnitCount} topic unit(s) present — real persistence/messaging code exists with no discovered HTTP/entry-point surface at all; may be a real gap in entry-point detection for this language/framework (e.g. Node/Python Lambda handlers, not yet built) rather than a service-free codebase`
    );
  }

  // S6 — a node with zero real relationships touching it, in either
  // direction. `relationships` here is exactly typed-facts.json's own
  // TypedRelationship[], computed strictly BEFORE calm-generator's
  // system-node-builder.ts ever runs (see run-slice.ts's pass ordering) —
  // the synthetic system `composed-of` edge doesn't exist yet at this point
  // in the pipeline, so it structurally cannot inflate this count; no
  // explicit filtering was needed to exclude it.
  const touchedUnitIds = new Set<string>();
  for (const rel of relationships) {
    touchedUnitIds.add(rel.from);
    touchedUnitIds.add(rel.to);
  }
  const isolatedNodeCount = units.filter((u) => !touchedUnitIds.has(u.id)).length;
  if (isolatedNodeCount > 0) {
    silenceFlags.push(
      `S6-isolated-nodes: ${isolatedNodeCount} unit(s) exist but have zero relationships touching them — may be a newly-detected unit whose relationships haven't been recovered yet, not necessarily a dead/unused component; see --strict-isolated-nodes to gate on this`
    );
  }

  // Architecture coverage RATE, same precondition
  // spirit as S1 (only meaningful when a store unit exists to potentially
  // connect to). Outbound only (rel.from), architecture-grade only (never
  // structural/trust) — a service "has architecture coverage" when it has
  // at least one real, graded outbound edge, not merely any relationship.
  const storeUnitCount = databaseUnitCount + topicUnitCount;
  const servicesWithArchitectureOutbound =
    storeUnitCount >= 1
      ? [...serviceUnitIds].filter((id) => relationships.some((rel) => rel.from === id && rel.grade === 'architecture')).length
      : 0;
  const architectureOutboundCoverage =
    storeUnitCount >= 1 && serviceUnitIds.size > 0 ? servicesWithArchitectureOutbound / serviceUnitIds.size : undefined;

  return {
    serviceUnitCount: serviceUnitIds.size,
    databaseUnitCount,
    serviceTouchingRelationshipCount,
    httpUnitsWithoutSecurityControlCount,
    messagingProducerUnverifiedCount,
    silenceFlags,
    topicUnitCount,
    servicesWithArchitectureOutbound,
    architectureOutboundCoverage,
    isolatedNodeCount,
  };
}

export function buildCoverageReport(ctx: AnalysisContext): CoverageReport {
  const crossPackageStatus: CoverageReport['crossPackageStatus'] = ctx.crossPackageRun ? 'ok' : ctx.crossPackageError ? 'failed' : 'skipped';

  const roots: RootCoverage[] = ctx.packageRoots.map((root) => {
    const raw = ctx.rawByRoot.get(root);
    const units = ctx.unitsByRoot.get(root) ?? [];
    const unitsByKind: Record<string, number> = {};
    for (const u of units) unitsByKind[u.kind] = (unitsByKind[u.kind] ?? 0) + 1;

    let crossPackageNodeCount = 0;
    let crossPackageEdgeCount = 0;
    if (ctx.crossPackageRun) {
      const { graph, resolveRoot } = ctx.crossPackageRun;
      crossPackageNodeCount = graph.nodes.filter((n) => resolveRoot(n.source_file)?.root === root).length;
      crossPackageEdgeCount = graph.edges.filter((e) => resolveRoot(e.source_file)?.root === root).length;
    }

    const openApiDocs = ctx.openApiDocumentsByRoot?.get(root) ?? [];

    return {
      packageRoot: root,
      filesByExt: raw?.filesByExt ?? {},
      nativeRouteCount: raw?.nativeRoutes.length ?? 0,
      decoratorFactCount: raw?.decoratorFacts.length ?? 0,
      crossPackageNodeCount,
      crossPackageEdgeCount,
      unitsByKind,
      openapiStatus: openApiDocs.length > 0 ? 'present' : 'absent',
      deployableManifests: (raw?.deployableManifests ?? []).map((m) => m.type),
    };
  });

  const ignoredByReason: Record<string, number> = {};
  const unresolvedByMechanism: Record<string, number> = {};
  let unmappedSignalCount = 0;
  const MECHANISM_PREFIX = /^([a-z0-9-]+):/;
  for (const item of ctx.allIgnoredItems) {
    ignoredByReason[item.reason] = (ignoredByReason[item.reason] ?? 0) + 1;
    if (item.detail?.startsWith('No signal-catalogue.yml rule matched')) unmappedSignalCount++;
    if (item.reason === 'CROSS_DOMAIN_UNRESOLVED') {
      const mechanism = MECHANISM_PREFIX.exec(item.detail ?? '')?.[1] ?? 'other';
      unresolvedByMechanism[mechanism] = (unresolvedByMechanism[mechanism] ?? 0) + 1;
    }
  }

  const relationshipsByKind: Record<string, number> = {};
  const relationshipsBySource: Record<string, number> = {};
  const relationshipsByMechanism: Record<string, number> = {};
  for (const rel of ctx.relationships) {
    relationshipsByKind[rel.kind] = (relationshipsByKind[rel.kind] ?? 0) + 1;
    relationshipsBySource[rel.source] = (relationshipsBySource[rel.source] ?? 0) + 1;
    if (rel.mechanism !== undefined) {
      relationshipsByMechanism[rel.mechanism] = (relationshipsByMechanism[rel.mechanism] ?? 0) + 1;
    }
  }

  const completeness = computeCompleteness(ctx.allUnits, ctx.relationships);
  // crossPackageStatus was already surfaced prominently in
  // intelligence-ir.md's own header, but living in a DIFFERENT field than
  // silenceFlags meant a reviewer (or the hitl-review-trigger.js CLI,
  // which reads exactly this array) could miss that a degraded/failed
  // cross-package backbone pass is the REAL reason a run looks architecturally
  // empty — every cross-package edge, persistence-detector unit, and R2
  // bridge resolution depends on it; a failure here silently starves S1's
  // own precondition (fewer database units even exist to trigger it).
  // Folding this into the SAME reviewer-facing list closes that gap.
  if (crossPackageStatus !== 'ok') {
    completeness.silenceFlags.push(
      `S0-cross-package-backbone-incomplete: crossPackageStatus is "${crossPackageStatus}"${ctx.crossPackageError ? ` (${String(ctx.crossPackageError)})` : ''} — cross-package relationships, import-based persistence/messaging units, and R2 bridge resolution all depend on the cross-package backbone pass; this run's architecture story may look emptier than the source code actually is, for a reason unrelated to detection maturity`
    );
  }
  // The CFN-specific half: real
  // infra evidence of an HTTP surface (actual API Gateway Method/Resource
  // bindings in the passed --cfn-manifests dir) exists, but NONE of it
  // bound to any unit this scan found — e.g. the handler's Java source
  // lives in a package root not passed to this scan (a real, honest
  // 21-of-26-unresolved case found against
  // a reference AWS SaaS sample's shared resources/ directory). Only meaningful when
  // --cfn-manifests was actually passed (undefined, not 0, when it wasn't
  // — same "don't fake a 0" precondition discipline as every other rate
  // in this file).
  if (ctx.cfnRouteBindingsFound !== undefined && ctx.cfnRouteBindingsFound > 0 && ctx.cfnRouteBindingsBound === 0) {
    completeness.silenceFlags.push(
      `S5-cfn-routes-found-but-unbound: ${ctx.cfnRouteBindingsFound} real CFN API Gateway route binding(s) found in --cfn-manifests, but 0 bound to any unit in this scan — the handler code for these routes likely lives in a package root not included in this run (or uses a handler shape this pipeline doesn't yet recognize), not "no HTTP surface here"`
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    crossPackageStatus,
    crossPackageError: ctx.crossPackageError ? String(ctx.crossPackageError) : undefined,
    roots,
    ignoredByReason,
    unmappedSignalCount,
    k8sManifestsStatus: ctx.k8sManifestsDir ? 'provided' : 'not-provided',
    relationshipsByKind,
    relationshipsBySource,
    relationshipsByMechanism,
    unresolvedByMechanism,
    completeness,
  };
}
