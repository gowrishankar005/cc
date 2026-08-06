# Agent task list — Solution cleanup + prioritized actions + modularity (P0–P2)

**Sources:**
- `docs/spikes/Solution_Design_v2_Critical_Review.md` §5 (prioritized action list)
- Cleanup advice (platform root + language annexes; do not merge monolithically)
- `docs/solution/Modularity_and_Integration_Assessment.md` §7 (P0–P2 seamless modularity)

**Extraction enrichment + integrity (do not track separately):**  
→ **`docs/solution/AGENT_TASKS_Extraction_Enrichment.md`**  
That file owns X0–X10 capability work **and** integrity process (Wave XI, hard dependencies, MVP-first, PR template, catalogue-before-detector). Use it after/alongside Wave M; do not duplicate enrichment tasks here.

**Why one file (not a separate modularity task list):** Agents and humans should have a **single ordered work queue** per concern. Split files cause wave-ordering mistakes (e.g. building CodeQL before module registration). Modularity P0–P2 is **Wave M** here, with reasons inline, and cross-links to review actions / Wave E where they overlap.

**How to use:** Assign tasks by ID to an LLM agent. Each task is self-contained: goal, **why (reason)**, inputs, steps, acceptance criteria, out of scope. Prefer one agent per wave.

**Suggested order:**
```
Wave A (docs) → Wave B (Slice 2a gates) → Wave C (verify Goal A thin track; often already done)
  → Wave M (modularity P0–P2) → Wave D / E as needed → Wave F stays deferred
```
Do not start Wave M until Wave C acceptance is true (or verified already shipped). Do not start Wave E engine/language expansion as a substitute for Wave M — that deepens the closed orchestration recipe.

**Authority after cleanup (target state):**
| Concern | Authoritative doc |
|---|---|
| Dual goals, platform contracts, CALM construction pattern, NFRs, modules | `Architecture_as_Code_Solution_Design_v2.md` (or renamed platform root — see T-A1) |
| Slice 2 Java sequencing, Phase 1/2 engines, Fidelity coverage rows | Java companion (or `docs/solution/language/java.md` annex) |
| What is built vs designed | Status matrix in platform root (generated/updated each doc edit) |
| Engine routing rows | Single `pipeline/src/scanner/engine-capability-matrix.yml` (or `docs/solution/` stub until coded) — **docs follow the matrix**, not the reverse |
| Modularity / seamless integration target | `Modularity_and_Integration_Assessment.md` (this file implements its P0–P2) |

---

## Wave A — Document cleanup (do first; no product code required)

### T-A0 — Decision: combine or keep separate (human or agent with user confirm)

| Field | Content |
|---|---|
| **Goal** | Record the structural decision for solution docs so later tasks do not thrash. |
| **Recommended decision** | **Do not merge into one monolithic file.** Keep **one platform root + language annexes**, with a hard conflict rule. Full merge would recreate the review’s #1 problem (contradictory “locked” claims in one huge file) and make Java/Node/Python churn rewrite the platform story. |
| **Target layout** | See T-A1. |
| **Acceptance** | Written decision in platform root §0 (2–4 sentences) + link to annexes. |
| **Out of scope** | Rewriting all content (that is T-A2+). |

**Recommended structure (do this unless user overrides):**

```
docs/solution/
  Architecture_as_Code_Solution_Design_v2.md   # platform + CALM construction (root)
  language/
    java.md                                    # from Architecture_as_Code_Java_Solution_Design.md
    # node.md / python.md later if needed
  STATUS.md                                    # built | designed | proven matrix (optional separate file)
  AGENT_TASKS_*.md                             # this file
```

**Conflict rule to paste into root §0:**  
*Platform contracts and CALM construction pattern → root is authoritative. Slice 2 Java sequencing and Phase 1/2 engine choice → `language/java.md` is authoritative. Capability matrix YAML is the runtime source of truth; both docs must match it. Where prose conflicts, the more recent verified pipeline evidence wins, and the losing section must be edited in the same PR.*

---

### T-A1 — Restructure files (move/rename, no content rewrite yet)

| Field | Content |
|---|---|
| **Goal** | Implement the layout from T-A0 without losing git history if possible. |
| **Steps** | 1) Create `docs/solution/language/` if missing. 2) Move `Architecture_as_Code_Java_Solution_Design.md` → `docs/solution/language/java.md` (or keep old name + add stub redirect at old path pointing to new). 3) Add short pointer at top of old path if kept for links. 4) Update references in `CLAUDE.md`, v2, review, this task file. |
| **Acceptance** | Links resolve; `rg "Architecture_as_Code_Java"` shows updated pointers; root and java annex open cleanly. |
| **Out of scope** | Content cleanup (T-A2–T-A5). |

---

### T-A2 — Reconcile engine matrix (Review action #1)

| Field | Content |
|---|---|
| **Goal** | Single Phase-1-first story: extractFromSource (+ route composition) primary for JAX-RS/JPA; CodeQL/scip-java = Phase 2 triggers only. |
| **Inputs** | Java companion §1.5–1.7; v2 §6.1; review §3 High findings. |
| **Steps** | 1) Create or update `pipeline/src/scanner/engine-capability-matrix.yml` (or `docs/solution/engine-capability-matrix.yml` if code not ready) with Phase 1 rows only as `primaryEngine`, Phase 2 as `augmentEngine` + `trigger`. 2) Edit v2 §6.1 YAML/prose to match. 3) Edit java annex §1 engine YAML to match. 4) Remove any “CodeQL primary for JAX-RS” wording for near-term. |
| **Acceptance** | `rg -n "primaryEngine: codeql" docs/solution pipeline` is empty **or** only appears under explicit `phase: 2`. Both docs state the same Phase 1 primary for jax-rs and jpa. |
| **Out of scope** | Implementing CodeQL/scip-java. |

---

### T-A3 — Implementation status matrix (Review action #2)

| Field | Content |
|---|---|
| **Goal** | Stop “specified, not built” language for things already in `pipeline/src/`. |
| **Steps** | 1) Inventory: catalogues, builders, override-applier, control-builder, jaxrs-route-composer, signal-mapper calmNodeType, module registry, contractVersion, k8s, api-contract, IR, LLM advisory. 2) Add a table to root (or `STATUS.md`): Design section \| Code path \| Status (`built`/`partial`/`designed`/`backlog`) \| Last verified. 3) Edit every “not built” claim that contradicts the inventory. |
| **Acceptance** | No false “not built” for files that exist under `pipeline/src/modules/calm-generator/` and `pipeline/src/rules/*mapping*`. Status table matches `find pipeline/src -name '*.ts'`. |
| **Out of scope** | Building missing pieces. |

---

### T-A4 — Fix Java risk table + Phase 1 completeness claims (Review actions #3, overclaim)

| Field | Content |
|---|---|
| **Goal** | Java annex risk #1 and §1.5 match evidence. |
| **Steps** | 1) Rewrite risk “Java never run E2E” → residual **breadth** risk (multi-module, multi-shape, multi-concern). 2) Soften §1.5 “entire Fidelity stack minus nothing of substance” → “Phase 1 mechanisms cover the *detectable* Fidelity concerns that map to native/decorates/import/structured-file; Spring Data/jOOQ/OpenAPI/full-scale E2E remain open.” 3) Mark each §2 coverage row: `built` / `proven-spike` / `designed` / `backlog`. |
| **Acceptance** | No claim that Java was never run E2E; §2 table has status column; §1.5 does not claim full Fidelity completeness. |
| **Out of scope** | Implementing missing rows. |

---

### T-A5 — Slice 2a / 2b / 2c split + conflict rule (Review action #4, polish #17)

| Field | Content |
|---|---|
| **Goal** | Replace over-packed Slice 2 with sequenced exits; paste conflict rule (T-A0). |
| **Steps** | Edit root §10 (and java annex if needed): **2a** Java source-only routes + JPA entity + construction/regression harden; **2b** controls evidence + DR/override UX polish; **2c** k8s + OpenAPI; **platform thin track** parallel or after 2a. Define exit criteria bullets per slice (see Wave B). |
| **Acceptance** | §10 no longer lists platform+CodeQL+k8s+controls+overrides as one undifferentiated “near-term” row. Conflict rule present in root §0. |
| **Out of scope** | Implementing slices. |

---

### T-A6 — Polish doc fixes (Review actions #15–18)

| Field | Content |
|---|---|
| **Goal** | Quick language/hygiene fixes. |
| **Steps** | 1) Rename Java §5 title away from “governance” → control/resiliency/observability **evidence**. 2) Add pilot numeric scorecard section to root (route recall, calm validate 0 errors, time/package, override rate — provisional numbers OK). 3) One-liner CALM 1.2 pin + “upstream CALM change = re-validate + bump artefact metadata.” |
| **Acceptance** | Title fixed; scorecard section exists; version-drift sentence exists. |
| **Out of scope** | Building measurement automation. |

---

### T-A7 — Optional: demote or relocate IR + LLM advisory

| Field | Content |
|---|---|
| **Goal** | Keep IR/LLM off Slice 2a critical path in the reader’s mind. |
| **Steps** | Move or label v2 §7.1 and §13 as **Appendix: optional review UX (unbuilt)**; add “not Slice 2a” banner. |
| **Acceptance** | Main Slice 2a narrative does not list IR/LLM as near-term must-build. |
| **Out of scope** | Implementing IR/LLM. |

---

## Wave B — Must resolve before “locked for build” (code + tests)

*Prereq: Wave A complete, especially T-A2 and T-A3.*

### T-B1 — Slice 2a exit criteria as executable checklist

| Field | Content |
|---|---|
| **Goal** | Make Slice 2a pass/fail concrete for agents and CI. |
| **Acceptance criteria (write into root §10 and enforce)** | (1) Fineract-charge (or agreed package) produces schema-valid CALM via `npm run validate`. (2) JAX-RS routes match grep baseline within agreed tolerance (document count). (3) JPA `@Entity` → `database` kind, not `service`. (4) No `interacts` with `{source,destination}`. (5) Automated regression for BoA + NestJS + Fineract-charge counts. |
| **Out of scope** | Waltz jOOQ, full Fineract 7k E2E, CodeQL. |

---

### T-B2 — Golden multi-language regression floor (Review action #7, early)

| Field | Content |
|---|---|
| **Goal** | Catalogue/builder edits cannot silently regress known good counts. |
| **Steps** | Add `npm test` (or script) that runs pipeline on fixtures/packages and asserts node/interface/relationship counts + calm validate. Include at least: NestJS fixture, BoA package if available, Fineract-charge if available. |
| **Acceptance** | CI or local `npm test` fails when a catalogue change breaks expected counts; documented how to update baselines intentionally. |
| **Out of scope** | Full golden-dataset program. |

---

### T-B3 — Service→service `connects` golden test (interacts fix residual)

| Field | Content |
|---|---|
| **Goal** | Prove relationship mapping never emits invalid `interacts` for service→service. |
| **Steps** | Fixture or synthetic typed-facts with service→service edge; assert CALM relationship shape is `connects` with source/destination; validate with calm-cli. |
| **Acceptance** | Test green; maps to review “verify with service→service edge golden test.” |

---

### T-B4 — Control requirement-url portability note + verify validate path

| Field | Content |
|---|---|
| **Goal** | Document and stabilize `calm validate -u` mapping for controls. |
| **Steps** | Ensure `npm run validate` always passes mapping; document in root artefact handoff for external consumers; prefer portable paths where possible. |
| **Acceptance** | Fresh clone: build + validate instructions work without hand-edited absolute paths (or script regenerates mapping). |

---

## Wave C — Goal A platform thin track (before multi-module marketing)

**Status note (verify before re-implementing):** As of the modularity assessment, `CONTRACT_VERSION` / `contractVersion`, `modules/registry.ts`, `calmGeneratorModule`, and `threat-signals` (second module) already exist in `pipeline/src/`. Agents must **check code first**, mark tasks complete if acceptance already holds, and only implement gaps. Wave M builds on this baseline (registration still hardcoded in `run-slice.ts` — that is P0, not Wave C).

### T-C1 — `contractVersion` on TypedFacts (Review action #6 part)

| Field | Content |
|---|---|
| **Goal** | Version the intermediate contract shape, not only catalogue version. |
| **Why** | Second modules must refuse incompatible facts rather than silently mis-read fields (modularity assessment: version safety). |
| **Steps** | If missing: extend `typed-facts.ts`; stamp in orchestration; document semver policy in root §3.4. If present: verify every run writes `contractVersion`. |
| **Acceptance** | Every `typed-facts.json` includes `contractVersion`; breaking field change requires bump documented in STATUS. |

---

### T-C2 — Module registry in orchestration (Review action #6 part)

| Field | Content |
|---|---|
| **Goal** | Replace hard-coded CALM-only terminus with a registry API. |
| **Why** | Goal A is “platform, not CALM-only script”; without a registry there is no multi-module boundary. |
| **Steps** | If missing: implement `runModules`; modules declare `supportedMajorVersion`. If present: confirm calm-generator is registered as a `Module`. |
| **Acceptance** | Adding a second module does not require editing CALM builder internals. |
| **Not done by this task alone** | Config-driven module list (that is **T-M1**). Hardcoded `runModules([calm, threat], …)` still counts as Wave C complete. |

---

### T-C3 — Second module proof (Review action #6 part)

| Field | Content |
|---|---|
| **Goal** | Prove Goal A with a real second consumer of `TypedFacts` only. |
| **Why** | Design sketches do not prove modularity; a second module that never imports Scanner/CALM does. |
| **Steps** | Prefer existing `threat-signals` if it meets acceptance. Else add no-op `module-health.json` writer. |
| **Acceptance** | One run produces CALM artefacts + a second module artefact; second module imports only `typed-facts` + registry types (no `scanner/`, no `calm-generator/` builders). |

---

## Wave M — Modularity P0–P2 (seamless enhancements & integrations)

**Source:** `docs/solution/Modularity_and_Integration_Assessment.md` §7 Recommendations.  
**Problem this wave fixes:** Downstream modules are modular; **orchestration is a closed recipe**, module registration requires a core PR, and new languages/engines require kernel edits. Without Wave M, every language/engine expansion (Wave E) makes the platform *less* modular.

**Do not:** Force a single polymorphic Engine interface that erases CodeGraph vs Graphify shapes; put CALM types into `TypedFacts`; allow modules to re-enter Scanner.

### P0 — Make “seamless module add” true

#### T-M1 — Externalize module list (config or CLI)

| Field | Content |
|---|---|
| **Goal** | Adding a module does not require editing `run-slice.ts` source. |
| **Why (P0.1)** | Today `run-slice` hardcodes `runModules([calmGeneratorModule, threatSignalsModule], …)`. That blocks third-party or team modules without a platform PR and fails the “seamless integration” bar for Goal A. |
| **Steps** | 1) Support `--modules calm-generator,threat-signals` and/or `modules.yml` / `pipeline/modules.manifest.yml`. 2) Built-in module map name → implementation (or package entrypoints). 3) Default list preserves current behaviour (calm-generator + threat-signals). 4) Unknown module name → clear error. |
| **Acceptance** | New internal module can be enabled by config/CLI only; `run-slice.ts` has no per-module import list growth for each add (dynamic load or single registry map). Existing default run still writes CALM + threat-signals artefacts. |
| **Out of scope** | npm plugin marketplace; remote download of modules. |

---

#### T-M2 — Namespace module outputs

| Field | Content |
|---|---|
| **Goal** | Modules write to isolated paths; no silent filename collisions. |
| **Why (P0.2)** | All modules share `outDir` today. As green/threat/custom modules grow, `report.json`-style names will collide; governance consumers need a stable layout. |
| **Steps** | 1) Convention: `outDir/modules/<module-name>/` for module-private artefacts. 2) Keep back-compat copies of primary artefacts at top level if needed (`architecture.calm.json`, `typed-facts.json`) — document which files stay top-level. 3) Update calm-generator and threat-signals to use convention. |
| **Acceptance** | Two modules never overwrite each other’s private files; layout documented in solution root artefact-handoff section or `STATUS.md`. |
| **Out of scope** | Changing CALM schema; multi-tenant storage. |

---

#### T-M3 — Module authoring guide (1 page)

| Field | Content |
|---|---|
| **Goal** | Anyone can implement a Module without reverse-engineering the registry. |
| **Why (P0.3)** | Seamless integration is social as well as technical — without a contract guide, modules will import Scanner or mutate TypedFacts. |
| **Steps** | Write `docs/solution/Module_Authoring_Guide.md` (or `pipeline/docs/modules.md`): `Module` interface, `contractVersion` / major match, allowed imports, output paths (T-M2), how to register (T-M1), determinism rules (no LLM in module path unless offline-flagged), example pointing at `threat-signals`. |
| **Acceptance** | Guide exists; threat-signals and calm-generator cited as examples; “forbidden: import scanner” stated explicitly. |
| **Out of scope** | Full SDK package publish. |

---

### P1 — Make TypedFacts evolution explicit

#### T-M4 — Contract evolution policy table

| Field | Content |
|---|---|
| **Goal** | Clear rules for catalogue-only vs `CONTRACT_VERSION` bump. |
| **Why (P1.4)** | Closed unions on `kind` / `category` / relationship `kind` / `Evidence.source` protect modules but surprise authors who expect “YAML only.” Without a policy, agents will either break the contract silently or refuse valid catalogue work. |
| **Steps** | Document in solution root or Module guide: (a) catalogue-only changes; (b) additive optional fields (minor bump policy if any); (c) closed-union extensions = major or minor bump rule; (d) who updates STATUS. |
| **Acceptance** | Policy checked into `docs/solution/`; references `CONTRACT_VERSION` in `typed-facts.ts`. |
| **Out of scope** | Opening all unions immediately. |

---

#### T-M5 — Evidence.source / authority tiers (or document closed set)

| Field | Content |
|---|---|
| **Goal** | Either implement open/tiered `Evidence.source` as designed in v2 §6.1, or explicitly freeze the closed set with rationale. |
| **Why (P1.5)** | Multi-engine routing and interface precedence need a stable way to prefer native-route vs decorator vs query-pack evidence. Hardcoded booleans do not scale. |
| **Steps** | Prefer: extend `Evidence.source` (or parallel `authorityTier`) + generic “best evidence wins” in interface-builder. Or: document current closed union as intentional for Slice 2a and ticket Phase 2. |
| **Acceptance** | Either code path + test, or written freeze decision linked from STATUS with reopen trigger. |
| **Out of scope** | Implementing CodeQL. |

---

#### T-M6 — Prove additive contract change process (optional kinds)

| Field | Content |
|---|---|
| **Goal** | Demonstrate one controlled extension of `TypedUnit.kind` (e.g. document-only process, or one real kind if already needed). |
| **Why (P1.6)** | Messaging/batch (v0.11–v0.14) will need new kinds; the org should practice the bump process before a crisis. |
| **Steps** | If not shipping a new kind yet: dry-run doc “how we would add `topic`.” If shipping: add kind + node-type-mapping row + fixture + bump version per T-M4. |
| **Acceptance** | Written procedure exists; if code change, tests pass and `CONTRACT_VERSION` policy followed. |
| **Out of scope** | Full Kafka detection pipeline (Wave E). |

---

### P2 — Modularize upstream without a forced mega-interface

#### T-M7 — Analysis pass registry (replace closed recipe core)

| Field | Content |
|---|---|
| **Goal** | Orchestration runs an ordered list of named analysis passes instead of a single opaque function body for all analysis. |
| **Why (P2.7 / friction F1)** | `run-slice.ts` is the integration bus: every new composer, detector, or language step is a kernel edit. A pass registry is the highest-leverage modularity fix without inventing a fake unified Engine interface. |
| **Steps** | 1) Define `AnalysisPass { name, run(ctx) => void | partial facts }`. 2) Extract current steps: mapSignals, (optional) composeRoutes, detectPersistence, reconcile, confidence/ignore. 3) `run-slice` becomes: scan → runPasses → build TypedFacts → runModules. 4) Preserve order and behaviour of current pipeline (golden tests from Wave B). |
| **Acceptance** | New analysis step can be added by registering a pass (one registration site or config), not by inserting mid-function logic without a name. Existing fixtures/regression still pass. |
| **Out of scope** | Parallel pass execution; rewriting Scanner engines. |

---

#### T-M8 — Route-composer plugins (JAX-RS first citizen)

| Field | Content |
|---|---|
| **Goal** | Language/framework route composition is pluggable, not an inline special case forever. |
| **Why (P2.8 / friction F4)** | `composeJaxRsRoutes` in the main loop is correct for Java and the wrong extension model — the next non-native route stack will add another branch. |
| **Steps** | 1) Interface e.g. `RouteComposer { languages/frameworks, compose(decoratorFacts) }`. 2) Register JAX-RS composer. 3) Orchestration/pass invokes all matching composers. 4) Keep NestJS native-vs-decorator precedence behaviour. |
| **Acceptance** | JAX-RS composition no longer appears as ad-hoc logic outside a named plugin; Fineract-charge (or fixture) route counts unchanged. |
| **Out of scope** | CodeQL route packs. |

---

#### T-M9 — Persistence strategy catalogue + dispatcher

| Field | Content |
|---|---|
| **Goal** | Replace hardcoded `PERSISTENCE_LIBRARIES` + single Graphify shape with strategy rows. |
| **Why (P2.9 / friction F5)** | Java/Fidelity persistence is multi-shape (JPA entity, Spring Data repo, jOOQ, drivers). One BoA-shaped detector forces per-repo patches — the largest “not seamless” risk for enhancement. Overlaps Review **T-E1**; do the **catalogue + dispatcher structure** here even if not every strategy is proven. |
| **Steps** | 1) Add `rules/persistence-detection-catalogue.yml` (strategies: driver-import, jpa-entity already via decorators may stay in signal path, interface-extends stub, etc.). 2) `persistence-detector.ts` becomes a dispatcher. 3) Current SQLAlchemy/path becomes one strategy. 4) Document unverified strategies. |
| **Acceptance** | Adding a new driver library is a catalogue row for the driver-import strategy; BoA/Python path still works; STATUS marks which strategies are proven. |
| **Out of scope** | Full Waltz jOOQ proof (can remain T-E1); scip-java. |

---

#### T-M10 — Engine capability matrix (optional file + wire or stub)

| Field | Content |
|---|---|
| **Goal** | Single matrix for which engine runs for `{language, framework}`; docs and code agree. |
| **Why (P2.10)** | Without a matrix, “augment don’t replace” and Phase 1 vs Phase 2 stay prose-only; agents reintroduce CodeQL-as-primary contradictions. |
| **Steps** | 1) Create `pipeline/src/scanner/engine-capability-matrix.yml` with Phase 1 primaries (extractFromSource / native as appropriate; CodeQL/scip-java as phase2 only). 2) Either load matrix to skip/select work, or load-and-validate + log planned engines (stub integration OK if full routing is large). 3) Align solution docs (T-A2). |
| **Acceptance** | Matrix file exists; no doc claims CodeQL primary for near-term JAX-RS; run logs or code path reference matrix. |
| **Out of scope** | Implementing CodeQL/scip-java providers. |

---

### Wave M dependency sketch

```
T-C* (registry exists)
  → T-M1 (externalize list) + T-M2 (output dirs) + T-M3 (guide)     [P0]
  → T-M4 (policy) → T-M5 / T-M6                                    [P1]
  → T-M7 (pass registry) → T-M8 (composers) → T-M9 (persistence)   [P2]
  → T-M10 (matrix) can parallel T-M7 after T-A2
```

---

## Wave D — Enterprise / multi-domain (after pilot)

| ID | Goal | Acceptance (summary) |
|---|---|---|
| **T-D1** | Two-tier mapping-config `global/` + `domains/` (Review #5) | Config load merges tiers; domain cannot disable global integrity rules; CROSS_DOMAIN_UNRESOLVED still works. |
| **T-D2** | Architecture drift/diff story (Review #8) | Design + minimal artefact: compare two run outputs by unique-id; stale override detection named in apply pass. |
| **T-D3** | Run-failure monitoring (Review #9) | Design note + basic non-zero exit / log on scanner failure; no silent empty graph. |

---

## Wave E — Scale-out / full Fidelity claim (after 2a **and preferably after Wave M P2**)

**Ordering reason:** Expanding languages/engines *before* T-M7–T-M10 deepens the closed `run-slice` recipe (modularity assessment). Prefer Wave M P2 first; if business needs force early E work, at least complete T-M1–T-M3 so new modules stay clean.

| ID | Goal | Acceptance (summary) | Overlap |
|---|---|---|---|
| **T-E1** | Persistence strategies proven beyond driver-import | Spring Data and/or jOOQ strategy proven on Waltz/BoA | Builds on **T-M9** |
| **T-E2** | OpenAPI provider (Review #11) | Static file parse → interfaces/controls; fallback documented; real checked-in spec tested | New scanner provider — register as pass if T-M7 done |
| **T-E3** | k8s trust + decorators (Review #12) | shares-secret + deployment decorator sidecar | May need relationship kind + contract policy T-M4 |
| **T-E4** | Node DynamoDB + SQS catalogue (Review #13) | Catalogue rows; verified or labeled unverified | Catalogue-only if driver-import strategy exists (T-M9) |
| **T-E5** | Full-pipeline Fineract-scale timing (Review #14) | E2E wall time recorded (not Graphify-only) | — |
| **T-E6** | Phase 2 CodeQL/scip-java | Spike only if Phase 1 gap metrics fail; go/no-go report | Matrix **T-M10** must list them as phase2 only |

---

## Wave F — Explicitly defer (do not assign to Slice 2a / Wave M agents)

| ID | Item | Why deferred |
|---|---|---|
| **T-F1** | Full threat modeller / green analyser product depth | Second-module proof via T-C3 / threat-signals first; green can be a thin module after T-M1–T-M2 |
| **T-F2** | IR layer + LLM advisory | Optional UX; off critical path; do not put in module core path |
| **T-F3** | Companion UI / draw.io product | Backlog; not dual-goal core |
| **T-F4** | CALM governance product | Out of scope by design |
| **T-F5** | Scala/Spark language expansion | Evidenced gap; out of Slice 1/2 language scope |
| **T-F6** | Forced single polymorphic Engine interface | Explicitly anti-pattern per modularity assessment — do not implement |
| **T-F7** | Modules calling Scanner / mutating TypedFacts in place | Breaks determinism and Goal A contract |

---

## Wave G — Integration façade (P3, optional after M)

From modularity assessment §7 P3 — not required for modularity grade B, needed for product-grade embed.

| ID | Goal | Why | Acceptance (summary) |
|---|---|---|---|
| **T-G1** | Programmatic `runPipeline({ packageRoots, outDir, modules })` used by CLI | CLI-only blocks library embed | CLI is thin wrapper; same behaviour |
| **T-G2** | Graphify fail-vs-continue config for CI | Soft-continue hides incomplete graphs | Flag or env; CI can fail closed |
| **T-G3** | Artefact schema versions in provenance | Downstream governance systems need pin | provenance.json includes contractVersion + catalogue version |

---

## Suggested agent prompts (copy-paste)

### Agent 1 — Doc cleanup only
```
You are cleaning solution design docs in this repo. Read:
- docs/spikes/Solution_Design_v2_Critical_Review.md
- docs/solution/AGENT_TASKS_Solution_Cleanup_and_Prioritized_Actions.md

Execute Wave A tasks T-A0 through T-A7 in order.
Do not implement product features. Do not merge the two solution docs into one file;
use platform root + language/java annex as specified.
Reconcile engine matrices to Phase 1 extractFromSource-first (CodeQL/scip-java Phase 2 only).
Add/fix implementation status so it matches pipeline/src/.
When done, summarize diffs and remaining open checklist items.
```

### Agent 2 — Slice 2a engineering
```
You are implementing Slice 2a only. Read docs/solution/AGENT_TASKS_*.md Wave B.
Prereq: Wave A done (or status matrix already accurate).
Implement T-B1–T-B4: Slice 2a exit criteria, multi-language regression floor,
service→service connects golden test, portable calm validate for controls.
Do not start CodeQL, scip-java, k8s, OpenAPI, IR, or LLM advisory.
Verify with real pipeline runs where fixtures/repos exist.
```

### Agent 3 — Platform thin track (verify / gap-fill Wave C)
```
Read docs/solution/AGENT_TASKS_*.md Wave C and pipeline/src/modules/.
Verify T-C1–T-C3 acceptance against code (contractVersion, registry, second module).
Implement only what is missing. Do not build full threat/green products.
Do not implement Wave M unless asked. Update STATUS when done.
```

### Agent 4 — Modularity P0 (seamless modules)
```
Read docs/solution/Modularity_and_Integration_Assessment.md §7 P0 and
docs/solution/AGENT_TASKS_*.md Wave M tasks T-M1, T-M2, T-M3.
Implement config/CLI module list, namespaced module outputs, and Module_Authoring_Guide.
Preserve default run behaviour (calm-generator + threat-signals).
Do not implement analysis pass registry or CodeQL. Do not put CALM types into TypedFacts.
```

### Agent 5 — Modularity P1 (contract evolution)
```
Read AGENT_TASKS Wave M T-M4–T-M6 and typed-facts.ts.
Deliver contract evolution policy; resolve Evidence.source/tiers (implement or freeze);
document or prove additive kind-change process. Minimal code unless policy requires it.
```

### Agent 6 — Modularity P2 (upstream plugins)
```
Read AGENT_TASKS Wave M T-M7–T-M10 and Modularity assessment friction F1/F4/F5.
Prereq: Wave B regressions exist or add minimal safety nets.
Implement analysis pass registry, JAX-RS route-composer plugin, persistence strategy
catalogue+dispatcher, engine-capability-matrix (Phase 1 primary; CodeQL phase2 only).
Do not force a single Engine interface. Preserve golden counts. No full CodeQL provider.
```

---

## Tracking checklist (for humans)

**Docs / review**
- [ ] T-A0 decision confirmed
- [ ] T-A1 restructure
- [ ] T-A2 engine matrix reconciled
- [ ] T-A3 status matrix
- [ ] T-A4 Java risk/claims
- [ ] T-A5 Slice 2a/b/c
- [ ] T-A6 polish
- [ ] T-A7 IR/LLM demoted

**Slice 2a / Goal A baseline**
- [ ] T-B1–B4 Slice 2a gates
- [ ] T-C1–C3 platform thin track (verify; often already done)

**Modularity (P0–P2)**
- [ ] T-M1 externalize module list
- [ ] T-M2 namespace module outputs
- [ ] T-M3 module authoring guide
- [ ] T-M4 contract evolution policy
- [ ] T-M5 Evidence.source / tiers
- [ ] T-M6 additive kind process
- [ ] T-M7 analysis pass registry
- [ ] T-M8 route-composer plugins
- [ ] T-M9 persistence strategy catalogue
- [ ] T-M10 engine capability matrix

**Later**
- [ ] Wave D / E / G as needed
- [ ] Wave F remains deferred
