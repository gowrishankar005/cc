import * as fs from 'fs';
import * as path from 'path';
import { TypedFacts } from '../../types/typed-facts';
import { CoverageReport } from '../coverage-report';
import { UnmappedSignalsReport } from '../unmapped-signals';
import { EvidencePack, countReviewWorthyIgnoredItems } from './evidence-packs';

/**
 * T-X3-2 — Platform IR, per Extraction_Gaps_Mitigation_and_IR_Platform_Review.md
 * §3: NOT a CALM draft, NOT calm-generator-owned. Deterministically rendered
 * from TypedFacts + coverage + unmapped + evidence packs — the same
 * intelligence every module reads, in a human/LLM-legible view. Module
 * output (CALM, threat-signals) is read back OPTIONALLY, as a projection
 * appendix, after modules have already run — this file never feeds the
 * reverse direction (IR -> TypedFacts is explicitly forbidden, §3.2 rule 1).
 *
 * Deliberately named `intelligence-ir.md`, not `architecture-ir.md`
 * (Extraction_Gaps §3.4) — the naming itself is part of not re-committing
 * v2 §13's original CALM-centric framing.
 */
export function renderIntelligenceIR(
  facts: TypedFacts,
  coverage: CoverageReport,
  unmapped: UnmappedSignalsReport,
  evidencePacks: EvidencePack[],
  outDir: string
): string {
  const lines: string[] = [];
  const h = (s: string) => lines.push(s, '');

  h(`# Intelligence IR`);
  lines.push(
    `Generated one-way from \`typed-facts.json\` (+ coverage + unmapped). This is a platform intelligence notebook, not a CALM draft — CALM/threat-signals below are read-only projections of the same facts, not a second source of truth.`,
    ''
  );

  h(`## Run header`);
  lines.push(
    `- contractVersion: \`${facts.contractVersion}\``,
    `- runVersion (catalogue): \`${facts.runVersion}\``,
    `- generatedAt: ${facts.generatedAt}`,
    `- packageRoots: ${facts.packageRoots.map((r) => `\`${r}\``).join(', ') || '(none)'}`,
    ''
  );

  h(`## Coverage appendix`);
  lines.push(
    `- graphifyStatus: \`${coverage.graphifyStatus}\`${coverage.graphifyError ? ` (${coverage.graphifyError})` : ''}`,
    `- k8sManifestsStatus: \`${coverage.k8sManifestsStatus}\``,
    `- relationships by kind: ${Object.entries(coverage.relationshipsByKind).map(([k, c]) => `${k}=${c}`).join(', ') || '(none)'}`,
    `- relationships by source: ${Object.entries(coverage.relationshipsBySource).map(([k, c]) => `${k}=${c}`).join(', ') || '(none)'}`,
    // T-L3-2 — resolved multi-hop edges by mechanism (r2-phase1/r2b, T-L2-1),
    // the resolved-side counterpart to "unresolved by mechanism" below.
    `- relationships by mechanism (multi-hop): ${Object.entries(coverage.relationshipsByMechanism).map(([k, c]) => `${k}=${c}`).join(', ') || '(none)'}`,
    `- unresolved by mechanism: ${Object.entries(coverage.unresolvedByMechanism).map(([k, c]) => `${k}=${c}`).join(', ') || '(none)'}`,
    ''
  );

  h(`## Completeness (AREC S1/S2 — distinct from confidence; see S4)`);
  lines.push(
    `- service units: ${coverage.completeness.serviceUnitCount}, database units: ${coverage.completeness.databaseUnitCount}, topic units: ${coverage.completeness.topicUnitCount}`,
    `- relationships touching a service unit: ${coverage.completeness.serviceTouchingRelationshipCount}`,
    `- HTTP-entry-point units without security-control evidence: ${coverage.completeness.httpUnitsWithoutSecurityControlCount}`,
    // Robustness T-R0-2 — a RATE alongside S1's binary flag. "N/A" (not 0%)
    // when there are no store units to potentially connect to — same
    // honesty discipline as every other precondition-gated metric here.
    `- architecture coverage: ${coverage.completeness.servicesWithArchitectureOutbound}/${coverage.completeness.serviceUnitCount} service unit(s) have ≥1 architecture-grade outbound relationship${coverage.completeness.architectureOutboundCoverage !== undefined ? ` (${(coverage.completeness.architectureOutboundCoverage * 100).toFixed(0)}%)` : ' (N/A — no store units in this run)'}`,
    ''
  );
  if (coverage.completeness.silenceFlags.length > 0) {
    lines.push(`**Silence flags:**`, '');
    for (const flag of coverage.completeness.silenceFlags) lines.push(`- ⚠️ ${flag}`);
    lines.push('');
  } else {
    lines.push(`No silence flags raised.`, '');
  }

  for (const root of coverage.roots) {
    lines.push(`### \`${root.packageRoot}\``);
    lines.push(
      `- files by extension: ${Object.entries(root.filesByExt).map(([e, c]) => `${e}=${c}`).join(', ') || '(none)'}`,
      `- native routes: ${root.nativeRouteCount}, decorator facts: ${root.decoratorFactCount}`,
      `- graphify nodes: ${root.graphifyNodeCount}, edges: ${root.graphifyEdgeCount}`,
      `- units by kind: ${Object.entries(root.unitsByKind).map(([k, c]) => `${k}=${c}`).join(', ') || '(none)'}`,
      ''
    );
  }
  lines.push(
    `- ignored items by reason: ${Object.entries(coverage.ignoredByReason).map(([r, c]) => `${r}=${c}`).join(', ') || '(none)'}`,
    `- unmapped signal occurrences: ${coverage.unmappedSignalCount}`,
    ''
  );

  h(`## Units (${facts.units.length})`);
  for (const u of facts.units) {
    lines.push(`- \`${u.id}\` — kind: ${u.kind}, confidence: ${u.confidence}, evidence: ${u.evidence.map((e) => e.signal).join(', ')}`);
  }
  lines.push('');

  h(`## Relationships (${facts.relationships.length})`);
  for (const r of facts.relationships) {
    lines.push(`- \`${r.from}\` --${r.kind}--> \`${r.to}\` (${r.crossPackage ? 'cross-package' : 'same-package'}, source: ${r.source})`);
  }
  lines.push('');

  // B-scale-oom (T-SP1-1) — evidencePacks is capped (MAX_EVIDENCE_PACKS) by
  // buildEvidencePacks itself; report the real total honestly rather than
  // silently showing a partial count as if it were complete, same
  // truncated-but-disclosed convention as the unmapped-signals section below.
  const totalReviewWorthy = countReviewWorthyIgnoredItems(facts.ignoredItems);
  const evidenceTruncated = totalReviewWorthy > evidencePacks.length;
  h(
    `## Ignored / ambiguous (evidence packs: ${evidencePacks.length}${evidenceTruncated ? ` of ${totalReviewWorthy} review-worthy item(s), truncated — see ignored-items-report.json for the full list` : ''})`
  );
  for (const pack of evidencePacks) {
    lines.push(`### \`${pack.ref}\` — ${pack.reason}`);
    if (pack.detail) lines.push(`> ${pack.detail}`);
    if (pack.snippet) {
      lines.push('```', ...pack.snippet, '```');
    }
    lines.push('');
  }

  h(`## Unmapped signals (${unmapped.clusterCount} cluster(s), ${unmapped.totalUnmappedOccurrences} occurrence(s)${unmapped.truncated ? ', truncated' : ''})`);
  for (const cluster of unmapped.clusters) {
    lines.push(`- \`${cluster.signal}\` — ${cluster.count}x (e.g. ${cluster.sampleRefs.slice(0, 2).join(', ')})`);
  }
  lines.push('', `> ${unmapped.footer}`, '');

  h(`## Module projections (optional, read-only)`);
  const calmPath = path.join(outDir, 'architecture.calm.json');
  if (fs.existsSync(calmPath)) {
    const calm = JSON.parse(fs.readFileSync(calmPath, 'utf8'));
    lines.push(`- CALM preview: ${calm.nodes?.length ?? 0} node(s), ${calm.relationships?.length ?? 0} relationship(s) — see \`architecture.calm.json\`.`);
  }
  const threatPath = path.join(outDir, 'modules', 'threat-signals', 'threat-signals-report.json');
  if (fs.existsSync(threatPath)) {
    const threat = JSON.parse(fs.readFileSync(threatPath, 'utf8'));
    lines.push(`- Threat findings: ${threat.findings?.length ?? 0} — see \`modules/threat-signals/threat-signals-report.json\`.`);
  }
  lines.push('');

  return lines.join('\n');
}
