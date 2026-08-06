# Modularity & Integration Assessment

**Scope:** Is the solution architecture modular enough for future enhancements and seamless integrations?  
**Grounded in:** live `pipeline/src/` (including `modules/registry.ts`, `threat-signals`, catalogue-driven CALM builders) + Solution Design v2 intent.  
**Note:** `Platform_Architecture_Analysis.md` §1 still claims “no module registry”; that is **stale** — registry + second module exist. Prefer this assessment for modularity status.

---

## 1. Verdict

| Question | Answer |
|---|---|
| **Modular enough for future *downstream modules*?** | **Yes, with caveats** — the module boundary is real and already proven by a second consumer (`threat-signals`). Not yet *seamless* (registration is still a code edit in `run-slice.ts`). |
| **Modular enough for future *languages / frameworks*?** | **Mostly yes for catalogue-shaped signals** — new framework often = YAML rows. Breaks when a new *mechanism* is needed (new code shape, new engine, JAX-RS composition, persistence shapes). |
| **Modular enough for future *engines / integrations*?** | **Partial** — engines are isolated adapters in practice, but there is **no formal Scanner plugin interface** and **no capability matrix file** driving routing; orchestration hardcodes CodeGraph → Graphify → analysis steps. |
| **Seamless external integration (CI, governance tools, Studio)?** | **Adequate for file handoff** (`architecture.calm.json`, `typed-facts.json`, provenance). **Not seamless as a library/API** (CLI-only entry, shared `outDir`, no package export contract). |

**One-line summary:** The architecture is **genuinely modular at the “analysis → modules” cut** and **catalogue-extensible for construction**; it is **only moderately modular upstream** (scanner/orchestration) and **not yet a drop-in platform product** for third-party plugins without touching core code.

---

## 2. Architecture as implemented (modularity lens)

```
┌──────────────────────────────────────────────────────────────┐
│  orchestration/run-slice.ts   ← FIXED RECIPE (not a plugin bus)
│    hardcodes: CG index → decorators → JAX-RS compose → map
│               → Graphify → persistence → reconcile → facts
│               → runModules([calm, threat-signals], …)
└────────────────────────────┬─────────────────────────────────┘
                             │ produces
                             ▼
                    ┌─────────────────┐
                    │  TypedFacts     │  contractVersion 1.0.0
                    │  (typed-facts)  │  CALM-agnostic kinds
                    └────────┬────────┘
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        calm-generator  threat-signals   (future green…)
        (builders+YAML) (facts only)     (facts only)
```

**Correct modularity claim (proven):**  
`threat-signals` imports only `TypedFacts` + `Module` — no Scanner, no Rules, no CALM builders. That is the real Goal A test, and it **passes**.

**Incorrect modularity claim (if still in older docs):**  
“Platform foundations complete for arbitrary plugins with zero core changes” — **false** until registration is data-driven and Scanner is pluggable.

---

## 3. Extension surfaces — scored

### 3.1 Downstream modules (threat, green, custom analysers)

| Dimension | Score | Evidence |
|---|---|---|
| Contract isolation | **Strong** | Modules only need `TypedFacts`; CALM types live under calm-generator. |
| Version safety | **Good (basic)** | `contractVersion` + `supportedMajorVersion`; major mismatch skips module. No range/semver minor policy. |
| Failure isolation | **Good** | One module failure is caught; others continue (`registry.ts`). |
| Registration | **Weak** | Must edit `run-slice.ts` import list — not config, not discovery. |
| Shared context | **Thin** | Only `outDir` + optional `overridesDir`. No module-private config, secrets, or feature flags. |
| Output isolation | **Medium** | Modules write into the **same** `outDir`; name collisions possible (`architecture.calm.json` vs future names OK today; no namespacing convention enforced). |

**Seamless enough for?** Internal modules written by the same team: **yes**.  
**Seamless enough for?** External plugin packages with no core PR: **no**.

**Enhancement cost to make seamless:**
- Module list from CLI/`modules.yml` or package entrypoints.
- Per-module output subdirectory (`outDir/modules/<name>/`).
- Optional `ModuleConfig` blob per module.
- Stricter contract: minor-version compatibility matrix.

---

### 3.2 CALM construction / new constructs

| Dimension | Score | Evidence |
|---|---|---|
| Catalogue-driven mapping | **Strong** | `node-type-mapping.yml`, `relationship-type-mapping.yml`, control catalogue + loaders. |
| Builder separation | **Strong** | node / interface / relationship / metadata / control are separate; `build-calm.ts` is a thin orchestrator. |
| New unit kinds | **Medium** | YAML can map `unitKind` → CALM type, but `TypedUnit.kind` is a **closed union** (`service` \| `database` \| `unresolved`) in TypeScript — batch-job/topic need a type change, not only YAML. |
| New relationship kinds | **Medium** | Same issue: `TypedRelationship.kind` closed (`calls` \| `imports` \| `connects`); `shares-secret` needs code. |
| New evidence categories | **Medium** | `Evidence.category` closed union; new categories require type + scorer awareness. |
| Overrides | **Good** | Apply after build; Decision Record enforcement is module-local (CALM path). |

**Seamless enough for?** New framework signals that fit existing kinds/categories: **yes (YAML)**.  
**Seamless enough for?** New architectural concepts (messaging network nodes, batch jobs): **requires TypedFacts schema bump** — correctly so, but not “catalogue only.”

---

### 3.3 Languages / frameworks (intelligence layer)

| Dimension | Score | Evidence |
|---|---|---|
| Signal catalogue | **Strong** | Framework annotations as rows; Java JAX-RS/JPA already extended this way. |
| Language-specific analysis | **Weak modularity** | `composeJaxRsRoutes` is hardcoded in `run-slice` loop — correct for Java, not a pluggable “route composer” registry. |
| Persistence detection | **Weak** | Hardcoded `PERSISTENCE_LIBRARIES` set + one code-shape (`L1` file node + single-level contains). Strategy table is designed, not modularized in code. |
| Engine routing | **Designed, not modular** | No `engine-capability-matrix.yml` in repo; always CodeGraph + Graphify. |
| File extensions scanned | **Hardcoded** | `listIndexedFiles(cg, ['.py', '.ts', '.java'])` — new language needs orchestration edit. |

**Seamless enough for?** Another annotation-shaped control or route signal in Java/Python/TS: **mostly yes**.  
**Seamless enough for?** Scala, gRPC, Dynamo SDK patterns without core touches: **no**.

---

### 3.4 Scanner engines / third-party tools

| Dimension | Score | Evidence |
|---|---|---|
| Adapter isolation | **Good in practice** | CodeGraph and Graphify are separate files; modules never import them. |
| Shared engine interface | **Intentionally absent** | Design §3.2: engines stay shape-specific. Valid, but integrations are **manual** in the pipeline recipe. |
| Swap/upgrade engine | **Medium** | Version-pin + adapter boundary helps; Graphify failure is soft-continue (good resilience, bad for “fool-proof” completeness). |
| Side-by-side CodeQL/SCIP | **Not modular yet** | Would require new orchestration branches, not a matrix row. |

**Seamless enough for?** Dropping in CodeQL as another adapter without rewriting modules: **conceptually yes, mechanically no** (orchestration recipe is the bottleneck).

---

### 3.5 External systems (governance, CI, CALM Studio, other platforms)

| Integration | Seamlessness | Notes |
|---|---|---|
| `calm validate -a` / pattern validate elsewhere | **Good** | File artefact handoff; control URLs need `-u` mapping (documented friction). |
| CI job | **Good enough** | CLI `run-slice` + exit codes; Graphify warn-and-continue can hide incomplete graphs. |
| CALM Studio / draw.io | **Partial** | `x-aac-*` namespacing designed; round-trip not proven; not a live API. |
| Library embed in another Node service | **Poor** | No stable public package API; `main` is CLI; types not published as a product SDK. |
| Multi-tenant / multi-domain config | **Poor** | Single flat catalogues; two-tier `global/`+`domains/` not built. |

---

## 4. What is already “modular enough”

1. **Pipes-and-filters layering** — Scanner → Rules → Analysis → TypedFacts → Modules is one-way; overrides do not corrupt the contract.
2. **Module registry + second module** — Goal A is no longer pure aspiration; threat-signals proves multi-module without touching CALM builders.
3. **Catalogue-driven CALM construction** — framework/construct growth without rewriting builders (when kinds already exist).
4. **Determinism boundary** — `suggest-rules.ts` offline; LLM not in core path; good for integrators who need reproducible artefacts.
5. **Failure containment at module layer** — one bad module does not abort the whole run (orchestrator still can fail hard on scan).

---

## 5. Friction points that block “seamless” enhancement

### F1 — Orchestration is a closed recipe (highest impact)

`run-slice.ts` is the integration bus. Every new:
- file extension,
- language-specific composer,
- engine,
- analysis pass  

requires editing this file. That is **not seamless**; it is a **kernel modification** pattern.

### F2 — TypedFacts closed unions (correct but non-seamless)

Closed unions protect the contract but force a **`contractVersion` bump** for new kinds/categories. That is good governance, bad “add a YAML row and ship.” Document when a change is catalogue-only vs contract-breaking.

### F3 — Module registration and I/O coupling

Hardcoded module list + shared `outDir` = fine for 2 modules, painful for 10 or for third parties.

### F4 — Analysis special cases leak language knowledge upward

JAX-RS composition in the main loop is the right *behavior* and the wrong *extension model*. Next language with the same problem (e.g. another non-native route stack) will add another branch.

### F5 — Persistence and engine strategy still code-shaped

Strategy catalogues are designed for genericity; code still encodes BoA-shaped Graphify heuristics. Future persistence tech will still risk per-shape patches until F1/F5 are fixed.

### F6 — No stable integration façade

No `createPipeline()` / programmatic API, no plugin discovery, no event hooks (`onFactsReady`). External “seamless integration” today means **wrapping the CLI**.

---

## 6. Future enhancement scenarios (walk-through)

| Enhancement | Seamless today? | What you must touch |
|---|---|---|
| New Spring annotation → control | **Mostly** | `signal-catalogue.yml` + control catalogue row (+ requirement JSON) |
| New NestJS route pattern (if CodeGraph native) | **Mostly** | catalogue; maybe nothing else |
| Green software module | **Yes for module body** | New `modules/green-*/` + **one line** in `run-slice` registry list |
| Threat modeller v2 (richer STRIDE) | **Yes** | Expand threat-signals only; if new evidence categories needed → TypedFacts + scanners |
| Kafka `topic` network nodes | **No** | TypedUnit.kind, mappings, detection, possibly Graphify/CodeGraph path |
| CodeQL for Java Phase 2 | **No** | New provider + orchestration wiring + (later) matrix |
| k8s trust relationships | **No** | New scanner provider + analysis + relationship kind + mapping row |
| Domain-specific EA overrides (payments domain) | **No** | Two-tier mapping-config not built |
| Embed in monorepo CI as library | **Weak** | Wrap CLI or extract API |

---

## 7. Recommendations (ordered by leverage)

### P0 — Make “seamless module add” true
1. Externalize module list (`--modules calm-generator,threat-signals` or `modules.yml`).
2. Namespace outputs: `outDir/modules/<name>/` + keep top-level copies of primary artefacts if needed for back-compat.
3. Document Module authoring guide (1 page): contract fields, versioning, output names.

### P1 — Make TypedFacts evolution explicit
4. Policy table: which fields are closed unions and when to bump `CONTRACT_VERSION`.
5. Open `Evidence.source` / authority tiers as designed (or document closed set as intentional).
6. Add `batch-job` / `topic` to kind union **only with** catalogue rows + one fixture — prove additive contract change process.

### P2 — Modularize upstream without a forced mega-interface
7. **Analysis pass registry** (ordered steps: mapSignals, composeRoutes*, detectPersistence, reconcile) instead of inline recipe.
8. **Route-composer plugins** keyed by language/framework (JAX-RS first citizen).
9. **Persistence strategy catalogue** replacing hardcoded library set + single shape.
10. Optional later: engine capability matrix driving which providers run.

### P3 — Integration façade
11. Thin programmatic API: `runPipeline({ packageRoots, outDir, modules })` used by CLI.
12. Harden Graphify failure policy (config: fail vs continue) for CI.
13. Publish artefact schema versions in provenance for downstream governance systems.

### Do not do (would fake modularity)
- Force one polymorphic “Engine” interface that erases CodeGraph vs Graphify shapes without a real win.
- Put CALM types into TypedFacts (would couple every module to CALM).
- Allow modules to re-enter Scanner (breaks determinism and contract).

---

## 8. Scorecard (current vs target)

| Capability | Today | Target for “seamless platform” |
|---|---|---|
| Multi-module on shared facts | **Done** (2 modules) | Done + discovery |
| Module without core PR | **No** | Config/registry file |
| New framework (same mechanisms) | **Mostly** (YAML) | Same |
| New mechanism / language | **Core edits** | Analysis/engine plugins |
| New CALM construct mapping | **Mostly** (YAML) | Same + open kinds process |
| External engine drop-in | **No** | Capability matrix + adapter |
| External product integration | **Files/CLI** | API + schemas + CI policy |
| Multi-domain config | **No** | Two-tier mapping-config |

**Overall modularity grade:** **B− (solid internal modularity, incomplete platform extensibility)**  
**Overall seamless-integration grade:** **C+ (excellent artefact boundary; weak plugin and API surface)**

---

## 9. Bottom line for decision-makers

- **Safe to build more modules** (green analyser, richer threat signals) on `TypedFacts` **now** — the boundary is real.
- **Not safe to promise “any team can plug in without touching the platform”** until registration, output namespacing, and upstream pass/engine plugins exist.
- **Catalogue-driven construction was the right modular bet** for CALM enhancements; **orchestration remains the main anti-modular hotspot**.
- For **future enhancements**, invest in **P0–P2** before expanding language coverage aggressively — otherwise every new language deepens the closed recipe.

This assessment is implementation-truth as of the current `pipeline/src/`; re-run when analysis pass registry or engine matrix lands.
