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
