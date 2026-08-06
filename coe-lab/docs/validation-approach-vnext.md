# Validation approach vNext (L0–L5)

**Status:** Wave 1-A2  
**Purpose:** Define what “pass” means so lab/core green cannot hide wild-type story gaps.

---

## Executive definition of “all pass” (≤10 lines)

1. **L0** — document is schema-valid CALM (`calm validate`).  
2. **L1** — required units/routes/controls **presence** match gold (semantic / path recall).  
3. **L2** — required **architecture relationships** (and control story where gold demands) match claim level.  
4. **L3** — silence invariants: no silent high-confidence incompleteness (e.g. service+db, zero service-touching edges) unless OOS.  
5. **L4** — scope-limitations / claim register match actual gaps.  
6. **L5** — residual HITL budget accepted only for non-systematic leftovers.  

**Lab core “semantic PASS” today is roughly L0+L1 (soft L2).**  
**Fineract hand gold L2 currently FAILS** (by design of current platform).  
Saying “all pass” without a layer is **forbidden**.

---

## Layers

| Layer | Name | Pass means | Primary tools |
|---|---|---|---|
| **L0** | Schema | `hasErrors: false` under calm validate (+ `-u` if controls) | `calm validate`, generate-calm |
| **L1** | Unit recall | Gold architectural nodes/types/paths/control **presence** matched (ids may differ) | `score-calm`, semantic half of `validate-calm-pair` |
| **L2** | Story recall | Gold **connects topology** (and required controls content level per claim) | Stricter validate-calm-pair; Fineract gold |
| **L3** | Silence probes | Invariants hold (see below) | Metrics on typed-facts/CALM (Wave 3-S may automate) |
| **L4** | Scope honesty | Every known gap has claim cell and/or scope-limitation id | Claim_Register, scope-limitations.yml |
| **L5** | HITL residual | Overrides only for residual after systematic strategies | DR/Override, review-flow map |

---

## Package → required layers

| Package set | Required for “eval green” | Notes |
|---|---|---|
| Lab **core** (py-accounts, nestjs, jaxrs, spring, rbac, lib trap, ledger) | L0 + L1; L2 soft (extras OK) | Good unit coverage today |
| Lab **stretch** (kafka, dynamo, jwt, k8s) | L0 + L1 report; L2 per gold expected gaps | May expected-fail L2 |
| **Wild Fineract** charge/core | L0 + L1 + **L2** for story gold | L2 fail until AREC R2/C-call or gold OOS |
| **Wild Fineract** system-map | L0 only vs class-level gen | Incomparable grain without aggregation |
| Ghostfolio / BoA full | L0 + L1; L2 per claim cell | Use as disconfirming samples |

---

## Silence invariants (L3) — on paper

Implement later (Wave 3-S); **policy now**:

| ID | Invariant | Fail means |
|---|---|---|
| **S1** | If ≥1 service and ≥1 database architectural unit in a package run, and gold/claim requires R1/R2, then service-touching relationship count must be >0 | Silent incomplete architecture graph |
| **S2** | If unit has `http-entry-point` and claim requires C-call or C-dec, then either security-control evidence or explicit OOS/scope id | Silent “secure by omission” |
| **S3** | Threat-signals “no security-control” on HTTP must not be marketed as “no auth in source” without C-call status | Narrative honesty |
| **S4** | High `x-aac-confidence` on units does not imply L2 pass | confidence-not-completeness |

**Fineract charge/core today:** S1 fails under architecture claim; S2 fails for HTTP APIs under full control claim.

---

## Tool roles

| Tool | Layer |
|---|---|
| `calm validate` | L0 |
| `gold/packages` + `score-calm` | L1 (P/R style) |
| `gold/calm` + `validate-calm-pair` | L0 + semantic L1; tighten for L2 |
| Claim register / scope-limitations | L4 |
| Overrides | L5 |

---

## Expected-fail packages (honesty)

| Package | Expected at L2 today |
|---|---|
| fineract-charge | **FAIL** story (no service→db) |
| fineract-core | **FAIL** story (no service→db; HTTP controls absent) |
| ts-orders-dynamo | **FAIL** or weak until cloud units exist |
| java-kafka-settlement | Partial L1 network; L2 producer edges fail |

Lab core may **L1 pass** while wild L2 fails — that is consistent, not a contradiction.

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-07 | Wave 1-A2 initial |
