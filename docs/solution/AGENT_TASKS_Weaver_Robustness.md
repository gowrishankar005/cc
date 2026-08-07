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
| [`AREC_R2b_Implementer_Store_Hop.md`](./AREC_R2b_Implementer_Store_Hop.md) | R2b design + evidence |
| [`Catalogue_Intake.md`](./Catalogue_Intake.md) | Rule for new catalogue rows (T-R2-1) |
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
| **Status** | **Done** (2026-08-08) — see [`Catalogue_Intake.md`](./Catalogue_Intake.md). |
| **Goal** | Written rule: new signal/control/persistence/messaging row requires evidence sample, claim cell, regression, scope-limitations note. |
| **Why** | Prevent one-off catalogue sprawl and undocumented vocab. |
| **Backlog ID** | B-catalogue-intake |
| **Integrity home** | docs (Module_Authoring or short `Catalogue_Intake.md`) |
| **Implementation details** | New `docs/solution/Catalogue_Intake.md` — four requirements (evidence sample cited by file/line, Claim Register update, regression test, scope-limitations note when narrower than the name suggests), what does NOT satisfy the rule (unevidenced "seems likely" rows, single-repo-shaped literals, crash-only tests, silent regex widening), a retroactive worked example (T-R1-3's `org.jooq` row) proving the rule against something already merged, not just prose. |
| **Acceptance** | Rule linked from BACKLOG and agent headers. |
| **Hard predecessors** | T-R0-1. |

---

### T-R2-2 — C-call vocabulary expansion

| Field | Content |
|---|---|
| **Status** | **Done** (2026-08-08). |
| **Goal** | Add catalogue-driven call-site auth signals beyond current set, with evidence. |
| **Why** | Enterprise stacks use many call patterns; two rows are not robust. |
| **Backlog ID** | B-C-call-expand |
| **Integrity home** | catalogue + scanner call-site path |
| **Implementation details** | Two new rows, both following `Catalogue_Intake.md`'s own rule (evidence + claim cell + regression + scope note). (1) `waltz-user-role-service` (`signal-catalogue.yml`) / `security-rbac-003` (`control-requirement-catalogue.yml`) — real evidence: Waltz's `WebUtilities.requireRole()` calls `userRoleService.hasRole(user, requiredRoles)` and throws `NotAuthorizedException` on failure (confirmed via real source, `waltz-web/.../WebUtilities.java:127-150`), weighted 40 (same tier as the existing fine-grained rows) — a genuinely DIFFERENT real repo's own vocabulary, not a Fineract-shaped guess. (2) `fineract-call-site-authenticated` / `security-auth-002` — Fineract's OWN `PlatformSecurityContext.isAuthenticated()` (confirmed real void assert-or-throw implementation, `SpringSecurityPlatformSecurityContext.java:81`), weighted 30 — deliberately BELOW the fine-grained RBAC tier on a real, stated distinction: authentication (logged in) is a materially weaker claim than authorization (allowed to do this specific thing), same honesty discipline as the existing `jwt.decode` row's lower weight. Real verification: Waltz `waltz-web` (225 files) — 4 real call sites get `security-rbac-003`, `calm validate` 0 errors; Fineract `isAuthenticated` confirmed matching (correctly sits below the unit confidence floor when isolated with no other evidence — same behavior as every other corroboration-tier signal, not a bug). 2 new regression tests. |
| **Acceptance** | ≥1 new vocabulary with test; Claim C-call still partial until broader coverage stated. |
| **Hard predecessors** | T-R2-1. |

---

### T-R2-3 — C-rich structured authority (optional depth)

| Field | Content |
|---|---|
| **Status** | **Done** (2026-08-08). |
| **Goal** | Beyond raw source-line text: structured fields where safely extractable (without resolving constants incorrectly). |
| **Why** | Gold often wants authority semantics; raw text is a start. |
| **Backlog ID** | B-C-rich-authority |
| **Integrity home** | control-builder (`control-builder.ts`) |
| **Implementation details** | New `authorityRef` field, alongside the existing `expression` field, extracted via `extractAuthorityRef()` — a regex over the ALREADY-captured raw expression text (no new extraction mechanism) matching a Java constant-style authority reference: a qualified enum member (`SystemRole.ADMIN`) or a bare ALL_CAPS constant (`RESOURCE_NAME_FOR_PERMISSIONS`). Deliberately NEVER resolves what the constant equals — a naming-convention token match, not cross-file value resolution (matches `extractCallArgumentText`'s own long-standing non-goal). Real, grep-verified against both evidence repos: Fineract's `RESOURCE_NAME_FOR_PERMISSIONS` (bare form), Waltz's `SystemRole.LICENCE_ADMIN`/`SystemRole.ADMIN`/`SystemRole.BULK_LEGAL_ENTITY_RELATIONSHIP_EDITOR` (qualified form) — all three real endpoint classes correctly get the field; `WebUtilities.java`'s own call site (`hasRole(user, requiredRoles)`, plain variables only) correctly gets NO field — a real negative case, not an oversight. Absent (not a fake empty string) whenever no such token is present, matching `expression`'s own discipline. 2 existing regression tests extended (not a new redundant test) with `authorityRef` assertions, including the negative case. |
| **Acceptance** | Documented field contract; at least one structured field when possible; never invent resolved secrets. |
| **Hard predecessors** | C-rich partial already shipped. |

---

# Phase R3 — Discovery system

**Goal:** Standing discovery, not one matrix forever.  
**Why:** Robustness requires continuous disconfirmation.

**Phase R3 complete** (2026-08-08): T-R3-1 through T-R3-4 all done.

---

### T-R3-1 — Stratified sample pass #2

| Field | Content |
|---|---|
| **Status** | **Done** (2026-08-08). |
| **Goal** | Refresh `pattern-coverage-matrix.md` with 5–15 packages (existing clones + FINOS landscape candidates if justified). Static probes first. |
| **Why** | Wave 1-B3 was a single pass; attention clustered on last hard sample. |
| **Backlog ID** | B-discovery-cadence |
| **Integrity home** | docs (coe-lab) |
| **Implementation details** | New "Wave R3-1" section appended to `coe-lab/docs/pattern-coverage-matrix.md` (Wave 1-B3's own section kept, not overwritten). 18 samples probed (static grep, no full pipeline run): 9 carried forward + Waltz `waltz-data`/`waltz-web` + Fineract `fineract-security`/`fineract-provider` + 5 previously-unprobed `coe-lab` lab fixtures. Real finding, not just a data refresh: Waltz and two Fineract modules had been used as real evidence repos across Phase R1/R2 work but were **never added to this matrix** — a genuine process gap this refresh names and closes, not only new numbers. |
| **Acceptance** | Updated matrix + ranked families; no requirement to pipeline-scan all. |
| **Hard predecessors** | None. |

---

### T-R3-2 — Re-rank and update BACKLOG

| Field | Content |
|---|---|
| **Status** | **Done** (2026-08-08). |
| **Goal** | After T-R3-1, adjust BACKLOG priorities; mark new OOS if warranted. |
| **Backlog ID** | B-discovery-cadence |
| **Implementation details** | Wave 1-B3's #1 (R2 multi-hop) and #2/#6 (call-site auth breadth, Spring Data/jOOQ) ranked risks retired as closed (Phase R1/R2 work). New #1 (`B-ontology`, U-persist-import) and new #2 (`B-msg-prod-sqs`, split out of the existing messaging-producer row — SQS/SNS producer specifically) promoted from P2 to P1 in `BACKLOG.md`. `OOS_Registry.md` checked for anything the refresh surfaced warranting a new non-goal row — nothing did (both new top risks are real, scoped, actionable gaps with a clear path, not permanent non-goals); its stale note about `B-java-driver-ref` updated to reflect that item is now done. |
| **Acceptance** | BACKLOG changelog entry; OOS registry updated if needed. |
| **Hard predecessors** | T-R3-1. |

---

### T-R3-3 — Trap-gold automation (≥2 traps)

| Field | Content |
|---|---|
| **Status** | **Done** (2026-08-08) — 7/8, well past the ≥2 bar. |
| **Goal** | Promote ≥2 trap cards to automated test or validate-calm-pair expected-fail/pass. |
| **Why** | Docs-only traps don’t enforce honesty. |
| **Backlog ID** | B-trap-promote |
| **Integrity home** | eval / regression |
| **Implementation details** | Audited all 8 trap cards in `coe-lab/docs/trap-gold-backlog.md` against the real regression suite — found 6 (T1, T2, T4, T5, T6, T7) already had real, passing, pre-existing tests that were never marked as promoted in the trap doc (a doc-sync gap, not missing coverage). T3 (pure-helper classes must not become services, `lib-fintech-common`) genuinely had no test despite its fixture already existing — new test added: `lib-fintech-common`'s `StringUtils`/`Money` classes (zero catalogue evidence of any kind) correctly produce ZERO CALM nodes, `calm validate` 0 errors. T7's SQS/SNS **producer** half specifically (as opposed to its already-proven DynamoDB persistence half) remains genuinely unpromoted, since that detection isn't built yet — see T-R3-2's `B-msg-prod-sqs` — honestly left as such rather than force-promoted against unbuilt capability. |
| **Acceptance** | Two traps gated in CI when fixtures/clones available; document skips. |
| **Hard predecessors** | T-R0-1 recommended. |

---

### T-R3-4 — Discovery cadence policy

| Field | Content |
|---|---|
| **Status** | **Done** (2026-08-08). |
| **Goal** | Write cadence (e.g. every major wave or N weeks: re-probe sample set). |
| **Why** | Without cadence, discovery dies after one iteration. |
| **Backlog ID** | B-discovery-cadence |
| **Implementation details** | `BACKLOG.md`'s health note gained a "Discovery cadence policy" section: cadence tied to Robustness phase boundaries (not a fixed calendar — phase completions are this project's real unit of progress), a 4-step repeatable procedure mirroring what T-R3-1/T-R3-2 just did, owner named as "whichever agent/session executes the current phase" (not a separate standing role), and the concrete failure mode this exists to prevent stated explicitly (Wave 1-B3's #1 risk closing with nothing forcing a re-rank, until this phase did it manually). |
| **Acceptance** | Policy paragraph in BACKLOG or NEXT_ITERATION; owner role named. |
| **Hard predecessors** | T-R3-1. |

---

# Phase R4 — Residual UX

**Goal:** Human path when automatic story incomplete; operator clarity.

**Phase R4 complete** (2026-08-08): T-R4-1 done (both original triggers now wired in, not just S1); T-R4-2 legitimately skipped (checked, not assumed — see below).

---

### T-R4-1 — HITL path when S1 / low architecture coverage

| Field | Content |
|---|---|
| **Status** | **Done** (2026-08-08). |
| **Goal** | Document + optional offline trigger: when S1 fires or arch coverage below threshold, point operator to overrides / IR — never auto-LLM into facts. |
| **Why** | Robust product still needs residual human completion. |
| **Backlog ID** | B-hitl-s1 |
| **Integrity home** | docs + optional offline script |
| **Implementation details** | T-E5 (Wave 3 Session E) had already shipped the S1/S2 half of this task's own two-part goal (`hitl-review-trigger.js`), but shipped *before* T-R0-2's `architectureOutboundCoverage` metric existed — the "OR arch coverage below threshold" half was a real, unclosed gap, not a doc-sync item, confirmed by reading the script: zero references to `architectureOutboundCoverage` anywhere in it. Closed here: new `low-architecture-coverage` trigger, threshold 50% (a real, reviewable starting value, same "draft not physics" framing as every other weight in this project), deliberately mutually exclusive with S1 (S1's own items already cover the degenerate 0%-coverage case more directly — this trigger is specifically for the SPARSE-but-nonzero case S1 was structurally unable to see). Reuses `coverage.completeness.architectureOutboundCoverage` and `facts.relationships` already computed — no new detection mechanism. **Real verification, not synthetic**: real Fineract `fineract-security` — 17% architecture coverage, S1 correctly does NOT fire (real relationships exist), 5 real service units correctly flagged by the new trigger. Still fully offline, deterministic, no LLM — same acceptance bar as T-E5. 1 new regression test. |
| **Acceptance** | Documented path; if tool, offline only. |
| **Hard predecessors** | T-R0-2. |

---

### T-R4-2 — K8s substring residual (only if FP observed)

| Field | Content |
|---|---|
| **Status** | **Legitimately skipped** (2026-08-08) — checked, not assumed. |
| **Goal** | Tighten deployment correlation without name denylists. |
| **Backlog ID** | B-k8s-fp |
| **Skip** | If no new FPs. |
| **Implementation details** | T-E6 already re-watched this under harder conditions (new `Transaction.java`/`TransactionRepository.java` database units, real substring-collision risk against `TransactionHistoryController`) and found 0 FPs. Since then, T-R1-3 added 3 new Java driver-import catalogue rows (`org.postgresql`, `org.jooq`, `org.springframework.jdbc.core`) — a real, concrete new-FP-risk vector worth actually checking rather than assuming T-E6's result still holds. Checked directly: `grep -rln "org.postgresql\|org.jooq\|org.springframework.jdbc.core" spikes/boa/repo/src --include="*.java"` returns zero matches — none of BoA's Java services (the real k8s-correlation evidence base) import any of the 3 new packages, so T-R1-3 introduced no new database units into that evidence base at all. Skip condition genuinely satisfied, not defaulted to. |
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

**All 13 items done as of 2026-08-08 — the robustness program (Phases R0–R4) is MVP complete.**

- [x] Pilot scorecard published — T-R0-1, `Pilot_Ready_Scorecard.md`
- [x] Architecture coverage metric shipping — T-R0-2, `coverage-report.ts`'s `architectureOutboundCoverage`
- [x] Multi-root L2 protocol written and used once — T-R0-3, `coe-lab/docs/multi-root-l2-protocol.md`, used for real in T-R1-2/T-R1-3's `fineract-charge`+`fineract-provider` remeasures
- [x] OOS registry live — T-R0-4, `OOS_Registry.md`
- [x] R2b shipped or residual explicitly permanent-bounded — T-R1-2 shipped; the one genuinely permanent residual (command-bus dynamic dispatch) is named `OOS-command-bus`, not left ambiguous
- [x] Java driver-ref fixed or OOS with reason — T-R1-3, fixed (not OOS) — **and its follow-up evidence check closed the flagship Fineract-charge residual itself**, beyond this checklist item's own bar
- [x] Catalogue intake rule live — T-R2-1, `Catalogue_Intake.md`
- [x] ≥1 C-call expansion **or** documented freeze with risk accepted — T-R2-2, 2 new vocabularies (exceeds the "≥1" bar)
- [x] Discovery pass #2 + cadence policy — T-R3-1/T-R3-2 (pass #2) + T-R3-4 (cadence policy)
- [x] ≥2 traps automated — T-R3-3, 7/8 (well past the "≥2" bar)
- [x] HITL residual path documented — T-R4-1, both original triggers now wired (S1/S2 + low-architecture-coverage), still fully offline
- [x] BACKLOG/STATUS/Claim aligned — updated at every phase close, this session
- [x] Suite green — 55/55, confirmed after T-R4-1's new test

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | Initial phased robustness program (R0–R4) from health assessment + RCA/discovery learnings |
