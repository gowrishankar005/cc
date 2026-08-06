# Handoff Brief: Architecture-as-Code POC — Structural Engine Evaluation

**Purpose of this file:** context for a fresh Claude Code session picking up where a long research conversation left off. Read this before doing anything else — it tells you what's actually proven vs. still assumed.

---

## Project context

Building a deterministic Architecture-as-Code pipeline: extract structure from a real, polyglot (Java + Node + Python) monorepo → generate CALM 1.2 JSON → review via draw.io + a companion interface → capture Decision Records/Overrides. No LLM in the core generation path. Multiple domain architects across BUs will review output; mapping-config is owned per-domain (two-tier: global + domain overlay). Complementary to an existing FINOS CALM Studio visualizer effort (which has a draw.io → CALM JSON converter; this pipeline needs the inverse direction and must share a schema/shape-library contract with it).

## What's been tested, and how (do this level of rigor, don't skip it)

Three structural-extraction tools were evaluated by actually installing and running them against real public repos, not just reading docs:

1. **CodeGraph** (`@colbymchenry/codegraph`, npm, MIT) — tested against Apache Fineract (Java, 7,062 files), OpenBB (Python/FastAPI), Ghostfolio (TypeScript/NestJS).
2. **Graphify** (`graphifyy`, PyPI, Apache 2.0) — tested against Fineract, code-only mode (`--code-only --no-cluster`, no LLM backend configured).
3. **jQAssistant** — **NOT YET TESTED.** Only researched via search; the JAX-RS support claim rests on one bullet in an old conference slide deck. Treat as unverified until run the same way as the other two.

## Proven findings (verified by execution or direct source-reading — trust these)

- **CodeGraph is fast** (Rust engine): 182K nodes/492K edges in 43s on the full Fineract repo.
- **CodeGraph has no bulk-export API** — every CLI/MCP command is a targeted query. Full graph access requires querying `.codegraph/codegraph.db` (SQLite) directly, an undocumented internal schema (confirmed: `registerFrameworkResolver` is NOT part of the public SDK — verified with `ERR_PACKAGE_PATH_NOT_EXPORTED`, this was an earlier mistaken claim, corrected).
- **CodeGraph's Java framework support is Spring-only.** JAX-RS (`@Path`/`@GET`) is captured only as low-confidence "fuzzy" `decorates` edges, never typed as `route`. Confirmed by reading the actual resolver source (`resolution/frameworks/index.js` — only `spring` and `play` registered for Java) and independently confirmed via Fineract's real `JerseyConfig.java` (a genuinely live, working Spring↔Jersey bridge, not dead code).
- **CodeGraph's `detect()` gate is root-relative and fails silently in monorepos.** Proven directly: indexing OpenBB from `openbb_platform/` → 0 routes. Indexing from `openbb_platform/core/` (where `fastapi` is actually declared in `pyproject.toml`) → 6 routes, same code. Ghostfolio worked cleanly from its repo root because Node/Nx monorepos conventionally declare deps once at the top — this is a manifest-location problem, not a language-quality problem.
- **This pattern is corroborated independently on GitHub**: Issue #307 (Hono monorepo, ~82% route miss rate, Flask routes "completely missed" in the same repo, closed as not planned), Issue #764 (NestJS multi-app symbol collisions), Issue #281 (multi-root support request, closed as not planned).
- **Graphify has a genuine bulk-export win** (`graph.json`, plain file, no schema-coupling risk) but **zero framework-specific typing for any language** — confirmed via its full relation vocabulary (`references, imports, calls, method, contains, case_of, inherits, implements` — no `route`, no `decorates`). Slower than CodeGraph (18s for a 692-file slice vs. CodeGraph's 43s for the full 7,062-file repo).
- **Graphify's "deep mode" (LLM-assisted) was read from source, never executed** (no API key available). It's a generic relationship-inference layer with no route/controller/entity output category — would not have solved the JAX-RS problem even if run.

## What's NOT yet proven — do these before deciding architecture

1. **Nothing has been tested against the real target monorepo.** Fineract/OpenBB/Ghostfolio are reasonable proxies, not a substitute. This is the single highest-value next step.
2. **jQAssistant is unverified.** Install it, run it against a real JAX-RS Java slice (Fineract's `SchedulerApiResource.java` or similar is a good test case — the repo may still be around locally, or re-clone `apache/fineract`), and confirm it actually produces annotation-level facts for `jakarta.ws.rs.Path` before it factors into any decision. It has no mature Python plugin and only an unreleased TypeScript RC plugin (confirmed) — so at best it's a Java-only specialist tool.
3. **"Hybrid architecture" (jQAssistant for Java + CodeGraph for Node/Python) has zero integration-cost estimate.** Don't commit to this without sizing the effort to merge a Neo4j-backed graph with CodeGraph's SQLite output into one CALM pipeline.
4. **The annotation-interpretation layer has only been sketched conceptually**, spot-checked against 1-2 classes. Not implemented. Before building it broadly: separate "genuinely unsupported" (JAX-RS — needs custom code) from "supported but detect()-gated" (FastAPI, NestJS — needs correct per-package indexing + a smoke test, not new code).

## Recommended immediate next steps, in order

1. Get a real slice of the actual target monorepo and run the same tests (performance, route-detection, per-package `detect()` smoke test) that were run against Fineract/OpenBB/Ghostfolio.
2. If jQAssistant still looks promising after step 1's results, install and test it with equal rigor — don't let it into the decision on the strength of research alone.
3. Build a small **per-package smoke-test script**: for every module/package in the pilot slice, index it individually, check `nodesByKind.route` isn't suspiciously zero for known-REST packages (grep-verify against real annotation usage first).
4. Only after 1–3: scope and build the annotation-interpretation layer, narrowly, for confirmed-unsupported patterns only.

## Artefacts from the prior conversation (download and bring these into the repo)

- `CodeGraph_Discovery_Spike_Report.md`
- `CodeGraph_vs_Graphify_Comparison.md`
- `CodeGraph_Polyglot_Spike_Node_Python.md`
- `Gap_Closure_Build_Ready_Specs_v0.1.md`
- `AaC_Solution_Design_Critical_Review.md`

Put these in a `docs/spikes/` folder in the repo (or wherever your CLAUDE.md points) so Claude Code can read them as context rather than starting cold.
