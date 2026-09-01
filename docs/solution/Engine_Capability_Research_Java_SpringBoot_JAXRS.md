# Engine capability research — CodeGraph vs. Graphify vs. CodeQL, Java Spring/JAX-RS (reference banking platform)

**Purpose:** a systematic, evidence-first comparison of the three structural/semantic
extraction engines this project has real experience with, scoped to Java
Spring/JAX-RS — a reference Java/JAX-RS banking platform specifically, now that it's a real, buildable
`spikes/` repo — for the purpose of semantic architecture-model building. Written
to be read on its own by someone deciding engine strategy later, without
re-deriving what this session already found the hard way.

**What this is not:** a plan to implement anything. No code changes accompany
this document. It's meant to feed `pipeline/src/scanner/engine-capability-matrix.yml`
(the actual, existing capability framework this repo runs on) and the relevant
`AGENT_TASKS_Ext_*` lane files' future scoping — as evidence, not as a decision
already made.

**Evidence basis:** every claim below traces to something actually run this
session (T-P0-1/T-P0-3, `E1-codeql-engine-evaluation.md`,
`E2-graded-fact-admission-experiment.md`) or to a specific, cited prior finding
already recorded in this repo's own `BACKLOG.md`/code comments — not to tool
documentation or assumption. Where a claim is inference rather than a direct
observation, it's marked as such.

---

## 1. What each tool fundamentally is

| | CodeGraph | Graphify | CodeQL |
|---|---|---|---|
| **Category** | Per-package semantic indexer (vendor SDK) | Whole-repo structural graph extractor | Static-analysis query engine (AST + data flow) |
| **Unit of extraction** | One package root per invocation | One combined pass across every given root (or a computed common ancestor) | One compiled database per language, per repo/module set |
| **Output shape** | Typed facts: native `route` nodes, plus `extractFromSource()`-derived reference facts (`decorates`, `calls`, `references`, `extends`) | Raw graph: untyped nodes (`id`, `label`, `file_type`, `source_file`, `source_location`) + edges (`imports`, `calls`, `references`, `contains`, `inherits`, `implements`) | Arbitrary `.ql` queries over a real semantic model (types, methods, annotations, constant expressions, data flow) |
| **Needs a compile?** | No — indexes source directly | No — buildless, source-only | **Java: yes.** Python/JS/TS: no (confirmed both ways this session and in prior research) |
| **In this pipeline today** | Primary engine for unit typing (`codegraph-provider.ts`) | Sole source of cross-file/cross-package structural edges (`graphify-provider.ts`) | Not wired in — evaluated only (`E1-codeql-engine-evaluation.md`) |

---

## 2. Direct vs. indirect capability — the framing this review uses

A capability is **direct** if its output can become a `TypedUnit`/`TypedRelationship`
fact in the architecture model with no further reasoning step. It's **indirect**
if its real value is corroborating, disambiguating, or validating another
engine's output — still useful, sometimes more valuable than a direct hit, but
a different kind of contribution and a different integration shape (a
confidence/trust-tier input, not a fact producer).

This matters because the three tools split unevenly across that line for Java:
CodeGraph and Graphify are almost entirely direct producers today; CodeQL's
most interesting real capability found this session (see §4.3) is squarely
indirect — resolving an *ambiguity* neither of the other two tools has any
mechanism to even represent, let alone resolve.

---

## 3. Capability matrix — Java Spring/JAX-RS, evidenced

| Capability | CodeGraph | Graphify | CodeQL | Notes |
|---|---|---|---|---|
| HTTP route detection (native framework typing) | **Yes**, where its resolver covers the framework | No (no semantic typing at all) | **Yes**, via framework-aware query (proven for TS/NestJS this session — `permission_controls.ql` — not yet run for Java routes) | For the reference platform specifically: JAX-RS is Phase-1 `extractFromSource()`-fallback (`engine-capability-matrix.yml`'s `jax-rs` row), not native — CodeQL is already named as that row's `augmentEngine`, trigger not yet fired |
| Annotation/decorator extraction generally | **Yes** — `extractFromSource()`, gate-free, file-scoped | No | **Yes**, and more expressively (real AST match on `Annotation`/`getValue()`, not text/regex) | CodeQL's annotation matching is semantic (resolves the annotation's *type*, not its textual name) — relevant to the bare-name-collision problem below |
| Cross-file/cross-package structural edges | Only within `extractFromSource()`'s file-local reference kinds | **Yes — the only source in this pipeline.** One combined pass, 265 real cross-module edges evidenced (`java.md`) | **Yes**, in principle (full program model) — not evaluated for this at scale this session | Graphify's uniqueness here is architectural, not incidental: this pipeline's entire R0/R1/R2/R2b relationship story runs off Graphify's raw graph |
| Symbol/type resolution fidelity | High within a file/package | **Low** — bare-label resolution, no real type binding | **High** — real compiled-AST symbol binding | See §4.1 — this is Graphify's most consequential real weakness |
| Persistence/ORM detection | Yes, via catalogue-driven import-strategy detection (built on Graphify's raw import edges, not CodeGraph alone) | Supplies the raw import edge `persistence-detector.ts` consumes | **Untested, but structurally the strongest candidate** — see §4.3 | The pipeline's actual persistence detector is a CodeGraph+Graphify hybrid already, not either alone |
| DI / interface→implementation resolution | No | Partial — `implements`-edge-based bridge detection (`multi-hop-bridge-detector.ts`, R2/R2b), bounded 2-hop | **Likely yes** — CodeQL's own guidance explicitly recommends its built-in Spring bean-graph models over hand-rolled matching (see §4.2) | Real, evidenced gap in this pipeline today: `docs/solution/BACKLOG.md`'s "Bean-factory / stereotype-free wiring detection" and "Direct-delegate bridge detection" rows are both DI-resolution gaps |
| String-keyed registry/dispatch-table resolution | No mechanism | No mechanism (raw edges only, no value-level reasoning) | **Yes — proven this session.** Generic (no hardcoded class names), 7/7 real edges, 0 false positives after 2 rounds of tightening (`E1-codeql-engine-evaluation.md`) | The one capability class *only* CodeQL can do among the three — needs literal-value joining across an annotation attribute and a builder call, in different files |
| Ambiguous ownership resolution (e.g. "does this class *query* via this client, or just wire it as a DI parameter") | No — CodeGraph's evidence is presence-based (imports X), not usage-based | No — same limitation, one level removed | **Structurally the right tool, untested** — real Java data-flow/taint tracking exists in CodeQL's standard library | See §4.3 — this maps directly onto BACKLOG's still-open JDBC read-service-vs-table-owner ambiguity |
| Buildless operation | Yes | Yes | **No, for Java** — CON-10, real and evidenced twice now (blocked a prior research pass entirely; this session hit and fixed a *different* build blocker, see §5) | The single biggest adoption cost difference between the three for this project's Java target |
| Determinism / reliability at scale | **Real, unresolved issue found this session** — silently returns fewer units under repeated same-process invocation (BACKLOG's "CodeGraph unit extraction degrades..." row) | Raw structural graph is deterministic (byte-identical across repeated fresh runs, confirmed) — but detection *quality* has its own real issues (§4.1) | Deterministic once a database exists — the risk is entirely on the build succeeding, not on query results varying | Three different risk profiles, not "one is simply more reliable" |
| Auditable/versionable as an artifact | No — vendor SDK behavior, opaque | Partially — catalogue-driven consumption of its output is versioned; the extraction itself isn't | **Yes — a `.ql` file is a real, reviewable, diffable source artifact** | Real, non-technical advantage: a CodeQL query lives in the repo and gets code-reviewed like any other detection rule; a vendor SDK's matching logic doesn't |
| Licensing for this project's real target | N/A (already licensed/in use) | N/A (OSS, `pip install graphifyy`) | **Free for OSS eval only; production/private needs GHAS** — resolved this session (`soln/codeql-licensing-check-memo.md`) | Confirmed procurement path exists per your own note; not an open blocker, but a real, non-zero cost line CodeGraph/Graphify don't have |

---

## 4. Findings worth carrying forward, in depth

### 4.1 Graphify's real, evidenced weaknesses are both about *identity*, not *coverage*

Graphify finds edges CodeGraph structurally cannot (cross-file, cross-package)
— that's real and valuable, and nothing else in this pipeline replaces it. But
two separate, both real, both evidenced problems exist in *what a Graphify
node actually means*:

1. **Bare-name collision.** Graphify resolves a bare identifier (e.g. an
   `@Component` annotation's simple class name) against *any* same-named node
   anywhere in the whole combined-extraction graph — not against the file's
   real import statement. Quantified on a real 918-relationship reference-platform scan:
   **32.4% of relationships** were this exact false-positive shape
   (`graphify-reconciler.ts`'s own code comment, `B-stereotype-name-collision`).
   A real mitigation exists in this pipeline (`isBareNameCollision`, a
   source-file-import-vs-target-package cross-check) but it's a patch on top
   of a structural weakness, not a fix to the weakness itself — Graphify
   doesn't do real symbol resolution, so this class of error is always
   possible in principle, just increasingly rare as more guards get added.
2. **Unattributable external symbols emit empty `source_file`.** Found this
   session (E2's evidencing): a decorator name imported from an external
   package (e.g. NestJS's `@Controller`/`@Get`) gets a real Graphify node with
   `source_file: ''` — Graphify knows *a reference exists* but not where it's
   really declared. This is not a bug in Graphify so much as an inherent limit
   of a tool that doesn't compile or resolve real symbol tables: it can see
   *that* a name is referenced, never definitively *what* that name resolves
   to when the answer isn't in the scanned source tree at all.

**CodeQL has neither problem** — because it operates on a real compiled AST
with real type bindings, "which class does this reference resolve to" isn't a
heuristic, it's a compiler fact. This is the most concrete argument for CodeQL
as *quality corroboration* for Graphify's own output, independent of any new
capability: a small, targeted CodeQL query that re-resolves a sample of
Graphify's edges would directly measure how often the 32.4%-class problem
still occurs after existing mitigations, something this pipeline currently
estimates only from a single historical repro, not an ongoing measurement.

### 4.2 DI/bean-graph resolution — CodeQL's own documentation already names the right approach, unverified until now

The research workspace's own CodeQL query README states directly: *"Prefer
CodeQL's built-in framework models... over hand-rolled AST matching wherever
they exist — they're maintained by GitHub and handle far more edge cases than
a from-scratch query will."* This project's own real, open backlog rows —
**"Bean-factory / stereotype-free wiring detection"** and **"Direct-delegate
bridge detection"** (28 real candidates found, 0 resolved) — are both, at
root, the same underlying problem: resolving Spring dependency injection
(interface/factory-method → real implementation), which neither CodeGraph's
annotation extraction nor Graphify's `implements`-edge-based 2-hop bridge
detector can do beyond their current bounded mechanisms.

**Not evaluated this session** — this is a real, concrete next research step,
not a finding yet. But it's the single highest-value untested hypothesis this
review surfaced: if CodeQL's Spring framework model resolves DI as well as its
own documentation claims, it could plausibly close *both* named backlog gaps
at once, since they're the same underlying resolution problem wearing two
different names.

### 4.3 The JDBC ownership ambiguity — CodeQL may be the first tool this project has that can actually answer the question

`BACKLOG.md`'s "JDBC read-service-vs-table-owner ambiguity" row is unusually
well-documented as a *dead end for this pipeline's existing mechanisms*: Phase
A's real evidence pass (`soln/bug3-jdbc-ownership-phase-a-memo.md`) falsified
`RowMapper<T>` presence as a signal, falsified bare `@Service` stereotype
exclusion, and found no corroborated naming convention. The reason all three
failed is structural: they're all **presence-based** heuristics (does this
class have annotation X / implement interface Y), and the real distinguishing
fact is **behavioral** — does this class actually *execute a query* through
the client it imports, or only wire it through as a constructor parameter for
someone else to use?

That is exactly the class of question real data-flow analysis answers and
presence-based AST matching structurally cannot. CodeQL's standard library
includes real taint/data-flow tracking for Java. **This was not tested this
session** — it's a hypothesis grounded in what CodeQL is generally capable of,
not a result — but it's the most promising concrete angle on a gap this
project has already spent a full investigation phase on and explicitly
concluded (correctly, given the tools available at the time) was unresolved
with the mechanisms on hand.

### 4.4 Command-bus dispatch — the one capability class evidenced as CodeQL-only

Real, run, verified this session (`E1-codeql-engine-evaluation.md`): resolving
`ChargesApiResource → CreateChargeDefinitionCommandHandler` requires joining a
literal string value set to another. Neither CodeGraph (annotation-*presence*,
not value-matching across files) nor Graphify (raw structural edges, no
constant-value reasoning at all) has any mechanism that could express this
join, generically, at all. This isn't a maturity gap that more catalogue rows
would close in either tool — the join fundamentally needs semantic,
constant-value-aware AST reasoning, which is CodeQL's actual category of
capability, not an extension of the other two.

### 4.5 CodeGraph's degradation-under-load is a real, separate axis from Graphify's identity problems

Worth stating plainly since it's easy to conflate "reliability issues" as one
bucket: Graphify's problems are about *correctness of identity* (does this
edge point at the right thing), stable across repeated runs. CodeGraph's
problem, found this session, is about *completeness under operating
conditions* (does repeated same-process invocation silently return fewer
units) — a fresh, isolated process is fully deterministic (94/94/94 across
three cold runs against the real reference platform); the same scan run repeatedly within
one long-lived process gives a different, but internally consistent, lower
number (60-64). These are different failure modes needing different
mitigations (Graphify: better identity resolution; CodeGraph: understanding
what resource the SDK exhausts under repeat invocation) — worth keeping
separate in any future capability-matrix trust-tier design, not folded into
one generic "reliability" score.

### 4.6 The buildless/build-based line is the real adoption-cost divider, and it's sharper than expected

Two separate real build blockers were hit and fixed for reference-platform-with-CodeQL
this session, worth distinguishing since they look similar but aren't:

1. **Prior research pass:** genuine network unavailability (no route to Maven
   Central / `services.gradle.org`) — an infrastructure/CI-policy problem, not
   a CodeQL or reference-platform problem.
2. **This session:** network was fine, but the reference platform's Gradle version-derivation
   plugin needs `git describe --tags`, which fails on a shallow clone (no
   tags reachable). Fixed by `git fetch --unshallow`.

Both are real, both are "CodeQL's Java extractor needs the build to actually
succeed" manifesting differently. The generalizable finding: **for any future
Java repo, "can CodeQL build it" is never a yes/no answered by the language
alone — it's answered by that specific repo's build tooling's own
prerequisites** (network reachability, version-control metadata availability,
JDK version match, dependency mirror access). Graphify and CodeGraph have no
equivalent failure class at all — buildless tools don't inherit a build
system's own fragility.

---

## 5. What this does *not* yet establish (honest gaps in this review itself)

- **Only one real Java codebase tested** (the reference banking platform) — a JAX-RS + Spring hybrid
  (REST layer is JAX-RS; DI/security/batch/messaging is Spring), not a pure
  Spring MVC application. `engine-capability-matrix.yml`'s own `spring-mvc`
  row is still `evidenceLevel: mechanism-proven-other-frameworks # never run
  against real Java Spring MVC source in this project` — this review does not
  close that gap; a pure Spring MVC (`@RestController`, not JAX-RS) sample
  would be needed to.
- **§4.2 and §4.3 are hypotheses, not results.** Both are well-grounded in
  what CodeQL is generically capable of and in this project's own already-
  documented dead ends, but neither DI resolution nor JDBC ownership
  disambiguation was actually run against CodeQL this session. They're the
  natural next two experiments, not findings.
- **CodeQL's cost at real monorepo scale is unmeasured.** The reference platform has 30+
  Gradle modules; this review only built and traced the reference Java/JAX-RS
  banking platform's charge module (+ its transitive core/tax deps) — a few seconds once
  warm. Building and tracing the *entire* monorepo (needed for a
  repo-wide DI-resolution or ownership-disambiguation pass) was not attempted
  and could have a materially different cost profile.
- **No comparison run for Python/Node**, though the research workspace's own
  prior findings (OpenBB, Ghostfolio) already show CodeQL winning outright
  there (buildless, 4.4x recall over hand-written regex extraction) — worth
  folding into a future revision of this document if a Python/Node engine
  strategy question comes up, rather than re-deriving it.
- **No quantitative re-measurement of the 32.4% bare-name-collision rate**
  after this pipeline's existing mitigations — §4.1's number is the original,
  pre-mitigation finding, cited for scale, not as a current-state number.

---

## 6. Recommended next research steps, in priority order

1. **Test §4.2 (DI/bean-graph resolution) for real** against the reference platform's own
   `@Bean`-factory/plain-interface gaps (`ChargeConfiguration`-shaped classes,
   already named in `Architect_Pilot_Feedback_Notes.md`'s Entries 11-13) — highest
   expected value, since it's evidenced as potentially closing two named
   backlog rows at once, not speculative capability.
2. **Test §4.3 (JDBC ownership disambiguation)** against the exact flagship
   false-positive case already characterized (`ChargeReadPlatformServiceImpl`)
   — a real data-flow query either resolves this project's longest-standing
   documented dead end, or gives a second, differently-shaped falsification to
   add to the Phase A memo.
3. **Run a pure Spring MVC sample** (not JAX-RS) to actually clear
   `engine-capability-matrix.yml`'s own `spring-mvc` `evidenceLevel` caveat —
   currently untested by this project at all, independent of which engine.
4. **Quantitatively re-measure the bare-name-collision rate** on a fresh full
   reference-platform scan with current mitigations active, to know whether 32.4% (raw)
   is now closer to 0% or still a meaningful residual — turns §4.1 from a
   historical citation into a current, trackable number.
5. **Only after 1-3 land** — revisit whether any of this warrants a change to
   `engine-capability-matrix.yml`'s `augmentEngine`/`augmentTrigger` rows for
   `jax-rs`/`jpa`/`spring-*`, and whether CodeQL's role in this pipeline should
   be "second `StructuralEngine`" (direct fact producer, per the original E1
   framing) or "corroboration/trust-tier input" (per §4.1/§4.3's actual
   strongest evidenced use case) — these are different integration shapes,
   and this review's own evidence leans toward the corroboration framing
   being more clearly demonstrated so far, not the direct-producer one.
