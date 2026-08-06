# Design-phase validation gates

**Status:** Wave 1-A6 (+ Wave 2-A4 AREC items)  
**Use:** Before marking STATUS “built” for extraction/relationship/control **completeness**, or locking a new design claim.

---

## Gate checklist (must cite before “built” on completeness)

### G1 — Claim register

- [ ] Mechanism class exists in `Claim_Register.md`  
- [ ] Status is proven / partial / specified-unbuilt / unevidenced / OOS — not implied only in prose  
- [ ] Allowed validation layers listed  

### G2 — Disconfirming samples

- [ ] At least **two shapes** for relationship claims: e.g. shallow one-hop (BoA Python) **and** layered multi-hop (Fineract)  
- [ ] For control claims: decorator sample **and** call-site sample (or OOS for one)  

### G3 — Joint claim

- [ ] Written joint statement: units ∧ relationships ∧ controls for the stack (not units alone)  
- [ ] Dual-unit / R0 role stated if Graphify edges are part of the claim  

### G4 — Validation layers

- [ ] L0–L4 assigned (`validation-approach-vnext.md`)  
- [ ] Expected-fail packages named if claim incomplete  

### G5 — Silence / premortem

- [ ] Premortem: “What would look green but be wrong?”  
- [ ] S1–S4 invariants considered  

### G6 — AREC (Wave 2+)

- [ ] Change maps to an AREC strategy cell (R* / C* / S) or explicit OOS  
- [ ] Not a one-off patch for a single class/repo  
- [ ] Wild gold or trap gold named for the cell  
- [ ] HITL residual only after strategy or OOS  

### G7 — Docs hygiene

- [ ] STATUS points at claim cell, not only file list  
- [ ] scope-limitations.yml updated if user-visible gap changes  

---

## Fail examples (do not ship claim)

| Anti-pattern | Why fails gates |
|---|---|
| “Java relationships work” after only charge route tests | G2, G3, G5 |
| “Auth captured” after only `@PreAuthorize` | G2 call-site missing |
| Hardcoded `ChargesApiResource → Charge` edge | G6 patch |
| Lab all-pass implies Fineract story pass | G4, wild policy |

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-07 | Wave 1-A6 + AREC G6 |
