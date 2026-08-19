# Weaver

**Weaver** is a deterministic Architecture-as-Code platform: it extracts software architecture signals from source (Java, Python, Node/TypeScript) and generates [FINOS CALM](https://calm.finos.org) 1.2 JSON — for review, governance input, and evaluation against hand-authored gold architecture.

**Product target:** polyglot enterprise monorepos — not any single application. Public repositories and lab fixtures are evidence samples used to prove or disprove detection mechanisms, not the product itself.

**No LLM in the core generation path.** An optional, offline tool may propose new detection-catalogue entries for human review; nothing in the generation path itself calls an LLM.

| | |
|---|---|
| **Primary code** | [`pipeline/`](./pipeline/) |
| **What's built vs. backlog** | [`docs/solution/Capabilities.md`](./docs/solution/Capabilities.md) |
| **Backlog** | [`docs/solution/BACKLOG.md`](./docs/solution/BACKLOG.md) |
| **What claims are allowed** | [`docs/solution/Claim_Register.md`](./docs/solution/Claim_Register.md) |
| **Solution design** | [`docs/solution/Architecture_as_Code_Solution_Design_v2.md`](./docs/solution/Architecture_as_Code_Solution_Design_v2.md) |
| **Evaluation harness** | [`coe-lab/`](./coe-lab/) |

---

## What this project is (and is not)

**Is:**
- A catalogue-driven analyser/orchestrator: scan → typed facts → modules (calm-generator, threat-signals, resilience-lens).
- A generator of schema-valid CALM (`calm validate` clean) with provenance and confidence metadata on every claim.
- An evaluation harness (`coe-lab/`) with hand-authored gold architecture — never bootstrapped from the generator's own output.
- Evidence-driven: real public repositories and controlled fixtures test the platform's mechanisms; they are not the product roadmap.

**Is not:**
- A product built for any one specific codebase — public repositories are proxies used to prove or falsify a generic mechanism, never a name-keyed special case.
- A CALM governance product (pattern authoring, organizational policy engines) — it produces artefacts that external governance tooling (`calm validate -p`) can consume.
- An LLM architecture generator — see "No LLM in the core generation path" above.
- A guarantee of a complete architecture graph for every codebase shape — see [Known limitations](#known-limitations).

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│  run-slice (orchestration)                                       │
│    package roots → scan → analysis passes → typed facts          │
│    → module registry → calm-generator / threat-signals /         │
│      resilience-lens                                             │
└─────────────────────────────────────────────────────────────────┘
         │                         │
         ▼                         ▼
  Scanner adapters           Rules / catalogues (YAML)
  • CodeGraph (routes,       • signal catalogue
    decorators)              • node / relationship / control maps
  • Graphify (structural     • persistence / messaging / HTTP-client
    backbone, cross-root)      detection catalogues
  • OpenAPI, k8s manifests,  • scope-limitations
    Spring config, SBOM
         │
         ▼
  typed-facts.json  ──►  architecture.calm.json (+ IR, coverage, unmapped)
                              calm validate -u control-url-mapping.json
```

**Fixed contract:** `TypedFacts` (versioned via `contractVersion`) is the boundary between Analysis and Modules — modules never reach back into scanner internals.

**Design rule:** new detection capability is a catalogue row plus one of the four proven extraction mechanisms (native framework typing, decorator/annotation extraction, import detection, structured-file ingestion) — not a special case in the CALM builder.

---

## Language and framework support

Scope is intentionally Java + Python + TypeScript/Node for enterprise service architectures. Support is catalogue- and evidence-based, not "every framework in the language."

| Language | Routes | Persistence | Security controls | Messaging |
|---|---|---|---|---|
| **Python** | Flask (built) | Import-based (SQLAlchemy-style) | Call-site auth not yet attached as controls | — |
| **TypeScript/Node** | NestJS, native + decorator (built) | Import-based (Prisma/TypeORM/Mongoose-class) | — | Cloud-native (SQS/SNS) producer detection built |
| **Java** | JAX-RS composed routes, Spring MVC (built); | JPA `@Entity` (built); Spring Data/jOOQ (backlog) | Spring `@PreAuthorize` decorator (built); call-site auth (backlog) | Kafka/JMS consumers (built); producers partial |

**Cross-cutting, all languages:** Kubernetes shared-secret trust relationships, OpenAPI/Swagger route + security-scheme ingestion, dependency-manifest corroboration via an external SBOM tool. Spring-specific: deterministic `application.yml`/`.properties` config reading (datasource, broker, cache, port).

**Explicitly out of scope, near-term:** languages outside Java/Python/TypeScript-Node; frontend/SPA architecture; build-dependent structural engines as a default (researched, not adopted); a CALM pattern-governance product; guaranteed-complete architecture graphs for arbitrarily deep multi-module systems.

Authoritative detail: [`docs/solution/Claim_Register.md`](./docs/solution/Claim_Register.md) (what may be claimed) and [`pipeline/src/scanner/engine-capability-matrix.yml`](./pipeline/src/scanner/engine-capability-matrix.yml) (engine routing).

---

## Features

**Scanning & analysis** — hybrid dual-engine scanning (per-package native typing + a combined cross-package structural pass); JAX-RS/Spring MVC/Flask/NestJS route composition; JPA/import-based persistence detection; messaging consumer/producer detection; outbound-HTTP client detection; OpenAPI ingestion; Spring configuration file reading; dependency-manifest (SBOM) corroboration; multi-hop bridge resolution across layered access classes; Kubernetes shared-secret trust relationships and manifest-vs-config contradiction detection; CloudFormation/SAM API-Gateway-to-Lambda route binding; an opt-in CodeQL DI-resolution engine for Spring wiring shapes neither structural engine can see; completeness/silence metrics that flag when a result looks empty because nothing was checked vs. genuinely checked-and-clean. See [What runs by default vs. what needs a flag](#what-runs-by-default-vs-what-needs-a-flag) for which of these are always-on.

**CALM generation** — catalogue-driven builders (nodes, interfaces, relationships, controls, system boundary, metadata); schema-correct relationship shapes; decorator- and call-site-based security controls with file:line evidence; a Decision Record/Override mechanism for human correction after a scan; a human-readable intermediate representation rendered from the same facts as the CALM output.

**Output honesty metadata** — not an afterthought, first-class output on every generated artefact: a `FactStatus` (`observed`/`inferred`/`requires-review`/`reviewed`/`externally-verified`) on every node and relationship (`x-aac-status`), telling a consumer which facts are safe to treat as settled versus which still need a human look; a self-disclosed `x-aac-scope-limitations` block at the document root (sourced from `scope-limitations.yml`) naming this specific run's known gaps, not just a general disclaimer; per-module fitness declarations (`fitness.json` alongside each module's findings) stating whether that module's output has been gold-measured or is `not-yet-fit-to-gate` — so a consumer knows whether it's safe to gate a CI decision on a given module's findings.

**Modules (what each one actually checks)** — see [`--modules`](#run-slice-cli-reference) to pick a different set:

| Module | What it flags |
|---|---|
| `calm-generator` | The CALM architecture graph itself — always needed unless you only want raw `typed-facts.json` |
| `threat-signals` | STRIDE-spoofing candidates: units with HTTP-entry-point evidence but no detected security-control evidence (decorator or call-site) — a signal for human review, not a verdict |
| `resilience-lens` | Units with retry-annotation (Spring Retry `@Retryable`, Resilience4j `@Retry`) and/or timeout-config (`resilience4j` `timelimiter` duration) evidence — descriptive facts, not a fragility verdict |

**Evaluation** — a fixtures monorepo covering the supported frameworks; hand-authored semantic and full-CALM gold architecture; scoring scripts; a strict isolation rule preventing gold from ever informing detector design (`coe-lab/ISOLATION.md`).

**Tooling** — a real regression suite (`npm test`, exact-value assertions against checked-in fixtures); an offline, explicitly-invoked rule-suggestion CLI (LLM-optional, never on the generation path); a Dockerfile.

---

## Known limitations

Named explicitly rather than left implicit — a high confidence score on what *was* found never implies the whole architecture story is complete.

| Limitation | Detail |
|---|---|
| **Layered, multi-hop architecture** | A service calling into an access-layer implementer that itself talks to a store, across package boundaries, is only recovered when the implementer is in the same multi-root scan and the store-detection catalogue covers its persistence shape. Single-root scans of a layered system will often miss the full story by design, not by bug. |
| **Call-site security controls** | Only decorator/annotation-based controls (e.g. `@PreAuthorize`) and a small set of call-based patterns are detected; broader method-call-based authorization checks are backlog. |
| **Confidence vs. completeness** | A high confidence score on a detected unit says nothing about whether the surrounding architecture was fully captured — always check the generated output's own scope-limitations metadata. |
| **Persistence/messaging breadth** | Spring Data repositories, jOOQ, and some cloud-native persistence/messaging shapes are designed but not fully dispatched. |
| **Kubernetes runtime placement** | Shared-secret trust relationships are detected; `deployed-in` (runtime placement) relationships are not yet built. |

See [`docs/solution/OOS_Registry.md`](./docs/solution/OOS_Registry.md) for permanent (not just near-term) non-goals, each with a stated reason and revisit trigger.

---

## Repository layout

```text
README.md                 ← you are here
CLAUDE.md                 ← guidance for AI coding assistants working in this repo
pipeline/                 ← Node/TS product code
  src/scanner/            ← engines & structured-file providers
  src/rules/              ← YAML catalogues + schemas
  src/analysis/           ← passes, detectors, IR, coverage
  src/modules/            ← calm-generator, threat-signals, resilience-lens, registry
  src/orchestration/      ← run-slice
  test/                   ← regression suite
coe-lab/                  ← evaluation benchmark (fixtures + gold + scripts)
docs/
  Requirements.md         ← current scope
  solution/               ← design, capabilities, backlog, claim register
tools/                    ← standalone tooling (residual-review session)
```

---

## Quick start

### Prerequisites

- Node.js 20+
- Python with `graphifyy` on `PATH` (`pip install graphifyy`)

### Build, test, run

```bash
cd pipeline
npm install
npm run build
npm test

# Scan one or more package roots → CALM + facts
node dist/orchestration/run-slice.js /path/to/package --out /path/to/out

# Multi-root example
node dist/orchestration/run-slice.js rootA rootB --out /path/to/out

# Optional: Kubernetes-manifest / env-correlation signals
# node dist/orchestration/run-slice.js ... --k8s-manifests /path/to/manifests --enable-env-soft-graph

# Schema-validate the generated CALM
npm run validate -- /path/to/out/architecture.calm.json -f pretty
```

### What runs by default vs. what needs a flag

Every detection mechanism in the pipeline, classified — kept in sync with
`analysis/passes.ts`'s `DEFAULT_PASSES` list (source of truth for what
actually executes) and the CLI reference table below it. **When a new
Analysis pass is added, add its row here too** — a pass that's silently
always-on or silently opt-in is exactly the kind of buried capability this
table exists to prevent.

| Mechanism | Runs by default? | How to reach it |
|---|---|---|
| Route composition, signal→unit mapping, persistence/messaging detection, outbound-HTTP, multi-hop bridges, Graphify reconciliation, relationship grading, status assignment (`FactStatus`) | **Always** | No flag — the core pipeline |
| OpenAPI/Swagger ingestion | **Always** | No flag — auto-discovers `openapi.yaml`/`.json` at each package root |
| Spring config file reading (`application.yml`/`.properties`) | **Always** | No flag — auto-discovers config files at each package root |
| Dependency-manifest (SBOM) corroboration + secondary-source introduction | **Always** | No flag — auto-detects `@cyclonedx/cdxgen` on `PATH` and a committed lockfile; a no-op (not an error) when either is absent |
| CloudFormation/SAM route binding | Opt-in | `--cfn-manifests <dir>` |
| Kubernetes shared-secret trust relationships | Opt-in | `--k8s-manifests <dir>` |
| Contradiction detection (k8s manifest vs. Spring config) | Opt-in | `--k8s-manifests <dir>` (same flag, no separate one) |
| Env-key-name soft-graph correlation | Opt-in | `--enable-env-soft-graph` (also requires `--k8s-manifests`) |
| CodeQL DI-resolution (T-LR-5) | Opt-in | `--codeql-source-root <dir> --codeql-build-command <cmd>` — real, non-trivial cost (a real compile + CodeQL database build), never on by default |
| Decision Record/Override application | Opt-in | `--overrides <dir>` |
| calm-generator, threat-signals, resilience-lens modules | **All three, by default** | `--modules <name>,<name>,...` to run a different set |

### `run-slice` CLI reference

Every flag `run-slice.js` accepts, kept in sync with `orchestration/run-slice.ts`'s
own `KNOWN_FLAGS` list — an unrecognized flag fails loudly rather than being
silently ignored. **When a change adds or renames a flag, update this table in
the same change** — a flag that only exists in code comments is invisible to
anyone deciding what the product can do.

| Flag | Takes a value | Default | What it does |
|---|---|---|---|
| `--out <dir>` | Yes | `./calm-output` | Output directory for `typed-facts.json`, `architecture.calm.json`, and module outputs |
| `--overrides <dir>` | Yes | — (off) | Apply Decision Record/Override pairs from this directory as a final pass after deterministic CALM construction |
| `--modules <name>,<name>,...` | Yes | `calm-generator,threat-signals,resilience-lens` | Which modules to run — see `docs/solution/Module_Authoring_Guide.md` |
| `--strict-detect` | No | off | Exit non-zero when routes were expected (grep-verified usage) but zero were found — turns a silent CodeGraph detect-gate failure into a loud one |
| `--no-snippets` | No | snippets included | Omit source-snippet content from the IR/output (redaction-adjacent; excludes snippet bodies, not evidence pointers) |
| `--k8s-manifests <dir>` | Yes | — (off) | Read flat/pre-rendered Kubernetes manifests for shared-Secret/ConfigMap trust relationships. **Also activates contradiction detection** (a k8s Deployment image naming a different datastore engine than a Spring-config-sourced unit's own JDBC scheme forces that unit to `requires-review`) — no separate flag for this |
| `--enable-env-soft-graph` | No | off | Env-key-name-correlation relationships — requires `--k8s-manifests` too; always low, fixed confidence |
| `--cfn-manifests <dir>` | Yes | — (off) | Read CloudFormation/SAM templates to bind API Gateway routes to their Lambda handlers |
| `--strict-overrides` | No | off | Fail the run if any Override is rejected (orphaned target, malformed value, inactive Decision Record) instead of reporting and continuing |
| `--no-system-node` | No | system node included | Omit the synthetic root `system` node and its `composed-of` edges from CALM output |
| `--from-facts <typed-facts.json>` | Yes | — | Reconstruct CALM output from a previously-generated, frozen `typed-facts.json` — no rescan. Refuses an incompatible `contractVersion` rather than attempting reconstruction |
| `--codeql-source-root <dir>` | Yes | — (off) | T-LR-5: the real, compilable root CodeQL should index (must be a common ancestor of every `--modules`-relevant package root). Requires `--codeql-build-command` too. See the CodeQL section below — real, non-trivial cost and a real license constraint, never on by default |
| `--codeql-build-command <cmd>` | Yes | — (off) | The exact build command CodeQL runs to observe a real compile (e.g. `"./gradlew :my-module:compileJava --rerun-tasks"`). **Must force a genuine recompile** — an up-to-date/cached build never re-invokes the compiler, so CodeQL's tracer observes nothing and the database silently comes back empty (a real failure mode found building this, not a hypothetical) |

**When to reach for which flag:**

- Have Kubernetes manifests for the system? → `--k8s-manifests <dir>`. You get shared-secret trust edges for free; if a manifest's datastore image disagrees with a Spring-config-sourced unit's JDBC scheme, that unit is also automatically forced to `requires-review` (no extra flag).
- Also want low-confidence env-var-name correlation edges on top of that? → add `--enable-env-soft-graph` (does nothing without `--k8s-manifests`).
- System is deployed via CloudFormation/SAM (API Gateway → Lambda)? → `--cfn-manifests <dir>`.
- Hit a case where CodeGraph/Graphify can't see a Spring `@Bean`-factory or stereotype-disambiguated wiring? → `--codeql-source-root`/`--codeql-build-command` (see the dedicated section below first — real cost, license-gated, local-only).
- Re-running CALM generation after tweaking `--modules` or an override, without re-scanning source? → `--from-facts <typed-facts.json>` instead of re-running the whole scan.
- A human already corrected a wrong classification? → `--overrides <dir>`; add `--strict-overrides` in CI so a malformed/orphaned override fails the build instead of silently no-op'ing.
- Debugging why a route didn't get detected? → `--strict-detect` turns a silent zero-routes result into a hard failure you'll actually notice.

#### Optional: CodeQL DI-resolution (`--codeql-source-root` / `--codeql-build-command`)

Resolves a Spring interface field to its real implementation via two shapes
neither CodeGraph nor Graphify can see at all: a `@Bean`-factory method
inside a `@Configuration` class, or 2+ real `implements` candidates
disambiguated by a stereotype annotation — see
[`docs/solution/E1b-codeql-di-resolution-experiment.md`](./docs/solution/E1b-codeql-di-resolution-experiment.md)
for the real, whole-codebase-scale evidence (2106 real bindings on a real
reference Java/Spring monorepo).

```bash
# Requires the CodeQL CLI on PATH and a real, successful compile of the
# target — real cost (minutes, not seconds), not a default-on path.
node dist/orchestration/run-slice.js /path/to/module \
  --codeql-source-root /path/to/repo-root \
  --codeql-build-command "./gradlew :my-module:compileJava --rerun-tasks"
```

**Free-tier CodeQL CLI license note:** automated/CI use is only permitted
against an Open Source Codebase, or under a paid GHAS license — this
pipeline's own CI does not run this flag. See
`soln/codeql-licensing-check-memo.md`'s durable summary in
`docs/solution/AGENT_TASKS_Ext_P0_Experiments.md` before enabling this
against a private repository in an automated context.

### Evaluation harness

```bash
cd pipeline && npm run build
cd ../coe-lab
node scripts/generate-calm.mjs --package py-accounts-api
node scripts/validate-calm-pair.mjs --package py-accounts-api
./scripts/run-eval.sh py-accounts-api
node scripts/scoreboard.mjs
```

See [`coe-lab/README.md`](./coe-lab/README.md).

---

## Validation layers

| Layer | Meaning |
|---|---|
| **L0** | CALM schema valid (`calm validate`) |
| **L1** | Unit/route/control presence vs. gold |
| **L2** | Full architecture story (e.g. service → store) vs. gold |
| **L3** | Silence/completeness invariants hold |
| **L4** | Scope-limitations metadata matches reality |

A clean L0+L1 result on a fixture does not imply L2 on a real multi-module system — see [`coe-lab/docs/validation-approach-vnext.md`](./coe-lab/docs/validation-approach-vnext.md).

---

## Documentation map

| Doc | Use when |
|---|---|
| [`docs/Requirements.md`](./docs/Requirements.md) | What Weaver is required to do |
| [`docs/solution/Capabilities.md`](./docs/solution/Capabilities.md) | Built vs. partial vs. backlog |
| [`docs/solution/Claim_Register.md`](./docs/solution/Claim_Register.md) | Allowed completeness claims |
| [`docs/solution/Architecture_as_Code_Solution_Design_v2.md`](./docs/solution/Architecture_as_Code_Solution_Design_v2.md) | Platform + CALM construction design |
| [`docs/solution/language/java.md`](./docs/solution/language/java.md) | Java engine sequencing detail |
| [`docs/solution/Module_Authoring_Guide.md`](./docs/solution/Module_Authoring_Guide.md) | Adding a new module |
| [`docs/solution/Contract_Evolution_Policy.md`](./docs/solution/Contract_Evolution_Policy.md) | When to version the typed-facts contract |
| [`docs/solution/Catalogue_Intake.md`](./docs/solution/Catalogue_Intake.md) | Adding a new detection catalogue row |
| [`CLAUDE.md`](./CLAUDE.md) | Working guidance for AI coding assistants |

---

## Principles

1. **Evidence before claim** — real repositories and greps beat vendor documentation.
2. **Catalogue over special case** — new framework support is a data row, not new code.
3. **Deterministic core** — same input always produces the same CALM output; an LLM is only ever offline/advisory.
4. **Honesty metadata** — scope-limitations, confidence-vs-completeness, and graded relationships are first-class output, not an afterthought.
5. **Surgical changes** — fix one mechanism without rewiring the platform.
6. **Evaluation isolation** — gold architecture is for scoring, never for informing detector design.

---

## License / provenance

The pipeline depends on open-source tools including `@colbymchenry/codegraph`, `graphifyy`, and `@finos/calm-cli`. Check upstream licenses before redistributing any generated artefacts derived from proprietary source.
