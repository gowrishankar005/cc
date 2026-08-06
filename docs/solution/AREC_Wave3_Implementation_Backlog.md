# AREC Wave 3 — ordered implementation backlog (W3-0)

**Status:** backlog only — **do not implement until user prioritizes first cell**  
**Depends on:** Wave 2 lock (`Architecture_Relation_Evidence_Completeness.md`)  
**Forbidden:** one-off `ChargesApi → Charge` patches

---

## Priority order (recommended)

| Order | ID | Work package | Exit (when implemented) |
|---|---|---|---|
| 1 | **W3-S** | Silence metrics on typed-facts/coverage (S1 at minimum): service-touching rel count; HTTP without security-control | L3 automatable; Fineract run shows S1 fail loudly |
| 2 | **W3-R0** | Grade/label R0 structural vs architecture (metadata or contract field) | Entity–entity not sold as service architecture |
| 3 | **W3-R1** | Confirm/lock R1 one-hop service→db claims (BoA + lab); regression if missing | Claim R1 partial→proven for one-hop shapes |
| 4 | **W3-R2** | Multi-hop / layered architecture relation strategy (generic) | fineract-charge/core L2 story improve or explicit residual |
| 5 | **W3-C-call** | Call-site control strategy catalogue + extraction | Fineract HTTP / jwt-gateway control evidence |
| 6 | **W3-C-rich** | Control config richness (expression/authority) | Gold-aligned config without host-specific hacks |
| 7 | **W3-eval** | coe-lab: Fineract L2 gates; expected-fail packages; layer labels in scoreboard | Operators see L0/L1/L2 separately |
| 8 | **W3-HITL** | Advisory/IR trigger for empty neighborhood (post W3-S) | Residual path only |
| 9 | **W3-U-*** | Spring Data / jOOQ / producer messaging as ranked | Per claim cells |

---

## Vertical template (each strategy)

1. Claim cell update path  
2. Catalogue/registry row (data) + thin producer (code)  
3. Disconfirming gold or trap card  
4. Regression or eval gate  
5. scope-limitations bump if user-visible  
6. No calm-generator special cases  

---

## First cell recommendation (when user prioritizes)

Start **W3-S + W3-R0** (visibility and honesty) before **W3-R2** (hardest).  
R2 without S recreates false confidence on the next monorepo.

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-07 | W3-0 initial backlog |
