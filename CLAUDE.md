# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

**Weaver** is a deterministic Architecture-as-Code (AaC) pipeline that extracts structure from a real, polyglot (Java + Python + Node/TypeScript) monorepo and generates [FINOS CALM](https://calm.finos.org) 1.2 JSON. There is explicitly **no LLM in the core generation path** — this is enforced architecturally, not just stated (see "Pipeline architecture" below).

For scope, see [`docs/Requirements.md`](docs/Requirements.md). For what's built vs. backlog, see [`docs/solution/Capabilities.md`](docs/solution/Capabilities.md). For the current solution design, see [`docs/solution/Architecture_as_Code_Solution_Design_v2.md`](docs/solution/Architecture_as_Code_Solution_Design_v2.md) (platform) and [`docs/solution/language/java.md`](docs/solution/language/java.md) (Java specifics).

**Before scoping anything, read the three governance registries** —
[`docs/solution/BACKLOG.md`](docs/solution/BACKLOG.md) (what's already known-missing, often with evidence attached),
[`docs/solution/Claim_Register.md`](docs/solution/Claim_Register.md) (what may be *said* to work, and the forbidden-phrase table),
[`docs/solution/OOS_Registry.md`](docs/solution/OOS_Registry.md) (permanent non-goals, each with a revisit trigger).
Skipping them produces work that is rejected on review or re-derives a
question already answered here: a detector keyed to a sample repo's class
names is always rejected, a permanent non-goal has a defined trigger rather
than being simply unbuilt, and a P1 backlog row usually already carries the
real evidence someone is about to go and re-gather.

## Working principles

**1. Think Before Coding — don't assume, verify against the real tool/schema/repo.** "Specified" and "true" are different claims. Before asserting a design or dependency assumption holds, verify it — a schema-shaped claim can be falsified the moment the real validator runs against it; a "not installed" claim can be stale the moment someone actually checks again. When a genuine decision point has more than one defensible answer and only the user can pick it (build-environment assumptions, scope tradeoffs, which of several correct designs to build), ask rather than picking silently.

**2. Simplicity First — minimum code that solves the problem, nothing speculative.** The construct-mapping catalogues (`node-type-mapping.yml`, `relationship-type-mapping.yml`, `control-requirement-catalogue.yml`, and the persistence/messaging/http-client detection catalogues) exist so builders stay thin and new capability is a data row, not new code. If a new signal needs more than a catalogue row plus one of the already-proven extraction mechanisms (native framework typing, decorator/annotation extraction, import detection, structured-file ingestion), stop and confirm it's actually in scope before inventing a new mechanism.

**3. Surgical Changes — touch only what you must, clean up only your own mess.** Every builder (`node-builder.ts`, `interface-builder.ts`, `relationship-builder.ts`, `metadata-builder.ts`, `control-builder.ts`, `port-interface-builder.ts`) is isolated on purpose — fixing one should never require touching another. Remove only what your own change makes unused; leave pre-existing gaps named, not silently patched over. **"Surgical" governs footprint — which files change — not generalization
scope. A small diff tuned to make one failing repo pass is not more surgical
than a slightly larger diff that fixes the actual mechanism class; it's just
narrower, and narrower-but-instance-specific is the anti-pattern, not the
virtue. If a bug traces to a mechanism (a matching pattern, a resolution
strategy, a catalogue gap), fix the mechanism — see "Bug fixes are capability
work" below.**

**4. Goal-Driven Execution — define success criteria, loop until verified.** Every change should be framed as "does the regression suite still produce the same counts, does `calm validate` return 0 errors, does the output match grep-verified ground truth" — never "does this code look right." State the verify step before making a non-trivial change, not after.

## Bug fixes are capability work, not exceptions to it

Named because it recurs: a fix that makes one failing repo/fixture pass by
adding a conditional, tuning a regex, or hardcoding a value is easy to mistake
for a small, safe change. It is usually the opposite — a mechanism-instance
patch dressed as a mechanism-class fix, and the next language, framework, or
repo hits the same underlying gap again under a different symptom.

**`OOS-sample-repo-detectors`** (`docs/solution/OOS_Registry.md`) already
forbids the sharpest version of this — any code path keyed to a specific
sample repo's class/module/package name — permanently, not as a backlog item.
**`Catalogue_Intake.md`'s four requirements apply to any bug fix that changes
detection, matching, or relationship-building logic, not only PRs framed as
new capability.** Calling it a bug fix does not exempt it.

Before writing a fix, not after:

1. **Name the mechanism class the bug belongs to** — the same discipline
   `Claim_Register.md`'s mechanism-class matrix already uses (`U-*`/`R-*`/`C-*`
   rows are classes, never single-repo instances).
2. **Check whether it's a catalogue gap or a mechanism gap.** A catalogue gap
   is a data row (Simplicity First, above). A mechanism gap needs a real,
   evidenced new extraction strategy — not a special case bolted onto an
   existing one.
3. **Verify the fix against a second, different instance of the same class**
   — not just the case that reported the bug. This is now a stated
   requirement in `Catalogue_Intake.md`, not a suggestion. If no second
   instance exists yet, say so explicitly rather than silently skip it.
4. **State the mechanism class in the commit message and the `Claim_Register.md`
   entry**, so the next person (or session) can tell a capability fix from an
   instance patch without reading the diff.

**A task's own status note claiming a fix was "caught" or "refactored" is not
itself evidence the catch was systemic.** The first real instance of this
whole pattern (an annotation name hardcoded as a literal, generalized only
after the fact) was found by the project owner reading a diff and getting
suspicious, not by this rule, not by the task's own definition-of-done
checklist, and not by the agent noticing on its own. Treat "flagged on
review" in a status note as meaning *a human read the diff*, not as evidence
the process would have caught it without one — and don't skip that reading
because a task reports itself done.

## Repository layout

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

See `coe-lab/ISOLATION.md`. Gold paths are also listed in `.cursorignore` / `.grokignore`. **Those ignore-files only guard the tools that read them** — under any other tooling, isolation rests on discipline alone. When in doubt, run implementation and scoring as separate sessions: a measurement taken by a process that read the answer key is void, not merely weak.

## Build and run

**Prerequisite:** Python with `graphifyy` on `PATH` (`pip install graphifyy`) — required for the Graphify cross-package pass. Missing it doesn't fail the build; it degrades cross-package detection instead (caught, logged as a warning, run continues without cross-package relationships).

```bash
cd pipeline && npm install && npm run build
node dist/orchestration/run-slice.js <package-root> [<package-root> ...] --out <dir>
npm run validate -- <dir>/architecture.calm.json -f pretty   # FINOS calm-cli schema validation
npm test                                                      # full regression suite

cd ../tools/review-session && python3 -m unittest discover -s . -p "test_*.py"  # separate Python test suite (residual-review tooling), not covered by npm test
```

`npm test` baseline on a fresh clone: **64 pass, 0 fail, 25 skip**. The skips are tests gated on third-party sample repos under `spikes/` (gitignored, never committed — see "Working in this repo" below); more tests pass locally if those scratch clones happen to be present.

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

**Module registry** — `TypedFacts` carries a `contractVersion`; `modules/registry.ts` skips a module that declares an incompatible major version and isolates a throwing module rather than crashing the whole run. Module outputs are namespaced under `outDir/modules/<name>/`. See [`docs/solution/Module_Authoring_Guide.md`](docs/solution/Module_Authoring_Guide.md) for adding a new module and [`docs/solution/Contract_Evolution_Policy.md`](docs/solution/Contract_Evolution_Policy.md) for when a change to `TypedFacts` requires a `contractVersion` bump versus a catalogue-only change.

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

## Session economy (no plugin required)

Four cheap habits, adopted rather than any third-party workflow framework —
evaluated and rejected as unnecessary overhead for this repo (`docs/06`
convergence notes, research workspace), but these four ideas are worth
keeping regardless of that verdict:

- **One git worktree per active lane/task**, not one shared working tree
  across parallel sessions. Removes the need to `git status`-check before
  every commit to avoid sweeping up another session's in-progress work — a
  real problem this project hit, not a hypothetical one.
- **One task, one fresh session**, where practical. The lane files
  (`AGENT_TASKS_Ext_*.md`) are written as self-contained briefs specifically
  so this works — a session doesn't need prior conversation history if the
  task file states what to read and what "done" means. Avoids carrying
  irrelevant context forward and the fidelity loss a long session risks after
  compaction.
- **Two failed fix attempts on the same problem is a stop signal, not a cue
  to try a third variation.** Repeated patching of the same symptom usually
  means the mechanism class was scoped wrong (see "Bug fixes are capability
  work" above) — stop, re-derive the mechanism class, then retry once, not
  indefinitely.
- **Root cause before patch, every time.** Reproduce → isolate → identify the
  mechanism → fix, in that order. Skipping straight to a plausible-looking
  change is the most common route to the instance-specific patches this
  project's governance already exists to catch.

## Process discipline (from this project's build retrospective)

The retrospective measured roughly **two lines of planning prose for every one
line of code that shipped** — ~11,000 lines of planning docs eventually deleted
as superseded churn, and a requirements doc that reached v0.14 before scope
locked. The engineering discipline in this repo is *why the codebase held up*;
the cost was in where the effort went, not how much. These rules exist to keep
that ratio from returning.

**One requirements doc, ever.** Version it in commit history, not in
filenames. The moment a doc is about to be saved as `_v2`, edit the original
and commit — git already remembers what it said.

**Two solutioning passes, hard cap.** A first draft, one structured critique,
then build. Wanting a third review *before* writing code is itself the signal
to go write the code — real evidence critiques a design faster and more
honestly than another planning pass.

**Turn open questions into tests, not paragraphs.** "Will this approach work?"
is not settled by arguing in a document; it's settled by the smallest real
test that could prove it wrong. If that test can't be written yet, the
question isn't understood yet either.

**"Documented" and "specified" never mean "done."** `Capabilities.md` and
`Claim_Register.md` are the status of record. A design paragraph is not a
capability.

**Delete finished planning artifacts as you go.** A task or requirements doc's
job ends when its content ships or is rejected. Don't archive "just in case" —
that's what git history is for, and it doesn't clutter the working tree in the
meantime.

**Comments are for a stranger with no memory of today.** No session references,
no task-ID shorthand only the author can resolve. Reasoning that matters
belongs in the commit message — durable and searchable — not narrated through
source files where it rots as context changes.

**Abstract third-party references the day you write them.** Using real
repositories as evidence is good practice; generalise the reference
immediately ("a reference banking platform", not the real name). Retrofitting
this across a whole repo is real, avoidable work — this project has already
paid for it once.

**Second occurrence of a mistake fixes the process, not the instance.** The
first time something breaks, patch it. The second time the *same class* breaks,
build the guardrail — a test, a lint rule, a frozen exam — so there's no third.
Cross-document reference rot (a `§`, ID, or path that no longer resolves after
a restructure) has now recurred enough times to warrant a mechanical check
rather than another manual sweep.

**Handover-ready is a standing constraint, not a final sweep.** The cheapest
time to keep the repo clean is continuously; the most expensive is a dedicated
pass at the end, which is exactly what closed out the previous cycle.
