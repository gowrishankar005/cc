# Requirements v0.5 — Repo Analyser/Orchestrator Platform + CALM Generator Module

**Status:** Draft. Supersedes v0.4. Closes §11 item 1 (with a correction to the underlying mechanism), reports §11 item 2 as environment-blocked, and reopens the tool question a second time — this time on the *cross-package structural backbone*, not just Java framework typing.

---

## 0. Changes from v0.4 — and why

**§11 items 1 and 2 were run before touching solution architecture, per v0.4's own recommendation.** Full evidence in `docs/spikes/CodeGraph_Annotation_Extraction_Reconciliation_Spike.md`. Net effect on this document:

1. **§11 item 1 (`Node.decorators` reconciliation) is RESOLVED — with a correction, not a confirmation.** The assumption carried since v0.1 — that `node.decorators` generically captures real annotations for every language, including Java — was tested against real indexed output (Fineract's `ChargesApiResource`, `Charge`) and **falsified**: the field came back `undefined` for every genuinely-annotated Java class/method; it's populated only by `java.js`'s hardcoded Lombok-synthesis special case, which is unrelated to real annotation capture. Persisted `decorates` **edges** were also empty (0/0) in a small single-module index — resolution has no local symbol to fuzzy-match external annotation types against at that scale. The reliable mechanism, also verified: `CodeGraph.extractFromSource(filePath, source)` — a public, documented, no-persistence-required method — returns the raw annotation names via `unresolvedReferences` filtered to `referenceKind === 'decorates'`, correctly attributed to the right class/method/field, independent of indexing or resolution succeeding. §3 and §5 below are updated to specify this as the extraction mechanism.

2. **§11 item 2 (jQAssistant multi-module spike) could not be run.** This environment has no working JVM, no Maven, no Docker — checked, not assumed. §4 Option A remains exactly as unverified as it was in v0.4; nothing here changes its status either way.

3. **New: Graphify is reopened as a candidate — for a different reason than the original comparison.** The user raised this directly: could a "best of both worlds" combination help? The original `docs/spikes/CodeGraph_vs_Graphify_Comparison.md` judged Graphify on bulk export (now moot — CodeGraph's SDK already provides this, per v0.1 §5) and framework typing (Graphify has none, at all, for any language — a clean loss there). But there's a property that comparison wasn't looking for and is now directly relevant to §4's cross-package-edge problem: **Graphify does one pass over a whole repo with no per-root `detect()` gate to dodge**, so it never partitions by package root the way CodeGraph's framework-detection requirement forces it to. That sidesteps the cross-root stitching problem entirely, for the structural backbone (imports/calls), rather than requiring a fix for it. This is added below as **Option C**, held to the same "provisional, unverified for this specific purpose" bar as everything else — notably, the original comparison's Graphify run **timed out on Fineract's full 7,062-file repo**, succeeding only on a 692-file slice, which is the open risk for Option C specifically.

---

## 1. System Structure: Platform + Modules

Structure unchanged from v0.4 (Scanner → Analysis → Orchestration → modules; typed-facts.json as the module contract; determinism rule; per-language Scanner Layer tool decision, still open for Java).

---

## 2. CALM 1.2 Construct Coverage

Unchanged from v0.1/v0.4.

---

## 3. Signal → Typed-Fact Mapping

**[v0.5 — mechanism corrected]** The rule-table design itself (framework, language, signal pattern, fact type, confidence contribution) is unchanged and remains tool-agnostic by construction. What changes is **how the Java rows reach their raw signal**:

- **Previous (v0.1) assumption, now falsified:** read `node.decorators` off nodes obtained via `getAllNodes()`/`getNodesByKind()` on the persisted, indexed graph.
- **Corrected (v0.5) mechanism:** call `CodeGraph.extractFromSource(filePath, source)` directly per Java source file (the orchestrator reads the file itself and passes the content in — no full-repo index required for this step), and read `result.unresolvedReferences.filter(r => r.referenceKind === 'decorates')`, using `referenceName` (the raw annotation name — `Path`, `GET`, `Entity`, `Column`, …) and `fromNodeId` (which class/method/field it decorates) as the signal. Verified against real Fineract code: 36 correctly-attributed refs for `ChargesApiResource.java` (JAX-RS), 48 for `Charge.java` (JPA).
- This mechanism is **file-scoped, not root-scoped** — it doesn't depend on `detect()` succeeding, doesn't require indexing at any particular package root, and doesn't depend on graph resolution succeeding. It runs identically regardless of how the per-package `detect()`-gate mitigation (§4) or the cross-root stitching approach (§4 Options A/B/C) end up resolving.
- **Caveat, also verified:** this mechanism does not substitute for the full indexed pipeline where **framework-native route typing** is the goal (e.g. Spring's `@GetMapping` → native `route` node, or Flask/FastAPI/NestJS route typing). A quick side-check found `extractFromSource()` on a bare single Python file (no project manifest/context) produces zero native `route` nodes — that typing requires the full `detect()`+context-aware indexing pipeline. The orchestrator needs **both**: `extractFromSource()` for raw annotation-name capture (all languages, all annotation types, no gate), and the full per-package index for native framework route/typing where a resolver exists (Spring, Flask, FastAPI, Django, Express, NestJS).

---

## 4. Cross-Language Risk: the `detect()` Gate — and the Cross-Package Edge Problem

The `detect()`-gate requirement (per-package-root indexing, non-zero-route smoke test) is unchanged from v0.3/v0.4. The cross-package edge problem (CodeGraph cannot merge multiple indexed roots into one queryable graph — GitHub Issue #281, closed as not planned) is unchanged from v0.4.

**Three candidate resolutions now on the table — all provisional, none yet verified to completion:**

**Option A — Hybrid: jQAssistant for the Java scan.** Unchanged from v0.4. **Status: still fully unverified.** The prioritized spike to test it (§11 item 2, v0.4) could not run in this environment (no JVM/Maven/Docker). Needs an environment with a working JDK 11+ and Maven or Docker before this moves past "researched, never run."

**Option B — In-house cross-root stitching.** Unchanged from v0.4: an explicit analysis-layer step resolving symbols across separately-indexed graphs by FQN/import-path matching. Tool-agnostic, works for all three languages, itself unbuilt and unverified effort, and per-language import-resolution conventions differ enough that "one stitching rule" may be closer to three related rules.

**Option C — [v0.5, new] Graphify for the structural backbone, CodeGraph for typed/annotated extraction.** Graphify has no framework-detection gate at all (it does generic structural extraction — `references, imports, calls, contains, inherits, implements` — uniformly regardless of subdirectory or manifest presence), so a single Graphify pass over the whole repo never needs to partition by package root in the first place, sidestepping the cross-root stitching problem rather than needing a fix for it. Paired with CodeGraph's `extractFromSource()` (§3, file-scoped, also gate-free) for annotation-level signal and CodeGraph's native framework resolvers where `detect()` does succeed, this is a genuine "best of both worlds" candidate: Graphify's whole-repo relationship graph + CodeGraph's richer per-node typing and annotation extraction.

**What's unverified about Option C, specifically:** the original `docs/spikes/CodeGraph_vs_Graphify_Comparison.md` found Graphify's full-repo run against Fineract (7,062 files) **exceeded the available execution time limit**, completing only on a 692-file slice (18s). Graphify is pure Python (vs. CodeGraph's Rust engine), and that comparison's own performance table flagged this needs re-verification "at real pilot-repo scale... Fineract-scale isn't necessarily your monorepo's scale" — i.e., it may or may not be a real blocker for the actual target monorepo, but is an open, not a closed, question, and Fineract-scale is the only real data point so far (and it failed). Graphify's `graph.json` output also has **no `kind` field at all** on nodes (type is only implicit via ID nesting depth) — reconstructing node kinds from a Graphify export is itself unbuilt work, separate from the timeout risk.

**These three aren't mutually exclusive**, and none is ready to design around yet. **Recommended framing for solutioning:** treat Option B as the baseline that will be built regardless (same framing as v0.4) — Option A narrows its Java-side scope *if* it pans out (unverified, environment-blocked here); Option C could reduce or eliminate the *need* for Option B entirely if its performance risk turns out not to bite at real-repo scale (unverified, one prior data point against it). None of the three should be locked into solution architecture without the specific verification each still needs.

---

## 5. Input Sources

Unchanged from v0.4 for the general framing (CodeGraph's public SDK supersedes raw SQLite; Kubernetes manifests; build manifests), **except**: the Java annotation-extraction mechanism is now specified precisely — `extractFromSource()` per file, not `node.decorators` off the indexed graph (§3). The `Node.decorators` reconciliation spike this section flagged as unresolved/blocking in v0.3/v0.4 is now closed — see §0 item 1 above and the full evidence in `docs/spikes/CodeGraph_Annotation_Extraction_Reconciliation_Spike.md`.

---

## 6–9. Confidence Scoring, Ignored Items Taxonomy, Output Artefacts, `.drawio` Scope

Unchanged from v0.3/v0.4.

---

## 10. Out of Scope for V1

Unchanged from v0.4.

---

## 11. Validation Plan — updated priority order

1. ~~§5 `Node.decorators` SDK reconciliation spike~~ — **RESOLVED this version.** See §0 item 1 and the spike doc.
2. ~~§4 Option A spike: jQAssistant multi-module cross-edge test~~ — **Attempted, environment-blocked** (no JVM/Maven/Docker available). Re-attempt in a JVM-capable environment before Option A can move past "researched, never run."
3. **[v0.5 — new] §4 Option C spike: Graphify at real-target-repo scale (or a larger Fineract slice than the 692-file one already tested).** Directly answers the one open risk that matters for Option C: does the full-repo timeout observed against Fineract actually reproduce at the real target monorepo's scale, or was Fineract's 7,062-file, 126MB-source size an unrepresentative worst case? Cheap-ish (Graphify is already known to install and run cleanly, per the original comparison) but the run itself may take a while if the timeout risk is real — size the timebox accordingly rather than assuming it'll be quick.
4. §4 Option B feasibility check — sketch what FQN-based stitching actually requires per language (unchanged from v0.4, still not done).
5. Evidence one messaging tech (Kafka first, per v0.3/v0.4).
6. Evidence Django/SQLAlchemy + TypeORM/Prisma persistence rows (still provisional/uncited, unchanged from v0.1).
7. Evidence at least one JAX-RS implementation beyond Fineract (Quarkus/Dropwizard/Micronaut) to confirm the rule table transfers.

**Recommended sequencing for solutioning:** item 3 (Graphify re-scale spike) is the next cheapest, highest-leverage item — like items 1–2 before it, it directly shapes whether Option C is worth designing around at all, before solutioning commits to a specific cross-package-edge architecture.

---

## Sources

Unchanged from v0.4, plus: `docs/spikes/CodeGraph_Annotation_Extraction_Reconciliation_Spike.md` (this session's §11 items 1–2 results, now load-bearing for §3/§4/§5 rather than background context).
