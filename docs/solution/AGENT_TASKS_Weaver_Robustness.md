# Agent task list — Weaver robustness program (phased)

**Single source of truth** for making Weaver **enterprise-robust**: honest under multi-module layered stacks, measurable architecture coverage, standing discovery, and pilot scorecard — without sample-repo hardcodes.

**Product:** Weaver. Evidence monorepos are **samples**, never the product target.

**Related:**
| Doc | Role |
|---|---|
| [`BACKLOG.md`](./BACKLOG.md) | Thin index (IDs **B-***) |
| [`NEXT_ITERATION.md`](./NEXT_ITERATION.md) | Iteration sequencing |
| [`Claim_Register.md`](./Claim_Register.md) | Claim cells |
| [`Architecture_Relation_Evidence_Completeness.md`](./Architecture_Relation_Evidence_Completeness.md) | AREC pillar |
| [`AREC_R2_MultiHop_Strategy.md`](./AREC_R2_MultiHop_Strategy.md) | R2 Phase 1 design |
| [`AGENT_TASKS_AREC_Wave3_Implementation.md`](./AGENT_TASKS_AREC_Wave3_Implementation.md) | Session E breadth (parallel track) |
| [`coe-lab/docs/validation-approach-vnext.md`](../../coe-lab/docs/validation-approach-vnext.md) | L0–L5 |
| [`coe-lab/docs/trap-gold-backlog.md`](../../coe-lab/docs/trap-gold-backlog.md) | Traps |

---

## 0. How to use this file (mandatory)

### 0.1 Phase order — hard

```
Phase R0  Foundations (scorecard, arch coverage metric, multi-root protocol, OOS registry)
  → Phase R1  Architecture residual (R2b + Java import normalize)
  → Phase R2  Security depth & catalogue intake (C-call expand, C-rich authority, intake rule)
  → Phase R3  Discovery system (sample pass #2, re-rank, trap automation)
  → Phase R4  Residual UX (HITL S1, Graphify-partial visibility, k8s FP if needed)
```

**Interleave with Session E:**  
- **R0** may run **in parallel** with Session E (mostly docs + metrics).  
- **R1 (R2b)** should not wait for all of E if capacity is limited — architecture residual is higher robustness value than some E breadth cells.  
- Do **not** start R2/R3 before R0 scorecard + arch-cov exist (otherwise “done” has no pilot bar).

### 0.2 Why this program exists (agent orientation)

| Failure mode we already hit | Robustness response |
|---|---|
| High unit confidence, empty service neighborhood | S1 (done) + **architecture coverage metric** (ongoing) |
| Entity mesh sold as architecture | R0 grades (done) + metrics that prefer architecture-grade edges |
| Layered multi-module: API→interface→impl→store | R2 Phase 1 (done, non-fabricating) + **R2b** for realistic terminal hop |
| Single-root vs multi-root confusion | **Labeled multi-root L2 protocol** (Q11) |
| Soft “all pass” on lab | L0–L5 (done) + **pilot scorecard** + **trap automation** |
| One probe table, then chase last pain | **Discovery cadence** |
| Silent catalogue miss (Graphify naming) | Node `ref_*` (done); **Java driver-ref** still open |
| Call-site auth only two vocabularies | **C-call expand** + **catalogue intake rule** |
| Permanent OOS forgotten (command-bus) | **OOS registry** |

### 0.3 Integrity (reject PR if violated)

| Principle | Required | Reject |
|---|---|---|
| Generic mechanisms | Catalogue / structural tests | Sample class/module name hardcodes |
| Honesty | No fabricated relationships | Edge invented to clear S1 |
| Determinism | No LLM in core path | Advisory writes TypedFacts |
| Layering | pass / detector / platform-artefact | 100+ lines in run-slice |
| Claims | Update Claim Register + BACKLOG + STATUS | “Done” only in chat |
| Evidence | Disconfirming pair before “architecture complete” | One shallow sample only |

### 0.4 Every phase completion

1. Integrity home named.  
2. BACKLOG IDs flipped.  
3. Claim Register + STATUS updated.  
4. Regression suite green.  
5. PR template filled (§0.5).

### 0.5 PR template

```markdown
## Weaver robustness delivery
- Phase: <R0|R1|R2|R3|R4>
- Task IDs: <T-R0-1, …>
- Failure mode addressed: <…>
- Integrity home: <…>
- Paths: <…>
- BACKLOG IDs updated: <…>
- Claim Register: <cells>
- Regression: <tests>
- Explicit residual: <…>
```

### 0.6 Regression shields (always)

Keep existing suite green (R1 BoA, R2 synthetic + non-fabricating residual, S1, Ghostfolio ref_, k8s service-only, Nest, lab).  
**Never delete** residual-honest tests to force green.

---

# Phase R0 — Robustness foundations

**Goal:** Define “pilot ready,” measure architecture coverage, protocolize multi-root L2, publish OOS.  
**Why first:** Without a bar and metrics, later work has no definition of done.

**Phase R0 done when:** scorecard doc exists; coverage-report (or equivalent) emits architecture-coverage fields; multi-root protocol written; OOS registry published; BACKLOG IDs updated.

---

### T-R0-1 — Pilot-ready scorecard

| Field | Content |
|---|---|
| **Goal** | Document which Claim Register cells must be `proven` or `partial` before calling Weaver pilot-ready. |
| **Why** | Enterprise readiness gap: no numeric/structured success bar; only feature lists. |
| **Backlog ID** | B-pilot-scorecard |
| **Integrity home** | docs |
| **Implementation details** | Create `docs/solution/Pilot_Ready_Scorecard.md`: table of claim cells (U-http, U-entity, R1, R2, C-dec, C-call, S-silence, R-k8s, …) with required status for pilot. Explicit: lab L1 green alone is insufficient. List mandatory disconfirming samples (shallow one-hop + layered multi-module). Link from BACKLOG/STATUS/README. |
| **Acceptance** | File merged; STATUS points to it; no code required. |
| **Out of scope** | Implementing all cells. |
| **Hard predecessors** | None. |

---

### T-R0-2 — Architecture coverage metric

| Field | Content |
|---|---|
| **Goal** | Beyond binary S1: report how many **service** units have ≥1 **architecture-grade** outbound relationship when the run also has store units (database/topic). |
| **Why** | S1 only says “zero vs non-zero service-touching.” Robust operators need a **coverage rate** as stories improve. |
| **Backlog ID** | B-arch-cov |
| **Integrity home** | platform-artefact (`coverage-report.ts`) + IR line |
| **Implementation details** | Extend `completeness` (or sibling block): e.g. `servicesWithArchitectureOutbound`, `serviceUnitCount`, `architectureOutboundCoverage` (ratio). Definition: architecture-grade = `grade === 'architecture'` (or trust if product wants). Only count when databaseUnitCount+topicUnitCount ≥ 1 (same precondition spirit as S1). Surface in intelligence-ir.md. Regression: BoA coverage > 0; charge-style residual still low/S1. |
| **Acceptance** | Metric present in coverage-report.json; test asserts fields exist and BoA vs residual shapes differ sensibly. |
| **Out of scope** | Auto-adding edges. |
| **Hard predecessors** | None (S1 already ships). |

---

### T-R0-3 — Labeled multi-root L2 remeasure protocol

| Field | Content |
|---|---|
| **Goal** | Written protocol: how to declare root sets, label claims, and remeasure L2 without implying single-root completeness. |
| **Why** | Q11; R2 design: implementers often live in other modules. Confusion single-root vs multi-root caused overclaim risk. |
| **Backlog ID** | B-R2-eval |
| **Integrity home** | docs (validation-approach-vnext + optional coe-lab/docs/multi-root-l2-protocol.md) |
| **Implementation details** | 1) Document primary claim mode (module-root) vs multi-root claims. 2) Template: list roots, expected claim cells, L0/L1/L2 expectations. 3) Example root sets described **generically** (“API module + provider module”, “two services + shared lib”) — sample repo paths only in an appendix as evidence, not product identity. 4) Update validate-calm-pair help text if useful. |
| **Acceptance** | Protocol merged; Claim Q11 remains decided and linked. |
| **Out of scope** | Implementing new scanners. |
| **Hard predecessors** | None. |

---

### T-R0-4 — Standing OOS registry

| Field | Content |
|---|---|
| **Goal** | Living list of permanent or long-horizon non-goals with reason. |
| **Why** | Command-bus dynamic dispatch, Helm, full frontend, etc. must not silently re-enter scope or be forgotten. |
| **Backlog ID** | B-oos-registry |
| **Integrity home** | docs — section in BACKLOG.md or `docs/solution/OOS_Registry.md` |
| **Implementation details** | Seed with: command-bus/string-dispatched handlers; Helm/Kustomize deep resolve; LLM core path; sample-repo-specific detectors; unbounded multi-hop; secret values in artefacts. Each row: ID, description, reason, revisit trigger. |
| **Acceptance** | Registry exists; linked from BACKLOG/STATUS. |
| **Hard predecessors** | None. |

---

### T-R0-5 — Graphify partial / fail-soft visibility (minimal)

| Field | Content |
|---|---|
| **Goal** | When Graphify fails or is degraded, coverage/provenance makes incompleteness obvious. |
| **Why** | Fail-soft resilience can hide missing cross-package/architecture backbone. |
| **Backlog ID** | B-graphify-partial |
| **Integrity home** | platform-artefact / provenance |
| **Implementation details** | Ensure coverage `graphifyStatus` / error already surfaced in IR prominently; if missing, add clear IR/coverage flag. Optional: ignored-item or completeness flag `graphify-backbone-incomplete`. Do not fail all runs by default. |
| **Acceptance** | Documented operator-visible signal; test or manual note for failed-graphify path if fixture-able. |
| **Hard predecessors** | None. |

---

# Phase R1 — Architecture residual (critical)

**Goal:** Close the realistic layered shape without fabrication.  
**Why:** R2 Phase 1 requires implementer to **be** a database/topic unit — rare in real services.

**Phase R1 done when:** R2b ships with tests; Java driver-ref fixed or bounded; Claim R2 updated honestly.

**Phase R1 complete** (2026-08-08): T-R1-1, T-R1-2, T-R1-3 all done. Real, substantial result beyond the phase's own bar — T-R1-3's follow-up evidence check closed the flagship Fineract residual (`ChargesApiResource → Charge`-family) this whole phase was scoped around, via a Phase 1 mechanism once the Java import-resolution root cause was fixed, not R2b alone.

---

### T-R1-1 — R2b design addendum

| Field | Content |
|---|---|
| **Status** | **Done** (2026-08-07) — see [`AREC_R2b_Implementer_Store_Hop.md`](./AREC_R2b_Implementer_Store_Hop.md). |
| **Goal** | Extend AREC_R2 strategy: after sole implementer found, if implementer is not DB/topic unit, allow **one** hop to DB/topic units the implementer **imports/references** (exactly-one rule or bounded multi with low confidence). |
| **Why** | Multi-root still residual when impl is JDBC/service-layer without being the entity. |
| **Backlog ID** | B-R2b (design half) |
| **Integrity home** | docs |
| **Implementation details** | Delivered as new file `AREC_R2b_Implementer_Store_Hop.md` (not an addendum section — kept the Phase 1 doc's regression-locked claims untouched). Rules: no hardcodes; hop bound (2 bridge hops, unchanged from Phase 1); ambiguous → unresolved-multi-hop; new confidence tiers 8 (same-root)/5 (cross-root), below both Phase 1 tiers; grade architecture; command-bus still OOS. **Real re-verified evidence attached, not just the original spike's recollection**: `fineract-provider` (2733 files) confirmed present locally for a real multi-root remeasure; `ChargeReadPlatformServiceImpl`'s own imports re-checked directly — it imports no entity/repository at all (raw JDBC), so R2b's hop has nothing to chase to on the *read* path; the *write*-path implementer (`ChargeWritePlatformServiceJpaRepositoryImpl`) does import the entity+repository directly (the exact R2b shape) but is unreachable from `ChargesApiResource` via any static edge (command-bus dispatch, already-named non-goal). **Documented prediction, to be confirmed not assumed at T-R1-2 Step 4**: R2b's mechanism is real and generalizes, but will most likely NOT close Fineract's own flagship residual — closing that specific case needs a separate Spring-JDBC driver-import catalogue row combined with T-R1-3's fix, out of R2b's own scope. |
| **Acceptance** | Design approved shape written before code. |
| **Hard predecessors** | T-R0-1 recommended. |

---

### T-R1-2 — Implement R2b + realistic synthetic fixture

| Field | Content |
|---|---|
| **Goal** | Code the implementer→store hop; fixture mirrors **API → interface → impl class → entity import** (impl is **not** the entity). |
| **Why** | Current r2-bridge-sample uses entity-as-implementer (artificial). Need realistic isolation test. |
| **Backlog ID** | B-R2b |
| **Integrity home** | analysis-pass (`multi-hop-bridge-detector` or sibling) |
| **Status** | **Done** (2026-08-07). |
| **Implementation details** | All 6 steps from [`AREC_R2b_Implementer_Store_Hop.md`](./AREC_R2b_Implementer_Store_Hop.md) §5 completed. `multi-hop-bridge-detector.ts` extended with the implementer-import hop (new `importsBySource` index, confidence tiers 8/5). New fixture `test/fixtures/r2b-implementer-hop-sample/` (positive + ambiguity, 1 new test); existing `r2-bridge-sample` Phase 1 test kept, unchanged in intent. **Real multi-root remeasure run** (`fineract-charge`+`fineract-provider`): confirms the T-R1-1 prediction exactly — 11 real new architecture relationships resolved elsewhere in `fineract-provider`, Fineract-charge's own flagship case stays an honest, named residual (its bridge implementer imports 0 candidate stores, confirmed via the real ignored-item text). Second real finding in `fineract-core` alone (3 more real closures) required updating a stale pre-existing regression test (T-A2) that had assumed "never architecture" — fixed to distinguish R0 vs R2/R2b edges by `confidence` presence, not just widened to force green. Docs synced: Claim Register R2 row, `BACKLOG.md` `B-R2b`, `STATUS.md` §E. Full suite: 48/48 green. |
| **Acceptance** | New fixture green; suite green; Claim R2 notes R2b partial/proven-for-shape; multi-root remeasure result reported honestly whichever way it lands. |
| **Out of scope** | Command-bus resolution (confirmed still unreachable — write-path implementer imports the entity directly but has no static edge from `ChargesApiResource` at all). |
| **Hard predecessors** | T-R1-1 (done). |

---

### T-R1-3 — Java Graphify import target normalization

| Field | Content |
|---|---|
| **Status** | **Done** (2026-08-08). |
| **Goal** | Catalogue driver packages match Graphify’s real edge targets for Java (symbol vs qualified), generically. |
| **Why** | R2 work found `org.postgresql`-style rows may never match Graphify targets — silent miss. |
| **Backlog ID** | B-java-driver-ref |
| **Integrity home** | rules (new `java-import-resolver.ts`, sibling to `graphify-import-target.ts`) + `graphify-import-strategy-detector.ts` + persistence catalogue expand |
| **Implementation details** | Real evidence FIRST, not assumed: re-confirmed against real Fineract (`fineract-security/.../SqlInjectionPreventerServiceImpl.java:26`) that Graphify's Java `imports` edges target the bare lowercased LAST SYMBOL (`utils`), never the qualified package — and that this target is often not even a real graph node (`nodeById.get('utils')` → `null`). Unlike Node's deterministic `ref_<name>` transform, there is NO string transform that recovers the package from that target — a Set-membership fix would be a false-positive generator (`Utils`/`Driver` are common class names across unrelated packages). **Actual fix**: read the real import line back from source at the edge's own `source_location` (same technique already proven for decorator/call arguments), match the qualified import against catalogue package names as prefix-or-exact. New `java-import-resolver.ts` (`resolveJavaImportPackage`, `javaImportMatchesPackage`), wired into `graphify-import-strategy-detector.ts`'s `findLibraryImportEdges` (shared by persistence/messaging/outbound-http detectors) with a per-run file-line cache. `org.postgresql` and `org.jooq` added as real, now-reachable `driver-import` catalogue rows (`evidenceLevel: verified`). **Real verification, not synthetic**: `fineract-security` (71 files) — `SqlInjectionPreventerServiceImpl.java` now a real `database` unit, evidence names the real resolved import `org.postgresql.core.Utils`. Real Waltz `waltz-data` (241 files) — 229 real `database` units via `org.jooq.*`, including the exact `GenericSelector.java` case the catalogue row was originally evidenced against; jOOQ strategy flipped `not-implemented` → `dispatched`. **Follow-up evidence check (B-charge-jdbc-driver), real and substantial**: added `org.springframework.jdbc.core` as a driver-import row and re-ran the real `fineract-charge`+`fineract-provider` multi-root scan — this **closes the flagship Fineract residual named since requirements v0.9**: `ChargeReadPlatformServiceImpl` (the real bridge implementer for `ChargesApiResource`'s read path) now becomes its own real `database` unit, and `ChargesApiResource → ChargeReadPlatformServiceImpl` is a real, `calm validate`-clean (0 errors), confidence-10 cross-root relationship — the exact case R2/R2b were scoped around, closed via a Phase 1 mechanism once the import-resolution root cause was fixed (R2b's extra hop wasn't even needed for this one). `architectureOutboundCoverage` for the combined run: 98.3% (up from 97.5%). 3 new regression tests (2 fast/gated on `fineract-security`+`waltz-data`, 1 slow/gated multi-root closure test with a real assertion on the exact flagship relationship). One pre-existing regression test's hardcoded R0 relationship count (85) had to move to 96 — a real, explained side effect (11 more real database units in `fineract-core` alone from the newly-reachable driver rows), not a rebaseline-to-force-green. |
| **Acceptance** | At least one previously unreachable Java driver row becomes matchable in test; Claim/STATUS note. |
| **Hard predecessors** | None (can parallel R2b). |

---

# Phase R2 — Security depth & catalogue discipline

**Goal:** Grow C-call safely; deepen C-rich; formalize intake.  
**Why:** Session D is partial by design (two vocabularies, raw expression text).

---

### T-R2-1 — Catalogue intake rule

| Field | Content |
|---|---|
| **Goal** | Written rule: new signal/control/persistence/messaging row requires evidence sample, claim cell, regression, scope-limitations note. |
| **Why** | Prevent one-off catalogue sprawl and undocumented vocab. |
| **Backlog ID** | B-catalogue-intake |
| **Integrity home** | docs (Module_Authoring or short `Catalogue_Intake.md`) |
| **Acceptance** | Rule linked from BACKLOG and agent headers. |
| **Hard predecessors** | T-R0-1. |

---

### T-R2-2 — C-call vocabulary expansion

| Field | Content |
|---|---|
| **Goal** | Add catalogue-driven call-site auth signals beyond current set, with evidence. |
| **Why** | Enterprise stacks use many call patterns; two rows are not robust. |
| **Backlog ID** | B-C-call-expand |
| **Integrity home** | catalogue + scanner call-site path |
| **Implementation details** | Follow intake rule; prefer patterns evidenced in samples or lab fixtures; no single-repo-only strings unless generalized. Confidence discipline unchanged. |
| **Acceptance** | ≥1 new vocabulary with test; Claim C-call still partial until broader coverage stated. |
| **Hard predecessors** | T-R2-1. |

---

### T-R2-3 — C-rich structured authority (optional depth)

| Field | Content |
|---|---|
| **Goal** | Beyond raw source-line text: structured fields where safely extractable (without resolving constants incorrectly). |
| **Why** | Gold often wants authority semantics; raw text is a start. |
| **Backlog ID** | B-C-rich-authority |
| **Integrity home** | control-builder |
| **Acceptance** | Documented field contract; at least one structured field when possible; never invent resolved secrets. |
| **Hard predecessors** | C-rich partial already shipped. |

---

# Phase R3 — Discovery system

**Goal:** Standing discovery, not one matrix forever.  
**Why:** Robustness requires continuous disconfirmation.

---

### T-R3-1 — Stratified sample pass #2

| Field | Content |
|---|---|
| **Goal** | Refresh `pattern-coverage-matrix.md` with 5–15 packages (existing clones + FINOS landscape candidates if justified). Static probes first. |
| **Why** | Wave 1-B3 was a single pass; attention clustered on last hard sample. |
| **Backlog ID** | B-discovery-cadence |
| **Integrity home** | docs (coe-lab) |
| **Acceptance** | Updated matrix + ranked families; no requirement to pipeline-scan all. |
| **Hard predecessors** | None. |

---

### T-R3-2 — Re-rank and update BACKLOG

| Field | Content |
|---|---|
| **Goal** | After T-R3-1, adjust BACKLOG priorities; mark new OOS if warranted. |
| **Backlog ID** | B-discovery-cadence |
| **Acceptance** | BACKLOG changelog entry; OOS registry updated if needed. |
| **Hard predecessors** | T-R3-1. |

---

### T-R3-3 — Trap-gold automation (≥2 traps)

| Field | Content |
|---|---|
| **Goal** | Promote ≥2 trap cards to automated test or validate-calm-pair expected-fail/pass. |
| **Why** | Docs-only traps don’t enforce honesty. |
| **Backlog ID** | B-trap-promote |
| **Integrity home** | eval / regression |
| **Acceptance** | Two traps gated in CI when fixtures/clones available; document skips. |
| **Hard predecessors** | T-R0-1 recommended. |

---

### T-R3-4 — Discovery cadence policy

| Field | Content |
|---|---|
| **Goal** | Write cadence (e.g. every major wave or N weeks: re-probe sample set). |
| **Why** | Without cadence, discovery dies after one iteration. |
| **Backlog ID** | B-discovery-cadence |
| **Acceptance** | Policy paragraph in BACKLOG or NEXT_ITERATION; owner role named. |
| **Hard predecessors** | T-R3-1. |

---

# Phase R4 — Residual UX

**Goal:** Human path when automatic story incomplete; operator clarity.

---

### T-R4-1 — HITL path when S1 / low architecture coverage

| Field | Content |
|---|---|
| **Goal** | Document + optional offline trigger: when S1 fires or arch coverage below threshold, point operator to overrides / IR — never auto-LLM into facts. |
| **Why** | Robust product still needs residual human completion. |
| **Backlog ID** | B-hitl-s1 |
| **Integrity home** | docs + optional offline script |
| **Acceptance** | Documented path; if tool, offline only. |
| **Hard predecessors** | T-R0-2. |

---

### T-R4-2 — K8s substring residual (only if FP observed)

| Field | Content |
|---|---|
| **Goal** | Tighten deployment correlation without name denylists. |
| **Backlog ID** | B-k8s-fp |
| **Skip** | If no new FPs. |
| **Hard predecessors** | None. |

---

# Dependency matrix

| Task | Hard predecessors |
|---|---|
| T-R0-* | None |
| T-R1-1 | T-R0-1 recommended |
| T-R1-2 | T-R1-1 |
| T-R1-3 | None (parallel OK) |
| T-R2-1 | T-R0-1 |
| T-R2-2 | T-R2-1 |
| T-R2-3 | C-rich partial exists |
| T-R3-2 | T-R3-1 |
| T-R3-3 | T-R0-1 recommended |
| T-R4-1 | T-R0-2 |

---

# Definition of robustness program “MVP done”

- [ ] Pilot scorecard published  
- [ ] Architecture coverage metric shipping  
- [ ] Multi-root L2 protocol written and used once  
- [ ] OOS registry live  
- [ ] R2b shipped or residual explicitly permanent-bounded  
- [ ] Java driver-ref fixed or OOS with reason  
- [ ] Catalogue intake rule live  
- [ ] ≥1 C-call expansion **or** documented freeze with risk accepted  
- [ ] Discovery pass #2 + cadence policy  
- [ ] ≥2 traps automated  
- [ ] HITL residual path documented  
- [ ] BACKLOG/STATUS/Claim aligned  
- [ ] Suite green  

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | Initial phased robustness program (R0–R4) from health assessment + RCA/discovery learnings |
