import { AnalysisContext } from './pass-registry';
import { TypedUnit, TypedRelationship } from '../types/typed-facts';

/**
 * T-X0-1 (AGENT_TASKS_Extraction_Enrichment.md) — without counts, a high
 * confidence score reads as "complete" and a zero-route package reads as
 * "no architecture here" instead of "detect() gate silently failed"
 * (requirements v0.6 §4, detect-gate-smoketest.ts). This is the per-run
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
  graphifyNodeCount: number;
  graphifyEdgeCount: number;
  unitsByKind: Record<string, number>;
  /** T-X4-1's own mitigation: "Absent file -> coverage openapi: absent" — never silently omit the status. */
  openapiStatus: 'present' | 'absent';
  /** T-X8-1 — real, previously-invisible coverage: a root can ship a deployable manifest and still produce 0 architectural units (e.g. a shared library with no HTTP route) — this makes that visible instead of silently indistinguishable from "nothing here." */
  deployableManifests: string[]; // manifest type names found at this root, e.g. ["package.json", "Dockerfile"]
}

export interface CoverageReport {
  generatedAt: string;
  graphifyStatus: 'ok' | 'failed' | 'skipped';
  graphifyError?: string;
  roots: RootCoverage[];
  ignoredByReason: Record<string, number>;
  unmappedSignalCount: number;
  /** T-X5-1 — top-level (not per-root) since --k8s-manifests is one shared directory, not scoped to a package root. */
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
   * Cross-cutting breakdown of CROSS_DOMAIN_UNRESOLVED ignored-items by
   * their detail's own `<mechanism>: ...` prefix convention (established by
   * outbound-http-detector.ts/env-soft-graph-detector.ts/k8s-trust-detector.ts)
   * — GENERIC: any future detector that follows the same "prefix: message"
   * convention is counted automatically, this file never lists mechanism
   * names. Items with no recognized prefix are bucketed under "other".
   */
  unresolvedByMechanism: Record<string, number>;
  /**
   * AREC Wave 3 T-A1 (S1/S2, validation-approach-vnext.md §L3) — completeness
   * signals, distinct from confidence. A package can have high-confidence
   * units and still be an architecturally silent/incomplete run (Fineract
   * charge/core: 64 relationships, 0 touching a service unit). These fields
   * make that visible without a hand audit, using dimensions every
   * TypedUnit/TypedRelationship already carries — no Fineract-specific or
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
     * S4 (confidence-not-completeness) is a documentation invariant, not a
     * computed field — deliberately not modelled here; see
     * scope-limitations.yml / metadata-builder.ts for where it's asserted.
     */
    silenceFlags: string[];
    /**
     * Robustness Wave T-R0-2 — beyond S1's binary "zero vs non-zero", a
     * RATE: of the run's service units, how many have at least one real
     * OUTBOUND architecture-grade relationship (T-A2's `grade === 'architecture'`
     * — R1 one-hop or R2 bridge-resolved, never `structural`/`trust`).
     * Same precondition spirit as S1 (only meaningful when the run also has
     * store units to potentially connect to) — `undefined` when there are 0
     * store units or 0 service units, never a fake 0/0 ratio.
     */
    topicUnitCount: number;
    servicesWithArchitectureOutbound: number;
    architectureOutboundCoverage?: number;
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

  const silenceFlags: string[] = [];
  if (serviceUnitIds.size >= 1 && databaseUnitCount >= 1 && serviceTouchingRelationshipCount === 0) {
    silenceFlags.push(
      `S1-zero-service-touching-relationships: ${serviceUnitIds.size} service unit(s) and ${databaseUnitCount} database unit(s) present, but 0 relationships touch a service unit — likely a multi-hop/layered architecture story not yet recovered (see AREC R2), not "no architecture here"`
    );
  }
  if (httpUnitsWithoutSecurityControlCount > 0) {
    silenceFlags.push(
      `S2-http-without-security-control: ${httpUnitsWithoutSecurityControlCount} HTTP-entry-point unit(s) have no security-control evidence — may reflect a missing detection mechanism (see AREC C-call), not necessarily "no auth in source"`
    );
  }

  // Robustness T-R0-2 — architecture coverage RATE, same precondition
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
    silenceFlags,
    topicUnitCount,
    servicesWithArchitectureOutbound,
    architectureOutboundCoverage,
  };
}

export function buildCoverageReport(ctx: AnalysisContext): CoverageReport {
  const graphifyStatus: CoverageReport['graphifyStatus'] = ctx.graphifyRun ? 'ok' : ctx.graphifyError ? 'failed' : 'skipped';

  const roots: RootCoverage[] = ctx.packageRoots.map((root) => {
    const raw = ctx.rawByRoot.get(root);
    const units = ctx.unitsByRoot.get(root) ?? [];
    const unitsByKind: Record<string, number> = {};
    for (const u of units) unitsByKind[u.kind] = (unitsByKind[u.kind] ?? 0) + 1;

    let graphifyNodeCount = 0;
    let graphifyEdgeCount = 0;
    if (ctx.graphifyRun) {
      const { graph, resolveRoot } = ctx.graphifyRun;
      graphifyNodeCount = graph.nodes.filter((n) => resolveRoot(n.source_file)?.root === root).length;
      graphifyEdgeCount = graph.edges.filter((e) => resolveRoot(e.source_file)?.root === root).length;
    }

    const openApiDocs = ctx.openApiDocumentsByRoot?.get(root) ?? [];

    return {
      packageRoot: root,
      filesByExt: raw?.filesByExt ?? {},
      nativeRouteCount: raw?.nativeRoutes.length ?? 0,
      decoratorFactCount: raw?.decoratorFacts.length ?? 0,
      graphifyNodeCount,
      graphifyEdgeCount,
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
  for (const rel of ctx.relationships) {
    relationshipsByKind[rel.kind] = (relationshipsByKind[rel.kind] ?? 0) + 1;
    relationshipsBySource[rel.source] = (relationshipsBySource[rel.source] ?? 0) + 1;
  }

  const completeness = computeCompleteness(ctx.allUnits, ctx.relationships);
  // Robustness T-R0-5 — graphifyStatus was already surfaced prominently in
  // intelligence-ir.md's own header, but living in a DIFFERENT field than
  // silenceFlags meant a reviewer (or the T-E5 hitl-review-trigger.js CLI,
  // which reads exactly this array) could miss that a degraded/failed
  // Graphify pass is the REAL reason a run looks architecturally empty —
  // every cross-package edge, persistence-detector unit, and R2 bridge
  // resolution depends on Graphify; a failure here silently starves S1's
  // own precondition (fewer database units even exist to trigger it).
  // Folding this into the SAME reviewer-facing list closes that gap.
  if (graphifyStatus !== 'ok') {
    completeness.silenceFlags.push(
      `S0-graphify-backbone-incomplete: graphifyStatus is "${graphifyStatus}"${ctx.graphifyError ? ` (${String(ctx.graphifyError)})` : ''} — cross-package relationships, import-based persistence/messaging units, and R2 bridge resolution all depend on Graphify; this run's architecture story may look emptier than the source code actually is, for a reason unrelated to R2/C-call maturity`
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    graphifyStatus,
    graphifyError: ctx.graphifyError ? String(ctx.graphifyError) : undefined,
    roots,
    ignoredByReason,
    unmappedSignalCount,
    k8sManifestsStatus: ctx.k8sManifestsDir ? 'provided' : 'not-provided',
    relationshipsByKind,
    relationshipsBySource,
    unresolvedByMechanism,
    completeness,
  };
}
