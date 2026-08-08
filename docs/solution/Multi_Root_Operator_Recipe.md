# Multi-root operator recipe (T-L3-1)

**Audience:** whoever runs Weaver against a real monorepo and hits an S1 silence flag. This is a short, practical "what do I do" doc — it does not re-derive the RCA history behind it (that's `coe-lab/docs/fineract-gold-vs-platform-finding.md` and `AGENT_TASKS_Layered_Architecture_Story.md`, linked below if you want the full story).

---

## When to reach for this

You ran `run-slice` on a single package root and got:

```
S1-zero-service-touching-relationships: N service unit(s) and M database unit(s)
present, but 0 relationships touch a service unit — likely a multi-hop/layered
architecture story not yet recovered (see AREC R2), not "no architecture here"
```

(visible in `coverage-report.json`'s `completeness.silenceFlags`, or `intelligence-ir.md`'s coverage appendix)

**Before assuming this is a detection bug, check one real, common architectural shape**: does your monorepo split the HTTP-facing API layer and the class(es) that actually implement its persistence access into **separate modules/package roots**? (e.g. an `api`/`resource` module that only depends on an interface, and a `provider`/`service`/`impl` module elsewhere in the repo that implements it). If yes — this is very likely the exact **layered, cross-module story** a single-root scan structurally cannot see, not a false negative to file a bug about.

## Why a single-root scan misses this (one sentence)

A single-root scan can only resolve a bridge interface's implementer if that implementer lives inside the SAME root you scanned — if it lives in a different module, the bridge stays unresolved (correctly, honestly — see `S-unresolved` below), not silently guessed at.

## What to do: scan both roots together

```bash
node dist/orchestration/run-slice.js <api-module-root> <provider-module-root> --out <dir>
```

Passing 2+ roots to one `run-slice` invocation runs **one combined structural pass** over their common ancestor — this is what makes a cross-module edge resolvable at all (a single-root run structurally cannot produce one; there's nothing to cross). See `coe-lab/docs/multi-root-l2-protocol.md` §2-§4 for the full mechanics and a declaration template if you need to write this claim up formally.

## What you'll get, honestly

Re-running combined, look at `typed-facts.json`'s relationships for `crossPackage: true` entries with `kind: 'calls'`, or the new `x-aac-mechanism` metadata on the generated CALM relationship (T-L2-1):

| `mechanism` value | Story ID (`AGENT_TASKS_Layered_Architecture_Story.md` §0.4) | What it means |
|---|---|---|
| `r2-phase1` | **S-layered-access** | The bridge's sole implementer (in the other root) IS itself a real database/topic unit — you get an edge straight to the access-layer class. |
| `r2b` | **S-layered-domain** | The implementer isn't itself a store, but imports exactly one — you get an edge to whatever it imports (often an entity/repository). |
| *(unset)* | — | Not multi-hop-derived (R0/R1/k8s/env-soft-graph). |

Also visible in `coverage-report.json`'s new `relationshipsByMechanism` field (T-L3-2) and `intelligence-ir.md`'s coverage appendix — a run-level count, not just per-relationship metadata.

**Say the claim triple, always** (`AGENT_TASKS_Layered_Architecture_Story.md` §0.2, the exact drift this whole program exists to prevent):

> ✅ "Recovers S-layered-access on multi-root `<api-module>`+`<provider-module>` (root set named)."
> ❌ "Fixed" / "closed" / "works now" with no root set and no terminal grain named — this reads as if the SINGLE-root gold-scored claim passed, which it didn't and structurally can't (the source has no static one-hop chain — that's not a bug to fix).

If you're formally scoring against a hand-authored gold package, the single-root and multi-root gold packages for the SAME API are **never interchangeable** — see `coe-lab/gold/calm/FINERACT_GOLD.md`'s explicit disambiguation note and `coe-lab/docs/standing-disconfirming-exams.md`'s `E-charge-single-L2` vs `E-charge-multi-story` exam pair for the concrete example this recipe generalizes from.

## When it's still honestly unresolved

Multi-root doesn't fix everything. You'll still correctly get **S-unresolved** (a named `unresolved-multi-hop` ignored-item in `typed-facts.json`, and a specific, actionable line in `review-queue.json` if you run `hitl-review-trigger.js` — T-L3-3) when:

- The bridge has **0 or 2+** implementers even across both roots scanned — never guessed, per this pipeline's "never fabricate to clear a silence flag" rule.
- The real call path goes through a **command bus / dynamic dispatch** — a permanent, named non-goal (`OOS_Registry.md`), not a detection gap.
- The implementer lives in a **third module you didn't include** in the roots you passed.

None of these are bugs to work around by adding a third root speculatively or hand-editing output — they're honest residuals. If you have real evidence a case should resolve and doesn't, that's either a catalogue-intake candidate (`Catalogue_Intake.md`) or, once it exists, a residual-review-session item (`Architect_Residual_Review_Session.md`, **B-review-session** — noted here as a *future* option, not something you need today; see T-L3-3's own explicit scoping).

## Links

- Full mechanism/root-set mechanics: `coe-lab/docs/multi-root-l2-protocol.md`
- Frozen exam pair for the canonical example: `coe-lab/docs/standing-disconfirming-exams.md` (`E-charge-single-L2` / `E-charge-multi-story`)
- Story-ID vocabulary + program rules: `AGENT_TASKS_Layered_Architecture_Story.md` §0.2-§0.4
- Detector mechanism detail (why 2 hops, why it stops there): `AREC_Store_Terminal_Policy.md`
- Original finding this all traces back to: `coe-lab/docs/fineract-gold-vs-platform-finding.md`

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | Initial recipe (T-L3-1), linked from README's "Known issues & honest gaps" table. |
