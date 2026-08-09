# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

**Weaver** is a deterministic Architecture-as-Code (AaC) pipeline that extracts structure from a real, polyglot (Java + Python + Node/TypeScript) monorepo and generates [FINOS CALM](https://calm.finos.org) 1.2 JSON. There is explicitly **no LLM in the core generation path** — this is enforced architecturally, not just stated (see "Pipeline architecture" below).

For scope, see [`docs/Requirements.md`](docs/Requirements.md). For what's built vs. backlog, see [`docs/solution/Capabilities.md`](docs/solution/Capabilities.md). For the current solution design, see [`docs/solution/Architecture_as_Code_Solution_Design_v2.md`](docs/solution/Architecture_as_Code_Solution_Design_v2.md) (platform) and [`docs/solution/language/java.md`](docs/solution/language/java.md) (Java specifics).

## Working principles

**1. Think Before Coding — don't assume, verify against the real tool/schema/repo.** "Specified" and "true" are different claims. Before asserting a design or dependency assumption holds, verify it — a schema-shaped claim can be falsified the moment the real validator runs against it; a "not installed" claim can be stale the moment someone actually checks again. When a genuine decision point has more than one defensible answer and only the user can pick it (build-environment assumptions, scope tradeoffs, which of several correct designs to build), ask rather than picking silently.

**2. Simplicity First — minimum code that solves the problem, nothing speculative.** The construct-mapping catalogues (`node-type-mapping.yml`, `relationship-type-mapping.yml`, `control-requirement-catalogue.yml`, and the persistence/messaging/http-client detection catalogues) exist so builders stay thin and new capability is a data row, not new code. If a new signal needs more than a catalogue row plus one of the already-proven extraction mechanisms (native framework typing, decorator/annotation extraction, import detection, structured-file ingestion), stop and confirm it's actually in scope before inventing a new mechanism.

**3. Surgical Changes — touch only what you must, clean up only your own mess.** Every builder (`node-builder.ts`, `interface-builder.ts`, `relationship-builder.ts`, `metadata-builder.ts`, `control-builder.ts`, `port-interface-builder.ts`) is isolated on purpose — fixing one should never require touching another. Remove only what your own change makes unused; leave pre-existing gaps named, not silently patched over.

**4. Goal-Driven Execution — define success criteria, loop until verified.** Every change should be framed as "does the regression suite still produce the same counts, does `calm validate` return 0 errors, does the output match grep-verified ground truth" — never "does this code look right." State the verify step before making a non-trivial change, not after.

## Repository layout

```
pipeline/       Node.js/TypeScript source — the real, running product
docs/           Requirements, current solution design, capabilities, backlog
coe-lab/        Evaluation lab: fixtures, gold architecture, scoring harness (see isolation note below)
tools/          Standalone tooling (e.g. the residual-review session helper)
.github/        CI workflows and chat-mode configuration
```

## CoE Lab isolation (evaluation benchmark)

**`coe-lab/`** is a controlled fintech-shaped **benchmark suite** (fixtures + gold architecture + scorer). It is **not** evidence for designing catalogues while implementing the platform.

| Path | Platform implementation agents | Evaluation agents |
|---|---|---|
| `coe-lab/fixtures/` | Prefer **not** (use `pipeline/test` fixtures) | Yes — run `run-slice` here |
| `coe-lab/gold/packages/*.json` | **DO NOT READ** | Yes — semantic scoring only |
| `coe-lab/gold/calm/**` | **DO NOT READ** | Yes — full CALM snapshot compare only |
| `coe-lab/generated/` | No | Yes — platform output under test |
| `coe-lab/scripts/` | No | Yes |

See `coe-lab/ISOLATION.md`. Gold paths are also listed in `.cursorignore` / `.grokignore`.

## Build and run

```bash
cd pipeline && npm install && npm run build
node dist/orchestration/run-slice.js <package-root> [<package-root> ...] --out <dir>
npm run validate -- <dir>/architecture.calm.json -f pretty   # FINOS calm-cli schema validation
npm test                                                      # full regression suite
```

## Pipeline architecture

Four layers: Scanner → Rules → Analysis → Orchestration → Modules, with `typed-facts.json` (`pipeline/src/types/typed-facts.ts`) as the fixed, versioned contract between Analysis and any downstream module. `calm-generator` and `threat-signals` are the two built modules.

**Dual-engine scanner** — each tool doing what it's verified good at:
- **CodeGraph** (`scanner/codegraph-provider.ts`) — per-package indexing; native `route` typing where its resolver covers the framework, plus `extractFromSource()`-based decorator/annotation facts for frameworks it doesn't natively type (e.g. JAX-RS, JPA).
- **Graphify** (`scanner/graphify-provider.ts`) — one combined pass across all package roots given to a run, used as the cross-package structural backbone. A single combined extraction (not one pass per root) is required for cross-package edges to be possible at all — Graphify has no per-root gate, so it captures cross-root edges natively once invoked this way.
- Both are real dependencies, not optional. `analysis/cross_package/persistence-detector.ts` uses Graphify's raw import/contains edges to recover persistence signal CodeGraph's native typing misses entirely (e.g. bare ORM usage with no framework-native route).
- A fourth structured-file-provider pattern (`k8s-manifest-provider.ts`, `openapi-provider.ts`, `spring-config-provider.ts`, `cdxgen-provider.ts`) reads deterministic, non-code evidence sources (Kubernetes manifests, OpenAPI specs, Spring configuration files, dependency manifests via an external SBOM tool) the two structural engines can't reach.

**Catalogue-driven CALM construction** — `build-calm.ts` reads `node-type-mapping.yml` and `relationship-type-mapping.yml` to construct CALM nodes/relationships instead of hardcoding type-casts; a control catalogue (`control-requirement-catalogue.yml`) and `control-builder.ts` attach evidence-backed `controls` to nodes. Relationship shapes (`connects`/`interacts`/`deployed-in`/`composed-of`) map to the real, distinct CALM 1.2 schema shapes, not a single generic edge type.

**Hybrid rule layer — LLM-assisted rule authoring, never rule application.** `rules/signal-catalogue.yml` is the versioned, human-owned rule table the deterministic pipeline reads. `rules/suggest-rules.ts` is a separate, offline, explicitly-invoked CLI — never imported by the run path — that can call an LLM to propose new catalogue entries from previously-unmapped signals. It only ever writes a draft file; a human promotes entries into the real catalogue. This is how "no LLM in the core generation path" and "an LLM can help author detection rules" both hold at once.

**Decision Record / Override mechanism** — a human (or the residual-review tooling under `tools/review-session/`) can correct an ambiguous or wrong classification after a scan, via a Decision Record + Override pair applied as a final pass strictly after the deterministic builders. This never changes what Analysis concluded, so determinism is preserved; every Override must reference an active Decision Record.

**Vendor isolation** — `scanner/structural-engine.ts` defines a neutral `StructuralEngine` interface; only `codegraph-provider.ts` imports the CodeGraph SDK directly, so a future alternate engine is a second implementation swapped in at one call site, not a change to every consumer.

**Module registry** — `TypedFacts` carries a `contractVersion`; `modules/registry.ts` skips a module that declares an incompatible major version and isolates a throwing module rather than crashing the whole run. Module outputs are namespaced under `outDir/modules/<name>/`.

## Known, disclosed limitations

- Kubernetes-manifest-derived `deployed-in` relationships (runtime placement) are not yet built; shared-Secret trust relationships (via the k8s manifest provider) are.
- Persistence detection genericity is partial — bare ORM-entity and driver-import strategies are dispatched; a few less common persistence shapes remain plain-import-only.
- The formal (`interface-definition`) CALM construct is largely unused by the generator; most output uses the informal interface convention.
- No third-party plugin discovery or embed API exists yet — the module registry and contract-versioning that would support it are built.
- Generated `architecture.calm.json` references control `requirement-url`s as placeholder identifiers that are not independently resolvable outside this repo — `npm run validate` resolves them locally via a generated `-u` mapping file; an external consumer receiving only the JSON artefact needs its own mapping or a copy of `pipeline/src/rules/control-requirements/`.
- See [`docs/solution/OOS_Registry.md`](docs/solution/OOS_Registry.md) for permanent (not just current) non-goals, each with a reason and a revisit trigger.

## Working in this repo

- `npm test` (from `pipeline/`) is the real regression suite — exact-value assertions against checked-in fixtures, not smoke tests. Some tests reference sample repos that are only present locally for manual testing (see `.gitignore`'s `spikes/` entry) and skip gracefully when absent.
- New detection coverage should be a catalogue row plus one of the four proven extraction mechanisms, per the Simplicity First principle above — see [`docs/solution/Catalogue_Intake.md`](docs/solution/Catalogue_Intake.md) for the intake process (evidence + test + backlog entry required).
- Before claiming a fix or a new detection works, run it against a real fixture and check the actual output — don't infer correctness from reading the code.
