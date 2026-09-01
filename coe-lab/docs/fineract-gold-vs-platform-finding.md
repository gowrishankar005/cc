# Finding: a reference Java/JAX-RS banking platform hand gold vs platform CALM (2026-08-07)

**Type:** validation / design finding (not a closed fix)  
**Gold:** `coe-lab/gold/calm/fineract-{charge,core,system-map}/`  
**Platform output (untracked example):** `tmp/fineract-platform-scan/` (regenerate; not committed)  
**RCA summary:** dual-unit Graphify gate + layered Java (no API→entity one-hop) + decorator-only controls  

---

## What was compared

| Gold package | Platform run |
|---|---|
| fineract-charge | `run-slice` on `spikes/fineract/repo/fineract-charge` |
| fineract-core | `run-slice` on `spikes/fineract/repo/fineract-core` |
| fineract-system-map | No class-level equivalent (module grain) |

Both gold and generated docs **pass `calm validate`** (0 errors). Schema-valid ≠ story-complete.

---

## Scorecard (honest)

| Dimension | Charge | Core |
|---|---|---|
| HTTP path recall vs gold | **6/6** | **17/17** |
| Service units | **1/1** | **8/8** gold services present |
| Entity / database units | **1/1** Charge | **4/4** gold entities + many extras (36 total) |
| RBAC `@PreAuthorize` | n/a | **Yes** on DatatableWriteService |
| Service → database `connects` | **0** (gold expects 1) | **0** (gold expects 2) |
| Any service-touching relationship | **0** | **0** of 64 typed-facts rels |
| Call-based API auth controls | **None** | **None** on HTTP APIs |

---

## Root causes (condensed)

1. **Dual-unit gate:** relationships only if both Graphify endpoints map to TypedUnits. Intermediate `*PlatformService` / command types are not units → multi-hop drops.  
2. **a reference Java/JAX-RS banking platform shape:** `ChargesApiResource` does not import `Charge`; path is multi-hop. Graphify has **no** one-hop API↔entity edge.  
3. **What R0 keeps:** entity↔entity imports (core: 64 rels, all database endpoints).  
4. **Controls:** only decorator `PreAuthorize` is security-control; APIs use `validateHasReadPermission` (call-site) → threat-signals “no security-control” is true for **pipeline categories**, not “no auth in source.”  
5. **CALM builders** faithfully project typed-facts; miss is upstream of calm-generator.

---

## Claim impact

See `docs/solution/Claim_Register.md`:

- **R2 multi-hop** = specified-unbuilt  
- **C-call** = specified-unbuilt  
- Must not claim “Java architecture relationships complete”

---

## What this finding is not

- Not a calm-cli bug  
- Not fixed by post-MVP Node/`ref_` or k8s correlation work (different mechanism classes)  
- Not solved by Wave 1 process alone — needs AREC Wave 2–3  

---

## 2026-08 retest addendum (Phase L0, T-L0-3)

**This section extends the original 2026-08-07 finding above — nothing above is retracted, and single-root gold L2 is still not fixed.**

Between the original finding and this addendum, real mechanism work landed (R2 Phase 1 `multi-hop-bridge-detector.ts`, R2b implementer-import hop, and T-R1-3's Java import-target root-cause fix in `java-import-resolver.ts`). Retesting both root-set shapes named in the original scorecard:

| Root set | Result | Detail |
|---|---|---|
| **Single-root** (`fineract-charge` alone) | **Still L0/L1 PASS, L2 FAIL — unchanged from the original finding** | Real re-run: 0 R2 relationships, exactly 2 honest `unresolved-multi-hop` ignored-items, `S1-zero-service-touching-relationships` still fires. `ChargesApiResource` still never imports `Charge` — no static one-hop chain exists in this shape, and no mechanism change was ever going to create one that isn't there. |
| **Multi-root** (`fineract-charge` + `fineract-provider`) | **Recovers a real architecture edge, but to a different terminal than gold expects** | `ChargesApiResource` → `ChargeReadPlatformServiceImpl` (an access-layer JDBC-backed store unit, real `org.springframework.jdbc.core` import), `crossPackage: true`, confidence 10, grade `architecture`, `calm validate` 0/0. This is the **S-layered-access** story — **not** the gold's expected `service → Charge entity` edge. |

**The process miss this addendum exists to name:** the multi-root result above was, in the same session it was found, described elsewhere in this repo as the "R2 flagship a reference Java/JAX-RS banking platform case CLOSED" — without naming which root set or which terminal grain had actually been resolved. That phrasing was true of a *different, easier* claim than the one this finding originally scored (single-root, gold-entity terminal). No exam was frozen at the time the phrasing changed, so nothing forced a check that the new claim was actually the old claim. This is precisely the failure mode `AGENT_TASKS_Layered_Architecture_Story.md` §0.2 names and Phase L0 exists to close — see `coe-lab/docs/standing-disconfirming-exams.md` (exams `E-charge-single-L2` and `E-charge-multi-story`, now separately IDed and never substitutable for each other) and `docs/solution/Claim_Register.md`'s split `R2-gold-charge-single` / `R2-multi-root-access-terminal` rows (T-L0-2), which correct the "flagship closed" wording.

**Do not read this addendum as "L2 fixed for the single-root gold."** It is not. The single-root case remains, honestly, an architecturally-correct residual — a reference Java/JAX-RS banking platform's own real layering has no static one-hop chain here, and closing it (if ever) would need either a different root set (already recovers a real, different-grain story) or a deliberate, evidenced terminal-refine mechanism (Phase L2b, `D-terminal-refine`, still optional/undecided).

---

## Related artefacts

- Hand gold: `gold/calm/FINERACT_GOLD.md`  
- Validation layers: `validation-approach-vnext.md`  
- Master sequence: `docs/solution/AGENT_TASKS_Master_Sequence_Claim_Honesty_and_AREC.md`  
