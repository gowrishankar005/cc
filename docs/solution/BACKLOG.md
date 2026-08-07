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
| **Pilot-ready scorecard** | [`Pilot_Ready_Scorecard.md`](./Pilot_Ready_Scorecard.md) |
| **Standing OOS registry** | [`OOS_Registry.md`](./OOS_Registry.md) |
| **Multi-root L2 protocol** | [`../../coe-lab/docs/multi-root-l2-protocol.md`](../../coe-lab/docs/multi-root-l2-protocol.md) |

---

## Now / next (active)

| ID | Item | Status | Detail |
|---|---|---|---|
| **E** | AREC Session E (breadth) | `done` (2026-08-08) | [T-E1…T-E6](./AGENT_TASKS_AREC_Wave3_Implementation.md) all shipped (T-E0 correctly skipped — C-rich already landed in D) |
| **RB** | Weaver robustness program (phased) | `doing` — Phase R0 in progress | [AGENT_TASKS_Weaver_Robustness.md](./AGENT_TASKS_Weaver_Robustness.md) |
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
| jOOQ | re-confirmed root cause (Graphify Java symbol-vs-package gap), not fixed — see **B-java-driver-ref** |
| OpenAPI dual-unit merge (trap T8) + C-contract expand | `done` — T-E4, trap promoted |
| HITL review trigger (offline, S1/S2 → review-queue.json) | `done` — T-E5 |
| K8s substring residual | `done` — watched under harder conditions, confirmed clean, no fix needed (T-E6) |

---

## Robustness track (must stay first-class)

These exist so Weaver stays honest under enterprise monorepos — not optional polish.

| ID | Item | Status | Why | Spec |
|---|---|---|---|---|
| **B-R2b** | R2 extension: sole implementer → **imported** DB/topic unit (impl need not be the entity) | `done` (T-R1-2) | Phase-1 R2 residual: real layered services rarely make the implementer itself `@Entity` | [`AREC_R2b_Implementer_Store_Hop.md`](./AREC_R2b_Implementer_Store_Hop.md); real evidence: 11 new relationships in `fineract-provider`, 3 more in `fineract-core` |
| **B-charge-jdbc-driver** | Spring-JDBC driver-import catalogue row (`org.springframework.jdbc.core`) + Java symbol-vs-package fix, combined | `todo` | The ONE remaining concrete path to close Fineract-charge's own flagship residual — its bridge implementer (`ChargeReadPlatformServiceImpl`) is raw-JDBC and imports neither the entity nor a currently-recognized driver; confirmed R2b's hop correctly finds 0 candidates there, not a bug | Depends on **B-java-driver-ref**; named in `AREC_R2b_Implementer_Store_Hop.md` §1 |
| **B-arch-cov** | Architecture coverage metric + gate (% services with architecture-grade outbound when store units exist) | `done` (T-R0-2) | S1 is binary; need ongoing quality signal, not only empty/non-empty | `coverage-report.ts`'s `architectureOutboundCoverage` |
| **B-pilot-scorecard** | Pilot-ready scorecard (which claim cells must be proven/partial) | `done` (T-R0-1) | Enterprise readiness: no single success metric | `Pilot_Ready_Scorecard.md` |
| **B-R2-eval** | Labeled multi-root L2 remeasure protocol | `done` (T-R0-3) | Q11; single-root ≠ multi-root claims | `coe-lab/docs/multi-root-l2-protocol.md` |
| **B-oos-registry** | Standing OOS registry (command-bus, Helm, …) | `done` (T-R0-4) | Permanent non-goals must not vanish | `OOS_Registry.md` |
| **B-catalogue-intake** | Catalogue intake rule (evidence + test + claim cell) for new rows | `todo` | Vocab growth without one-offs | Robustness Phase R2 |
| **B-discovery-cadence** | Scheduled stratified sampling (not one-shot) | `todo` | Avoid overfitting last pain | Robustness Phase R3 |
| **B-graphify-partial** | Operator visibility when Graphify fail-soft / partial backbone | `done` (T-R0-5) | Completeness UX under tool failure | S0 silence flag in `coverage-report.ts` |
| **B-java-driver-ref** | Graphify Java import target normalize (symbol vs qualified package) | `todo` | Silent catalogue miss class | Robustness Phase R1 |
| **B-trap-promote** | Trap-gold → automated eval/CI gates | `todo` | Docs-only traps don’t enforce honesty | Robustness Phase R3 |
| **B-hitl-s1** | HITL/advisory path when S1 fires (offline; no TypedFacts write) | `done` (T-E5) | Residual human path | Robustness Phase R4 / T-E5 — `hitl-review-trigger.js` |

---

## Open product backlog (by priority)

Statuses: `todo` · `partial` · `doing` · `oos` · `done`

### P1 — Architecture stories & security depth

| ID | Item | Status | Spec / claim |
|---|---|---|---|
| **B-R2b** | (see robustness) | `done` (T-R1-2) | Claim **R2** |
| **B-R2-eval** | (see robustness) | `done` (T-R0-3) | Q11 |
| **B-C-call-expand** | Expand call-site control vocabularies | `todo` | Claim **C-call** |
| **B-C-rich-authority** | Richer control config (structured authority) | `todo` | Claim **C-rich** |
| **B-S3** | Threat narrative honesty | `done` | T-D3 |

### P2 — Breadth (Session E + catalogue debt)

| ID | Item | Status | Spec / claim |
|---|---|---|---|
| **B-msg-prod** | Messaging **producers** | `done` (Kafka field-type); SQS/SNS producer `todo` | **U-msg-producer**; T-E1 |
| **B-ontology** | Persist ontology (ORM import ≠ always database) | `decided, not code-fixed` | **U-persist-import**; T-E2 (Q13) |
| **B-spring-data** | Spring Data repository dispatch | `done` | T-E3 |
| **B-jooq** | jOOQ strategy dispatch | `todo` — root cause re-confirmed (Graphify Java symbol-vs-package), not fixed | T-E3 |
| **B-dynamo-sqs** | Dynamo / SQS architecture units | `partial` — DynamoDB verified; SQS/SNS producer still open | T-E3 |
| **B-openapi-dual** | OpenAPI dual-unit policy | `done` | T-E4 |
| **B-c-contract** | OpenAPI securitySchemes expand | `done`, expanded | **C-contract** |
| **B-java-driver-ref** | (see robustness) | `todo` | R2 notes |

### P3 — Eval, discovery, residual UX

| ID | Item | Status | Spec |
|---|---|---|---|
| **B-discovery-cadence** | (see robustness) | `todo` | Phase R3 |
| **B-trap-promote** | (see robustness) | `todo` | Phase R3 |
| **B-hitl-s1** | (see robustness) | `todo` | Phase R4 |
| **B-k8s-fp** | Deployment correlation residual FPs | `done` — watched, confirmed clean, no fix needed | T-E6 |
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
| Hardest story (layered multi-module) | Good progress — **B-R2b** `done` (11 new real fineract-provider relationships, 3 more in fineract-core); Fineract-charge's own flagship case is a real, named residual → **B-charge-jdbc-driver** |
| Discovery as a system | Weak → **B-discovery-cadence** |
| Eval enforcement | Fair → **B-trap-promote** (metric itself, **B-arch-cov**, now `done`) |
| Pilot readiness | Scorecard shipped (**B-pilot-scorecard** `done`) — readiness itself still gated on the last-mile Fineract-charge story, tracked as **B-charge-jdbc-driver** |

See [NEXT_ITERATION.md](./NEXT_ITERATION.md) for sequencing.

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | Initial thin index after Wave 3 A–D |
| 2026-08-08 | Robustness track folded in; link to AGENT_TASKS_Weaver_Robustness.md |
| 2026-08-08 | Session E (T-E1–T-E6) marked done — was stale `todo` from before this session's work landed |
| 2026-08-08 | Robustness Phase R0 (T-R0-1…T-R0-5) done: B-pilot-scorecard, B-R2-eval, B-oos-registry flipped; new Pilot_Ready_Scorecard.md / multi-root-l2-protocol.md / OOS_Registry.md linked above |
| 2026-08-07 | Backlog-hygiene pass: B-arch-cov and B-graphify-partial were shipped in R0 (T-R0-2/T-R0-5 per STATUS.md) but never flipped from `todo`; B-R2-eval was `done` in the Robustness track table but still `todo` in the duplicate P1 reference — both classes of staleness fixed, health note reworded to match |
| 2026-08-07 | T-R1-1 (R2b design addendum) done — see `AREC_R2b_Implementer_Store_Hop.md`; B-R2b flipped `todo` → `doing`. Separately: real-repo scan sweep against Fineract found and fixed a real crash (`.push(...arr)` spread exceeding V8's argument limit on `fineract-provider`, 2733 files, 167k+ ignored items) — 13 call sites converted to a loop-based `pushAll()`, regression-locked (200k-element synthetic test, no real-repo dependency needed to catch a regression). Not a BACKLOG-tracked item (no open row existed for it — found and fixed same-session); see STATUS.md §E for full detail. |
| 2026-08-07 | T-R1-2 (R2b implementation) done — `multi-hop-bridge-detector.ts` extended with the implementer-import hop; B-R2b flipped `doing` → `done`. Real multi-root remeasure: 11 new architecture relationships resolved in `fineract-provider`, 3 more in `fineract-core` (single-root) — Fineract-charge's own flagship case stays an honest, named residual (implementer imports 0 candidate stores, confirmed via real run). New backlog row **B-charge-jdbc-driver** names the one concrete remaining path to close it. Claim Register R2 row and STATUS.md §E updated same-session. 48/48 tests green. |
