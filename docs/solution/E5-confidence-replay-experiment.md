# E5 — Confidence Replay Experiment (T-P0-6)

**Task:** `AGENT_TASKS_Ext_P0_Experiments.md`'s T-P0-6 row (`docs/06`'s E5):
*"Replay probabilistic-OR + contradiction detection over existing runs.
Passes if ≥1 fact changes status in a way a reviewer agrees is more correct.
If nothing changes, deprioritise `L3`/`L4` — they'd be theory."*

**Result: NEGATIVE — deprioritise `L3`/`L4`, but reached via the harder
route the acceptance bar actually specifies.** A real difference was found
(22 of 617 real units across 9 real generated runs change confidence band
under probabilistic-OR instead of the live summed-weight combination), so
this is not "nothing changed." But on review, every single changed case
moves in the direction a reviewer judges **less** correct, not more — so the
honest disposition is the acceptance bar's own escape hatch, reached by
actually checking the harder condition rather than defaulting to it because
nothing happened.

## Claim triple

`{rootSet: fresh run-slice output for the reference banking platform's core
module, the reference governance platform's data module (spikes/,
real repos) + all 7 coe-lab core/trap packages, terminalGrain: unit
confidence band (low <40 / medium 40-69 / high >=70, the live bandFor()
thresholds), evalArtefact: an offline replay script scored against real,
already-generated typed-facts.json output — no pipeline code modified}`.

## Method

`pipeline/src/analysis/confidence-scorer.ts`'s live implementation is a
capped sum of evidence weights (`Math.min(100, sum(weight))`). No
probabilistic-OR or contradiction-detection combination function exists in
the codebase today — `L3`/`L4` were never built, only specified. E5's own
premise is a **replay**, not a new pipeline feature, so a standalone offline
script (not wired into the pipeline, no builder touched) recomputed
confidence for every real unit with 2+ evidence items using
probabilistic-OR (`1 - Π(1 - w_i/100)`) and compared the resulting band to
the live band, across 9 real, already-generated `typed-facts.json` files (2
fresh `spikes/` runs + the 7 coe-lab core/trap packages already regenerated
for this session's coe-lab gate re-verification).

Contradiction detection could not be replayed at all — there is no existing
mechanism anywhere in this codebase that flags two evidence items as
*opposing* (vs. merely both present), so there is nothing to replay for that
half of L3/L4. This is itself part of the finding: contradiction detection is
`specified-unbuilt`, not partially built, confirmed by direct code search
(`grep -rn "contradiction"` across `pipeline/src` — the only hits are
`BACKLOG.md`'s own "Contradiction detection between evidence sources" row,
already tracked there, not source code).

## Result

617 total units scanned, 72 with 2+ evidence items (the only candidates
where combination choice can matter — a single-evidence unit is identical
under either formula). **22 band changes**, all `high -> medium` (80 -> 64),
all the same real shape: a Spring Data repository interface with exactly two
`extends` clauses from one declaration (`extends JpaRepository<X, Long>,
JpaSpecificationExecutor<X>`), each independently weighted 40. Every single
instance is the reference Java/JAX-RS banking platform's real source; the
coe-lab fixtures and the reference governance platform's data module contributed 0 changes (too few 2+-evidence
units, or existing evidence already summed past the point where the two
formulas' outputs land in different bands).

## Review: is the change more correct?

**No, for the dominant real-world case this replay actually found.**
Probabilistic-OR's independence assumption models each evidence item as an
*independent* signal of the same underlying fact — appropriate when two
pieces of evidence come from genuinely separate sources (e.g. a route
annotation AND a security-control call site, corroborating from different
angles). It is not appropriate here: `extends JpaRepository<X, Long>,
JpaSpecificationExecutor<X>` is **one Java `implements`/`extends` clause**,
syntactically split into two catalogue rows only because
`java-import-resolver.ts` records each generic interface separately. These
two evidence items are not independent corroboration — they are two facets
of the identical declaration. Treating them as independent and applying
probabilistic-OR's multiplicative discount **undercounts** what is actually
very strong, exact, structural evidence (a real Spring Data type declaration
— about as reliable a persistence signal as this pipeline has). Demoting
these 22 real repository units from `high` to `medium` confidence would be a
regression in practice, not an improvement — a human reviewer looking at
`ChargeRepository.java`'s real source would not conclude 64/100 confidence
is more accurate than 80/100 for a class that unambiguously `extends
JpaRepository`.

No case moved in the other direction (no `low -> medium` or `medium -> high`
upgrade was found in this replay) — there is no example on the positive side
to weigh against the 22 negative-direction ones either.

## Acceptance bar, scored

| Criterion | Result |
|---|---|
| ≥1 fact changes status | **Yes — 22, real, from real repos** |
| A reviewer agrees the change is more correct | **No, for all 22.** The evidence-correlation assumption probabilistic-OR requires (independence) does not hold for this pipeline's dominant "multiple generic interfaces from one declaration" evidence shape |
| Disposition per the bar's own escape hatch | **Deprioritise `L3`/`L4`** — not because nothing changed, but because what changed made the honest, reviewed call: worse, not better, for the real evidence shape this pipeline actually produces most often |

## What would reopen this

- A different real evidence shape where 2+ items genuinely are independent
  (not two facets of one declaration) surfaces a band change that improves
  correctness — this replay's dataset (the reference banking platform's core
  module, the reference governance platform's data module, 7
  coe-lab packages) happened to only exercise the correlated-evidence shape;
  a different repo could exercise a genuinely independent-evidence case this
  replay never saw.
- Contradiction detection specifically — this replay could not test it at
  all (nothing to replay); it remains a separate, still-open question from
  the confidence-combination question this replay actually answered.
