# Claim Register — what we may say is “built”

**Status:** active (Wave 1-A0)  
**Authority:** Prefer this file over marketing language in STATUS/CLAUDE when they disagree on **relationship or control completeness**.  
**Master sequence:** `AGENT_TASKS_Master_Sequence_Claim_Honesty_and_AREC.md`  
**Last updated:** 2026-08-07

---

## How to use this register

| Status | Meaning | Allowed green |
|---|---|---|
| **proven** | Verified on real evidence + regression or documented run | L1 unit recall; L2 only if claim says so |
| **partial** | Some strategies work; not the full product claim | L0–L1; L2 only for proven sub-shapes |
| **specified-unbuilt** | Design/requirements named it; code incomplete or absent | Must not claim “works”; OOS or fail L2 |
| **unevidenced** | No solid sample yet | No product claim |
| **OOS** | Explicitly out of product scope for now | Silence OK only if scope-limitation id present |

**Rule:** Do not mark STATUS “built” for a cell here without evidence pointer + validation layer that is allowed to green.

---

## Dual-unit Graphify decision (product, not implementation accident)

| Decision | **Dual-unit structural edges are an interim / structural product (R0), not the full definition of “architecture relationship.”** |
|---|---|
| Meaning | Graphify reconciler only emits edges when **both** endpoints are TypedUnits. That is correct for **code-level structural** edges. It is **insufficient** alone for enterprise **architecture stories** (e.g. layered Fineract API → platform service → entity). |
| Claim language | May say: “structural/code-graph relationships between discovered units.” Must **not** say: “service→persistence architecture is recovered for Java enterprise monorepos” without R1/R2 strategies (AREC). |
| Date | 2026-08-07 (Wave 1-A0 lock for claim honesty; AREC details in Wave 2) |

---

## Mechanism-class matrix

| ID | Mechanism class | Status | Evidence | Validation allowed green | Notes |
|---|---|---|---|---|---|
| **U-http** | HTTP entry (native route / composed JAX-RS / Nest) | **proven** | BoA Flask, Nest fixture, Fineract charge/core, lab fixtures | L1 paths | |
| **U-entity** | JPA `@Entity` → database unit | **proven** | Fineract charge/core, lab java | L1 database nodes | |
| **U-persist-import** | Driver/import persistence (SQLAlchemy, Prisma `ref_`, …) | **partial** | BoA SQLAlchemy; Ghostfolio Prisma after `ref_` fix | L1 with low confidence ok | Prisma service-as-database ontology is modelling debt |
| **U-msg-consumer** | `@KafkaListener` → network/topic | **partial** | Fineract listener + lab kafka; gold maps to network | L1 network unit | Producer call-site still open |
| **U-msg-producer** | `KafkaTemplate.send` / SQS send | **specified-unbuilt** | Named backlog | L2 fail or OOS | |
| **U-spring-data / jOOQ** | Repo interfaces / jOOQ | **specified-unbuilt** | Catalogue rows not fully dispatched | L2 partial | |
| **R0** | Dual-unit Graphify structural edges | **proven** (as structural) | Core entity–entity; BoA service–db when one-hop | L2 **only** for shapes that match R0 | Not Fineract API→entity |
| **R1** | One-hop architecture service→db (import/calls between units) | **partial** | BoA Python service→AccountDb | L2 BoA-class | |
| **R2** | Multi-hop / layered (API→app service→entity) | **specified-unbuilt** | Fineract charge/core gold vs gen: 0 service-touching edges | L2 **fail** until AREC R2 | Primary Fineract gap |
| **R-k8s** | shares-secret / env soft-graph | **partial** | BoA k8s; deployment correlation post-MVP | L2 when manifests passed | |
| **C-dec** | Decorator controls (`@PreAuthorize`) | **proven** | DatatableWriteService | L1 controls presence | Payload weak (no expression) |
| **C-call** | Call-site auth (`validateHasReadPermission`, `jwt.decode`) | **specified-unbuilt** | v0.10; Fineract APIs; lab jwt-gateway | L2 control fail or OOS | |
| **C-contract** | OpenAPI securitySchemes | **partial** | OpenAPI fixture | L1 when OpenAPI present | |
| **C-rich** | Control config richness (expression, authority) | **specified-unbuilt** | Gold richer than gen | Not L1 requirement today | |
| **S-silence** | Completeness / empty neighborhood loudness | **specified-unbuilt** | Fineract high unit conf + 0 service edges | L3 when AREC S lands | |

---

## Product claims — allowed vs forbidden phrases

| Forbidden (without caveats) | Allowed |
|---|---|
| “Java relationships work end-to-end” | “JAX-RS routes and JPA entities are discovered; architecture service→store links are partial (R1 where one-hop; R2 unbuilt)” |
| “Security/controls captured for Fineract APIs” | “`@PreAuthorize` on service interfaces is captured; call-based PlatformSecurityContext auth is not” |
| “Graphify recovers full architecture graph” | “Graphify supplies structural edges between TypedUnits (R0)” |
| “Node persistence verified” (pre-ref_ fix) | “Prisma/import detection works with Graphify `ref_` normalization (Ghostfolio)” |

---

## Open questions (Q1–Q12) — decide / park

Living cadence: re-open when claim cells or AREC DoD change. Full narrative: `Open_Questions_Validation.md`.

| Q | Topic | State | Decision / park |
|---|---|---|---|
| Q1 | Definition of done: schema vs unit vs story | **decided** | Layered L0–L5 (`validation-approach-vnext.md`); story = L2 |
| Q2 | Meaning of relationship: code vs architecture | **decided** | R0 structural ≠ architecture claim; R1+ for architecture |
| Q3 | What incompleteness must be loud | **decided (policy)** | Service+db with zero service-touching edges must not L2-pass; implement L3 in Wave 3-S |
| Q4 | Dual-unit product boundary | **decided** | Interim structural (see above) |
| Q5 | Disconfirming samples for relationship claims | **decided (process)** | BoA shallow + Fineract layered required before “Java rels complete” |
| Q6 | Lab shape-representative? | **decided** | Lab under-represents layering; wild gold mandatory for enterprise claims |
| Q7 | Wild gold owner | **parked** | Lab maintainer / eval owner; refresh on fixture or Fineract module intent change |
| Q8 | Validation stack | **decided** | L0 calm validate; L1 semantic/unit; L2 story; L3 silence; L4 scope; L5 HITL residual |
| Q9 | HITL → catalogue promotion | **parked** | Follow existing unmapped≥5 promotion; AREC residual separate |
| Q10 | Forever OOS vs deferred | **partial** | Register + scope-limitations; refresh when strategies ship |
| Q11 | Full monorepo vs module scan product mode | **parked** | Module roots supported; multi-root optional; claims must name mode |
| Q12 | STATUS “built” vs mechanism subset | **decided** | This register is authoritative for completeness claims |

---

## AREC DoD binding (Wave 2-3)

Architecture completeness claims also require `Architecture_Relation_Evidence_Completeness.md` §7.  
In short: R0 structural ≠ architecture L2; R2 + C-call (or OOS) before Fineract-class story green.

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-07 | Wave 1-A0 initial register from Fineract RCA + dual-unit decision |
| 2026-08-07 | Wave 2-3 AREC DoD cross-link |
