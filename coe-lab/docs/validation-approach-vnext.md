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
| **S0** | If `graphifyStatus !== 'ok'`, flag it — a degraded/failed structural backbone silently starves every downstream mechanism (cross-package edges, import-based persistence/messaging, R2 bridge resolution), including S1's own precondition | Empty-looking architecture story that's actually a tool-failure artifact, not a maturity gap — shipped T-R0-5, `coverage-report.ts`'s `completeness.silenceFlags` |
| **S1** | If ≥1 service and ≥1 database architectural unit in a package run, and gold/claim requires R1/R2, then service-touching relationship count must be >0 | Silent incomplete architecture graph |
| **S2** | If unit has `http-entry-point` and claim requires C-call or C-dec, then either security-control evidence or explicit OOS/scope id | Silent “secure by omission” |
| **S3** | Threat-signals “no security-control” on HTTP must not be marketed as “no auth in source” without C-call status | Narrative honesty |
| **S4** | High `x-aac-confidence` on units does not imply L2 pass | confidence-not-completeness |
| **S5** | T-Y5-1, HT-ASB-006 class: (a) 0 service units present but ≥1 database/topic unit exists — real persistence code with no discovered entry-point surface at all; (b) `--cfn-manifests` found real API Gateway route bindings but bound none of them to a scanned unit | The degenerate, loudest-should-be case S1 structurally cannot catch (S1 requires ≥1 service unit to even fire) — real, pre-Y3 `aws-saas-boost-tier-service`/`tenant-service` baseline (0 services, N Dynamo units, `silenceFlags: []`) named this gap; still fires post-Y4 for Node/Python handlers (no sample yet) or CFN routes whose handler code lives outside the scanned roots |

**Fineract charge/core today:** S1 fails under architecture claim; S2 fails for HTTP APIs under full control claim.

---

## Tool roles

| Tool | Layer |
|---|---|
| `calm validate` | L0 |
| `gold/packages` + `score-calm` | L1 (P/R style); `rel R` column is an L2 proxy, read separately from `pass` (T-A3) |
| `gold/calm` + `validate-calm-pair` | L0 + explicit L1 + explicit L2 (T-A3 — no longer bundled into one `semantic` line) |
| Claim register / scope-limitations | L4 |
| Overrides | L5 |

### `validate-calm-pair.mjs` L0/L1/L2 (T-A3, 2026-08-07)

Each package result now prints separate `L0 schema`, `L1 unit recall`, `L2 story` lines instead of one bundled `semantic: PASS/FAIL` — the previous shape made it impossible to tell an L1-only pass from an L2 story pass by output alone, which is exactly the false-comfort the Fineract finding named.

- **L2 = N/A** (not PASS, not FAIL) when: gold has zero `connects`-shaped relationships (most lab-core packages — they assert unit/interface recall, not architecture links), OR gold carries an `x-lab-grain` metadata key (module-grain gold, e.g. `fineract-system-map`, is not comparable to a class/file-grain generated CALM at all — both L1 and L2 are N/A for those).
- **Exit code default = L0 + L1 only.** An L2-only failure does not fail the run. Pass `--require-l2` to also gate on L2 — deliberately off by default while R2 (multi-hop architecture links) is Claim-Register `specified-unbuilt`; turning default exit code red for an honestly-documented, not-yet-built capability would just train operators to ignore red, the opposite of this file's purpose.
- Real verified result (2026-08-07): `fineract-charge`/`fineract-core` now print `L1: PASS`, `L2: FAIL` (exit 0 by default, exit 1 with `--require-l2`) — matching the documented baseline (`coe-lab/docs/fineract-gold-vs-platform-finding.md`) exactly, not a new claim.

---

## Expected-fail packages (honesty)

| Package | Expected at L2 today |
|---|---|
| fineract-charge | **FAIL** story — R2 (T-C1, 2026-08-07) was implemented and RUN against this exact package (both single-root and a `fineract-charge`+`fineract-provider` multi-root scan) and did NOT close the gap: a real, evidenced residual, not an unbuilt-mechanism gap anymore. `ChargesApiResource`'s bridge to `ChargeReadPlatformService` resolves correctly, but the real implementer (`ChargeReadPlatformServiceImpl`, in `fineract-provider`) has no catalogue-recognized persistence evidence of its own (raw JDBC, not `@Entity`/a matched driver import) — see `AREC_R2_MultiHop_Strategy.md` §1 and `STATUS.md` §D T-C1. |
| fineract-core | **FAIL** story (no service→db; HTTP controls absent) — R2 not yet remeasured against `fineract-core` specifically (T-C1 remeasured `fineract-charge`); expect the same class of residual until C-call (Session D) or a Phase 2 engine closes the implementer-evidence gap |
| ts-orders-dynamo | **FAIL** or weak until cloud units exist |
| java-kafka-settlement | Partial L1 network; L2 producer edges fail |

Lab core may **L1 pass** while wild L2 fails — that is consistent, not a contradiction.

**R2 mechanism status (T-C1, 2026-08-07)**: built and verified NON-FABRICATING on two real scan shapes — never invents an edge when a bridge is ambiguous or its implementer lacks persistence evidence, always reports an honest `unresolved-multi-hop` ignored-item instead. Proven POSITIVE on a synthetic fixture (`pipeline/test/fixtures/r2-bridge-sample`) where the full chain (service → bridge → persistence-evidenced implementer) is resolvable within scanned roots. Fineract-charge's own L2 failure is now a genuinely evidenced residual (the real implementer lacks its own persistence evidence), not an "unbuilt mechanism" gap — worth re-testing once C-call (Session D) or a broader persistence catalogue closes that specific evidence gap.

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-07 | Wave 1-A2 initial |
| 2026-08-07 | AREC Wave 3 T-A3: `validate-calm-pair.mjs` prints explicit L0/L1/L2 lines; `--require-l2` gates exit code; system-map/empty-gold-rel packages report L2 N/A generically (metadata-driven, no package-name check) |
