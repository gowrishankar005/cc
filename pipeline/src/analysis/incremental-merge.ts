import { Evidence, FactStatus, TypedFacts, TypedRelationship, TypedUnit } from '../types/typed-facts';

/**
 * T-CL-2 (BACKLOG.md "Fact identity, incremental merge, and review
 * history", `AGENT_TASKS_Ext_Contract_Lifecycle.md`) — merges this run's
 * freshly-computed units/relationships against the PRIOR run's
 * `typed-facts.json` (same `--out` directory), keyed on the stable,
 * content-derived ids T-CL-1 already guarantees (`TypedUnit.id` /
 * `TypedRelationship.id`).
 *
 * The lane's own hard constraint: "No `reviewed` fact is ever silently
 * overwritten. A human's confirmation takes a human to un-confirm;
 * contradicting evidence flags for re-review." This module is the one place
 * that constraint is mechanically enforced, not just documented:
 *  - a fact whose PRIOR status was 'reviewed' and whose signature (evidence
 *    for a unit, kind/source/mechanism/confidence/grade for a relationship,
 *    since TypedRelationship carries no Evidence[] of its own) is UNCHANGED
 *    carries its 'reviewed' status forward, even though a fresh
 *    `assignStatuses` run never produces 'reviewed' on its own.
 *  - a fact whose prior status was 'reviewed' but whose signature CHANGED is
 *    never silently promoted back to whatever the fresh, evidence-driven
 *    status would have been — it's forced to 'requires-review' instead
 *    (the "contradicting evidence flags for re-review" half of the rule).
 *  - any other fact (never reviewed) simply keeps the freshly-computed
 *    status/fields, which is already correct — recomputed deterministically
 *    from this run's own evidence.
 *
 * A fact present in the prior run but absent from this one (a rename,
 * deletion, or a mechanism no longer firing) is never resurrected here —
 * T-CL-1's own doc comment on `TypedUnit.id` already names that as "a
 * disappeared fact plus a new one, not a bug to work around." It's only
 * recorded in the returned history/report so it's visible, not silently
 * dropped from the audit trail.
 */

export interface FactHistoryEntry {
  id: string;
  factType: 'unit' | 'relationship';
  at: string; // this run's TypedFacts.generatedAt
  from: FactStatus | 'new';
  to: FactStatus | 'disappeared';
  reason: string;
}

export interface MergeReport {
  units: { new: number; disappeared: number; unaffected: number; flaggedForReReview: number };
  relationships: { new: number; disappeared: number; unaffected: number; flaggedForReReview: number };
}

function evidenceSignature(evidence: Evidence[]): string {
  return evidence
    .map((e) => `${e.category}|${e.source}|${e.signal}|${e.ref}`)
    .sort()
    .join(';');
}

function unitSignature(u: TypedUnit): string {
  return `${u.kind}|${evidenceSignature(u.evidence)}`;
}

// TypedRelationship carries no Evidence[] of its own (unlike TypedUnit) — its
// descriptive fields together stand in for "what this fact currently claims".
function relationshipSignature(r: TypedRelationship): string {
  return `${r.kind}|${r.source}|${r.mechanism ?? ''}|${r.confidence ?? ''}|${r.grade ?? ''}`;
}

function mergeCategory<T extends { id?: string; status?: FactStatus }>(
  factType: 'unit' | 'relationship',
  prior: T[],
  fresh: T[],
  signatureOf: (f: T) => string,
  generatedAt: string,
  history: FactHistoryEntry[]
): { new: number; disappeared: number; unaffected: number; flaggedForReReview: number } {
  const priorById = new Map<string, T>();
  for (const f of prior) {
    if (f.id) priorById.set(f.id, f);
  }

  let newCount = 0;
  let unaffected = 0;
  let flaggedForReReview = 0;
  const seenIds = new Set<string>();

  for (const f of fresh) {
    if (!f.id) continue; // every real producer sets id (mapSignalsToUnits / factIdentityPass) — defensive only
    seenIds.add(f.id);
    const priorFact = priorById.get(f.id);
    if (!priorFact) {
      newCount++;
      history.push({ id: f.id, factType, at: generatedAt, from: 'new', to: f.status ?? 'inferred', reason: 'introduced by this run' });
      continue;
    }

    const signatureUnchanged = signatureOf(priorFact) === signatureOf(f);

    if (priorFact.status === 'reviewed') {
      if (signatureUnchanged) {
        f.status = 'reviewed'; // carried forward — never silently overwritten by a fresh, non-'reviewed' recompute
        unaffected++;
      } else {
        f.status = 'requires-review'; // contradicting evidence flags for re-review, not a silent promotion to the fresh status
        flaggedForReReview++;
        history.push({
          id: f.id,
          factType,
          at: generatedAt,
          from: 'reviewed',
          to: 'requires-review',
          reason: 'evidence changed since this fact was human-reviewed — flagged for re-review, prior reviewed status not silently overwritten',
        });
      }
      continue;
    }

    if (signatureUnchanged) {
      f.status = priorFact.status ?? f.status;
      unaffected++;
    } else if (priorFact.status && priorFact.status !== f.status) {
      history.push({ id: f.id, factType, at: generatedAt, from: priorFact.status, to: f.status ?? 'inferred', reason: 'evidence changed between runs' });
    }
  }

  let disappeared = 0;
  for (const [id, priorFact] of priorById) {
    if (seenIds.has(id)) continue;
    disappeared++;
    history.push({ id, factType, at: generatedAt, from: priorFact.status ?? 'inferred', to: 'disappeared', reason: 'not observed in this run' });
  }

  return { new: newCount, disappeared, unaffected, flaggedForReReview };
}

/**
 * Mutates `units`/`relationships` in place (same convention as
 * `status-assignment.ts`'s `assignStatuses`) — only their `.status` field,
 * only where the rules above require it. Never adds or removes a fact.
 */
export function mergeIncrementalFacts(
  prior: TypedFacts | undefined,
  generatedAt: string,
  units: TypedUnit[],
  relationships: TypedRelationship[]
): { report: MergeReport; history: FactHistoryEntry[] } {
  const history: FactHistoryEntry[] = [];
  const unitReport = mergeCategory('unit', prior?.units ?? [], units, unitSignature, generatedAt, history);
  const relationshipReport = mergeCategory('relationship', prior?.relationships ?? [], relationships, relationshipSignature, generatedAt, history);
  return { report: { units: unitReport, relationships: relationshipReport }, history };
}
