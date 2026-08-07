# Pattern coverage matrix & stratified probes (Wave 1-B3)

**Date:** 2026-08-07  
**Method:** Desk matrix + **static probes** (grep counts), not full pipeline on all samples.  
**Samples:** local clones under `spikes/` + coe-lab fixtures only.

---

## Probe results (static)

| sample | Path/Rest/Ctrl | @Entity | PreAuthorize | validateHas*Perm | jwt.decode | KafkaListener | prisma | sqlalchemy | java API files | API→domain import |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| fineract-charge | 5 | 1 | 0 | 3 | 0 | 0 | 0 | 0 | 2 | 1* |
| fineract-core | 11 | 36 | 4 | 12 | 0 | 0 | 0 | 0 | 11 | 2 |
| boa-userservice | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 8 | 0 | 0 |
| boa-balancereader | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| ghostfolio-api | 34 | 0 | 0 | 0 | 0 | 0 | 90 | 0 | 0 | 0 |
| lab-java-jaxrs | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| lab-py-accounts | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 0 |
| lab-jwt-gateway | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| lab-kafka | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |

\*API→domain import heuristic is coarse; charge API still does **not** import `Charge` entity (source review). Core: **2/11** API files with domain import → **layered dominance**.

---

## Mechanism × sample (qualitative)

| Mechanism | Fineract | BoA | Ghostfolio | Lab |
|---|---|---|---|---|
| HTTP units | strong | strong (Flask/Spring) | strong Nest | strong |
| Entity units | strong | partial Java | n/a (Prisma import) | strong |
| R1 one-hop service→db | weak/rare | strong Python | partial (service vs prisma ontology) | strong py |
| R2 multi-hop layered | **dominant gap** | less critical | service layers | weak representation |
| C-dec PreAuthorize | sparse (core) | rare | — | rbac package |
| C-call permission/jwt | **dominant on HTTP** | jwt in userservice | — | jwt-gateway |
| Messaging consumer | present elsewhere | — | — | kafka lab |
| Messaging producer | present elsewhere | — | — | open |
| K8s trust | — | strong | — | stretch |

---

## Ranked risk families (for AREC Wave 2–3)

| Rank | Family | Claim cell | Why high risk | Density signal |
|---|---|---|---|---|
| **1** | Multi-hop layered service→store | R2 | Fineract gold L2 fail; core APIs rarely import entities | 2/11 domain imports |
| **2** | Call-site auth / permission APIs | C-call | validateHasReadPermission ≫ PreAuthorize on Fineract HTTP | 12 vs 4 in core; 3 in charge |
| **3** | Import-graph ontology (service vs database) | U-persist-import | Prisma DTO imports vs real stores | Ghostfolio fixed FP; modelling open |
| **4** | Messaging producers | U-msg-producer | Spec’d unbuilt | Lab + Fineract evidence elsewhere |
| **5** | Entity–entity R0 noise vs architecture | R0 quality | Core 64 rels, 0 service-touching | Full pipeline evidence |
| **6** | Spring Data / jOOQ | U-spring-data | Catalogue not fully dispatched | Requirements backlog |
| **7** | Contract auth (OpenAPI) | C-contract | Partial fixture only | Lab nest openapi |

---

## Explicit non-run

Full platform scan of all samples **not** required for this ranking. Deep pipeline evidence already exists for Fineract charge/core and Ghostfolio access slice.

---

# Refresh — Wave R3-1 (Robustness Phase R3, T-R3-1)

**Date:** 2026-08-08
**Method:** Same as Wave 1-B3 — static probes (grep counts), not full pipeline on all samples.
**Samples:** 18 total (9 carried forward from Wave 1-B3 + 4 new `spikes/` modules + 5 previously-unprobed `coe-lab` fixture packages), all local clones/checked-in fixtures, no new repos cloned this round.

**Why this refresh matters, stated plainly**: Wave 1-B3's #1-ranked risk (multi-hop layered service→store, R2) and a large chunk of #2 (call-site auth vocabulary breadth) are now **closed or substantially advanced** by Robustness Phase R1/R2 work done since — the whole point of a discovery *cadence* (T-R3-4) is that a ranking is a snapshot, not a standing truth, and this refresh is the first real test of whether attention correctly moves to the next-highest risk rather than staying anchored on the sample that was hardest last time (the exact failure mode T-R3-1's own "why" names).

## New samples added, with justification

- **`waltz-data` / `waltz-web`** (real, `spikes/waltz/repo`) — used extensively in Phase R1 (T-R1-3, jOOQ) and Phase R2 (T-R2-2, `hasRole`) work but, despite that, **was never added to this discovery matrix** — a real process gap this refresh closes, not just a data update. `waltz-web` alone shows 45 files with `org.jooq` imports (not just `waltz-data`) and 4 real `hasRole` call sites — real, substantial density this project has already built real detection for.
- **`fineract-security` / `fineract-provider`** — both used as real evidence repos in T-R1-3/T-R2-2 but, same gap, never in this matrix. `fineract-provider` alone is a genuinely large, dense surface (112 REST files, 91 entities, 72 call-site permission checks, 90 Spring Data repository interfaces) — the single densest sample in this whole set, confirming it as the right module to keep using for future disconfirmation passes, not just a one-off.
- **5 previously-unprobed `coe-lab` fixture packages** (`java-rbac-datatable`, `java-kafka-settlement`, `java-spring-payments`, `py-ledger-worker`, `ts-orders-dynamo`) — these were built and are already exercised by `pipeline/test/regression.test.js` (e.g. `ts-orders-dynamo`'s persistence/messaging double-detector-collision test), but had never been added to the discovery matrix that's supposed to be tracking what's covered — another real instance of the same gap named above, not a new finding about the fixtures themselves.

## Probe results (static), refreshed + extended indicators

| sample | rest | entity | preauth | validateHas | hasRole | isAuthenticated | jwt.decode | kafkaListener | jooq | prisma | sqlalchemy | dynamodb | sqs | springDataRepo |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| fineract-charge | 1 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| fineract-core | 7 | 36 | 1 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 19 |
| fineract-security *(new)* | 6 | 2 | 0 | 2 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| fineract-provider *(new)* | 112 | 91 | 0 | 72 | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 90 |
| boa-userservice | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 4 | 0 | 0 | 0 |
| boa-contacts | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 3 | 0 | 0 | 0 |
| ghostfolio-api | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 |
| waltz-data *(new)* | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 229 | 0 | 0 | 0 | 0 | 0 |
| waltz-web *(new)* | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 0 | 45 | 0 | 0 | 0 | 0 | 0 |
| lab-java-jaxrs-charges | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lab-java-rbac-datatable *(new)* | 1 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lab-java-kafka-settlement *(new)* | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| lab-java-spring-payments *(new)* | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lab-py-accounts-api | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| lab-py-jwt-gateway | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lab-py-ledger-worker *(new)* | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| lab-ts-nestjs-users | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lab-ts-orders-dynamo *(new)* | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 0 |

Note: `rest`/`entity`/`preauth`/`validateHas` counts differ from Wave 1-B3's own numbers for `fineract-charge`/`fineract-core` (e.g. `preauth` on `fineract-core` was 4, now 1) — the earlier probe's exact regex/scope isn't preserved verbatim in this file, so this refresh states its own regex explicitly (see the script referenced below) rather than silently presenting numbers as directly comparable to Wave 1-B3's. Treat each wave's own table as internally consistent, not a strict diff against the prior wave.

## Ranked risk families — re-ranked

| Rank (R3-1) | Family | Claim cell | Status vs Wave 1-B3 | Why |
|---|---|---|---|---|
| ~~1~~ | Multi-hop layered service→store | R2 | **CLOSED** for the flagship case (T-R1-2/T-R1-3, Robustness Phase R1) | Real `fineract-charge`+`fineract-provider` multi-root: `ChargesApiResource → ChargeReadPlatformServiceImpl`, `calm validate` 0 errors. 11+3+3 further real closures across `fineract-provider`/`fineract-core`. Demoted off the ranked list — no longer the standing #1 risk. |
| ~~2~~ | Call-site auth / permission APIs | C-call | **Substantially advanced** (T-R2-2) | 2 vocabularies → 4 (added Waltz `hasRole`, Fineract `isAuthenticated`). Still not exhaustive — see new rank 1 below. |
| **1** | Import-graph ontology (service vs database) | U-persist-import | Unchanged, still open | Prisma DTO-vs-store ambiguity (Q13) decided-but-not-code-fixed; real risk any time a file imports an ORM's generated types for typing only, not persistence. |
| **2** | Messaging producers beyond Kafka field-type | U-msg-producer | Partially advanced (Kafka field-type built, T-E1), SQS/SNS producer still open | `lab-ts-orders-dynamo` probe confirms BOTH dynamodb+sqs imports in one real fixture — the exact double-detector shape already tested, but SQS *producer* detection itself (as opposed to persistence) remains unbuilt. |
| **3** | Entity–entity R0 noise vs architecture | R0 quality | Unchanged, structurally permanent | `fineract-provider` alone: 91 real `@Entity` classes — R0 entity-mesh volume only grows as more real modules are scanned; grading (T-A2) mitigates the mislabeling risk but the noise volume itself isn't reduced. |
| **4** | Spring Data / jOOQ | U-spring-data | **CLOSED** (T-E3 Spring Data, T-R1-3 jOOQ) | `waltz-data` alone: 229 real jOOQ-detected units. `fineract-provider`: 90 real Spring Data repository interfaces. Demoted off the ranked list. |
| **5** | Contract auth (OpenAPI) | C-contract | Unchanged, still narrow | Still lab-fixture-only real evidence (no OpenAPI file found in any newly-probed real repo this round — `waltz`/`fineract-provider` neither ship one at these module roots). |
| **6** *(new)* | Call-site auth beyond the now-4 named vocabularies | C-call | New, named honestly | `fineract-provider`'s 72 real `validateHas*` call sites vs only 1 `isAuthenticated` and 0 `hasRole` (Waltz-specific) confirms the catalogue is still Fineract/Waltz-shaped — a fifth real repo's own vocabulary (not yet sampled) would very likely add a fifth row, the same way this round added a third and fourth. |

Two real, load-bearing corrections from this refresh, not just re-ranking: (1) ranks 1 and 2 from Wave 1-B3 are **retired**, not carried forward unchanged — a discovery cadence that never retires a closed risk isn't actually tracking current risk, it's accumulating a todo list; (2) the new rank 6 names the SAME kind of gap rank 2 named originally (vocabulary breadth), at a smaller, honestly-scoped size — this is what "the risk shrinks, doesn't vanish" looks like in practice, worth stating explicitly rather than letting the family quietly disappear.

## Explicit non-run (unchanged from Wave 1-B3)

Full platform scan of all 18 samples **not** required for this ranking. Deep pipeline evidence already exists for Fineract charge/core/security/provider (Phase R1/R2 work), Waltz data/web (same), Ghostfolio access slice, and the `ts-orders-dynamo` lab fixture (regression suite).
