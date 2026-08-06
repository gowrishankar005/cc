# CodeGraph vs. Graphify — Structural Engine Comparison

**Basis:** both tools installed and run against real code — Apache Fineract (full repo for CodeGraph; `fineract-loan`, a 692-file bounded slice, for Graphify after a full-repo run exceeded available time) — plus source-level verification of claims neither tool's marketing fully supported on its own. Nothing here is taken from documentation alone without a corresponding test or source-code check.

---

## 1. What we were actually testing for

Two concrete needs from the Solution Design, unresolved as of the last gap-closure pass:
1. A **bulk, portable export** of the full node/edge graph (Playbook Phase 2.2, "Thin Graph Query Layer").
2. **Framework/annotation-aware typing** — specifically, can the tool recognize JAX-RS (`@Path`, `@GET`, `@Produces`), the REST style this real fintech platform actually uses, not just Spring MVC.

---

## 2. Performance (measured, not vendor-claimed)

| | CodeGraph | Graphify |
|---|---|---|
| Test scope | Full repo — 7,062 files | `fineract-loan` slice — 692 files |
| Result | 182,573 nodes / 492,497 edges in **42.8s** core work | 7,527 nodes / 22,082 edges in **18s** |
| Full-repo attempt | Completed | **Exceeded our execution time limit** — only partial cache written, no `graph.json` produced |
| Storage | 706MB SQLite for 126MB source (~5.6x) | Single `graph.json`, size scales with corpus |

Extrapolating Graphify's slice linearly to full-repo scale suggests several minutes, vs. CodeGraph's 43 seconds — a real, substantial gap. Plausible explanation, not just brand loyalty: CodeGraph's engine was recently rewritten in Rust; Graphify is 100% Python (confirmed via GitHub language stats). This should be re-verified at real pilot-repo scale before being treated as decisive — Fineract-scale isn't necessarily your monorepo's scale.

---

## 3. Bulk export — the thing CodeGraph doesn't have

| | CodeGraph | Graphify |
|---|---|---|
| CLI/MCP bulk export | **None.** Every command (`query`, `node`, `callers`, `explore`, `files`, `status`) is a targeted lookup, built for an AI agent asking specific questions. | **Yes** — `graph.json` is a first-class output of every run: a plain `{nodes: [...], edges: [...]}` file, directly loadable. |
| How to get the full graph | Query the internal SQLite file directly (`.codegraph/codegraph.db`) — works, but the schema is **undocumented and not part of the public API** (confirmed: `registerFrameworkResolver` and the whole `resolution/frameworks` module aren't reachable through the package's declared `exports` — verified with a direct `ERR_PACKAGE_PATH_NOT_EXPORTED` test, not assumed). | Already solved. |
| Coupling risk | Real — an undocumented internal schema could change on any CodeGraph version bump with no warning. Mitigation: pin the version, isolate all SQLite access in one module. | Low — `graph.json`'s shape is the tool's actual advertised contract. |

**This is Graphify's clearest, least ambiguous win.**

---

## 4. Framework / annotation detection — the JAX-RS test

Verified against real Fineract source (`SchedulerApiResource.java`, `DelinquencyApiResource.java` — genuinely live JAX-RS endpoints, confirmed by finding the `JerseyConfig.java` bridge that wires `@Path`-annotated Spring beans into Jersey at runtime, not dead code from a migration).

| | CodeGraph | Graphify |
|---|---|---|
| Native "route" typing | Yes, but **Spring MVC only** (`@GetMapping`/`@RequestMapping`) — confirmed by reading the actual resolver source: only 2 Java frameworks registered (`spring`, `play`), regex patterns match Spring mapping annotations exclusively. | **None, for any framework.** Confirmed: the full relation vocabulary is `references, imports, calls, method, contains, case_of, inherits, implements` — no `route`, no `decorates`, nothing framework-specific. |
| What happens to `@Path`/`@GET` | Captured as a `decorates` edge, but **100% of 919 instances resolved at the tool's own lowest confidence tier ("fuzzy")** — the resolved target is often wrong (fuzzy name-matching against an in-repo symbol, since JAX-RS's real definition is external). | Captured as a generic `references` edge to an unresolved stub node, tagged `EXTRACTED`. But `EXTRACTED` here certifies "this reference exists in source," not "we resolved it correctly" — a different (not simply better) confidence axis than CodeGraph's fuzzy tag. |
| Net effect | Spring MVC gets free, real typing. JAX-RS gets a low-trust breadcrumb. | **Every** framework, including Spring, gets the same flat treatment — more consistent, but strictly more total interpretation work falls on us, not less. |
| Extensibility to fix this | `registerFrameworkResolver` exists in source but is **not part of the public API** (verified empirically — not just undocumented, actually blocked by Node's `exports` field). Fixing this natively would require forking, not extending. | Python has no equivalent hard export boundary, so the contribution path (`ARCHITECTURE.md`'s "add an `extract_<lang>()` function") is more genuinely open — though it's still "edit/extend the source," not a clean runtime plugin API, and wasn't tested end-to-end. |

**Conclusion: neither tool solves this for us.** Our own annotation-interpretation layer (reading raw annotation names and mapping them to Appendix B signal categories) is required either way — the choice of tool changes *how much* of that work is needed (less with CodeGraph, since Spring is free; more with Graphify, since nothing is free) but not *whether* it's needed.

---

## 5. Node/edge schema richness

| | CodeGraph | Graphify |
|---|---|---|
| Node typing | Explicit `kind` enum: `class, method, field, interface, enum, constant, namespace, route, import, variable` | **No `kind` field at all.** Type is only implicit — via ID nesting depth and label formatting (methods prefixed with `.`) — something we'd have to reconstruct ourselves. |
| Confidence granularity | 4 tiers on resolution: `exact-match, framework, fuzzy, import` | 2–3 tiers on extraction: `EXTRACTED, INFERRED` (`AMBIGUOUS` only appears in LLM/deep mode, not seen in code-only runs) |
| Dynamic dispatch | Explicit pipeline stage, confirmed in indexer logs ("Linking dynamic dispatch...") | Not specifically tested; not called out as a distinct capability in what we read |

CodeGraph's schema is meaningfully richer and does more of the "is this a class or a method" work for us.

---

## 6. Risk surface (relevant since both would eventually touch a real, proprietary monorepo)

| | CodeGraph | Graphify |
|---|---|---|
| License | MIT | Apache 2.0 |
| Data egress by default (code-only use) | None — fully local | None — confirmed by testing: `--code-only --no-cluster` ran clean, no network calls, no API key needed |
| Data egress if misconfigured | N/A — no LLM integration exists in the tool at all | Real — non-code content (docs/PDFs) and any `extract` run without `--code-only` routes through a configurable LLM backend, one of which (`Moonshot/Kimi`) explicitly sends data to **servers in China**. Avoidable, but a real default to be careful with. |
| Other surface area | None beyond the CLI/MCP itself | Git hooks (auto-run on commit), MCP-over-HTTP with API key auth, and a tie-in to a separate commercial product ("Penpax") describing itself as mapping "meetings, browser history, emails, files, and code" — none of this was used in our test, but it's part of what you'd be adopting. |
| Prompt-injection defense (LLM mode only) | N/A | Genuinely good — every source file wrapped in `<untrusted_source>` tags with explicit instructions not to treat file content as commands. Worth noting as a maturity signal even though we didn't use this path. |

---

## 7. Deep/semantic mode (Graphify only — read from source, not executed; no LLM backend was available or configured)

The actual system prompt, read directly from `llm.py`:
- Base semantic pass and "deep mode" are the **same mechanism** — deep mode just appends a short instruction to include more `INFERRED` edges, restricted to "concrete architectural signals," explicitly told to avoid "broad conceptual similarity edges."
- The output schema's `file_type` vocabulary (`code|document|paper|image|rationale|concept`) has **no route/controller/entity category, deep mode or not** — so even fully enabled, this would not have natively solved the JAX-RS typing gap. It might add an extra inferred edge around a `@Path`-decorated method if the model judges it architecturally significant, but there's no guarantee and no structured "this is an HTTP entry point" output.
- **Conclusion:** deep mode is orthogonal to the framework-detection problem, not a fix for it, and enabling it at all means a deliberate, separate decision about sending code to a cloud LLM (or self-hosting via Ollama) — not something to fold into a tool-selection decision.

---

## 8. Summary comparison

| Dimension | Winner |
|---|---|
| Performance at scale | **CodeGraph** — meaningfully faster, verified not assumed |
| Bulk export / schema stability | **Graphify** — real advertised contract vs. undocumented internal DB |
| Node typing richness | **CodeGraph** — explicit kind enum vs. none |
| Framework/annotation coverage | **Tie, both insufficient** — CodeGraph free for Spring only; Graphify free for nobody |
| Extension path if we wanted to fix it natively | **Graphify, marginally** — no hard export boundary, though untested end-to-end |
| Risk surface for code-only use | **CodeGraph** — no LLM integration to misconfigure at all |
| Maturity signals (security design, etc.) | Graphify's prompt-injection defense is a genuine positive, but only relevant if LLM mode is ever used |

---

## 9. Recommendation

**Use CodeGraph as the primary structural engine**, for three reasons that matter more than the single category Graphify wins:
1. The performance gap is large and verified, and large-monorepo performance was already a named risk in the original Solution Design review — this isn't a marginal tiebreaker.
2. The richer node schema (`kind` enum) reduces how much reconstruction work our own Heuristics Engine has to do — Graphify's flat schema pushes that cost onto us regardless of which tool we pick.
3. The bulk-export gap is real but **solvable with ordinary engineering discipline** (pin the CodeGraph version, isolate all SQLite access behind one module, treat any CodeGraph upgrade as a re-validation event) — whereas Graphify's performance gap and missing node typing aren't things we can engineer around from our side.

**Keep Graphify as a documented fallback, not a discard.** If the SQLite-coupling risk turns out worse in practice than expected during the pilot (e.g., a CodeGraph upgrade silently breaks our data-access layer), Graphify's portable `graph.json` is the credible escape hatch specifically because of the property it wins on.

**Either way, the annotation-interpretation layer is unavoidable and should be built now**, scoped first to JAX-RS + Spring (proven against real Fineract source), since neither tool solves that problem natively.

---

## 10. How to proceed

1. **Validate the one thing Fineract couldn't test: polyglot coverage.** This whole comparison ran on a 99.9% Java repo. Before locking in CodeGraph, run the same performance + annotation tests against a real Node and Python slice — ideally from your actual monorepo, not a substitute — since CodeGraph's language-specific engineering quality may not be uniform (we already saw its Java framework coverage was narrower than its own marketing implied).
2. **Build the two components already scoped, now that they're precisely specified:**
   - The SQLite data-access layer (Playbook Phase 2.2), version-pinned, isolated in one module.
   - The annotation-interpretation layer (part of Phase 2.4), starting with the JAX-RS → Appendix B signal mapping we already validated works against real `decorates` edge data.
3. **Update the CodeGraph Discovery Spike report** with today's corrections — the `registerFrameworkResolver` walk-back, and the Graphify comparison — so the artefact trail stays accurate for whoever reads it next.
4. **Treat "do we ever enable LLM-backed semantic extraction" as its own explicit decision**, made with security/compliance input, independent of which structural engine wins — not something either tool's default behavior should decide for you.
