# Multi-root L2 remeasure protocol

**Purpose:** a written procedure for declaring package-root sets, labeling the resulting claim, and remeasuring L2 (architecture story) — so a multi-root run's cross-package findings are never silently read as if they applied to a single-root claim, or vice versa.

**Authority:** implements Claim Register **Q11** ("decided — module-root is the primary/default claim mode; multi-root is real and supported but secondary and scan-specific"). This document is the HOW; Q11 is the WHAT/decision record.

---

## 1. Why this exists

`run-slice` accepts one or more package roots in a single invocation. Passing two roots is not "the same claim as two separate single-root runs" — it changes what the underlying structural scan (Graphify) can see:

- **Single root:** one extraction pass over that root only. `crossPackage: true` relationships are structurally impossible — there is nothing outside the root to cross into.
- **Multiple roots, one invocation:** one COMBINED extraction pass over the roots' common ancestor directory. This is the only way cross-package relationships (R2 bridge resolution, cross-module `imports`/`implements` edges) can be produced at all.

Confusing these two modes was a real, named risk (Q11's own history): a multi-root run's cross-package finding was at risk of being read as "this pipeline recovers cross-package architecture in general," when it's only true for the specific root SET that was scanned together.

---

## 2. Primary claim mode: module-root

Unless a claim explicitly states otherwise, every Claim Register cell (R0, R1, R2, C-*, U-*, S-silence) is evidenced and claimed against **single package-root scans**. This is the default, the common case, and what most of this project's regression suite exercises.

## 3. Multi-root claims: secondary, scan-specific, must be labeled

A multi-root finding (e.g. "265 cross-module edges found scanning module A + module B together") is valid **only for that specific root set**, in that specific invocation. It does NOT mean:

- Module A alone would show the same edges (it would not — no cross-root edges are possible in a single-root scan).
- Any other pair of modules in the same monorepo would show comparable results (untested unless separately run).
- The whole monorepo's architecture is now "recovered" (only the scanned roots' mutual edges are).

**Rule: any report, doc, or STATUS row citing a multi-root result MUST name the exact root set scanned.** "265 cross-module edges" alone is not a valid claim; "265 cross-module edges scanning `<module-A>` + `<module-B>` together" is.

---

## 4. Template: declaring a multi-root claim

Use this shape whenever recording a multi-root result (STATUS.md, Claim Register, an eval report):

```markdown
**Root set:** <root-1>, <root-2>, ... (name the real roots, or generically — "API module + provider module" — with real paths in an appendix if evidence-repo-specific)
**Scan mode:** multi-root, single combined pass (common-ancestor extraction)
**Expected claim cells:** <which Claim Register cells this scan is evidence for — e.g. R2, R-k8s>
**L0 (schema):** <pass/fail>
**L1 (unit recall):** <pass/fail — vs what gold/expectation>
**L2 (architecture story):** <pass/fail/N/A — vs what gold/expectation, or "no gold available, descriptive only">
**Residual, if any:** <what did NOT resolve, and why — e.g. "implementer found but has no persistence evidence of its own">
```

### Real worked example (evidence repo, not the product)

```markdown
**Root set:** fineract-charge, fineract-provider
**Scan mode:** multi-root, single combined pass (2772 files, ~26s)
**Expected claim cells:** R2
**L0:** pass (0 errors)
**L1:** n/a (not the focus of this scan)
**L2:** fail — the real bridge interface's implementer (ChargeReadPlatformServiceImpl) was found across the module boundary, but it is not itself a database/topic unit (no catalogue-recognized persistence evidence), so no service→store edge was produced
**Residual:** honest, evidenced (see AREC_R2_MultiHop_Strategy.md §1 and STATUS.md §D T-C1) — not closed by this scan
```

This is a real, already-run example (T-C1's own remeasure) — included to show the template applied, not as a repeatable product claim about a reference Java/JAX-RS banking platform specifically.

---

## 5. Generic root-set shapes (product-level, not evidence-repo-specific)

When describing what kinds of multi-root scans matter for the PRODUCT (as opposed to citing one evidence repo), use generic shapes:

- **"API module + provider/implementation module"** — the shape that motivated R2/R2b: an HTTP resource module that doesn't directly import its own persistence layer, with the real implementation living in a sibling module.
- **"Two services + a shared library module"** — tests whether a shared dependency correctly produces same-owner attribution rather than duplicate detection.
- **"Full monorepo (all modules)"** — the largest, slowest case; only run when the specific cross-module question requires the full common ancestor (most real questions are answered by a 2–3 module subset).

Evidence-repo paths (e.g. `spikes/fineract/repo/fineract-charge`) belong in an **appendix** of any report using them, never as the headline description of what was tested — the headline should describe the SHAPE, per §5 above; the path is how that shape happened to be reproduced this time.

---

## 6. Tooling note

`coe-lab/scripts/validate-calm-pair.mjs` and `generate-calm.mjs` currently operate on single lab-fixture package roots only — neither invokes a multi-root scan today. Multi-root claims in this project so far have come from direct `run-slice` invocations against evidence-repo module pairs (documented via §4's template), not from the coe-lab eval harness. If/when the eval harness gains multi-root support, its own output must carry the same root-set labeling this protocol requires — not a silent behavior change.

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | T-L0-4 — linked from [`standing-disconfirming-exams.md`](./standing-disconfirming-exams.md): `E-charge-multi-story` uses this protocol's root-set-labeling discipline for its own claim triple. Any multi-root finding scored against a standing exam must still follow §4's declaration template. |
| 2026-08-08 | T-R0-3 — initial protocol, implements Claim Register Q11 |
