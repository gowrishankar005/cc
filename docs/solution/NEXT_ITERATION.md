# Weaver — next iteration (critical todos)

**Date:** 2026-08-08  
**Primary navigation (if lost):** **[`WHERE_NEXT.md`](./WHERE_NEXT.md)** — Prethink vs Weaver, discovery priorities, hard-test queue.

**Backlog:** [`BACKLOG.md`](./BACKLOG.md) · **Claims:** [`Claim_Register.md`](./Claim_Register.md) · **STATUS:** [`STATUS.md`](./STATUS.md)

---

## Iteration goals (this round)

1. **Hard-tests** — continue queue after saas-boost tier-service (#3 tenant-service, then ghostfolio, …) per `WHERE_NEXT` §3. Eval only; no detector patches in-session.  
2. **Discovery priority list** — use `WHERE_NEXT` §2 (P0 Lambda/Dynamo → P1 outbound HTTP / Spring); re-rank after each hard-test.  
3. **Implement when you choose** — serverless Y0–Y5 (authority: [`Fidelity_Yardstick_Closeout_Matrix.md`](./Fidelity_Yardstick_Closeout_Matrix.md), agent tasks `AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md`, **Y0 started 2026-08-08**) or residual RS-1; not both confused with hard-tests.

---

## What just closed (do not re-queue)

| Program | Result |
|---|---|
| Wave 3 + Robustness R0–R4 + layered story | Done |
| B-ontology / B-msg-prod-sqs | Done |
| Hard-tests #1–#2 | Doxia empty; saas-boost tier-service → HT-ASB / B-lambda-http |
| Research | Prethink source split; bank dual-estate; WHERE_NEXT navigation |

---

## Recommended sequence (default)

**Named list:** **Weaver Discovery Ladder (WDL)** — [`WHERE_NEXT.md`](./WHERE_NEXT.md) §2.1.  
**Rules:** Java → TypeScript/Node → Python; within that **cloud/K8s first**. Prethink pick-up later, not mixed into WDL.

```text
1. ✅ Hard-test #3 tenant-service (WDL-1 systematic; see finding)
2. Implement WDL Phase I  — WDL_Implementation_Plan.md + AGENT_TASKS_Fidelity Y*
3. Optional later hard-tests: calm-hub → ghostfolio → boa (Java then TS then Python)
4. Phase II+ per WDL ladder
```

**Do not** start open-ended industry research without a package-id or a named deliverable.  
**Owner go-ahead:** say “implement WDL Phase I” to start build.

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
