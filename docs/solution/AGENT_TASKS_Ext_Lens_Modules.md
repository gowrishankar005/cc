# AGENT TASKS — Lens Modules

**Lane:** Independent — **runs in parallel with every other lane, including P0**
**Governance/DoD:** `AGENT_TASKS_Semantic_Model_Extension.md`

Modules consume `typed-facts.json` only. `threat-signals` proved the boundary
holds: it was written without touching Scanner, Rules, Analysis or the CALM
generator. **That independence is why this lane doesn't wait for the gate** —
it neither blocks nor is blocked by fact-semantics work.

| Task | Depends on | Acceptance |
|---|---|---|
| **T-LM-1 Vulnerability lens** | A real SCA/dependency-scan feed on a real repo | Design driven by the real feed, not a hypothetical schema. Module + namespaced output |
| **T-LM-2 Resilience lens** | Narrow capability definition first | Retry-annotation and timeout-config detection — not "resilience" scoped whole |
| **T-LM-3 Data-flow / lineage lens** | — | Field-level lineage across transformations; start from existing flows + data classification |
| **T-LM-4 Green-engineering lens** | Non-code cost evidence source | **Do not approximate cost from code metrics** (call counts, LOC) — that isn't what the requirement means. Needs cloud-billing/IaC input |

### Blocking gap found in pre-flight: these lenses have no ground truth

All 12 gold packages in `coe-lab/gold/packages/` are **architecture-level**
(units, routes, persistence, controls, k8s trust). **There is no gold for
green-engineering, resilience, data-flow or vulnerability output, and no
scoring path for module outputs at all** — `threat-signals` itself ships
unscored today.

Consequence: a lens built now is **unmeasurable**, and under `BR-110` an
unmeasured lens may *inform* but must **not gate** a governance decision.

| Task | Status | Acceptance |
|---|---|---|
| **T-LM-0 Module-output gold + scorer** | **Done, 2026-08-14** — `coe-lab/gold/modules/threat-signals/*.gold.json` (7 core/trap packages, each authored by reading fixture source directly — including catching a real cross-evidence-source case, `ts-nestjs-users`'s security control coming from its `openapi.yaml`, not the `.ts` file, that a naive gold author reading only the route file would have missed). `coe-lab/scripts/score-module-threat-signals.mjs` — verified to actually catch a mismatch (deliberately broke one gold file, confirmed FAIL + exit 1, restored). All 7 pass against real module output. `Claim_Register.md`'s new "Module fitness" section records `threat-signals` as `partial, now scored`; every other lens stays `specified-unbuilt`. | A gold shape and scoring path for module outputs exists, with `threat-signals` as the first subject (it already produces findings to score against). **Do this before, or with, the first new lens** — not after |
| **T-LM-5 Per-lens fitness declaration** | Not started — natural next step once a second module exists to prove the declaration mechanism isn't threat-signals-specific | Each lens result states its measured fitness, or is explicitly marked not-yet-fit-to-gate |

Authoring that gold is subject to `CON-40` isolation: gold is authored from
fixture source, **never** from a module's own output.

**Shortcut to refuse:** emitting lens data as free-form metadata on existing
nodes because it validates and looks done. It bypasses the contract and can't
be gated. If a lens needs a new field shape, it goes through the catalogue and
contract — same bar as any other capability.

**Per module:** declare `supportedMajorVersion`, register in
`AVAILABLE_MODULES`, write output under `outDir/modules/<name>/`, and add a
Claim Register entry at the status the evidence supports. A module that throws
must not stop the others — the registry already isolates this; don't defeat it.

**Contract coupling:** if the Contract & Lifecycle lane bumps `TypedFacts`,
every module here needs its declared major version *reviewed*, not merely
bumped — an unbumped module is skipped with a warning, not an error.
