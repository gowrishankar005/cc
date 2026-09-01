/**
 * Emission-coverage rule: "what the representation could not
 * carry, and why" becomes a required emission output, not an implicit
 * assumption. Closes BACKLOG.md's "Emission-coverage reporting as a
 * governed rule" row: `coverage-report.ts`/`unmapped-signals.ts` already
 * report analysis-time (pre-CALM) completeness; nothing previously recorded
 * completeness at the later, distinct point where a real TypedUnit/
 * TypedRelationship/security-control-evidence fact existed but the CALM
 * representation itself had no catalogue row to carry it.
 *
 * Gaps are recorded INLINE by the builders themselves at their own existing
 * `continue`/filter drop points (node-builder.ts, relationship-builder.ts,
 * control-builder.ts) — never re-derived here by walking facts a second
 * time with independent logic, which would risk drifting out of sync with
 * what the builders actually decide.
 */
export interface EmissionCoverageGap {
  stage: 'node' | 'relationship' | 'control';
  factId: string;
  reason: string;
}

export interface EmissionCoverageReport {
  units: { total: number; represented: number; dropped: number };
  relationships: { total: number; represented: number; dropped: number };
  controlEvidence: { total: number; represented: number; dropped: number };
  /** (represented units + represented relationships + represented control evidence) / same totals. 1 when nothing was dropped; 1 (not NaN) when there was nothing to consider. */
  coverageRatio: number;
  gaps: EmissionCoverageGap[];
}

export function buildEmissionCoverageReport(
  units: Array<{ evidence: Array<{ category: string }> }>,
  relationships: unknown[],
  gaps: EmissionCoverageGap[]
): EmissionCoverageReport {
  const controlEvidenceTotal = units.reduce((n, u) => n + u.evidence.filter((e) => e.category === 'security-control').length, 0);

  const droppedByStage = (stage: EmissionCoverageGap['stage']): number => gaps.filter((g) => g.stage === stage).length;
  const nodeDropped = droppedByStage('node');
  const relationshipDropped = droppedByStage('relationship');
  const controlDropped = droppedByStage('control');

  const totalConsidered = units.length + relationships.length + controlEvidenceTotal;
  const totalDropped = nodeDropped + relationshipDropped + controlDropped;

  return {
    units: { total: units.length, represented: units.length - nodeDropped, dropped: nodeDropped },
    relationships: { total: relationships.length, represented: relationships.length - relationshipDropped, dropped: relationshipDropped },
    controlEvidence: { total: controlEvidenceTotal, represented: controlEvidenceTotal - controlDropped, dropped: controlDropped },
    coverageRatio: totalConsidered === 0 ? 1 : (totalConsidered - totalDropped) / totalConsidered,
    gaps,
  };
}
