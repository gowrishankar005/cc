# AREC store-terminal policy (T-L2-0)

**Status:** design note, written before any L2 code, per `AGENT_TASKS_Layered_Architecture_Story.md`'s hard rule (T-L2-0 must exist before T-L2-1).
**Scope:** documents what the multi-hop detection mechanism (`multi-hop-bridge-detector.ts`) actually does today, names the two story IDs it produces, and records the L2b (domain-terminal refine) decision — so that decision is made once, in writing, not re-litigated per package.

---

## 1. Current detector inventory (as of L1 completion, read from source, not recalled)

`pipeline/src/analysis/cross_package/multi-hop-bridge-detector.ts`, one function (`detectMultiHopBridgeRelationships`), two hops, bounded:

```
service unit --imports/references--> BRIDGE (zero-evidence interface/type)
                                        │
                              implementers (exactly 1, else refuse)
                                        │
                       ┌────────────────┴────────────────┐
                       │                                  │
              implementer IS a                   implementer is NOT a
              database/topic unit                database/topic unit
              (Phase 1 short-circuit)             (chase ONE more hop)
                       │                                  │
              emit edge, confidence           implementer's own imports,
              15 same-root / 10 cross-root    filtered to database/topic
              → this is R2 Phase 1            units (exactly 1, else refuse)
                                                          │
                                                emit edge, confidence
                                                8 same-root / 5 cross-root
                                                → this is R2b
```

- **Bridge discovery is structural only** (`imports`/`references` edge to a node with zero TypedUnits of its own, resolved to a real in-repo file via `isRealBridgeCandidate`) — never a name-suffix list. The design note this implements (`AREC_R2_MultiHop_Strategy.md`) found Fineract alone uses 3+ different suffixes for the same architectural role, which is exactly why a name list was rejected at design time, not just in principle.
- **Both hops share one "never guess" rule**: 0 or 2+ candidates at either the bridge-implementer step or the R2b store-import step → an honest `unresolved-multi-hop` ignored-item, never a fabricated edge. This is load-bearing — it is the mechanism that makes `E-r2-ambiguity` (standing exam) pass, and the same discipline that correctly produces `E-charge-single-L2`'s expected L2 FAIL (0 implementers in scope, for real).
- **Bound is fixed at 2 bridge hops** (service → bridge → implementer → store). An implementer's implementer is never chased. This is a stated design limit (`AREC_R2b_Implementer_Store_Hop.md` §2.4.2), not an oversight — going deeper trades "never guess" confidence for reach, and hasn't been evidenced as needed yet.

## 2. Story IDs this mechanism produces (vocabulary from `AGENT_TASKS_Layered_Architecture_Story.md` §0.4)

| Mechanism branch | Story ID | Terminal | Confidence tier |
|---|---|---|---|
| Phase 1 short-circuit (sole implementer **is** the store) | **S-layered-access** | The implementer itself (e.g. a JDBC-backed access-layer class) | 15 same-root / 10 cross-root |
| R2b hop (sole implementer imports exactly one store) | **S-layered-domain** | Whatever the implementer imports (e.g. an `@Entity`/repository unit) | 8 same-root / 5 cross-root |
| Either hop's 0/2+ ambiguity | **S-unresolved** | none — honest ignored-item | n/a |

**Real, verified mapping** (T-L1-1/T-L1-2, `standing-disconfirming-exams.md`): the real Fineract `fineract-charge`+`fineract-provider` flagship case resolves via the **Phase 1 short-circuit branch** — `ChargeReadPlatformServiceImpl` itself is a real `database` unit (own `JdbcTemplate` field), so R2b's extra hop is never even reached for this specific case. This is S-layered-access, confidence 10 (cross-root). It is not, and was never claimed to be, S-layered-domain or a match for the single-root gold's `Charge` entity terminal.

## 3. D-terminal-refine decision (T-L2-3 / L2b), recorded here per §0.5

**Default from `AGENT_TASKS_Layered_Architecture_Story.md` §0.5**: `D-terminal-refine = "Phase L2b optional — access default first"`. `coe-lab/docs/standing-disconfirming-exams.md`'s "Product decision overrides" section confirms: **no owner override was recorded at Phase L0 start** — all four `D-*` defaults stand as written.

**Decision: do not implement T-L2-3 (L2b domain-terminal refine) this round.** Reasoning, stated so a future session doesn't have to re-derive it:

1. The default itself already answers the question — "access default first" means the Phase 1 short-circuit's access-layer terminal is the correct, complete answer unless and until an owner deliberately asks for refine behavior. Building L2b without that ask would be scope creep against this project's own Simplicity First principle (`CLAUDE.md`), not a neutral extra feature.
2. The one real case this program was built around (`ChargesApiResource → ChargeReadPlatformServiceImpl`) **already resolves via Phase 1**, not R2b — so there is no live example in evidence today where an L2b refine would even fire (L2b only matters when Phase 1's implementer is NOT itself a store, i.e. the R2b branch). Building a refine mechanism with no real case to verify it against would violate this project's own "verify against real evidence, don't assume" discipline (`CLAUDE.md` working principle 1).
3. If a future session finds a real case where R2b resolves to an access-layer-shaped implementer that itself imports exactly one clearly-domain store unit, and a stakeholder specifically wants the domain store surfaced instead of (or alongside) the access terminal — that's the trigger to revisit this decision, record a `D-terminal-refine = yes` override in `standing-disconfirming-exams.md`, and only then build T-L2-3 with the two-import/zero-import test matrix the task list already specifies.

**This is a considered "not now," not a "no."** Named as an open, revisitable decision — same discipline as `OOS_Registry.md`'s own rule that a deferred item needs both a reason and a trigger, not just "not done yet."

## 4. What T-L2-1 through T-L2-5 build on top of this (forward pointer, not yet done as of writing this note)

- **T-L2-1**: the table in §2 above is currently only reconstructable by reading `confidence` (15/10 vs 8/5) — correct but not self-documenting. Add an explicit, additive `mechanism` field so a consumer (coverage report, IR, a future query layer) can ask "which branch produced this edge" without hardcoding the confidence-value mapping.
- **T-L2-2**: a synthetic, non-Fineract fixture proving the Phase 1 short-circuit branch specifically (service → bridge → sole implementer that IS the store) — the R2b branch already has synthetic coverage (`r2b-implementer-hop-sample`), but Phase 1's own synthetic fixture (`r2-bridge-sample`) predates this note and should be checked for the same "not a Fineract name" bar.
- **T-L2-4**: a spike, not a commitment — investigates whether a generic structural noise filter (multi-hop must not terminate on units with zero persistence/messaging/http-entry evidence) is safe, explicitly rejecting a name/suffix denylist as a valid implementation.
- **T-L2-5**: a gated regression against the real multi-root Fineract case, asserting by kind + interfaces + grade (never a bare hardcoded file path inside `pipeline/src`) — test-only evidence paths are fine, detector logic must stay generic.

## 5. T-L2-4 noise filter spike — conclusion: not needed, existing gate already sufficient

**Question posed by the task**: could a multi-hop chain terminate on a "noise" unit — something typed `database`/`topic` that shouldn't really count as a persistence/messaging terminal (the task names framework-only units, e.g. a bare `Component`, as the shape to worry about)?

**Spike, done by reading the real code path, not assuming**: `multi-hop-bridge-detector.ts` only accepts a terminal when `nodeToUnit.get(...).unit.kind === 'database' || 'topic'` (both branches, lines checking `implMatch.unit.kind` and the R2b `storeCandidates` filter). Tracing where `kind: 'database'`/`kind: 'topic'` ever gets assigned, in every producer:

- `signal-mapper.ts` (native per-file units): `kind` is `'database'` only if `categories.has('persistence')`, `'topic'` only if `categories.has('messaging')` — both categories are populated only by a real catalogue-matched signal (JPA `@Entity`, a recognized driver import, Spring Data repository, `@KafkaListener`, etc.). There is no code path where a unit becomes `database`/`topic` kind without a real evidence category behind it.
- `cross_package/persistence-detector.ts` (Graphify import-strategy units): `kind: 'database'` is only ever pushed after a catalogue-matched driver-import strategy fires (and, since B-ontology, after the `ownerBaseClass` ownership check for libraries that declare one).
- `messaging-pass.ts`: same structure — a unit only gets `kind: 'topic'`/`'database'`-with-merged-messaging-evidence after a real catalogue-matched messaging signal.

**Conclusion: defer, with a stated reason, not "not done yet."** A second noise filter at the multi-hop layer would be checking a condition (does the terminal have real persistence/messaging/http-entry evidence) that is already structurally guaranteed by the moment a unit is typed `database`/`topic` at all — every producer requires real evidence to assign that kind, with no bare/default path to it (unlike `service`, which IS the default fallback kind when no category matched, per `signal-mapper.ts`'s final `: 'service'`). Adding a filter here would be redundant against an already-enforced invariant, and — worse — a second, independently-maintained gate is a real risk of drifting out of sync with the first one over time. **Revisit trigger**: if a future producer is ever added that assigns `database`/`topic` kind WITHOUT gating on a real evidence category (a real regression from the invariant just traced), that is the moment this filter becomes necessary — add it then, at the producer, not speculatively here.

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | Initial design note (T-L2-0), written before any L2 code per the phase's own hard rule. Documents the real, current two-branch mechanism, the S-layered-access/S-layered-domain story-ID mapping, and records the D-terminal-refine decision: L2b not built this round, access remains the default terminal, reasoned + revisitable. |
