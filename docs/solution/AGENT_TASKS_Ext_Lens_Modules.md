# AGENT TASKS — Lens Modules

**Lane:** Independent — **runs in parallel with every other lane, including P0**
**Governance/DoD:** `AGENT_TASKS_Semantic_Model_Extension.md`

Modules consume `typed-facts.json` only. `threat-signals` proved the boundary
holds: it was written without touching Scanner, Rules, Analysis or the CALM
generator. **That independence is why this lane doesn't wait for the gate** —
it neither blocks nor is blocked by fact-semantics work.

| Task | Depends on | Acceptance |
|---|---|---|
| **T-LM-1 Vulnerability lens** | A real SCA/dependency-scan feed on a real repo | **Not started — checked, gate not met.** `cdxgen-provider.ts` produces a real CycloneDX SBOM (component name/version only, no CVE/advisory data); `grype`/`trivy` are not installed and no vulnerability-scan output exists anywhere in this repo or its fixtures. Building against a fabricated CVE schema would be exactly the "hypothetical schema" this gate forbids — deferred until a real feed exists. |
| **T-LM-2 Resilience lens** | Narrow capability definition first | **Done, 2026-08-16 (review-fixed).** Retry-annotation (Spring Retry `@Retryable`, Resilience4j `@Retry`) and timeout-config (resilience4j `timelimiter.instances.*.timeout-duration`) detection only — not "resilience" scoped whole. `resilience-lens` module + namespaced output (`outDir/modules/resilience-lens/`), `CONTRACT_VERSION` 12.0.0, gold+scorer built alongside per T-LM-0's pattern (`coe-lab/gold/modules/resilience-lens/*.gold.json` on a **dedicated** `java-resilience-handlers` fixture package — never coupled to `java-spring-payments`'s own pre-existing architecture-level gold — + `coe-lab/scripts/score-module-resilience-lens.mjs`, ALL PASS, verified to catch a real mismatch). Second-instance verification for the resilience4j `@Retry` row is now **real, not self-authored-only**: independently confirmed in `spikes/fineract`'s core module (49 files use the exact `@Retry(name=..., fallbackMethod=...)` shape; a real `run-slice` scan of that module detects 7 of them). Spring Retry's `@Retryable` and the `timelimiter.timeout-duration` config key have **no real spikes evidence** — disclosed honestly in `Claim_Register.md`/`scope-limitations.yml`, not silently left standing on the self-authored fixture pair alone. `Claim_Register.md`'s Module fitness section records it `partial, now scored — narrow by design`. |
| **T-LM-3 Data-flow / lineage lens** | — | Not started. Checked: no data-classification facts exist anywhere in `typed-facts.ts` today, so "start from existing flows + data classification already in the pipeline" is not yet true — field-level lineage across transformations would need real new extraction work, not a catalogue row alone. |
| **T-LM-4 Green-engineering lens** | Non-code cost evidence source | Not started. Checked: `k8s-manifest-provider.ts` doesn't parse `resources.requests/limits` today, and no real cloud-billing feed exists in this environment — extending the k8s provider to read declared CPU/memory requests would still be a capacity-declaration proxy, not a real cost/billing figure, and risks being exactly the approximation this gate forbids. |

### Blocking gap found in pre-flight: these lenses have no ground truth

All 12 gold packages in `coe-lab/gold/packages/` are **architecture-level**
(units, routes, persistence, controls, k8s trust) — this is unaffected by the
module-fitness work below. **At the time this section was first written,
there was no gold for green-engineering, resilience, data-flow or
vulnerability output, and no scoring path for module outputs at all** —
`threat-signals` itself shipped unscored at that point.

**Update (2026-08-16): resilience now has gold + a scorer (T-LM-2, above) —
this consequence no longer applies to it.** Green-engineering, data-flow, and
vulnerability remain in the original state: no gold, no scoring path, not
started.

Consequence for the three still-unbuilt lenses: a lens built now is
**unmeasurable**, and under `BR-110` an unmeasured lens may *inform* but must
**not gate** a governance decision.

| Task | Status | Acceptance |
|---|---|---|
| **T-LM-0 Module-output gold + scorer** | **Done, 2026-08-14** — `coe-lab/gold/modules/threat-signals/*.gold.json` (7 core/trap packages, each authored by reading fixture source directly — including catching a real cross-evidence-source case, `ts-nestjs-users`'s security control coming from its `openapi.yaml`, not the `.ts` file, that a naive gold author reading only the route file would have missed). `coe-lab/scripts/score-module-threat-signals.mjs` — verified to actually catch a mismatch (deliberately broke one gold file, confirmed FAIL + exit 1, restored). All 7 pass against real module output. `Claim_Register.md`'s new "Module fitness" section records `threat-signals` as `partial, now scored`; every other lens stays `specified-unbuilt`. | A gold shape and scoring path for module outputs exists, with `threat-signals` as the first subject (it already produces findings to score against). **Do this before, or with, the first new lens** — not after |
| **T-LM-5 Per-lens fitness declaration** | **Done** — `modules/fitness.ts`'s `loadModuleFitness()`, a generic mechanism (not threat-signals-specific — proven by resilience-lens, the second real caller): reads a checked-in `fitness.json` next to each module's `index.ts`, deliberately NOT computed live at run time (`CoE Lab isolation`/CON-40 — the gold this measures against is evaluation-only, never present in a real customer run). Absent/malformed always resolves to the same honest `{ status: 'not-yet-fit-to-gate' }` default, never an error. Both built modules now carry a real, re-verified declaration in their own report JSON (`{findings, fitness}`): threat-signals 7/7 gold packages exact-match (2026-08-18), resilience-lens 8/8 (2026-08-18) — real numbers from re-running each module's own `coe-lab/scripts/score-module-*.mjs`, not asserted. 2 new regression tests (direct `loadModuleFitness()` + real end-to-end wiring through both modules in one run); `npm test` 115/115. **Re-run each module's scorer and hand-update its `fitness.json` whenever real coverage changes — nothing catches staleness automatically.** | Each lens result states its measured fitness, or is explicitly marked not-yet-fit-to-gate |

BR-50 lenses not in this file (workflow, observability, pattern-conformance
stance): `AGENT_TASKS_Ext_Remaining_Lenses.md`. Start those only after
Session A (`T-LM-1`…`4`) finishes.

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
