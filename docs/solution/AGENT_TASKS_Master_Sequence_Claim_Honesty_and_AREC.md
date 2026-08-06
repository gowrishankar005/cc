# Master sequence — Claim honesty + AREC pillar

**Status:** Wave 1 + Wave 2 **executed** (2026-08-07). Wave 3 backlog written; strategy **code** waits on user priority.  
**G0:** cleared by user “start/unblocked.”

This merges:

1. **Track Claim** — validation / claim honesty / discovery (`AGENT_TASKS_Validation_Claim_and_Discovery_Program.md`)  
2. **Track AREC** — Architecture Relation & Evidence Completeness pillar (design → ranked strategies → residual HITL)

---

## Principle

```text
Claim honesty first  →  AREC design lock  →  ranked strategy builds  →  residual HITL/LLM
        (know what green means)   (how we fix systematically)   (instances of pillar)   (not primary)
```

Claim program does **not** fix Fineract CALM.  
AREC design does **not** skip claim freeze.  
Strategy builds without silence/eval gates recreate soft green.

---

## Full sequence (do in order; parallel only where marked)

### Gate 0 — User blocker

| ID | Todo | Depends | Exit |
|---|---|---|---|
| **G0** | User completes their separate task; then authorizes start | — | User message: “start” / “unblocked” |

*Nothing below starts until G0 is cleared.*

---

### Wave 1 — Claim honesty (Track Claim, minimum viable + discovery)

| ID | Todo | Depends | Parallel OK? | Exit evidence |
|---|---|---|---|---|
| **W1-A0** | Claim register (mechanism classes, dual-unit product decision, Q1–Q12 decide/park, STATUS link) | G0 | — | `docs/solution/Claim_Register.md` (or agreed path) |
| **W1-A1** | Package Fineract gold-vs-platform finding under coe-lab/docs + BASELINES/FINERACT_GOLD links | G0 | with W1-A0 | `coe-lab/docs/fineract-gold-vs-platform-finding.md` |
| **W1-A2** | Validation approach vNext L0–L5 + silence invariants on paper + “all pass” definition | W1-A0 | — | `coe-lab/docs/validation-approach-vnext.md` |
| **W1-A5** | Wild-type gold policy (coe-lab only; lab green ≠ wild green) | W1-A1 | with W1-A2 | Policy in FINERACT_GOLD / wild-type-gold-policy |
| **W1-A6** | Design-phase validation gates checklist | W1-A2 | with W1-A5 | `docs/solution/Design_Phase_Validation_Gates.md` |
| **W1-A7** | Living open-questions register + cadence | W1-A0 | with W1-A6 | Living Q section maintained |
| **W1-B3** | Pattern discovery: matrix refresh, stratified static probes, ranked families, trap-gold backlog | W1-A0 | after A0 draft; // with A2–A7 | Ranked risk list + trap backlog docs |
| **W1-C4** | HITL/LLM capability map (what residual review can/cannot fix) | W1-A2 | after A2 | `coe-lab/docs/review-flow-capability-map.md` |

**Wave 1 done when:** claims cannot silently overstate Java relationships/controls; Fineract miss is on record; “all pass” is layered; discovery ranking exists.

**Wave 1 does not:** implement multi-hop, call-auth extractors, or change generators to pass Fineract story gold.

---

### Wave 2 — AREC pillar design lock (architecture, not code)

| ID | Todo | Depends | Parallel OK? | Exit evidence |
|---|---|---|---|---|
| **W2-1** | Write AREC solution approach: R/C/S layers (relation strategies, control strategies, silence), TypedFacts impact, module boundary | W1-A0, W1-A2 | after Wave 1 MVP (A0+A2 min); prefer full Wave 1 | `docs/solution/Architecture_Relation_Evidence_Completeness.md` |
| **W2-2** | Map ranked B3 families → AREC strategy cells (R0/R1/R2…, C-dec/C-call/C-contract) | W2-1, W1-B3 | — | Matrix section in AREC doc |
| **W2-3** | Define AREC DoD + what “architecture connects” claim requires vs structural-only edges | W2-1 | with W2-2 | Claim register updated + AREC § DoD |
| **W2-4** | Design-phase gate: AREC checklist items added to Design_Phase_Validation_Gates | W2-3 | — | Gates doc updated |
| **W2-5** | Stakeholder lock: AREC is a platform pillar (not a Fineract patch queue) | W2-1–W2-4 | — | STATUS.md + v2 pointer / banner note |

**Wave 2 done when:** AREC is written, claim-bound, and ranked; no strategy code required yet.

---

### Wave 3 — AREC strategy implementation (only after Wave 2 lock)

*Each strategy is a small vertical: catalogue/registry row + thin producer + gold/silence gate — not a calm-generator special case.*

| ID | Todo | Depends | Notes |
|---|---|---|---|
| **W3-0** | Implementation backlog sliced from W2-2 rank (ordered backlog only) | W2-5 | Ticket list; still no coding until user prioritizes first cell |
| **W3-R0** | R0 honesty: structural Graphify edges labeled/graded vs architecture relations (as designed in W2) | W3-0 + priority | May be docs+metadata first |
| **W3-R1** | R1 one-hop architecture edges (BoA-class service→db) validated against claims | W3-0 | Confirm/repair against claim, not new Fineract special case |
| **W3-R2** | R2 multi-hop / layered (Fineract-class) strategy | W3-R0/R1 design constraints from W2 | Disconfirming gold: fineract-charge/core |
| **W3-C-call** | C-call control strategy (call-site auth family) | W2-2 rank | Fineract validateHasReadPermission + lab jwt-gateway as shapes |
| **W3-C-rich** | Control evidence richness policy (expression/authority in config) as part of C-* strategies | with C-call or after | Not Fineract-only |
| **W3-S** | Silence/completeness reporting bound to claim levels (eval L3 and/or platform artefacts) | W2-3, W1-A2 | Makes empty service neighborhood loud |
| **W3-eval** | Eval hardening: Fineract L2 story compare; expected-fail packages | W1-A2, W1-A5, W3-S | coe-lab scripts/gold |
| **W3-HITL** | Wire residual only: advisory triggers for gaps S reports; overrides for true residual | W1-C4, W3-S | Never primary path for systematic cells |

**Wave 3 done when:** claimed R/C levels are either built with wild gold or OOS-with-gate; Fineract story pass/fail matches claim register—not accidental.

---

### Out of sequence / never under this master list

| Item | Why |
|---|---|
| One-off “add ChargesApi→Charge edge” | Patch; forbidden as Wave 3 entry |
| Bootstrap gold from generator | Rejected product decision |
| Full-org pipeline scans for discovery | Use W1-B3 probes |

---

## Compressed todo board (for tracking)

```text
[BLOCKED] G0   User external task + authorize start

WAVE 1 — Claim honesty
[ ] W1-A0  Claim register
[ ] W1-A1  Fineract finding note
[ ] W1-A2  Validation L0–L5
[ ] W1-A5  Wild gold policy
[ ] W1-A6  Design-phase gates
[ ] W1-A7  Open questions living
[ ] W1-B3  Pattern probes + rank + trap backlog
[ ] W1-C4  HITL/LLM capability map

WAVE 2 — AREC design lock
[ ] W2-1  AREC solution design doc
[ ] W2-2  Rank → strategy cells
[ ] W2-3  DoD + claim binding
[ ] W2-4  Gates include AREC
[ ] W2-5  STATUS / design pointer lock

WAVE 3 — AREC strategies (after W2-5)
[ ] W3-0   Ordered impl backlog from rank
[ ] W3-R0  Structural vs architecture relation honesty
[ ] W3-R1  One-hop architecture relations
[ ] W3-R2  Multi-hop / layered
[ ] W3-C-call  Call-site controls
[ ] W3-C-rich  Control evidence richness
[ ] W3-S   Silence / completeness
[ ] W3-eval  Fineract/lab story gates
[ ] W3-HITL  Residual advisory/overrides only
```

---

## Dependency diagram

```text
G0 (user)
 └─► W1-A0 ─┬─► W1-A2 ─┬─► W1-A6
            │          ├─► W1-C4
            │          └─► W2-1 ──► W2-2 ──► W2-3 ──► W2-4 ──► W2-5
            ├─► W1-A1 ──► W1-A5              │                    │
            ├─► W1-A7                        │                    ▼
            └─► W1-B3 ───────────────────────┘              W3-0 → W3-* strategies
```

**MVP if time-boxed before full Wave 1:** G0 → W1-A0 → W1-A1 → W1-A2 → W1-A5 (policy sentence) → W1-A6 → then W2-1 (AREC design can start with partial B3 if probes still running).

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-07 | Master sequence created; both claim honesty + AREC; blocked on user before start |
