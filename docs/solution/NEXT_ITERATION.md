# Weaver — next iteration (critical todos)

**Date:** 2026-08-08 (updated: robustness rows folded)  
**Context:** AREC Wave 3 **A–D done**. Product is **Weaver**.  
**Backlog index:** [`BACKLOG.md`](./BACKLOG.md)  
**Robustness agent tasks:** [`AGENT_TASKS_Weaver_Robustness.md`](./AGENT_TASKS_Weaver_Robustness.md)  
**Breadth agent tasks:** Session E in [`AGENT_TASKS_AREC_Wave3_Implementation.md`](./AGENT_TASKS_AREC_Wave3_Implementation.md)

---

## Iteration goals

1. **Session E** — finish Wave 3 breadth (or OOS with claim cells).  
2. **Robustness Phase R0–R1** — pilot scorecard, architecture coverage metric, multi-root L2 protocol, **R2b**, Java import normalize.  
3. **Discovery** — sample pass #2 + trap automation so the queue stays evidence-ranked.  
4. Keep **honesty > green** (no fabricated edges, no sample-repo hardcodes).

---

## Recommended sequence (two tracks)

```text
Track Breadth:     Session E (T-E1…T-E6)     ── can run in parallel with R0 docs ──
Track Robustness:  Phase R0 → R1 → R2 → R3 → R4   (see AGENT_TASKS_Weaver_Robustness.md)

Suggested calendar:
  Slice 1:  Commit hygiene + Session E start + Robustness R0 (scorecard, arch-cov, multi-root protocol, OOS registry)
  Slice 2:  R2b design + implement + realistic synthetic fixture
  Slice 3:  Java driver-ref normalize + multi-root L2 remeasure on 1–2 samples
  Slice 4:  Discovery pass #2 + trap promote + C-call vocab expand (as ranked)
  Ongoing:  BACKLOG/STATUS/Claim sync after each drop
```

If capacity is limited: **R0 + R2b before finishing all of Session E** — robustness of architecture stories > more partial cells.

---

## Tier 0 — Critical this iteration

| # | Todo | Backlog ID | Exit |
|---|---|---|---|
| 1 | Session E (or explicit OOS for each E item) | E | Claim cells + suite green |
| 2 | Pilot scorecard | B-pilot-scorecard | Doc: cells required for pilot |
| 3 | Architecture coverage metric + S1/S2 consumers | B-arch-cov | In coverage-report + test |
| 4 | Multi-root L2 remeasure protocol (labeled root sets) | B-R2-eval | Written protocol + example |
| 5 | Standing OOS registry | B-oos-registry | Doc section or BACKLOG table living |
| 6 | R2b: implementer → imported DB/topic unit | B-R2b | Mechanism + tests; residual documented |
| 7 | Commit hygiene Wave 3 A–D if needed | — | Tree matches STATUS |
| 8 | BACKLOG discipline | B-scope-hygiene | Rows flip on ship |

---

## Tier 1 — Critical product depth

| # | Todo | Backlog ID |
|---|---|---|
| 9 | C-call vocabulary expand (catalogue + evidence) | B-C-call-expand |
| 10 | Messaging producers | B-msg-prod |
| 11 | Java Graphify import target normalize | B-java-driver-ref |
| 12 | Catalogue intake rule (evidence + test + claim) | B-catalogue-intake |

---

## Tier 2 — Discovery & eval enforcement

| # | Todo | Backlog ID |
|---|---|---|
| 13 | Stratified sample pass #2 | B-discovery-cadence |
| 14 | Re-rank pattern families | B-discovery-cadence |
| 15 | Trap-gold → automated gates (≥2) | B-trap-promote |
| 16 | Disconfirming-pair enforced in review | Design gates + STATUS |

---

## Tier 3 — Breadth remainder / later

Ontology, Spring Data, jOOQ, Dynamo/SQS, OpenAPI dual-unit, HITL S1, k8s FP watch, Phase 2 engines, plugins — see BACKLOG P2/P3/Later.

---

## Non-goals

| Do not | Why |
|---|---|
| Sample-repo class hardcodes | Weaver is generic |
| Fabricate edges to clear S1 | Honesty |
| Bootstrap gold from generator | Circular eval |
| LLM in core path | Principle |
| Skip R2b because “R2 shipped” | Mechanism ≠ product story |

---

## Iteration success criteria

- [ ] Session E complete or OOS documented  
- [ ] Pilot scorecard exists  
- [ ] Architecture coverage metric shipping  
- [ ] R2b shipped or residual explicitly bounded  
- [ ] Multi-root L2 protocol written + used once  
- [ ] Discovery matrix refreshed once  
- [ ] ≥2 trap cards automated  
- [ ] BACKLOG + STATUS + Claim Register aligned  
- [ ] Regression suite green  

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | Initial post A–D plan |
| 2026-08-08 | Robustness rows + two-track sequence + link to AGENT_TASKS_Weaver_Robustness |
