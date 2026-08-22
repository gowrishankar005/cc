/**
 * T-LR-6 (`docs/solution/AGENT_TASKS_Ext_CodeQL_Engine.md`) — the
 * evidence-earned trust matrix `BACKLOG.md`'s "Per-(engine, fact-type) trust
 * tiers" row names. NOT the same axis as `scanner/engine-capability-matrix.yml`:
 * that file routes which engine RUNS for a given (language, framework) —
 * declared upfront, before any measurement. This file is the opposite axis —
 * once multiple engines/mechanisms both produce a fact for the same
 * (fact-type, scope), which one is trusted more, and by how much — and every
 * number here carries a citation to the real run/test that earned it, not an
 * assumption about the framework.
 *
 * Before this file, that tier lived as same-named `_CONFIDENCE` constants
 * duplicated across `cross_package/multi-hop-bridge-detector.ts`,
 * `cross_package/graphify-reconciler.ts`, and `codeql-di-pass.ts`, compared
 * only via prose comments ("below R2b's tier", "between R2b's 8 and R2c's
 * 6") with no single place a reader — or a new engine being added — could
 * see the whole ordering at once. This is that single place; the three
 * files above now read their confidence values from here instead of
 * defining their own.
 *
 * "CodeQL is never automatically primary" (the task's own acceptance
 * wording) is enforced two ways, not just documented:
 *   1. `codegraph`'s own R0/R1 direct-import relationships carry NO
 *      `TypedRelationship.confidence` at all (see `relationship-builder.ts`'s
 *      "absence, not a fake 0" comment) — they are never entered into this
 *      matrix, because they are not gap-filling/inferred facts needing a
 *      trust tier; they ARE primary, structurally, by never competing on
 *      this axis in the first place.
 *   2. `assertCodeqlNeverPrimary()` (called by this module's own test)
 *      asserts every `engine: 'codeql'` row's confidence is strictly below
 *      the strongest tier any OTHER engine earns in this matrix
 *      (`r2-phase1`, Graphify's least-inferred multi-hop tier) — so even
 *      within the inferred/gap-filling tiers this matrix does cover, CodeQL
 *      can never be entered as the top row.
 */

export type TrustEngine = 'graphify' | 'codegraph' | 'codeql';
export type TrustFactType = 'relationship-edge' | 'unit-introduction';
export type TrustScope = 'same-root' | 'cross-root' | 'n/a';

export interface TrustMatrixEntry {
  readonly engine: TrustEngine;
  readonly factType: TrustFactType;
  /** Matches `TypedRelationship['mechanism']` for `relationship-edge` rows; a named introduction mechanism otherwise. */
  readonly mechanism: string;
  readonly scope: TrustScope;
  readonly confidence: number;
  /** Pointer to the real measurement/evidence this number was earned from — required, never a placeholder string. */
  readonly evidence: string;
}

export const TRUST_MATRIX: readonly TrustMatrixEntry[] = [
  // Graphify multi-hop bridge detection (multi-hop-bridge-detector.ts).
  // Dated historical record — Graphify was the cross-package backbone that
  // earned these tiers; the backbone migrated to CodeGraph on 2026-08-22
  // (docs/solution/E6-cross-package-backbone-evaluation.md), and no code
  // calls relationshipTrust('graphify', ...) anymore. Rows kept, not
  // rewritten, per this project's own append-only-evidence discipline
  // (Claim_Register.md) — see the 'codegraph' rows below for what's live.
  // R2 Phase 1 — sole implementer, no ambiguity. Least-inferred tier this matrix covers.
  { engine: 'graphify', factType: 'relationship-edge', mechanism: 'r2-phase1', scope: 'same-root', confidence: 15, evidence: 'BACKLOG.md R2 gold-charge evaluation; real fineract-charge run' },
  { engine: 'graphify', factType: 'relationship-edge', mechanism: 'r2-phase1', scope: 'cross-root', confidence: 10, evidence: 'BACKLOG.md R2 gold-charge evaluation; real fineract-charge run' },
  // R2 stereotype-disambiguated — 2+ real implements candidates, narrowed by real @Service/@Component evidence.
  { engine: 'graphify', factType: 'relationship-edge', mechanism: 'r2-stereotype', scope: 'same-root', confidence: 12, evidence: 'T-LR-3 (BACKLOG.md "Plain-interface bridge detection")' },
  { engine: 'graphify', factType: 'relationship-edge', mechanism: 'r2-stereotype', scope: 'cross-root', confidence: 7, evidence: 'T-LR-3 (BACKLOG.md "Plain-interface bridge detection")' },
  // R2b — second-hop implementer-import chase (implementer resolved but itself not a store; imports exactly one).
  { engine: 'graphify', factType: 'relationship-edge', mechanism: 'r2b', scope: 'same-root', confidence: 8, evidence: 'E2 round 2, r2b-implementer-hop-sample' },
  { engine: 'graphify', factType: 'relationship-edge', mechanism: 'r2b', scope: 'cross-root', confidence: 5, evidence: 'E2 round 2, r2b-implementer-hop-sample' },
  // R2c — direct delegate, no `implements` corroboration at all, imports exactly one store.
  { engine: 'graphify', factType: 'relationship-edge', mechanism: 'r2c', scope: 'same-root', confidence: 6, evidence: 'T-LR-2 (BACKLOG.md "Direct-delegate bridge detection"), 28 real candidates' },
  { engine: 'graphify', factType: 'relationship-edge', mechanism: 'r2c', scope: 'cross-root', confidence: 3, evidence: 'T-LR-2 (BACKLOG.md "Direct-delegate bridge detection"), 28 real candidates' },
  // Graded fact admission — a raw structural reference this pipeline could not classify into any of the above at all.
  { engine: 'graphify', factType: 'relationship-edge', mechanism: 'admitted-unresolved', scope: 'same-root', confidence: 3, evidence: 'T-P0-1 (E2), BACKLOG.md "Graded fact admission (dual-unit gate)"' },
  { engine: 'graphify', factType: 'relationship-edge', mechanism: 'admitted-unresolved', scope: 'cross-root', confidence: 2, evidence: 'T-P0-1 (E2), BACKLOG.md "Graded fact admission (dual-unit gate)"' },

  // CodeGraph cross-package backbone (2026-08-22 migration, codegraph-crossroot-provider.ts)
  // — the LIVE rows every call site actually uses now. Same mechanism
  // classes, same confidence numbers as the graphify rows above (not new
  // numbers invented for the occasion): the underlying algorithm
  // (multi-hop-bridge-detector.ts/graphify-reconciler.ts) is unchanged, only
  // which engine supplies the raw cross-package edges changed. Evidence:
  // E6-cross-package-backbone-evaluation.md (the migration decision trail)
  // plus a real 3-repo pre/post benchmark (Fineract charge/core/security/
  // provider, a Python two-root fixture, Waltz 3-module) showing identical
  // unit counts and equal-or-more resolved relationships on every repo
  // checked, confirming these tiers hold under the new engine.
  { engine: 'codegraph', factType: 'relationship-edge', mechanism: 'r2-phase1', scope: 'same-root', confidence: 15, evidence: 'E6-cross-package-backbone-evaluation.md; 3-repo pre/post benchmark, 2026-08-22' },
  { engine: 'codegraph', factType: 'relationship-edge', mechanism: 'r2-phase1', scope: 'cross-root', confidence: 10, evidence: 'E6-cross-package-backbone-evaluation.md; 3-repo pre/post benchmark, 2026-08-22' },
  { engine: 'codegraph', factType: 'relationship-edge', mechanism: 'r2-stereotype', scope: 'same-root', confidence: 12, evidence: 'E6-cross-package-backbone-evaluation.md; 3-repo pre/post benchmark, 2026-08-22' },
  { engine: 'codegraph', factType: 'relationship-edge', mechanism: 'r2-stereotype', scope: 'cross-root', confidence: 7, evidence: 'E6-cross-package-backbone-evaluation.md; 3-repo pre/post benchmark, 2026-08-22' },
  { engine: 'codegraph', factType: 'relationship-edge', mechanism: 'r2b', scope: 'same-root', confidence: 8, evidence: 'E6-cross-package-backbone-evaluation.md; 3-repo pre/post benchmark, 2026-08-22' },
  { engine: 'codegraph', factType: 'relationship-edge', mechanism: 'r2b', scope: 'cross-root', confidence: 5, evidence: 'E6-cross-package-backbone-evaluation.md; 3-repo pre/post benchmark, 2026-08-22' },
  { engine: 'codegraph', factType: 'relationship-edge', mechanism: 'r2c', scope: 'same-root', confidence: 6, evidence: 'E6-cross-package-backbone-evaluation.md; 3-repo pre/post benchmark, 2026-08-22' },
  { engine: 'codegraph', factType: 'relationship-edge', mechanism: 'r2c', scope: 'cross-root', confidence: 3, evidence: 'E6-cross-package-backbone-evaluation.md; 3-repo pre/post benchmark, 2026-08-22' },
  { engine: 'codegraph', factType: 'relationship-edge', mechanism: 'admitted-unresolved', scope: 'same-root', confidence: 3, evidence: 'E6-cross-package-backbone-evaluation.md; 3-repo pre/post benchmark, 2026-08-22' },
  { engine: 'codegraph', factType: 'relationship-edge', mechanism: 'admitted-unresolved', scope: 'cross-root', confidence: 2, evidence: 'E6-cross-package-backbone-evaluation.md; 3-repo pre/post benchmark, 2026-08-22' },

  // CodeQL DI resolution (T-LR-5, codeql-di-pass.ts). Deliberately placed
  // strictly between r2b (8/5) and r2c (6/3) — real, verified accuracy
  // (E1b: 2106 bindings, correct ambiguity refusal) but "never automatically
  // primary" per the T-LR-6 acceptance criterion, so it does not get to
  // outrank r2-phase1/r2-stereotype despite being a more direct fact.
  { engine: 'codeql', factType: 'relationship-edge', mechanism: 'codeql-di-stereotype', scope: 'same-root', confidence: 7, evidence: 'Claim_Register.md T-LR-5-codeql-di; fineract-charge+fineract-provider run, 2026-08-19, 2105 bindings' },
  { engine: 'codeql', factType: 'relationship-edge', mechanism: 'codeql-di-stereotype', scope: 'cross-root', confidence: 4, evidence: 'Claim_Register.md T-LR-5-codeql-di; fineract-charge+fineract-provider run, 2026-08-19, 2105 bindings' },
  { engine: 'codeql', factType: 'relationship-edge', mechanism: 'codeql-di-bean-factory', scope: 'same-root', confidence: 7, evidence: 'Claim_Register.md T-LR-5-codeql-di; LoanChargesApiResource -> LoanChargeReadPlatformServiceImpl, real @Bean-factory wiring' },
  { engine: 'codeql', factType: 'relationship-edge', mechanism: 'codeql-di-bean-factory', scope: 'cross-root', confidence: 4, evidence: 'Claim_Register.md T-LR-5-codeql-di; LoanChargesApiResource -> LoanChargeReadPlatformServiceImpl, real @Bean-factory wiring' },

  // CodeQL-introduced units — T-FS-4-class introduction ("own tier, never
  // promoted"; status-assignment.ts's SECONDARY_ONLY_SOURCES). Not a
  // relationship-edge fact type at all: this is CodeQL asserting a class
  // exists and is real, not resolving an edge between two already-known units.
  { engine: 'codeql', factType: 'unit-introduction', mechanism: 'codeql-di', scope: 'n/a', confidence: 10, evidence: 'Claim_Register.md T-LR-5-codeql-di; 56 new units introduced, fineract-charge+fineract-provider run, 2026-08-19' },

  // Command-bus dispatch join (#18, codeql-command-dispatch-pass.ts).
  // Placed at the SAME tier as DI resolution's mechanisms (7/4) — comparably
  // real, whole-codebase-scale evidence, not a different number invented
  // without justification. Originally evaluated in E1-codeql-engine-evaluation.md
  // (7 real edges, Fineract-only scope) but never shipped (T-LR-5 scoped DI
  // resolution as the smaller safe first unit); re-verified and shipped
  // 2026-08-22 after the original query was found never to have left
  // gitignored soln/ and had to be reconstructed from the memo's own
  // mechanism description.
  { engine: 'codeql', factType: 'relationship-edge', mechanism: 'codeql-command-dispatch', scope: 'same-root', confidence: 7, evidence: 'E1-codeql-engine-evaluation.md; re-verified 2026-08-22, 408 real bindings whole-fineract-provider-tree scale, including a second real dispatch convention (InteropWrapperBuilder) found unprompted' },
  { engine: 'codeql', factType: 'relationship-edge', mechanism: 'codeql-command-dispatch', scope: 'cross-root', confidence: 4, evidence: 'E1-codeql-engine-evaluation.md; re-verified 2026-08-22, 408 real bindings whole-fineract-provider-tree scale, including a second real dispatch convention (InteropWrapperBuilder) found unprompted' },
  { engine: 'codeql', factType: 'unit-introduction', mechanism: 'codeql-command-dispatch', scope: 'n/a', confidence: 10, evidence: 'E1-codeql-engine-evaluation.md; re-verified 2026-08-22, real command-handler classes CodeQL alone identified' },
];

function lookup(engine: TrustEngine, factType: TrustFactType, mechanism: string, scope: TrustScope): TrustMatrixEntry {
  const entry = TRUST_MATRIX.find((e) => e.engine === engine && e.factType === factType && e.mechanism === mechanism && e.scope === scope);
  if (!entry) {
    throw new Error(`fact-trust-matrix: no entry for (engine: ${engine}, factType: ${factType}, mechanism: ${mechanism}, scope: ${scope}) — a new mechanism needs a matrix row with a real evidence citation before it can emit a confidence value, not a locally-hardcoded number`);
  }
  return entry;
}

/** Confidence for a `relationship-edge` fact from `engine`/`mechanism` at the given scope. Throws if the (engine, mechanism, scope) triple has no matrix row. */
export function relationshipTrust(engine: TrustEngine, mechanism: string, scope: 'same-root' | 'cross-root'): number {
  return lookup(engine, 'relationship-edge', mechanism, scope).confidence;
}

/** Confidence for a `unit-introduction` fact from `engine`/`mechanism` (root-scope-independent). Throws if the (engine, mechanism) pair has no matrix row. */
export function unitIntroductionTrust(engine: TrustEngine, mechanism: string): number {
  return lookup(engine, 'unit-introduction', mechanism, 'n/a').confidence;
}

/**
 * Structural check for the T-LR-6 acceptance criterion's own wording:
 * "CodeQL is never automatically primary." `codegraph`'s real primary tier
 * never enters this matrix (see module doc, point 1) — this asserts the
 * weaker, matrix-internal version: no `engine: 'codeql'` row ever reaches or
 * exceeds the strongest tier any OTHER engine holds for the SAME `factType`.
 * Scoped per fact type deliberately — comparing across fact types (e.g. a
 * `unit-introduction` confidence against a `relationship-edge` confidence)
 * would be comparing two different claims on the same numeric scale, not a
 * real ranking; it would also make the check's outcome depend on unrelated
 * fact types' values, which is exactly the "config-declared, not
 * evidence-earned-per-fact-type" shape this task exists to replace. A fact
 * type where CodeQL is currently the only producer (e.g. `unit-introduction`)
 * has no "other" tier to compare against and is vacuously fine — CodeQL
 * being the sole source for a gap no other engine fills is not the same
 * claim as CodeQL out-ranking an established engine for a fact type both
 * produce.
 *
 * Called from a regression test, not the run path — a hard rule about the
 * matrix's own shape, not a per-run runtime check. Takes an explicit
 * `matrix` (defaulting to the real `TRUST_MATRIX`) so a test can exercise
 * this exact function against a deliberately-rigged matrix and confirm it
 * actually fails closed, not just that the real matrix happens to pass.
 */
export function assertCodeqlNeverPrimary(matrix: readonly TrustMatrixEntry[] = TRUST_MATRIX): void {
  const factTypes = new Set(matrix.map((e) => e.factType));
  for (const factType of factTypes) {
    const rowsOfType = matrix.filter((e) => e.factType === factType);
    const otherConfidences = rowsOfType.filter((e) => e.engine !== 'codeql').map((e) => e.confidence);
    if (otherConfidences.length === 0) continue; // no competing engine for this fact type — CodeQL being the sole source is not "primary" in the competitive sense this rule targets
    const maxOther = Math.max(...otherConfidences);
    for (const entry of rowsOfType) {
      if (entry.engine === 'codeql' && entry.confidence >= maxOther) {
        throw new Error(`fact-trust-matrix: codeql row (${entry.mechanism}/${entry.scope}, factType ${entry.factType}, confidence ${entry.confidence}) reaches or exceeds the strongest non-codeql tier for that fact type (${maxOther}) — violates "CodeQL is never automatically primary"`);
      }
    }
  }
}
