# Platform Architecture Analysis — What This Actually Is, As a Piece of Software

**Why this document exists:** every prior design document analyzes this system's *domain logic* (how signals become CALM constructs). None analyze it as *software* — its architectural style, runtime topology, technology stack, and quality attributes. That's a real gap, correctly flagged: naming a platform well requires first being precise about what it actually is. This is that analysis, grounded in the real `pipeline/src/` codebase (1,927 lines of TypeScript, 24 files) as it exists after this session's fixes, not the aspirational version in the design docs.

---

## 0. Naming Proposal

**Recommendation (locked): `Weaver`.**

The dominant real mechanism in this system — proven, not aspirational — is taking many independent, low-level threads of evidence (a route annotation here, a persistence import there, an RBAC decorator somewhere else) and **weaving** them, via a fixed set of catalogues, into one coherent fabric (`architecture.calm.json`). That's a precise metaphor, not a decorative one: `signal-catalogue.yml` + construct-mapping catalogues are the fixed structure; each new framework/language is a thread pulled through without rebuilding the machine. Earlier working name “Loom” described the same idea; **product name is Weaver** (see root `README.md` and `Capabilities.md`).

**Runners-up, with honest tradeoffs:**

| Name | Rationale | Why it's not the top pick |
|---|---|---|
| **Cartograph** | Cartography (mapping) + graph (the literal underlying tech — CodeGraph, Graphify). Very on-the-nose functional. | Reads as "yet another graph tool" — undersells that CALM output is a governed, catalogue-validated artefact, not just a graph dump. |
| **Strata** | The system is genuinely layered (Scanner → Rules → Analysis → Orchestration → Modules) and CALM architectures are conventionally drawn in layers. | Doesn't capture the catalogue-driven extensibility, which is this system's actual differentiator over "yet another code-to-diagram tool." |
| **Codex** | Evokes a governed rulebook (the catalogues) that architecture is checked against. | Overloaded in the industry (OpenAI Codex) — real naming-collision risk. |

`Weaver` is short and — practically — reads well as a CLI binary name (`weaver scan <root> --out <dir>`, when the bin is renamed) and a module-framework noun ("a Weaver module," matching Goal A's plugin story). **Locked as the product name** (2026-08).

---

## 1. Architectural Style Classification

This is a **pipeline (pipes-and-filters) architecture with a catalogue-driven strategy layer**, not a service, not an event-driven system, not a monolith in the pejorative sense. Concretely:

- **Pipes-and-filters**: Scanner → Rules → Analysis → Construction is a strict, one-directional data transformation chain. Each stage consumes the previous stage's output and produces a new, more refined artefact (raw source → `Evidence[]` → `TypedFacts` → `CalmDocument`). No stage reaches backward into an earlier one — confirmed architecturally by the override mechanism's own design constraint (§5.4 of Solution Design v2: overrides apply *after* construction, never feeding back into `typed-facts.json`).
- **Strategy pattern via external configuration**, not inheritance or polymorphism in code: `signal-catalogue.yml`, `node-type-mapping.yml`, `relationship-type-mapping.yml`, `control-requirement-catalogue.yml` are the actual extension points. This is why the "new framework = catalogue row" claim held up under real Java testing this session — it's not a design aspiration, it's what the code structurally does (`findRule`/`findNodeTypeMapping`/`findRelationshipTypeMapping`/`findControlRequirement` are the only four functions any new signal type has to be found by).
- **Not (yet) a plugin architecture**, despite Goal A's stated ambition. `run-slice.ts` hardcodes exactly one consumer of `typed-facts.json` (`writeArtefacts` → `buildCalm`). The module registry / `contractVersion` boundary that would make this a real plugin architecture is specified, not built — this is the single most consequential gap between the stated architectural style and the real one.

**Anti-pattern check, since this project holds itself to that discipline elsewhere**: this is *not* a big-ball-of-mud despite being one process — the isolation between builders (`node-builder.ts`, `interface-builder.ts`, `relationship-builder.ts`, `metadata-builder.ts`, `control-builder.ts`, each independently testable and independently touched this session without breaking the others) is real, evidenced by six real bugs this session each requiring a change to exactly one file.

---

## 2. Component / Module View

```
┌─────────────────────────────────────────────────────────────────┐
│ scanner/          — engine adapters, no shared interface (§3.2   │
│                      of Solution Design v2 — a considered choice) │
│   codegraph-provider.ts   — CodeGraph (native npm module,        │
│                              per-package SQLite cache in .codegraph/)│
│   graphify-provider.ts    — Graphify (external Python subprocess,│
│                              GraphifyRun: one combined extraction) │
│   detect-gate-smoketest.ts│
├─────────────────────────────────────────────────────────────────┤
│ rules/            — the extension surface. FOUR catalogues,       │
│                      four loader/matcher pairs, no code changes   │
│                      needed to add a signal.                      │
│   signal-catalogue.yml + rule-schema.ts                          │
│   node-type-mapping.yml + relationship-type-mapping.yml +        │
│     control-requirement-catalogue.yml + construct-mapping-schema.ts│
│   suggest-rules.ts  — OFFLINE ONLY, LLM-assisted catalogue        │
│                        authoring, never imported by run-slice.ts  │
├─────────────────────────────────────────────────────────────────┤
│ analysis/         — raw signals -> TypedFacts                     │
│   signal-mapper.ts, confidence-scorer.ts, ignored-items.ts,      │
│   jaxrs-route-composer.ts,                                        │
│   cross_package/{graphify-reconciler,persistence-detector}.ts    │
├─────────────────────────────────────────────────────────────────┤
│ modules/calm-generator/  — the ONE real module (Goal A's proof    │
│                             point, not yet generalized to a       │
│                             registry)                              │
│   build-calm.ts (thin orchestrator) ->                           │
│     node-builder / interface-builder / relationship-builder /    │
│     metadata-builder / control-builder (5 of 6 spec'd builders)  │
│   override-applier.ts  — Decision Record/Override apply pass      │
│   write-artefacts.ts   — filesystem sink                          │
├─────────────────────────────────────────────────────────────────┤
│ orchestration/    — run-slice.ts, the ONLY entrypoint, CLI-only   │
├─────────────────────────────────────────────────────────────────┤
│ types/            — the module contract: typed-facts.ts, calm.ts, │
│                      overrides.ts                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Coupling analysis**: the only hard dependency `modules/` has on `scanner/` is through `types/typed-facts.ts` — verified structurally, not just claimed, since `control-builder.ts`/`relationship-builder.ts` etc. import only from `../../types/*` and `../../rules/*`, never from `../../scanner/*`. This is the real evidence for "the contract holds," not an assertion.

---

## 3. Runtime / Process View

**This is a CLI tool, not a service — worth being precise about, since it changes every downstream quality-attribute conclusion.**

- **Single Node.js process**, invoked synchronously, terminates on completion. No daemon, no listener, no persistent server.
- **One external subprocess per run**: `graphify extract` (Python), invoked via `execFileSync` — a **blocking, synchronous** call. The whole pipeline stalls on Graphify's completion; there's no concurrency between the CodeGraph pass and the Graphify pass (confirmed: `run-slice.ts`'s `for` loop over package roots completes entirely before the single `runGraphifyPass` call begins).
- **CodeGraph is invoked in-process** (native npm module, not a subprocess) — a real architectural asymmetry from Graphify worth naming: one engine is a library call, the other is a subprocess call, with different failure/error-surface characteristics (CodeGraph errors are JS exceptions; Graphify errors are subprocess exit codes wrapped in a try/catch that degrades gracefully, per `run-slice.ts`'s `catch` block).
- **Two different persistence models for the two engines**: CodeGraph maintains a **persistent, incremental-capable local cache** (`.codegraph/` SQLite per package root — confirmed present after every run this session). Graphify's output is written to an **ephemeral temp directory, deleted at the end of every run** (`fs.mkdtempSync`/`fs.rmSync` in `graphify-provider.ts`) — meaning Graphify does a full re-extraction every single run, with zero incremental benefit, even though CodeGraph's own caching infrastructure is sitting right next to it unused for this purpose. **This is a real, concrete, previously-unnamed optimization opportunity**: nothing about Graphify's own incremental story is being exploited, and the temp-dir-then-delete pattern actively prevents ever building one.

---

## 4. Data Flow

```
source repo (git checkout, read-only)
   │
   ▼
CodeGraph (in-process) ──► native routes + decorator facts (per file)
   │
   ▼
signal-catalogue.yml lookup ──► Evidence[] (category/weight-tagged)
   │
   ▼
TypedUnit[] (confidence-scored, floor-filtered at 40)
   │
   ├──► Graphify (subprocess, ONE combined pass across all roots) ──► persistence units + relationships
   │
   ▼
TypedFacts (the versioned contract — runVersion set, contractVersion NOT yet added despite being specified)
   │
   ▼
5 builders (node/interface/relationship/metadata/control) ──► CalmDocument
   │
   ├──► Override-apply pass (if --overrides given) ──► patched CalmDocument
   │
   ▼
architecture.calm.json + ignored-items-report.json + provenance.json +
typed-facts.json + overrides-applied-report.json (all written to <outDir>, filesystem only)
```

**Nothing in this flow crosses a network boundary** — confirmed architecturally (no `fetch`/`http` imports anywhere in `pipeline/src/`, no API keys required for the core path). The only external process boundary is the Graphify subprocess, and it runs `--code-only`, confirmed clean of network calls in the original tool comparison spike.

---

## 5. Deployment View — **STALE as written, corrected 2026-08-09 (T-PC3-1)**

> **This section is a point-in-time snapshot from an earlier session** (the codebase was 24 files / 1,927 lines when it was written — it has grown substantially since). Left below as the historical record it was, per this project's own "correct with a dated note, don't silently rewrite history" convention (`Claim_Register.md`'s changelog does the same). **The real, current state, as of 2026-08-09**:
>
> - **`pipeline/Dockerfile` exists and now has a real, verified build**, not just a written-but-unexecuted file: [`docker-build` CI job](https://github.com/gowrishankar005/cc/actions/runs/31306304051), `docker build` succeeded, a smoke test confirmed the built image contains a real runnable `dist/` (AGENT TASKS Phase1 Close's T-PC2-1/T-PC2-2).
> - **`.github/workflows/pipeline-test.yml` exists and has been running successfully on every push to `dev` for 10+ consecutive real runs** (confirmed via `gh run list`, not assumed) — this was true of the real repo even while this document still said "no CI configuration"; the original claim was accurate about *this analysis's own point-in-time snapshot*, not about the repo's current state.
> - **A real automated regression suite exists** (`pipeline/test/regression.test.js`, 65 tests as of 2026-08-09) — the "no automated test suite at all" finding in §7/§8 below is also stale; see the Architectural Risk Register correction at the end of §8.
> - `package.json`'s `bin` field **has been verified working** (`npm pack` → install into an isolated prefix → the installed CLI ran end-to-end) — see `CLAUDE.md`'s "Deployment/packaging story exists now" entry for the full real finding, including one real packaging bug found and fixed (`files` field missing, tarball shipped 105 files instead of 61).
>
> The one honest limitation that's still real: none of this has been verified against a **local** Docker daemon (this development sandbox has never had one, in any session) — real CI verification is the only verification that exists, which is a legitimate, sufficient bar for "does this Dockerfile actually build," not a residual gap.

There is currently **no deployment story at all**. This is worth stating plainly rather than leaving implicit:

- No containerization (no `Dockerfile` anywhere in `pipeline/`).
- No CI configuration (no `.github/workflows/`, no equivalent).
- `package.json` declares a `bin` field (`run-slice`), which *would* make this installable as a global CLI via `npm install -g` or `npm link` — but this has never been tested in this session or, as far as the codebase shows, ever.
- Every run this session has been invoked as `node dist/orchestration/run-slice.js` from inside the `pipeline/` directory — a developer-machine invocation pattern, not a packaged tool's.

**For a platform whose Goal A is "modules other teams build against," this is a real gap**, distinct from the Java/persistence-strategy gaps already tracked — nobody outside this exact checkout can currently run this tool at all.

---

## 6. Technology Stack — choices and their real risk profile

| Layer | Technology | Why (real reason, not aspirational) | Risk |
|---|---|---|---|
| Orchestration/construction | TypeScript, Node.js, `commonjs`, ES2022 target | Matches CodeGraph's own npm-native distribution; `strict: true` in `tsconfig.json` (confirmed) — real type safety, not just convention | Low — mature, well-understood |
| Structural extraction (primary) | `@colbymchenry/codegraph` npm package (native module) | Fast (Rust-backed per earlier spikes), rich native typing for Spring/Flask/FastAPI/NestJS | **Single-vendor dependency, no fallback in code today** — Graphify is the documented fallback but nothing currently auto-switches; a breaking CodeGraph release would silently break the pipeline until manually caught (mitigated only by version-pinning discipline, not by code) |
| Cross-package backbone | `graphify` CLI (external Python package, subprocess) | Only tool with a real bulk-export contract and no per-root `detect()` gate | **Two real, newly-found risks this session**: (1) it evolved from a narrow extraction tool into a much larger multi-command "AI coding assistant skill" product (v0.9.34) — the one flag combination this pipeline uses (`extract --code-only --no-cluster`) still works, but the vendor's own product direction has visibly shifted, worth monitoring; (2) confirmed data-quality inconsistency at wide scan scope (dangling edge-target ids, §CLAUDE.md) |
| Schema validation | `@finos/calm-cli` (npm devDependency) | The authoritative external validator — never reimplemented in-house, correctly | Low — this is exactly the "produce output for external validators" boundary the design intends |
| Catalogue format | YAML (`yaml` npm package) | Human-editable, matches this project's own "architects should be able to read/edit the rules" goal | Low |
| Rule authoring assist | Offline LLM (`suggest-rules.ts`, model-agnostic per env var) | Explicitly outside the run path — architecturally enforced, not policy-enforced | Low, by design |

---

## 7. Quality Attribute Analysis (ISO 25010-style, each grounded in this session's real evidence)

| Attribute | Real evidence | Verdict |
|---|---|---|
| **Functional suitability** | 5/6 builders real; routes/persistence/controls/cross-package all verified against real the reference Java/JAX-RS banking platform+the reference Python app+NestJS; `calm validate` 0 errors across every regression case | **Strong for what's built** — narrow relative to full a large financial-services organization-stack scope (Spring Data/jOOQ/messaging still absent) |
| **Performance efficiency** | Measured, not assumed: 823-file CodeGraph pass ~10s; full 6,781-file Graphify pass ~96s. No benchmark yet for the full pipeline (CodeGraph + Graphify + construction) at that combined scale | **Promising, incompletely measured** |
| **Compatibility** | Zero network calls, filesystem-only I/O, no assumed OS beyond Node/Python availability | **Good** |
| **Reliability/availability** | Graphify failures degrade gracefully (`try/catch`, continues without cross-package data) — real, tested pattern. **STALE, corrected 2026-08-09**: the "no automated test suite at all" finding here was accurate for this document's own point-in-time snapshot, not the current repo — `pipeline/test/regression.test.js` (65 tests) runs in real CI on every push, see §5's correction note. **No retry logic anywhere** is still real and unaddressed. | **Was a real gap, now closed for the test-suite half** — a future change breaking the reference Python app/NestJS/the reference Java/JAX-RS banking platform's known-good output is now caught by CI, not just informal manual comparison |
| **Security** | No secrets handled, no network egress in the core path, LLM advisory layer (when built) explicitly bounded and off by default | **Good, by architectural constraint** |
| **Maintainability** | Real evidence this session: 6 bugs found, each fixed in one file, none required cross-cutting rework. Builder isolation genuinely holds | **Strong** |
| **Extensibility** | Catalogue-driven claim proven under real Java testing (not just Python/Node) this session | **Strong, for the catalogue-driven path.** Module-level extensibility (Goal A) unproven — no second module exists |
| **Testability** | **STALE, corrected 2026-08-09** — accurate for this document's own point-in-time snapshot, not current. `pipeline/test/regression.test.js` (65 tests, real CI-gated) exists now. | **Was weak, now real and CI-gated** — see §5's correction note |
| **Portability** | **STALE, corrected 2026-08-09** — `npm pack` install verified working outside this checkout in an isolated prefix; `Dockerfile` now has a real verified CI build. See §5's correction note. | **Was unknown, now verified via CI + a real isolated-install test** |
| **Observability** | `console.log` only, no structured logs, no metrics, no run history beyond the artefacts of the single most recent run | **Weak** |

---

## 8. Architectural Risk Register

| Risk | Severity | Real, not hypothetical |
|---|---|---|
| ~~No automated test suite~~ **CLOSED, 2026-08-09** | ~~High~~ | Stale — was accurate when written (24-file/1,927-line snapshot), not current. `pipeline/test/regression.test.js` is real, 65 tests, gated by real CI (`.github/workflows/pipeline-test.yml`) on every push. See §5's correction note above. |
| ~~No deployment/packaging story~~ **CLOSED, 2026-08-09** | ~~Medium~~ | Stale — `bin` field verified working (real `npm pack` install test), `Dockerfile` now has a real verified CI build + smoke test. See §5's correction note above. |
| Graphify's ephemeral-output pattern forgoes incremental extraction | **Medium** | Confirmed — CodeGraph's own caching infrastructure sits unused as a model for this; full re-extraction every run at any real repo's scale is a standing, avoidable cost |
| CodeGraph single-vendor coupling, no automatic fallback | **Medium** | Documented since the original tool comparison; still true, still only a *documented* fallback, not a *coded* one |
| Graphify's product-direction drift (narrow tool → broad "AI assistant skill" platform) | **Low-Medium, newly observed** | The one flag combination used still works, but a vendor moving this fast warrants a periodic re-check, not a one-time verification |
| No observability/run-history | **Low-Medium** | Fine for a CLI used interactively; would need addressing before any Goal-A-style shared/scheduled usage |

---

## 9. What This Analysis Changes About "Locked"

The prior lock (Solution Design v2, this session) covered the *construction* architecture — catalogues, builders, override mechanism. This analysis adds two things that were genuinely absent from that lock and shouldn't be assumed settled just because the construction logic is:

1. **Testability is the highest-leverage next investment, ahead of new features.** Every real bug this session was caught by hand; formalizing the reference Python app/NestJS/the reference Java/JAX-RS banking platform regression checks into an actual `npm test` (even a simple one) converts a fragile ritual into a real safety net — cheap, and the single most consequential gap this analysis found.
2. **Deployment/packaging is a real precondition for Goal A**, not a later polish item — a platform other teams build modules against has to be runnable by those teams first.

---

## Sources

`pipeline/package.json`, `pipeline/tsconfig.json`, full `pipeline/src/` file tree (read directly this session), `docs/solution/Architecture_as_Code_Solution_Design_v2.md`, `CLAUDE.md`'s pipeline-architecture section (this session's real findings), direct observation of `.codegraph/` cache persistence and Graphify's temp-dir lifecycle during this session's test runs.
