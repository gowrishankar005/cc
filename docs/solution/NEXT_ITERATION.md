# Weaver — next iteration (critical todos)

**Date:** 2026-08-08  
**Context:** AREC Wave 3 Sessions **A–D done** (silence, R0 grade, R1 lock, R2 mechanism, C-call + C-rich partial). Product is **Weaver** (generic enterprise monorepos), not any single evidence repo.  
**Backlog index:** [`BACKLOG.md`](./BACKLOG.md)

This is the **recommended work plan for the next iteration** — critical fixes and discovery — derived from:

- Layered multi-module RCA (dual-unit gate, multi-hop, command bus OOS)
- Stratified probes / pattern matrix
- R2 residual (mechanism vs flagship story)
- C-call bounded vocabularies
- Claim honesty / L0–L5 eval discipline

---

## Iteration goal

1. Finish **Wave 3 Session E** (breadth) without reopening A–D.  
2. Close or **honestly bound** the **R2 residual** so layered multi-module stories have a next mechanism step (R2b), not silence.  
3. Run a **small discovery pass** so the next queue is evidence-ranked, not anecdote-only.

---

## Tier 0 — Do first this iteration (critical)

| # | Todo | Why (learning) | Exit |
|---|---|---|---|
| **1** | **Session E execution** per agent tasks (T-E1→…; T-E0 only if C-rich missing) | Completes Wave 3 breadth; producers/ontology/cloud are known claim cells | Claim cells updated; suite green |
| **2** | **R2b design+spike: implementer → imported persistence unit** | R2 Phase 1 only closes when sole implementer *is* a database/topic unit. Real layered services: impl is often a **service-layer class** (e.g. JDBC/RowMapper) that **uses** an entity/repo — multi-root still yields 0 architecture edges without fabricating. RCA + T-C1 residual. | Short design addendum + optional flag; no name hardcodes; synthetic fixture for realistic shape (API→interface→impl **imports** entity) |
| **3** | **Commit hygiene for Wave 3 A–D** (if still uncommitted locally) | Implementation must land in git for baseline | Clean commits; STATUS/Claim match tree |
| **4** | **Weaver backlog discipline** | Thin index now exists; keep STATUS/Claim/BACKLOG in sync after each drop | BACKLOG rows flipped on ship |

---

## Tier 1 — Critical product gaps (architecture & security)

| # | Todo | Why | Exit |
|---|---|---|---|
| **5** | **Labeled multi-root eval protocol** for L2 stories | Q11: single-root ≠ multi-root claims. Layered monorepos need declared root sets for remeasure, not “scan everything” or “one module forever.” | Written protocol in validation-approach or eval docs; 1–2 example root sets (generic, not product-named) |
| **6** | **C-call vocabulary expansion (catalogue-driven)** | Session D shipped only named call patterns (e.g. `validateHas*Permission`, `jwt.decode`). Enterprise stacks use many call-site auth shapes. | New catalogue rows + ≥1 new real sample or lab fixture; Claim C-call stays “partial” until broader |
| **7** | **Messaging producers** | Consumers partial; producers still open — probe/rank and lab stretch gold already named | T-E1 done; Claim U-msg-producer partial or OOS |
| **8** | **Java driver / Graphify import target normalization** | R2 work exposed: Graphify may emit bare symbol names for Java driver imports vs qualified package rows in persistence catalogue — silent miss class | Generic normalize/expand (like Node `ref_*`); regression |

---

## Tier 2 — Discovery & sampling (so we don’t only chase last pain)

| # | Todo | Why | Exit |
|---|---|---|---|
| **9** | **Stratified sample pass #2** | Wave 1-B3 was one probe table. Need refreshed density without full-repo pipeline on everything. | Update `pattern-coverage-matrix.md` with 5–15 packages (FINOS landscape + existing clones + 1–2 new candidates if justified) |
| **10** | **Rank next pattern families** | After E + R2b + C-call expand, re-rank risks (command-bus OOS, Spring Data, etc.) | Ranked list in matrix or BACKLOG |
| **11** | **Trap-gold → automated gates** | Cards T1–T8 must not stay docs-only as cells ship | ≥2 traps enforced in test or validate-calm-pair |
| **12** | **Disconfirming pair policy** | Always: shallow one-hop sample **and** layered multi-module sample before claiming “architecture relationships complete” | Design gate already; enforce in STATUS review |

**Out of scope for discovery:** building a product for any single public repo; full-org monorepo scans as default.

---

## Tier 3 — Important but not blocking next ship

| # | Todo | Notes |
|---|---|---|
| **13** | Persist ontology (service vs database on ORM import) | T-E2 |
| **14** | Spring Data / jOOQ dispatch | Catalogue rows exist |
| **15** | Dynamo/SQS unit story | Lab stretch |
| **16** | OpenAPI dual-unit policy | T-E4 |
| **17** | HITL S1 trigger (offline) | After silence metrics — already have metrics |
| **18** | Phase 2 engines (CodeQL/scip) only on measured gap | No premature swap |
| **19** | Plugin discovery / two-tier mapping-config | Goal A polish |

---

## Explicit non-goals (next iteration)

| Do not | Why |
|---|---|
| Hardcode any evidence-repo class/module names | Product is Weaver, not a sample app |
| Fabricate architecture edges to clear S1 | Honesty > green dashboard |
| Bootstrap gold from generator | Circular eval |
| LLM in core path | Standing principle |
| Treat Session E as optional forever | Wave 3 incomplete without E or OOS decisions |

---

## Suggested sequence for the iteration

```text
Week slice 1:  #3 commit hygiene + #1 Session E (producers, ontology, cloud as ranked)
Week slice 2:  #2 R2b design/spike + synthetic realistic fixture
Week slice 3:  #5 multi-root L2 protocol + remeasure on 1–2 multi-module samples
Week slice 4:  #6 C-call expand + #8 Java import normalize (if blocking persistence)
Ongoing:       #9–#11 discovery + traps
```

Adjust order if product prioritizes **security vocab** (#6) over **breadth** (#1).

---

## Success criteria for “iteration done”

- [ ] Session E complete or each remaining E item **OOS with claim cell**  
- [ ] R2 residual either improved via R2b or still partial with **clear written bound**  
- [ ] BACKLOG.md statuses updated  
- [ ] Claim Register + STATUS match reality  
- [ ] At least one discovery matrix refresh  
- [ ] Regression suite green  
- [ ] No sample-repo-specific patches  

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | Initial next-iteration plan post Wave 3 A–D |
