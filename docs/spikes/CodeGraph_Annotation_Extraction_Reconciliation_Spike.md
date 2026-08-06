# Annotation-Extraction Reconciliation Spike — Results

**What this is:** the two prioritized items from `docs/requirements/CALM_Generator_Requirements_v0_4.md` §11 ("run these before touching solution architecture"), run against the currently-installed CodeGraph v1.5.0 and this session's real clones of Apache Fineract and Bank of Anthos.

**Bottom line up front:** item 1 (the `Node.decorators` reconciliation spike) is complete and **overturns a conclusion from this project's earlier session** (recorded in `docs/requirements/CALM_Generator_Requirements_v0.1.md` §5): `node.decorators` is **not** a reliable generic annotation hook for Java. The reliable extraction point is different, and is identified below. Item 2 (jQAssistant multi-module spike) **could not be run** — this environment has no working Java runtime, no Maven, no Docker. That is reported as a blocker, not simulated.

---

## Item 1: `Node.decorators` reconciliation spike — RESULT: hypothesis falsified, real mechanism identified

### What was being checked

The requirements v0.1 document claimed (based on reading `extraction/tree-sitter.js` source, never on running the tool): *"`Node.decorators?: string[]` is populated generically for every language including Java... raw annotation names are readable directly off class/method nodes via `getAllNodes()`."* This was never verified against real indexed output. v0.4 correctly flagged this as unresolved and blocking.

### What was actually run

1. `codegraph init` against `spikes/fineract/repo/fineract-charge` (a real, self-contained Maven module — 38 files, 818 nodes, 1,397 edges, 1.5s).
2. Queried the persisted index via the public `CodeGraph` SDK (`getNodesByName`, `getNodesByKind`, `getOutgoingEdges`) for `ChargesApiResource` (JAX-RS: `@Path`, `@GET`/`@POST`/`@PUT`/`@DELETE`) and `Charge` (JPA: `@Entity`, `@Table`, `@Column`).
3. When that came back empty, went one level lower: called the public `CodeGraph.extractFromSource(filePath, source)` method directly — raw single-file extraction, no indexing/persistence/resolution involved — on the same two files, and inspected the full `ExtractionResult` (`nodes`, `edges`, `unresolvedReferences`).

### Result

| Check | Outcome |
|---|---|
| `node.decorators` on the persisted `ChargesApiResource` class node | `undefined` |
| `node.decorators` on the persisted `Charge` entity class node | `undefined` |
| `getOutgoingEdges()` on either class, filtered to `kind === 'decorates'` | **0 edges**, on both — only `contains` edges present |
| Native `route` node count (`getNodesByKind('route')`) | **0** — expected; JAX-RS has no CodeGraph resolver, confirmed again |
| Raw `extractFromSource()` on `ChargesApiResource.java` — `unresolvedReferences` filtered to `referenceKind === 'decorates'` | **36 refs**, correct raw names: `Path` (line 56, class), `GET`/`Path`/`Produces` per method (lines 75, 88-90, 114-116, …), `POST`/`Consumes` (line 133), etc. — every JAX-RS annotation in the file, correctly attributed to the right `fromNodeId` (class or specific method) |
| Raw `extractFromSource()` on `Charge.java` — same filter | **48 refs**: `Entity`/`Table` (class, lines 60-61), `Column` per field (lines 72, 76, 80, 83, 87…) — every JPA annotation, correctly attributed |
| `node.decorators` in the **raw** extraction result (pre-DB) | Non-empty only for Lombok-synthesized methods (`getName`, `getAmount`, …), each tagged `["lombok"]` — this is `java.js`'s hardcoded Lombok-synthesis special case, unrelated to real annotation capture |

### Why the persisted-edge path comes back empty (root-caused, not just observed)

`extraction/tree-sitter.js`'s `extractDecoratorsFor()` **does** correctly walk Java's `modifiers` child node and **does** emit a `decorates` unresolved reference for every real annotation (confirmed above — this part of the original spike-era finding holds). But an unresolved reference only becomes a persisted `Edge` if the resolution pass finds a **matching node already in the index** to attach it to. `Path`, `GET`, `Entity`, `Column`, etc. are external `jakarta.ws.rs`/`jakarta.persistence` types — never declared as classes anywhere in a source-only index. In a small, single-module index (this test: 38 files), there is no candidate for even a wrong "fuzzy" match, so the reference is dropped silently — not resolved, not visible via `getOutgoingEdges()`, and `node.decorators` was never populated for it in the first place (that field is fed by a different, narrower code path than the `decorates` reference stream). The original `CodeGraph_Discovery_Spike_Report.md` finding — "919/919 JAX-RS instances resolved at the 'fuzzy' tier" — was observed against the **full 7,062-file Fineract repo**, where sheer corpus size makes a same-named symbol collision (right or wrong) far more likely. That doesn't help here: the original spike itself already warned the resolved *target* is frequently wrong and unusable, so depending on resolution succeeding was never the right design regardless of corpus size.

### Conclusion — corrected architecture decision for the Annotation Interpretation Layer

**Do not build the interpretation layer against `node.decorators` or against persisted `decorates` edges.** Both are unreliable for real annotations on Java (one is empty, the other depends on incidental corpus-size effects and would need the wrong-target problem worked around anyway). 

**Build it against `CodeGraph.extractFromSource(filePath, source)`**, called directly per source file (the orchestrator reads the file itself and passes the content in): filter `result.unresolvedReferences` to `referenceKind === 'decorates'`, and use `referenceName` + `fromNodeId` (which node — class, method, or field — the annotation sits on) as the signal. This is a documented, public, single-file, no-persistence-required API call — it works identically whether the orchestrator is indexing per-package (per the §4 `detect()`-gate mitigation) or the whole repo at once, since it doesn't depend on graph resolution succeeding at all. This should replace the relevant part of the requirements doc's Java signal-extraction design (§3/§5 in both v0.1 and v0.4).

**Scope note:** this spike tested Java only, since that's where the original claim and the blocking gap both live. A quick side-check on Python (Bank of Anthos' `userservice.py`, Flask) found `extractFromSource()` on a bare single file (no project manifest/context) produces **zero** `decorates` refs and zero native `route` nodes — consistent with framework-specific extraction (Flask's `@app.route` typing) requiring the full indexing pipeline's `detect()`/context machinery, which single-file `extractFromSource()` doesn't run. This isn't a new finding (it's consistent with the already-documented `detect()`-gate risk) but is worth noting: **the `extractFromSource()` shortcut validated above for Java's generic annotation capture is not a substitute for the full per-package index when native framework route-typing is what's needed** — the two serve different purposes (raw annotation-name capture vs. framework-native typed `route` nodes) and the orchestrator needs both.

---

## Item 2: jQAssistant multi-module cross-edge spike — BLOCKED, not run

**Checked:** `java -version` → no JRE installed (`/usr/bin/java` is macOS's install-stub, not a real JVM). `mvn` → not found. `docker` → not found.

jQAssistant is itself a JVM tool that scans via a Maven plugin or standalone CLI, normally backed by an embedded or external Neo4j. None of the three ways to run it (local JVM + Maven, standalone JVM CLI, or a Neo4j+jQAssistant container) are available in this environment. This was verified by checking, not assumed — no attempt was made to fake or approximate this result.

**This spike needs to run in an environment with a working JDK (11+) and either Maven or Docker before §4 Option A (the jQAssistant hybrid hypothesis) can be treated as anything more than the "researched, never run" status v0.4 already assigns it.** Nothing here changes that status — it remains fully open.

**Recommendation for solutioning in the meantime:** per v0.4 §4's own framing, Option B (in-house FQN-based cross-root stitching) is "the baseline that will be built regardless," with Option A only narrowing its Java-side scope *if* it pans out. Since Option A remains unverified and unrunnable here, solution architecture should proceed on the assumption that **Option B is required for all three languages**, and treat jQAssistant/Option A purely as a future scoped spike to run in a JVM-capable environment — not as something the current architecture should be designed around or await.

---

## Net effect on `docs/requirements/CALM_Generator_Requirements_v0_4.md`

- §5's `Node.decorators` reconciliation spike can now be marked **resolved**, with the corrected extraction approach documented above — not "decorators generically populated," but "raw `decorates` unresolved references via `extractFromSource()`, per file, independent of indexing/resolution."
- §4 Option A remains **unverified** (environment-blocked, not evidence-based). §4 Option B's status is unchanged but is now the *de facto* required baseline given Option A can't be validated here.
- §3's Java signal-extraction rows (JAX-RS `@Path`/`@GET`, JPA `@Entity`/`@Table`/`@Column`) are **confirmed still valid as CALM-mapping targets** — the annotations are real and reliably extractable — but the *mechanism* the orchestrator uses to reach them needs to change from what v0.1 assumed.
