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
| **B-R2b** | R2 extension: sole implementer → **imported** DB/topic unit (impl need not be the entity) | `todo` | Phase-1 R2 residual: real layered services rarely make the implementer itself `@Entity` | Robustness Phase R1; AREC_R2 strategy |
| **B-arch-cov** | Architecture coverage metric + gate (% services with architecture-grade outbound when store units exist) | `todo` | S1 is binary; need ongoing quality signal, not only empty/non-empty | Robustness Phase R0 |
| **B-pilot-scorecard** | Pilot-ready scorecard (which claim cells must be proven/partial) | `done` (T-R0-1) | Enterprise readiness: no single success metric | `Pilot_Ready_Scorecard.md` |
| **B-R2-eval** | Labeled multi-root L2 remeasure protocol | `done` (T-R0-3) | Q11; single-root ≠ multi-root claims | `coe-lab/docs/multi-root-l2-protocol.md` |
| **B-oos-registry** | Standing OOS registry (command-bus, Helm, …) | `done` (T-R0-4) | Permanent non-goals must not vanish | `OOS_Registry.md` |
| **B-catalogue-intake** | Catalogue intake rule (evidence + test + claim cell) for new rows | `todo` | Vocab growth without one-offs | Robustness Phase R2 |
| **B-discovery-cadence** | Scheduled stratified sampling (not one-shot) | `todo` | Avoid overfitting last pain | Robustness Phase R3 |
| **B-graphify-partial** | Operator visibility when Graphify fail-soft / partial backbone | `todo` | Completeness UX under tool failure | Robustness Phase R0 / R4 |
| **B-java-driver-ref** | Graphify Java import target normalize (symbol vs qualified package) | `todo` | Silent catalogue miss class | Robustness Phase R1 |
| **B-trap-promote** | Trap-gold → automated eval/CI gates | `todo` | Docs-only traps don’t enforce honesty | Robustness Phase R3 |
| **B-hitl-s1** | HITL/advisory path when S1 fires (offline; no TypedFacts write) | `done` (T-E5) | Residual human path | Robustness Phase R4 / T-E5 — `hitl-review-trigger.js` |

---

## Open product backlog (by priority)

Statuses: `todo` · `partial` · `doing` · `oos` · `done`

### P1 — Architecture stories & security depth

| ID | Item | Status | Spec / claim |
|---|---|---|---|
| **B-R2b** | (see robustness) | `todo` | Claim **R2** |
| **B-R2-eval** | (see robustness) | `todo` | Q11 |
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
| Hardest story (layered multi-module) | Fair — mechanism yes, product close needs **B-R2b** + **B-R2-eval** |
| Discovery as a system | Weak → **B-discovery-cadence** |
| Eval enforcement | Fair → **B-trap-promote** + **B-arch-cov** |
| Pilot readiness | Needs **B-pilot-scorecard** |

See [NEXT_ITERATION.md](./NEXT_ITERATION.md) for sequencing.

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | Initial thin index after Wave 3 A–D |
| 2026-08-08 | Robustness track folded in; link to AGENT_TASKS_Weaver_Robustness.md |
| 2026-08-08 | Session E (T-E1–T-E6) marked done — was stale `todo` from before this session's work landed |
| 2026-08-08 | Robustness Phase R0 (T-R0-1…T-R0-5) done: B-pilot-scorecard, B-R2-eval, B-oos-registry flipped; new Pilot_Ready_Scorecard.md / multi-root-l2-protocol.md / OOS_Registry.md linked above |
