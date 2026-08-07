# Weaver — next iteration (critical todos)

**Date:** 2026-08-08 (post robustness R0–R4 review)  
**Context:** AREC Wave 3 **done**. Robustness program **R0–R4 MVP done** (55/55 tests). Product is **Weaver**.  
**Backlog index:** [`BACKLOG.md`](./BACKLOG.md)  
**Capability matrix:** [`STATUS.md`](./STATUS.md)  
**Claims:** [`Claim_Register.md`](./Claim_Register.md)  
**Residual UX design (proposed):** [`Architect_Residual_Review_Session.md`](./Architect_Residual_Review_Session.md)

---

## Iteration goals (this round)

1. **Ship ranked product residuals** — ontology (Prisma service-vs-database) and SQS/SNS producers.  
2. **Review then (if accepted) implement residual-session UX** — session pack + VS Code agent; end state = **semantically correct effective architecture IR** after HITL/LLM residual.  
3. **Decide query surface** for “questioning” flows and auth methods (CALM JSON today; optional query helper later — not a second source of truth).  
4. Keep **honesty > green** (no fabricated edges; catalogue intake for new rows).

---

## What just closed (do not re-queue)

| Program | Result |
|---|---|
| Wave 3 A–E | Silence, grades, R1 lock, R2 mechanism, C-call/C-rich base, breadth (Kafka producers, Spring Data, Dynamo, OpenAPI dual-unit, HITL queue) |
| Robustness R0 | Pilot scorecard, arch-cov metric, multi-root L2 protocol, OOS registry, S0 Graphify flag |
| Robustness R1 | R2b + Java import normalize; **flagship Fineract multi-root story closed** |
| Robustness R2 | Catalogue intake, C-call expand, C-rich `authorityRef` |
| Robustness R3 | Discovery refresh/re-rank, trap promote 7/8, cadence policy |
| Robustness R4 | HITL low-architecture-coverage trigger; k8s FP re-check clean |

---

## Recommended sequence

```text
1. Review Architect_Residual_Review_Session.md (product owner)
2. P1 code: B-ontology  then  B-msg-prod-sqs   (can parallel if two agents)
3. If residual design accepted: B-review-session Phase 1 pack → validate_drafts → pilot
4. Optional: IR “effective architecture” appendix + light query helper over reviewed CALM
5. Hygiene: Claim Register forbidden-phrase cleanup; scope-limitations ↔ claims
```

---

## Tier 0 — Critical next

| # | Todo | Backlog ID | Exit |
|---|---|---|---|
| 1 | Product review of residual-session design (incl. effective IR + query Q) | B-review-session | Accept / amend / park |
| 2 | Persist ontology code fix (ORM import ≠ always database) | B-ontology | Claim U-persist-import updated; BoA + Ghostfolio-class regression |
| 3 | SQS/SNS producer detection | B-msg-prod-sqs | Lab fixture + claim U-msg-producer; trap T7 full |

---

## Tier 1 — Residual UX (after design accept)

| # | Todo | Backlog ID |
|---|---|---|
| 4 | Session pack builder (`tools/review-session/pack`) | B-review-session |
| 5 | Draft validate + apply via `--from-facts --overrides` | B-review-session |
| 6 | **Effective architecture IR** after residual (semantically correct reviewed model) | B-review-session / IR follow-on |
| 7 | Optional: query helper / Q&A over reviewed CALM (flows, auth methods) | design §12 — not yet a BACKLOG code row until accepted |

---

## Tier 2 — Platform / later

| # | Todo | Backlog ID |
|---|---|---|
| 8 | Phase-2 engines only on measured gap | B-phase2-engines |
| 9 | Module plugin / embed API | B-plugin |
| 10 | Two-tier mapping-config | B-two-tier-map |
| 11 | ADR → CALM `adrs[]` | B-adr |
| 12 | Discovery second cycle (prove cadence) | B-discovery-cadence (process) |

---

## Non-goals

| Do not | Why |
|---|---|
| Re-open Robustness R0–R4 as if unfinished | MVP checklist complete |
| Sample-repo hardcodes | Weaver is generic |
| Fabricate edges to clear S1 | Honesty |
| LLM in `run-slice` core | Principle |
| Treat lab L1 green as pilot complete | Pilot_Ready_Scorecard |

---

## Iteration success criteria

- [ ] B-ontology shipped or explicitly bounded with claim cell  
- [ ] B-msg-prod-sqs shipped or OOS with reason  
- [ ] Residual-session design reviewed (accept/amend/park recorded on BACKLOG)  
- [ ] If accepted: at least pack + one pilot residual → valid post-override CALM + effective IR  
- [ ] Suite stays green; Claim Register phrases match reality (R2 flagship closed)
