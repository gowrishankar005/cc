# Weaver — next iteration (critical todos)

**Date:** 2026-08-08 (post robustness R0–R4 review)  
**Context:** AREC Wave 3 **done**. Robustness program **R0–R4 MVP done** (55/55 tests). Product is **Weaver**.  
**Backlog index:** [`BACKLOG.md`](./BACKLOG.md)  
**Capability matrix:** [`STATUS.md`](./STATUS.md)  
**Claims:** [`Claim_Register.md`](./Claim_Register.md)  
**Residual UX design (proposed):** [`Architect_Residual_Review_Session.md`](./Architect_Residual_Review_Session.md)

---

## Iteration goals (this round)

1. **Fidelity serverless HTTP** — **B-lambda-http** + **B-dynamo-handler-kind** (standing exam: aws-saas-boost tier-service). Do not claim Fidelity cloud complete without this.  
2. **Residual-session UX** — RS-1 → (RS-0 already signed, Gowri); safety mandatory.  
3. Keep **honesty > green** (no fabricated edges; catalogue intake for new rows).

---

## What just closed (do not re-queue)

| Program | Result |
|---|---|
| Wave 3 A–E | Silence, grades, R1 lock, R2 mechanism, C-call/C-rich base, breadth (Kafka producers, Spring Data, Dynamo, OpenAPI dual-unit, HITL queue) |
| Robustness R0–R4 | Full MVP; flagship multi-root Fineract access-layer story (claim triple) |
| B-ontology / B-msg-prod-sqs | Prisma ownership + SQS merge onto dual-role units |
| B-layered-story L0–L4 | Standing exams + dual gold + operator recipe |

---

## Recommended sequence

```text
1. B-review-session RS-1… (residual UX) — may interleave with serverless design
2. B-lambda-http + B-dynamo-handler-kind — product P1; Claim U-http-serverless
3. Later: RS-4 LLM draft, B-calm-portable-ir, platform plugins, etc.
```

Ontology + SQS (**B-ontology**, **B-msg-prod-sqs**) are **done** — do not re-queue.  
Residual RS-0 is **signed off** — do not re-open design without owner.

---

## Tier 0 — Critical next

| # | Todo | Backlog ID | Exit |
|---|---|---|---|
| 1 | Layered story **Phase L0** (standing exams + Claim Register R2 split) | B-layered-story | T-L0-1…T-L0-4; see agent task list |
| 2 | Layered story **Phase L1** (multi gold + expected-fail harness) | B-layered-story | T-L1-1…T-L1-5 |
| 3 | Residual session **RS-1** (pack + choice cards + chat-mode safety) | B-review-session | T-RS1-1…T-RS1-6; owner **Gowri**; **do not skip safety** |

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
