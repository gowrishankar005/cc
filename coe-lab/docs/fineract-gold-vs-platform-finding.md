# Finding: Fineract hand gold vs platform CALM (2026-08-07)

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
2. **Fineract shape:** `ChargesApiResource` does not import `Charge`; path is multi-hop. Graphify has **no** one-hop API↔entity edge.  
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

## Related artefacts

- Hand gold: `gold/calm/FINERACT_GOLD.md`  
- Validation layers: `validation-approach-vnext.md`  
- Master sequence: `docs/solution/AGENT_TASKS_Master_Sequence_Claim_Honesty_and_AREC.md`  
