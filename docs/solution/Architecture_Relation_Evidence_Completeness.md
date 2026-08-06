# Architecture Relation & Evidence Completeness (AREC)

**Status:** Wave 2 design lock (2026-08-07) — **design only; strategy code is Wave 3**  
**Pillar role:** First-class platform concern parallel to unit discovery and catalogue-driven CALM construction.  
**Not:** A queue of Fineract one-off patches.

**Depends on:** `Claim_Register.md`, `coe-lab/docs/validation-approach-vnext.md`, `pattern-coverage-matrix.md`  
**Master sequence:** `AGENT_TASKS_Master_Sequence_Claim_Honesty_and_AREC.md`

---

## 1. Problem statement

The platform is strong at **unit formation** (HTTP routes, entities, some decorator controls, import-based persistence after Graphify `ref_` fix). It is weak at **architecture stories**:

- Who **depends on** whom for persistence, trust, messaging  
- Which **security mechanisms** apply to HTTP surfaces  
- When silence (empty graph / no controls) is a **product gap** vs honest OOS  

Fineract 2026-08-07 finding: L0 schema pass + L1 unit/path pass + **L2 story fail** (0 service-touching relationships; call-site auth invisible). Root causes: dual-unit Graphify gate, multi-hop layering, decorator-only control path. See `coe-lab/docs/fineract-gold-vs-platform-finding.md`.

---

## 2. Pillar placement

```text
Scanner adapters → Unit formation (catalogues) → [ AREC: R + C + S ] → TypedFacts → Modules → Eval L0–L5 + HITL residual
```

| Layer | Name | Responsibility |
|---|---|---|
| **R** | Relation strategies | Produce / grade `TypedRelationship`s |
| **C** | Control strategies | Produce security-control evidence + control attachment inputs |
| **S** | Silence & claim binding | Completeness metrics; bind claims to required R/C levels |

Calm-generator builders remain **thin projectors** of TypedFacts. AREC does not live as `if (fineract)` in builders.

---

## 3. Relation strategies (R)

| ID | Strategy | Intent | Status (claim) | Primary evidence shape |
|---|---|---|---|---|
| **R0** | Dual-unit structural | Edges when both Graphify endpoints are TypedUnits | **proven as structural** | imports/calls/connects between units |
| **R1** | One-hop architecture | Service unit file imports/calls database (or topic) unit | **partial** (BoA Python) | Direct import/call between units |
| **R2** | Multi-hop / layered | Architecture link across non-unit intermediate application services | **specified-unbuilt** | Fineract API → *Service → entity |
| **R-k8s** | Config/trust | shares-secret, env soft-graph | **partial** | Manifests + deployment correlation |
| **R-contract** | Spec-declared links | Future: OpenAPI/AsyncAPI channel links | **unevidenced / backlog** | Contracts |

### Product rules

1. **R0 may always run.** Output should be **graded or described** so entity–entity mesh is not sold as “service architecture.”  
2. **Claiming “architecture connects” (L2)** requires the claim’s R-level (usually R1+ or R2) **or** explicit OOS.  
3. **R2 must not be “add ChargesApi→Charge.”** It is a **strategy class** for layered systems (any repo with API / application / domain split).  
4. New engines (scip-java, CodeQL) are **optional power** for R2 precision, not a substitute for defining the strategy.

### TypedFacts impact (design direction for Wave 3)

Without mandating a contract bump yet, Wave 3 should choose one of:

- **A)** `TypedRelationship` gains optional `role` / `grade`: `structural` | `architecture` | `trust` | …  
- **B)** Separate relationship lists in facts (structural vs architecture)  
- **C)** Metadata-only on relationships until contract bump  

Prefer **A or B** when implementing R0 honesty; follow `Contract_Evolution_Policy.md` if shape breaks.

---

## 4. Control strategies (C)

| ID | Strategy | Status | Notes |
|---|---|---|---|
| **C-dec** | Decorator (`PreAuthorize`, …) | **proven** | Open catalogue for vocabulary growth |
| **C-call** | Call-site (`validateHasReadPermission`, `jwt.decode`, …) | **specified-unbuilt** | v0.10; Fineract HTTP; lab jwt-gateway |
| **C-contract** | OpenAPI securitySchemes | **partial** | Fixture proven |
| **C-rich** | Evidence richness (expression, authority string) | **specified-unbuilt** | Config payload policy |

**Threat-signals** remains a consumer of “HTTP without security-control category evidence” — narrative must not confuse category absence with source absence until C-call exists.

---

## 5. Silence & claim binding (S)

| ID | Invariant (from validation-approach-vnext) | Wave 3 home |
|---|---|---|
| S1 | Service+db present, architecture claim active, zero service-touching rels → fail L2/L3 | coverage / eval |
| S2 | HTTP + required C-level, no evidence and no OOS → fail | claim + threat + eval |
| S3 | Marketing honesty for threat findings | docs |
| S4 | Confidence ≠ completeness | existing scope-limitation |

**S is part of AREC**, not optional QA. Shipping R2 without S recreates soft green elsewhere.

---

## 6. Ranked families → strategy cells (Wave 2-2)

From `pattern-coverage-matrix.md` probes:

| Rank | Family | Cell | Wave 3 priority band |
|---|---|---|---|
| 1 | Multi-hop layered service→store | **R2** | P0 |
| 2 | Call-site auth | **C-call** | P0 |
| 3 | Import ontology service vs database | U + R1 policy | P1 |
| 4 | Messaging producers | U-msg-producer | P1 |
| 5 | R0 entity mesh noise | **R0** grading | P1 |
| 6 | Spring Data / jOOQ | U-persist strategies | P2 |
| 7 | OpenAPI contract auth | **C-contract** expand | P2 |
| — | Control expression richness | **C-rich** | P2 with C-call |
| — | Silence automation | **S** | P0 with first R2/C-call drop |

---

## 7. Definition of done (AREC pillar)

AREC is **architecturally present** when:

1. This document is STATUS-linked as the pillar authority for relation/control **completeness**.  
2. Claim Register cells R0/R1/R2/C-*/S match reality.  
3. TypedFacts can express relation grade/role **or** product explicitly accepts metadata-only interim.  
4. Each **claimed** R/C level is either **built with disconfirming gold** or **OOS-with-gate**.  
5. Eval can **L2-fail** Fineract story while **L1-pass** lab core without contradiction.  
6. New enterprise shapes add a **strategy cell** (or OOS), not a one-off in `build-calm.ts`.

**Fineract L2 green** is a **consequence** of R2 + (C-call or OOS for HTTP auth), not a special case.

---

## 8. Module boundary

| May read AREC outputs | Must not |
|---|---|
| calm-generator (project relationships/controls) | Reach into Graphify raw graph ad hoc in builders |
| threat-signals | Invent relationships |
| Future modules | Bypass TypedFacts |

HITL/LLM: residual only (`review-flow-capability-map.md`).

---

## 9. Explicit non-goals (Wave 2)

- Implementing R2/C-call in this document’s PR  
- Hardcoding Fineract class names  
- Replacing unit discovery  
- Full Graphify dump into IR by default  

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-07 | Wave 2 design lock |
