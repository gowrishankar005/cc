# Weaver — product backlog (thin index)

**Purpose:** One place to see **what is left to build**, without duplicating full task specs.  
**Product:** Weaver (Architecture-as-Code → CALM). Evidence repos are samples, not the product.

| This file is | This file is not |
|---|---|
| Ordered index of pending/planned work | Full implementation instructions |
| Status snapshot of open items | Capability matrix (that’s STATUS) |
| Links to the doc that owns detail | Claim authority (that’s Claim Register) |

**Update rule:** When an item ships, set status → `done` (or remove) and update **STATUS** + **Claim Register**. When you add work, add one row here + a task/spec link if needed.

---

## How to use

| Need | File |
|---|---|
| **What’s left (this index)** | **This file** |
| **How an agent implements (current wave)** | [`AGENT_TASKS_AREC_Wave3_Implementation.md`](./AGENT_TASKS_AREC_Wave3_Implementation.md) |
| **What’s built vs partial** | [`STATUS.md`](./STATUS.md) |
| **What we may claim** | [`Claim_Register.md`](./Claim_Register.md) |
| **Eval traps** | [`../../coe-lab/docs/trap-gold-backlog.md`](../../coe-lab/docs/trap-gold-backlog.md) |
| **Next iteration plan** | [`NEXT_ITERATION.md`](./NEXT_ITERATION.md) |

---

## Now / next (active)

| ID | Item | Status | Owner detail |
|---|---|---|---|
| **E** | AREC Session E (breadth) | `todo` | [Wave 3 tasks T-E0…T-E6](./AGENT_TASKS_AREC_Wave3_Implementation.md) — skip T-E0 if C-rich already done in D |
| **W3-close** | Close Wave 3 checklist (done cells + OOS decisions) | `todo` | Same agent file § “Definition of Wave 3 program done” |

### Recently landed (Wave 3 A–D) — do not re-queue

| Item | Status |
|---|---|
| Silence S1/S2 + coverage completeness | `done` |
| R0 relationship grading | `done` |
| Eval L0/L1/L2 labels | `done` |
| R1 one-hop regression lock | `done` |
| R2 multi-hop **mechanism** (non-fabricating) | `done` (partial product — residual open below) |
| C-call (bounded vocabularies) + C-rich (expression text) | `done` (partial — vocab/expansion open) |

---

## Open product backlog (by priority)

Statuses: `todo` · `partial` · `doing` · `oos`

### P1 — Architecture stories & security depth (critical)

| ID | Item | Status | Why it matters | Spec / claim |
|---|---|---|---|---|
| **B-R2b** | R2 extension: terminal hop via implementer → imported DB/topic unit (not only “impl is @Entity”) | `todo` | Mechanism works on synthetic shape; real multi-module layered services often have service impls without being the entity | Claim **R2** residual; [AREC_R2 strategy](./AREC_R2_MultiHop_Strategy.md) |
| **B-R2-eval** | Wild-type L2 remeasure protocol (labeled multi-root sets, not one-repo fetish) | `todo` | Q11 claim mode; honest multi-module evaluation | Claim Q11; validation-approach-vnext |
| **B-C-call-expand** | Expand call-site control vocabularies (beyond validateHas*/jwt.decode) | `todo` | C-call is partial; enterprise stacks use many call shapes | Claim **C-call** |
| **B-C-rich-authority** | Richer control config (resolved authority / structured fields) | `todo` | C-rich is raw line text only | Claim **C-rich** |
| **B-S3** | Threat-signals narrative vs category-only detection (if not fully closed in D) | `partial` | Avoid “no auth in source” misread | T-D3 / Claim S |

### P2 — Breadth (Session E + known catalogue debt)

| ID | Item | Status | Spec / claim |
|---|---|---|---|
| **B-msg-prod** | Messaging **producers** (KafkaTemplate.send, SQS send, …) | `todo` | Claim **U-msg-producer**; T-E1 |
| **B-ontology** | Persist ontology: app service + ORM type import ≠ always `database` unit | `todo` | Claim **U-persist-import**; T-E2 |
| **B-spring-data** | Spring Data repository strategy dispatch | `todo` | Claim **U-spring-data**; T-E3 |
| **B-jooq** | jOOQ strategy dispatch | `todo` | Claim **U-spring-data/jOOQ**; T-E3 |
| **B-dynamo-sqs** | Dynamo / SQS architecture units (lab + real samples) | `todo` | T-E3; lab stretch gold |
| **B-openapi-dual** | OpenAPI dual-unit merge/ignore policy | `todo` | T-E4; trap T8 |
| **B-c-contract** | OpenAPI securitySchemes as controls (expand) | `partial` | Claim **C-contract** |
| **B-java-driver-ref** | Graphify Java import target normalization for driver packages (qualified vs symbol) | `todo` | Surfaced during R2 work; Claim R2 notes |

### P3 — Eval, discovery, residual UX

| ID | Item | Status | Spec / claim |
|---|---|---|---|
| **B-hitl-s1** | Empty-neighborhood / S1 advisory or IR trigger (offline, no TypedFacts write) | `todo` | T-E5 |
| **B-k8s-fp** | Deployment correlation residual FPs (substring) | `todo` | T-E6 if observed |
| **B-discovery** | Next stratified sample pass (FINOS landscape / new proxies) | `todo` | [NEXT_ITERATION.md](./NEXT_ITERATION.md); pattern matrix |
| **B-trap-promote** | Promote trap-gold cards to automated gates as cells ship | `todo` | trap-gold-backlog.md |
| **B-scope-hygiene** | Keep scope-limitations.yml ↔ Claim Register after each wave | `ongoing` | STATUS hygiene |

### Later / platform (not only AREC)

| ID | Item | Status | Notes |
|---|---|---|---|
| **B-phase2-engines** | CodeQL / scip-java as Phase 2 when Phase 1 gaps measured | `todo` | engine-capability-matrix |
| **B-plugin** | Third-party module discovery / embed API | `todo` | Goal A incomplete |
| **B-two-tier-map** | Two-tier mapping-config (global + domain) | `todo` | Gap_Closure / design |
| **B-adr** | ADR file discovery → CALM `adrs[]` | `todo` | design v2 |
| **B-helm** | Helm/Kustomize resolution | `oos` near-term | Not Phase 1 |
| **B-lang-expand** | Go / .NET / frontend stacks | `oos` near-term | Explicit non-support in README |

---

## Pointers (do not duplicate full lists)

| Topic | Canonical detail |
|---|---|
| Wave 3 session tasks | `AGENT_TASKS_AREC_Wave3_Implementation.md` |
| Older extraction waves | `AGENT_TASKS_Extraction_Enrichment.md` (mostly historical/done) |
| Trap shapes | `coe-lab/docs/trap-gold-backlog.md` |
| Ranked pattern risks | `coe-lab/docs/pattern-coverage-matrix.md` |
| Next iteration focus | `NEXT_ITERATION.md` |

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | Initial thin index after Wave 3 A–D; next = Session E + R2 residual / discovery |
