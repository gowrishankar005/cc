# Weaver — product backlog (thin index)

**Purpose:** One place to see **what is left to build**, without duplicating full task specs.  
**Product:** **Weaver** (Architecture-as-Code → CALM). Evidence repos are samples, not the product.

| This file is | This file is not |
|---|---|
| Ordered index of pending/planned work | Full implementation instructions |
| Status snapshot of open items | Capability matrix (that’s STATUS) |
| Links to the doc that owns detail | Claim authority (that’s Claim Register) |

**Update rule:** When an item ships → `done` (or remove) + update **STATUS** + **Claim Register**. Add one row here when work is accepted onto the queue.

---

## How to use

| Need | File |
|---|---|
| **What’s left (this index)** | **This file** |
| **Next iteration focus** | [`NEXT_ITERATION.md`](./NEXT_ITERATION.md) |
| **Robustness program (phased agent tasks)** | [`AGENT_TASKS_Weaver_Robustness.md`](./AGENT_TASKS_Weaver_Robustness.md) |
| **Wave 3 Session E (breadth)** | [`AGENT_TASKS_AREC_Wave3_Implementation.md`](./AGENT_TASKS_AREC_Wave3_Implementation.md) |
| **What’s built vs partial** | [`STATUS.md`](./STATUS.md) |
| **What we may claim** | [`Claim_Register.md`](./Claim_Register.md) |
| **Eval traps** | [`../../coe-lab/docs/trap-gold-backlog.md`](../../coe-lab/docs/trap-gold-backlog.md) |
| **Architect residual review session (proposed)** | [`Architect_Residual_Review_Session.md`](./Architect_Residual_Review_Session.md) — **review before implementing** |
| **Pilot-ready scorecard** | [`Pilot_Ready_Scorecard.md`](./Pilot_Ready_Scorecard.md) |
| **Standing OOS registry** | [`OOS_Registry.md`](./OOS_Registry.md) |
| **Multi-root L2 protocol** | [`../../coe-lab/docs/multi-root-l2-protocol.md`](../../coe-lab/docs/multi-root-l2-protocol.md) |

---

## Now / next (active)

| ID | Item | Status | Detail |
|---|---|---|---|
| **E** | AREC Session E (breadth) | `done` (2026-08-08) | [T-E1…T-E6](./AGENT_TASKS_AREC_Wave3_Implementation.md) all shipped (T-E0 correctly skipped — C-rich already landed in D) |
| **RB** | Weaver robustness program (phased) | `done` (2026-08-08) — Phases R0–R4 all complete, MVP checklist 13/13 | [AGENT_TASKS_Weaver_Robustness.md](./AGENT_TASKS_Weaver_Robustness.md) |
| **W3-close** | Close Wave 3 checklist / OOS decisions | `done` | AREC Wave 3 DoD — all checkboxes closed, Sessions A–E complete |

### Recently landed (Wave 3 A–D) — do not re-queue

| Item | Status |
|---|---|
| Silence S1/S2 + coverage completeness | `done` |
| R0 relationship grading | `done` |
| Eval L0/L1/L2 labels | `done` |
| R1 one-hop regression lock | `done` |
| R2 multi-hop **mechanism** (non-fabricating) | `done` — **product residual** → **B-R2b** |
| C-call (bounded vocab) + C-rich (expression text) | `done` — expand → **B-C-call-expand** / **B-C-rich-authority** |

### Recently landed (Wave 3 E) — do not re-queue

| Item | Status |
|---|---|
| Messaging producers (KafkaTemplate field-type) | `done` — T-E1; SQS/SNS producer still open, see **B-dynamo-sqs** |
| Persistence ontology decision (Prisma Service vs database) | `done` — decided, not code-fixed (Q13); see **B-ontology** for the deferred code fix |
| Spring Data repository dispatch | `done` — T-E3 |
| DynamoDB verified | `done` — T-E3 |
| jOOQ | `done` (T-R1-3) — root cause fixed, 229 real database units verified against real Waltz `waltz-data` |
| OpenAPI dual-unit merge (trap T8) + C-contract expand | `done` — T-E4, trap promoted |
| HITL review trigger (offline, S1/S2 → review-queue.json) | `done` — T-E5 |
| K8s substring residual | `done` — watched under harder conditions, confirmed clean, no fix needed (T-E6) |

---

## Robustness track (must stay first-class)

These exist so Weaver stays honest under enterprise monorepos — not optional polish.

| ID | Item | Status | Why | Spec |
|---|---|---|---|---|
| **B-R2b** | R2 extension: sole implementer → **imported** DB/topic unit (impl need not be the entity) | `done` (T-R1-2) | Phase-1 R2 residual: real layered services rarely make the implementer itself `@Entity` | [`AREC_R2b_Implementer_Store_Hop.md`](./AREC_R2b_Implementer_Store_Hop.md); real evidence: 11 new relationships in `fineract-provider`, 3 more in `fineract-core` |
| **B-charge-jdbc-driver** | Spring-JDBC driver-import catalogue row (`org.springframework.jdbc.core`) + Java symbol-vs-package fix, combined | `done` (T-R1-3) | **Closes the flagship Fineract residual named since requirements v0.9.** Real, verified: `ChargeReadPlatformServiceImpl` now a real `database` unit; `ChargesApiResource → ChargeReadPlatformServiceImpl` real, `calm validate`-clean, confidence-10 cross-root relationship in a real `fineract-charge`+`fineract-provider` run | `persistence-detection-catalogue.yml`'s `org.springframework.jdbc.core` row |
| **B-arch-cov** | Architecture coverage metric + gate (% services with architecture-grade outbound when store units exist) | `done` (T-R0-2) | S1 is binary; need ongoing quality signal, not only empty/non-empty | `coverage-report.ts`'s `architectureOutboundCoverage` |
| **B-pilot-scorecard** | Pilot-ready scorecard (which claim cells must be proven/partial) | `done` (T-R0-1) | Enterprise readiness: no single success metric | `Pilot_Ready_Scorecard.md` |
| **B-R2-eval** | Labeled multi-root L2 remeasure protocol | `done` (T-R0-3) | Q11; single-root ≠ multi-root claims | `coe-lab/docs/multi-root-l2-protocol.md` |
| **B-oos-registry** | Standing OOS registry (command-bus, Helm, …) | `done` (T-R0-4) | Permanent non-goals must not vanish | `OOS_Registry.md` |
| **B-catalogue-intake** | Catalogue intake rule (evidence + test + claim cell) for new rows | `done` (T-R2-1) | Vocab growth without one-offs | [`Catalogue_Intake.md`](./Catalogue_Intake.md) |
| **B-discovery-cadence** | Scheduled stratified sampling (not one-shot) | `done` (T-R3-1/T-R3-2/T-R3-4) | Avoid overfitting last pain | `coe-lab/docs/pattern-coverage-matrix.md` Wave R3-1 + cadence policy in this file's health note |
| **B-graphify-partial** | Operator visibility when Graphify fail-soft / partial backbone | `done` (T-R0-5) | Completeness UX under tool failure | S0 silence flag in `coverage-report.ts` |
| **B-java-driver-ref** | Graphify Java import target normalize (symbol vs qualified package) | `done` (T-R1-3) | Silent catalogue miss class | `java-import-resolver.ts`; real evidence: `org.postgresql` (Fineract), `org.jooq` (229 real Waltz units), `org.springframework.jdbc.core` (closes flagship residual, see **B-charge-jdbc-driver**) |
| **B-trap-promote** | Trap-gold → automated eval/CI gates | `done` (T-R3-3) | Docs-only traps don’t enforce honesty | `coe-lab/docs/trap-gold-backlog.md`; 7/8 traps promoted |
| **B-hitl-s1** | HITL/advisory path when S1 fires (offline; no TypedFacts write) | `done` (T-E5 + T-R4-1) | Residual human path | Robustness Phase R4 — `hitl-review-trigger.js`. T-R4-1 closed a real gap: the task's own original goal named "S1 fires OR arch coverage below threshold," but only S1/S2 were ever wired in until T-R4-1 added a `low-architecture-coverage` trigger (real evidence: Fineract `fineract-security`, 17% coverage, S1 does not fire, 5 real services flagged) |

---

## Open product backlog (by priority)

Statuses: `todo` · `partial` · `doing` · `oos` · `done`

### P1 — Architecture stories & security depth

| ID | Item | Status | Spec / claim |
|---|---|---|---|
| **B-R2b** | (see robustness) | `done` (T-R1-2) | Claim **R2** |
| **B-R2-eval** | (see robustness) | `done` (T-R0-3) | Q11 |
| **B-C-call-expand** | Expand call-site control vocabularies | `done` (T-R2-2) | Claim **C-call**; real evidence: Waltz `hasRole` (security-rbac-003), Fineract `isAuthenticated` (security-auth-002) |
| **B-C-rich-authority** | Richer control config (structured authority) | `done` (T-R2-3) | Claim **C-rich**; new `authorityRef` field, `control-builder.ts` |
| **B-S3** | Threat narrative honesty | `done` | T-D3 |
| **B-ontology** ⬆ | Persist ontology (ORM import ≠ always database) | `decided, not code-fixed` | **U-persist-import**; T-E2 (Q13). **Promoted from P2, T-R3-2 (Robustness Phase R3 re-rank)** — now the #1 ranked risk family per `coe-lab/docs/pattern-coverage-matrix.md`'s Wave R3-1 refresh, since R2/jOOQ/Spring-Data (the prior #1/#6) closed this round. |
| **B-msg-prod-sqs** ⬆ | SQS/SNS messaging **producer** detection (distinct from the already-done Kafka field-type producer and from DynamoDB persistence) | `todo` | **U-msg-producer**. **Promoted from P2 (split out of B-msg-prod/B-dynamo-sqs), T-R3-2** — now the #2 ranked risk family; real evidence a single fixture (`lab-ts-orders-dynamo`) already imports both `@aws-sdk/client-dynamodb` (persistence, done) and `@aws-sdk/client-sqs` (messaging producer, still undetected) — the same file shape, only half-covered. |

### P2 — Breadth (Session E + catalogue debt)

| ID | Item | Status | Spec / claim |
|---|---|---|---|
| **B-msg-prod** | Messaging **producers** | `done` (Kafka field-type); SQS/SNS producer split out and promoted to P1 → **B-msg-prod-sqs** | **U-msg-producer**; T-E1 |
| **B-ontology** | Persist ontology (ORM import ≠ always database) | `decided, not code-fixed` — promoted to P1 (see above), row kept here for its original T-E2/Q13 context | **U-persist-import**; T-E2 (Q13) |
| **B-spring-data** | Spring Data repository dispatch | `done` | T-E3 |
| **B-jooq** | jOOQ strategy dispatch | `done` (T-R1-3) | T-E3; real evidence: 229 database units, real Waltz `waltz-data` |
| **B-dynamo-sqs** | Dynamo / SQS architecture units | `partial` — DynamoDB verified; SQS/SNS producer split out, see **B-msg-prod-sqs** (P1) | T-E3 |
| **B-openapi-dual** | OpenAPI dual-unit policy | `done` | T-E4 |
| **B-c-contract** | OpenAPI securitySchemes expand | `done`, expanded | **C-contract** |
| **B-java-driver-ref** | (see robustness) | `done` (T-R1-3) | R2 notes |

### P3 — Eval, discovery, residual UX

| ID | Item | Status | Spec |
|---|---|---|---|
| **B-discovery-cadence** | (see robustness) | `done` (T-R3-1/T-R3-2/T-R3-4) | Phase R3 |
| **B-trap-promote** | (see robustness) | `done` (T-R3-3) | Phase R3 |
| **B-hitl-s1** | HITL empty-neighborhood queue (`hitl-review-trigger`) | `done` (T-E5 + T-R4-1) | Phase R4 — queue only, both original triggers (S1/S2 + low-architecture-coverage) now wired; not full residual UX, see **B-review-session** |
| **B-review-session** | Architect-friendly residual session (session pack + VS Code LLM agent; Tier A human / Tier B evidenced LLM drafts → DR+Override only) | `proposed — **review before implementing**` | [`Architect_Residual_Review_Session.md`](./Architect_Residual_Review_Session.md). **Do not start Phase 1 pack tooling until this design is reviewed/accepted.** Productizes §7.1 residual UX without putting LLM on `run-slice`. |
| **B-k8s-fp** | Deployment correlation residual FPs | `done` (T-E6, re-checked T-R4-2) — watched under harder conditions, confirmed clean both times, no fix needed | T-E6; T-R4-2 checked whether T-R1-3's 3 new Java driver-import rows introduced any new FP risk into the real BoA k8s-correlation evidence base — grep-confirmed zero of BoA's Java services import any of them, so no new units, no new risk |
| **B-scope-hygiene** | scope-limitations ↔ Claim Register | `ongoing` | every wave |

### Later / platform

| ID | Item | Status | Notes |
|---|---|---|---|
| **B-phase2-engines** | CodeQL / scip-java on measured gap only | `todo` | engine-capability-matrix |
| **B-plugin** | Module discovery / embed API | `todo` | Goal A |
| **B-two-tier-map** | Global + domain mapping-config | `todo` | Gap_Closure |
| **B-adr** | ADR → CALM `adrs[]` | `todo` | design v2 |
| **B-helm** | Helm/Kustomize | `oos` near-term | — |
| **B-lang-expand** | Go / .NET / frontend | `oos` near-term | README |

---

## Health note (robustness)

| Dimension | Assessment |
|---|---|
| Honesty / anti-overclaim | Strong (S1, grades, non-fabricating R2, Claim Register) |
| Hardest story (layered multi-module) | **Closed.** **B-R2b** + **B-charge-jdbc-driver** both `done` — Fineract-charge's own flagship `ChargesApiResource → Charge`-family residual (open since requirements v0.9) is real, `calm validate`-clean, in a real multi-root run. |
| Discovery as a system | **Improving** — Wave R3-1 refresh done (T-R3-1/T-R3-2), cadence policy now written (below); still needs a second real cycle to prove the cadence holds, not just that it was written once |
| Eval enforcement | Good → **B-trap-promote** `done` (7/8 traps promoted, T-R3-3); **B-arch-cov** `done` |
| Pilot readiness | Scorecard shipped (**B-pilot-scorecard** `done`); the last-mile Fineract-charge story is now closed too (**B-charge-jdbc-driver** `done`) |

### Discovery cadence policy (T-R3-4)

**Cadence:** re-probe the sample set (`coe-lab/docs/pattern-coverage-matrix.md`) at the start of every Robustness phase boundary (i.e. after each `AGENT_TASKS_Weaver_Robustness.md` phase closes, not on a fixed calendar — phase completions are this project's real unit of progress, a fixed N-week timer would fire independent of whether anything changed). At minimum: before any phase whose own tasks depend on "what's the current top risk" (compare `AGENT_TASKS_Weaver_Robustness.md`'s own phase list — R1/R2 both did).

**What a re-probe pass must do** (same shape as Wave R3-1, T-R3-1/T-R3-2 — don't reinvent per cycle):
1. Static probes (grep counts) across current `spikes/`+`coe-lab` samples — no full pipeline run required.
2. Add any real sample used as evidence in the phase just closed but never added to the matrix (Wave R3-1's own finding: Waltz and two Fineract modules were used extensively before ever being added — check for this class of gap every cycle, not just once).
3. Explicitly retire ranked risks that closed during the phase (don't silently carry a closed risk forward — Wave R3-1's own corrective act).
4. Re-rank BACKLOG P1 to match the refreshed top risks; check OOS registry for anything the refresh surfaced (usually nothing — that's fine, the check itself is the discipline, not finding something every time).

**Owner:** whichever agent/session is executing the CURRENT Robustness phase — discovery is not a separate standing role, it's a required first/last step of each phase (mirrors T-R0's own "R0 must exist before R1-R4 have a bar" ordering). If no agent owns a phase actively, the next session picking up `AGENT_TASKS_Weaver_Robustness.md` inherits it.

**Failure mode this prevents** (already observed once, named honestly): Wave 1-B3's #1-ranked risk was closed by Phase R1, but nothing forced a re-rank — without T-R3-1/T-R3-2 explicitly doing it, the matrix would have kept presenting a solved problem as the standing top risk indefinitely, exactly the "one probe table, then chase last pain" failure `AGENT_TASKS_Weaver_Robustness.md` §0.2 already named as a reason this whole phase exists.

See [NEXT_ITERATION.md](./NEXT_ITERATION.md) for sequencing.

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | **B-review-session** added (P3): architect residual review session design in `Architect_Residual_Review_Session.md` — status `proposed — review before implementing`. **B-hitl-s1** flipped to `done` (T-E5 already shipped queue CLI; full residual UX is B-review-session, not a second hitl-s1). Doc link added to “How to use” table. |
| 2026-08-08 | Initial thin index after Wave 3 A–D |
| 2026-08-08 | Robustness track folded in; link to AGENT_TASKS_Weaver_Robustness.md |
| 2026-08-08 | Session E (T-E1–T-E6) marked done — was stale `todo` from before this session's work landed |
| 2026-08-08 | Robustness Phase R0 (T-R0-1…T-R0-5) done: B-pilot-scorecard, B-R2-eval, B-oos-registry flipped; new Pilot_Ready_Scorecard.md / multi-root-l2-protocol.md / OOS_Registry.md linked above |
| 2026-08-07 | Backlog-hygiene pass: B-arch-cov and B-graphify-partial were shipped in R0 (T-R0-2/T-R0-5 per STATUS.md) but never flipped from `todo`; B-R2-eval was `done` in the Robustness track table but still `todo` in the duplicate P1 reference — both classes of staleness fixed, health note reworded to match |
| 2026-08-07 | T-R1-1 (R2b design addendum) done — see `AREC_R2b_Implementer_Store_Hop.md`; B-R2b flipped `todo` → `doing`. Separately: real-repo scan sweep against Fineract found and fixed a real crash (`.push(...arr)` spread exceeding V8's argument limit on `fineract-provider`, 2733 files, 167k+ ignored items) — 13 call sites converted to a loop-based `pushAll()`, regression-locked (200k-element synthetic test, no real-repo dependency needed to catch a regression). Not a BACKLOG-tracked item (no open row existed for it — found and fixed same-session); see STATUS.md §E for full detail. |
| 2026-08-07 | T-R1-2 (R2b implementation) done — `multi-hop-bridge-detector.ts` extended with the implementer-import hop; B-R2b flipped `doing` → `done`. Real multi-root remeasure: 11 new architecture relationships resolved in `fineract-provider`, 3 more in `fineract-core` (single-root) — Fineract-charge's own flagship case stays an honest, named residual (implementer imports 0 candidate stores, confirmed via real run). New backlog row **B-charge-jdbc-driver** names the one concrete remaining path to close it. Claim Register R2 row and STATUS.md §E updated same-session. 48/48 tests green. |
| 2026-08-08 | T-R1-3 (Java Graphify import target normalization) done — new `java-import-resolver.ts` reads the real import line back from source (Graphify's Java `imports` edges only ever carry the bare symbol, never the qualified package). B-java-driver-ref, B-jooq flipped to `done`; real evidence: `org.postgresql` (Fineract `fineract-security`), `org.jooq` (229 real units, Waltz `waltz-data`). **Follow-up evidence check closes the flagship Fineract residual**: added `org.springframework.jdbc.core`, re-ran the real `fineract-charge`+`fineract-provider` multi-root scan — `ChargesApiResource → ChargeReadPlatformServiceImpl` is now a real, `calm validate`-clean, confidence-10 relationship. B-charge-jdbc-driver flipped `todo` → `done`. Phase R1 complete. 3 new regression tests (2 fast, 1 slow/gated); 1 pre-existing test's hardcoded count moved 85→96 with a real, explained reason. 51/51 tests green. |
| 2026-08-08 | Phase R2 complete (T-R2-1, T-R2-2, T-R2-3). New `Catalogue_Intake.md` (B-catalogue-intake → done). Two new C-call rows: Waltz `hasRole` (security-rbac-003, real 4-call-site evidence) and Fineract `isAuthenticated` (security-auth-002, weighted lower on a real stated authn-vs-authz distinction) — B-C-call-expand → done. New `authorityRef` structured field (control-builder.ts) — B-C-rich-authority → done. 4 new/extended regression tests. 53/53 tests green. |
| 2026-08-08 | T-R3-1/T-R3-2 (discovery refresh + re-rank) done — `coe-lab/docs/pattern-coverage-matrix.md`'s Wave R3-1 section: 18 samples probed (9 carried forward + Waltz data/web, Fineract security/provider, and 5 previously-unprobed lab fixtures — none had ever been added to this matrix despite being real evidence repos this whole session). Wave 1-B3's #1/#2/#6 ranked risks (R2 multi-hop, call-site auth, Spring Data/jOOQ) retired as closed; **B-ontology** and a new, split-out **B-msg-prod-sqs** promoted to P1 as the new #1/#2 ranked risks. `OOS_Registry.md` checked — nothing new warranted an OOS row, both promoted to active backlog instead; its stale "B-java-driver-ref not listed" note updated to reflect it's now done. |
| 2026-08-08 | Phase R4 complete (T-R4-1, T-R4-2). T-R4-1 found and closed a real gap, not just doc-sync: the task's own original goal named two triggers ("S1 fires OR arch coverage below threshold"), but `hitl-review-trigger.ts` had only ever wired in S1/S2 (T-E5 shipped before T-R0-2's `architectureOutboundCoverage` metric existed). New `low-architecture-coverage` trigger added, mutually exclusive with S1, real-verified against Fineract `fineract-security` (17% coverage, 5 real services flagged). T-R4-2 legitimately skipped — checked (not assumed) whether T-R1-3's 3 new Java driver-import rows introduced new FP risk into the real BoA k8s evidence base; grep-confirmed zero BoA Java services import any of them. 1 new regression test. **Robustness program (R0-R4) now fully complete.** |
