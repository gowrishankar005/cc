# Requirements v0.4 — Repo Analyser/Orchestrator Platform + CALM Generator Module

**Status:** Reviewed draft. Supersedes v0.3. Reopens the scanner-tool question v0.1–v0.3 silently dropped, and connects it to the §4 cross-package blocking issue found in the last review.

---

## 0. Changes from v0.3 — and an honest note on why

**What happened:** the hybrid-tool idea (jQAssistant for Java + CodeGraph for Node/Python) was actively explored earlier in this project and was never rejected — it just stopped appearing once work moved into Claude Code and CodeGraph became the only tool referenced. That's a real drift the document's own versioning discipline should have caught and didn't. Worth naming plainly rather than smoothing over.

**Why it matters now, specifically:** re-examining it wasn't just "let's revisit an old idea" — it turns out to bear directly on the §4 cross-package relationship problem (last review). That connection is new; it wasn't why jQAssistant was originally on the table.

1. **§4 gets a newly identified, more specific blocking issue**, plus two candidate resolutions — neither yet verified.
2. **§1 Scanner Layer reframed**: which tool serves which language is now an explicit open decision per language, not an implicit "CodeGraph does everything."
3. **§5 gets jQAssistant back as a named, provisional Java-specific candidate**, held to the same evidence bar as every other provisional row.
4. **§11 validation plan gets two new, prioritized spikes** to close this before solutioning locks in an approach.

---

## 1. System Structure: Platform + Modules

Structure unchanged from v0.3 (Scanner → Analysis → Orchestration → modules; typed-facts.json as the module contract; determinism rule).

**[v0.4] Scanner Layer, reframed:** "the Scanner Layer runs CodeGraph" is not accurate as a blanket statement — it was never re-decided, just assumed by omission. Correct framing: **the Scanner Layer produces raw graph facts per language; which tool produces them is a per-language decision**, currently:

| Language | Current tool | Status |
|---|---|---|
| Python | CodeGraph | Evidenced (OpenBB, Bank of Anthos) |
| Node/TypeScript | CodeGraph | Evidenced (Ghostfolio) |
| Java | CodeGraph | Evidenced, but with two known real gaps: JAX-RS/JPA require our own interpretation layer (§3, unchanged), and — new this version — CodeGraph cannot merge multiple package roots into one graph (§4). **jQAssistant is a live, unverified candidate specifically for Java**, not a settled replacement. |

---

## 2. CALM 1.2 Construct Coverage

Unchanged from v0.3.

---

## 3. Signal → Typed-Fact Mapping

Unchanged from v0.3 (Java framework backlog, Python/Node core, evidence discipline). The rule-table design (framework, language, signal pattern, fact type, confidence contribution) is tool-agnostic by construction — if jQAssistant ends up producing the Java raw facts instead of CodeGraph, the JAX-RS/JPA rules in this table still apply, they just read from a different raw source. Worth stating explicitly: **this section does not need to change regardless of how §4 resolves.**

---

## 4. Cross-Language Risk: the `detect()` Gate — and a newly identified, related blocking issue

The `detect()`-gate requirement (per-package-root indexing, non-zero-route smoke test) is unchanged from v0.3.

**[v0.4 — new] What per-package indexing costs, not previously addressed:** CodeGraph indexes each root into its own isolated database, and **does not support merging multiple roots into one queryable graph** — confirmed by a real, closed-as-not-planned request: GitHub Issue #281, "Allow multiple roots projects." So if §4's requirement is satisfied literally (index every package separately to dodge the `detect()` gate), a `calls`/`imports` edge that crosses a package boundary — Service A in package X calling Service B in package Y — is likely invisible to both indexes. This isn't hypothetical: it directly undermines the §3 JPA/database clustering design too, since entity references frequently cross module boundaries in real multi-module builds (Fineract's own module layout is a working example of this).

**Two candidate resolutions, neither verified yet:**

**Option A — Hybrid: jQAssistant for the Java scan.** jQAssistant scans into a persistent Neo4j database, and its normal usage pattern in multi-module Maven projects is to scan each module's bytecode into the *same* cumulative graph across a build — which, if it holds, would mean cross-module edges are naturally captured rather than needing to be reconstructed. **This is a genuine hypothesis, not a verified fact** — it's consistent with how jQAssistant's own documentation and tutorials describe multi-module dependency analysis, but nobody has actually run it against a real multi-module Java codebase in this project and checked for cross-module edges. It also only ever solves the Java third of the problem — Python and Node still need Option B regardless of this decision, so Option A is a partial fix even in the best case, not a full one.

**Option B — In-house cross-root stitching.** Keep CodeGraph (or whichever scanner) per-package, and add an explicit analysis-layer step that resolves symbols across the separately-indexed graphs by fully-qualified name / import-path matching — e.g., Service A's `imports` edge referencing `com.example.packagey.ServiceB` gets stitched to package Y's index by FQN match rather than relying on either tool's own internal graph. Tool-agnostic (works the same whether Java uses CodeGraph or jQAssistant), works for all three languages uniformly, but is itself unbuilt and unverified effort, and importation/module-resolution conventions differ enough across Java/Python/Node that "one stitching rule" may not actually be one rule in practice.

**These aren't mutually exclusive** — Option A (if it holds) reduces how much Option B's Java-side stitching needs to do, but Python/Node need Option B either way. Recommended framing for solutioning: **treat Option B as the baseline that will be built regardless**, and treat Option A as a scoped spike that, if it pans out, narrows Option B's Java workload — not as an alternative that removes the need to design Option B at all.

---

## 5. Input Sources — jQAssistant reintroduced as a provisional candidate

Unchanged from v0.3 for CodeGraph/Python/Node and the `Node.decorators` reconciliation spike (still unresolved, still blocking, still no owner or date — that gap from the last review has not been closed by this version and shouldn't be read as resolved).

**[v0.4 — new row, held to the same evidence bar as every other provisional item in this document:**

| Candidate | Status | What would need verifying before it's anything more than provisional |
|---|---|---|
| jQAssistant (Java scanning) | **P — researched, never installed or run in this project** | (1) Cross-module edge continuity across multiple scanned Maven modules in one Neo4j graph — the §4 Option A hypothesis. (2) Whether its JAX-RS plugin (evidenced only via one bullet in an old conference slide deck) still exists, is maintained, and handles the modern `jakarta.ws.rs` namespace vs. the legacy `javax.ws.rs` one. (3) Confirmed real gaps that don't need re-verifying: no mature Python plugin found anywhere in its ecosystem; TypeScript plugin exists but is explicitly unreleased (RC1), with a maintainer stating outright there was no working JS/TS scanner as of that discussion. GPLv3 license — different from CodeGraph's MIT — worth a licensing check before adoption, not a blocker on its own. |

---

## 6–9. Confidence Scoring, Ignored Items Taxonomy, Output Artefacts, `.drawio` Scope

Unchanged from v0.3.

---

## 10. Out of Scope for V1

Unchanged from v0.3. jQAssistant's addition here doesn't change what's out of scope — it changes *how* the in-scope Java facts might get produced, which is a §1/§4/§5 concern, not a scope concern.

---

## 11. Validation Plan — two new spikes, prioritized ahead of solutioning committing to an approach

Priority order updated:

1. **§5 `Node.decorators` SDK reconciliation spike** — still first, still blocking, still unowned. Carried forward unresolved from v0.2/v0.3; flagging again because it hasn't moved.
2. **[v0.4 — new] §4 Option A spike: jQAssistant multi-module cross-edge test.** Install jQAssistant, scan two or more real Fineract Maven modules (e.g. `fineract-loan` and `fineract-provider`, which we already know reference each other) into one Neo4j instance, and check via Cypher whether a cross-module call/dependency edge actually appears. A few hours of work, and it directly answers whether Option A is real before any orchestration-layer design commits to it.
3. **[v0.4 — new] §4 Option B feasibility check**, done regardless of #2's outcome: sketch what FQN-based stitching actually requires per language (Java fully-qualified class names vs. Python's `import` resolution vs. Node's module resolution/`node_modules` conventions) — even a rough sizing here matters, since "one stitching rule for three languages" may turn out to be closer to three related-but-distinct rules.
4. Evidence one messaging tech (Kafka first, per v0.3).
5. Evidence Django/SQLAlchemy + TypeORM/Prisma persistence rows.
6. Evidence at least one JAX-RS-implementation beyond Fineract (Quarkus/Dropwizard/Micronaut) to confirm the rule table transfers.

**Recommended sequencing for solutioning:** items 1 and 2 above are both cheap (hours, not days) and both directly shape the scanner/orchestration design that everything else sits on top of. Worth running both before solutioning commits to a specific architecture, even though it delays the start slightly — this is the same judgment call as the earlier decision to test tools against real repos before writing code, and it's paid off every time so far in this project.

---

## Sources

Unchanged from v0.3, plus: GitHub Issue #281 (`colbymchenry/codegraph`, "Allow multiple roots projects," closed as not planned) — cited in this project's earlier tool-comparison research, now directly load-bearing for §4 rather than background context.
