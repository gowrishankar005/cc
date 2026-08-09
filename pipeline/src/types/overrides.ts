/**
 * Decision Record / Override schema — docs/spikes/Gap_Closure_Build_Ready_Specs_v0.1.md §6,
 * scoped for implementation in docs/solution/Architecture_as_Code_Solution_Design_v2.md §5.4.
 * This is the mechanism that turns "an architect or LLM can correct an
 * ambiguous/wrong classification" from a design claim into something real:
 * a human (or the bounded LLM advisory layer, once built) edits/creates a
 * Decision Record + Override pair; this pipeline applies ACTIVE overrides as
 * a final, auditable pass after deterministic CALM construction — it never
 * changes what Analysis concludes, so the core generation path stays
 * deterministic and re-running with the same source + same overrides always
 * produces the same result.
 */

export interface DecisionRecord {
  decision_id: string;
  module: string; // e.g. "architecture"
  domain?: string;
  target_type: 'node' | 'relationship' | 'ignored-item';
  target_ref: string; // calm-element unique-id, or an ignored-item ref (file:line)
  original_suggestion?: {
    proposed_type?: string;
    confidence_score?: number;
    evidence_refs?: string[];
  };
  final_decision: {
    // AP-4 (Architect_Pilot_Feedback_Notes.md Entry 8) — 'accepted' is the
    // DESIGNATED value for a reviewed "leave open" outcome: the architect
    // (or Tier B drafting agent) confirmed the scan correctly found no real
    // node/relationship to add or change here, not an inferred best-fit.
    // No dedicated 'target_ref' Override is written for this case (nothing
    // in CALM changes) — the Decision Record alone is the audit trail. This
    // was, empirically, the single most common Tier A outcome across two
    // real pilot sessions (3/3 residuals in both the Fineract and Bank of
    // Anthos runs) — worth stating explicitly rather than leaving an
    // architect or drafting agent to infer the mapping each time.
    action: 'accepted' | 'overridden' | 'added' | 'removed';
    new_value?: unknown;
  };
  rationale: string;
  evidence_snapshot?: string[];
  reviewer: string; // architect-id, or "llm-advisory:<model>" for an LLM-proposed-then-confirmed decision
  reviewed_at: string; // ISO timestamp
  source_run_id?: string;
  status: 'active' | 'superseded';
  supersedes?: string | null;
}

export type OverrideType =
  | 'type_change'
  | 'relationship_add'
  | 'relationship_remove'
  | 'node_add'
  | 'node_remove'
  | 'node_rename'
  | 'boundary_change';

export interface Override {
  override_id: string;
  module: string;
  domain?: string;
  target_ref: string; // calm-element-id this override applies to, or "new" for node_add
  override_type: OverrideType;
  new_value?: unknown;
  decision_record_ref: string; // decision_id — MUST resolve to a real, active Decision Record; enforced, not just documented
  applied_since_run?: string;
  status: 'active' | 'retired';
  created_by: string;
  created_at: string;
}

export interface OverrideApplicationResult {
  applied: Array<{ override_id: string; override_type: OverrideType; target_ref: string }>;
  rejected: Array<{ override_id: string; reason: string }>;
  skipped: Array<{ override_id: string; override_type: OverrideType; reason: string }>;
  /**
   * T-X6-2 (G-L4-08) — a SUBSET of `rejected`, specifically overrides whose
   * target_ref doesn't resolve against the current deterministic
   * CalmDocument (the thing it pointed at was renamed/removed since the
   * override was written — "DR points at a ghost node"). Not every
   * rejection is an orphan (a malformed new_value shape or an inactive
   * Decision Record are different failure classes, not staleness), so this
   * is reported separately rather than treating all rejections as the same
   * kind of problem.
   */
  orphans: Array<{ override_id: string; override_type: OverrideType; target_ref: string; reason: string }>;
}
