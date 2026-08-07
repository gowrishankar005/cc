# Pilot-Ready Scorecard

**Product:** Weaver. **Purpose:** a single, structured bar for "is Weaver ready to run against a real enterprise pilot repo," replacing feature-list vibes with a checklist tied directly to `Claim_Register.md`'s own cell statuses.

**Authority:** `Claim_Register.md` remains the source of truth for what each cell's status actually is. This file only defines what bar each cell must clear before Weaver is called pilot-ready — it does not restate or override cell statuses itself.

**Explicit, load-bearing rule:** a green `npm test` suite and a lab-core "ALL PASS" are **not**, on their own, evidence of pilot readiness. Lab core fixtures assert **L1** (unit/interface recall) almost exclusively — see `coe-lab/docs/validation-approach-vnext.md`. Pilot readiness is an **L2** (architecture story) and **L3** (silence/completeness) bar, which lab-core green does not by itself demonstrate. This is exactly the failure mode `Architecture_Relation_Evidence_Completeness.md` and the Fineract finding (`coe-lab/docs/fineract-gold-vs-platform-finding.md`) named: lab L1 passing while a real layered monorepo's L2 story failed, with nothing in the test output distinguishing the two.

---

## 1. Mandatory disconfirming samples

Before any pilot claim, Weaver must have been run against **at least these two shapes** (generic descriptions — see §4 for which real evidence repos currently fill each role; the roles are what matter, not the specific repos):

| Shape | Why mandatory | Currently filled by (evidence only, not the product target) |
|---|---|---|
| **Shallow, one-hop** — a service directly imports/calls its own persistence layer, single module | Proves the deterministic base case (R1) works at all | A two-service Python sample with a directly-owned DB class per service |
| **Layered, multi-module** — HTTP resource → interface → implementation class → persistence entity, implementation may live in a different module than the resource | Proves (or honestly disproves) the realistic enterprise shape R2/R2b targets — this is the shape that broke the "lab L1 green = done" assumption | A real, large, multi-module Java monorepo sample |

A pilot readiness claim resting on only ONE of these two shapes is not valid — per Claim Register Q5 ("Disconfirming samples for relationship claims," decided (process)), whose current wording names the two specific evidence repos that filled these roles when it was decided ("BoA shallow + Fineract layered required before 'Java rels complete'"); this scorecard generalizes that decision to the SHAPE, not the specific repos, per §4 below.

---

## 2. Required claim cell status, by pillar

Format: cell ID → **minimum status required for pilot** → what "pilot-ready" means for that cell (may be stricter than the cell's current real status — gaps are the punch list, not hidden).

### Unit formation (U-*)

| Cell | Minimum for pilot | Notes |
|---|---|---|
| U-http | `proven` | Route/entry-point detection across the pilot's real languages |
| U-entity | `proven` | Persistence-entity detection (decorator/annotation path) |
| U-persist-import | `partial` acceptable | Import-only detection; ontology ambiguity (Q13) must be a NAMED limitation the pilot operator sees, not silent |
| U-msg-consumer | `partial` acceptable if pilot doesn't lean on messaging | `specified-unbuilt` unacceptable if the pilot repo has real messaging |
| U-msg-producer | `partial` acceptable | Must not be `specified-unbuilt` if pilot repo has real producers in its dominant language |
| U-spring-data / U-jooq | `partial` acceptable for whichever ORM the pilot repo doesn't use; the ORM it DOES use must not be `specified-unbuilt` |

### Relations (R*)

| Cell | Minimum for pilot | Notes |
|---|---|---|
| R0 | `proven` (as structural, graded) | Entity-mesh noise must be labeled `structural`, never presented as architecture |
| R1 | `partial, regression-locked` minimum | One-hop must never silently regress |
| R2 | `partial` acceptable **only if** the pilot's own layered residual is explicitly measured and reported — see §3 | `specified-unbuilt` is disqualifying for any pilot with real layered services |
| R-k8s | `partial` acceptable if pilot doesn't use k8s manifests; otherwise must be exercised on the pilot's real manifests before claiming |

### Controls (C-*)

| Cell | Minimum for pilot | Notes |
|---|---|---|
| C-dec | `proven` | |
| C-call | `partial` acceptable, but the pilot's OWN call-site auth vocabulary must be checked against `signal-catalogue.yml`'s call-site rows first (the catalogue intake rule, Phase R2, governs adding a new one) — a pilot using an unlisted vocabulary gets silent false negatives |
| C-contract | `partial` acceptable if pilot has no OpenAPI/Swagger; otherwise must be exercised on the pilot's real spec |
| C-rich | `partial` acceptable | Raw text richness only; no structured-authority requirement for pilot v1 |

### Silence / completeness (S)

| Cell | Minimum for pilot | Notes |
|---|---|---|
| S-silence | `partial` minimum, **and S1/S2 must be run against the pilot repo itself before any completeness claim** | This is the single most important gate — see §3 |

---

## 3. The actual pilot-readiness procedure (not just a table)

1. Run Weaver against the pilot repo (module-root scans; multi-root only if the pilot's own layering needs it — see `coe-lab/docs/multi-root-l2-protocol.md`).
2. Read `coverage-report.json`'s `completeness` block for the pilot's own run. If `silenceFlags` includes S1, the architecture story is genuinely incomplete for THIS repo — this must be disclosed to the pilot stakeholder before any "architecture recovered" claim, not smoothed over because the cell table above says R2 is `partial`.
3. Run `hitl-review-trigger.js` against the pilot's own output and hand the resulting `review-queue.json` to a human reviewer — this is the residual-completion step, not optional polish.
4. Only after 1–3 does a "Weaver ran against `<pilot>`, here is what it found AND did not find" report become honest.

**A pilot readiness claim without step 2 having actually been performed against the pilot's own repo is not a valid claim, regardless of what this table says about lab/sample-repo cell statuses.**

---

## 4. Evidence repos are not the product

Every real-repo path cited anywhere in this project (Bank of Anthos, Fineract, Ghostfolio, Waltz, calm-hub, lab fixtures) exists to **prove or falsify** a mechanism. None of them is the product target. A pilot is a **different, real** customer repo — this scorecard's bar must be re-applied to that repo specifically; passing against the evidence repos above is necessary (it's how the mechanisms got proven) but not sufficient.

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | T-R0-1 — initial scorecard, derived from Claim_Register.md's real cell statuses at the time of writing |
