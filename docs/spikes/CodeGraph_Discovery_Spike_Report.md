# CodeGraph Discovery Spike — Results (Apache Fineract)

**What this is:** the spike recommended in the last round — pointing the actual CodeGraph tool at a real fintech monorepo before designing the Heuristics Engine any further. Apache Fineract (github.com/apache/fineract) was used as a stand-in real-world repo: a mature, production-grade Java fintech core-banking platform, similar in spirit to your own domain.

**Setup:** `@colbymchenry/codegraph` v1.5.0 installed via npm. Fineract shallow-cloned (7,062 files, 126MB source). Full index run, then inspected via the CLI, then via direct SQLite queries against `.codegraph/codegraph.db` to see what's actually in the raw data (not just what the CLI chooses to print).

---

## 1. What's confirmed and good

| Claim (Solution Design §6.1) | Verdict | Evidence |
|---|---|---|
| Handles large monorepos | ✅ Confirmed | 7,062 files → 182,573 nodes, 492,497 edges indexed in **42.8s** of actual work (~2.5 min wall-clock incl. process overhead). This is a positive, real data point against the "large monorepo performance" risk (§12 row 6) — CodeGraph itself is unlikely to be the bottleneck at this scale. |
| Dynamic dispatch information | ✅ Confirmed | The indexer explicitly runs a "Linking dynamic dispatch..." pass — this is real, not marketing. |
| Call graphs, imports, containment, inheritance | ✅ Confirmed | Raw edge table has clean `calls` (181,496), `imports` (37,552), `contains` (174,603), `extends` (1,033), `implements` (1,191) edge kinds — solid structural backbone. |
| Java support | ✅ Confirmed | Full, clean AST-level extraction for Java specifically — classes, methods, fields, signatures, line ranges all correct. |

**One real cost data point not previously flagged:** the SQLite index came out to **706MB for a 126MB source repo — a ~5.6x storage multiplier.** Worth a line in Non-Functional Considerations if this runs across many pilot domains in parallel.

---

## 2. The critical finding: "framework detection" is much narrower than assumed, and inconsistent

This is the important one — it changes what the Heuristics Engine actually has to build.

**There is no bulk export.** Every CLI/MCP command (`query`, `node`, `callers`, `callees`, `impact`, `explore`, `files`, `status`) is a targeted lookup, built for an AI coding agent asking specific questions — not a "give me the whole graph" API. The only way to get the full node+edge set for the Heuristics Engine is to **query the raw SQLite file directly**, which works fine technically (it's just a local file) but means the Orchestration Utility ends up coupled to an **undocumented internal schema** that could change without notice on a CodeGraph upgrade. This itself is worth adding to the CodeGraph vendor-risk item from the earlier gap tracker.

**Route/framework typing is real but narrow, and doesn't cover this platform's actual REST layer.** Fineract's production API uses **JAX-RS (`@Path`, `@GET`, `@POST` from `jakarta.ws.rs`)** — a very common enterprise Java REST style, and the exact pattern Appendix B.1 names as a signal. Testing against real Fineract source:

| Signal | Ground truth (grep) | What CodeGraph natively typed |
|---|---|---|
| `@RestController` (Spring MVC) | 2 files | Correctly typed as first-class `route` nodes (3 routes total — e.g. `GET /login`) |
| `@Path` (JAX-RS) | **171 files**, 919 annotation instances | **Zero** typed as `route`. Captured only as generic `decorates` edges, and **100% of them (919/919) resolved at CodeGraph's own lowest confidence tier ("fuzzy")** |
| `@Entity` (JPA) | **255 files** | **Zero** captured at all — not even as a fuzzy edge |
| `@Component` / `@Configuration` (Spring DI) | — | Captured with `resolvedBy: "framework"` (CodeGraph's higher-trust tier) |

Overall, across all 4,719 annotation edges in the repo: 46% resolved `fuzzy` (lowest trust), 22% `framework`, 20% `import`, 12% `exact-match`. **Fuzzy is the single largest bucket.**

**What this means concretely:** the annotation *name* is technically present in the data (`decorates` edge → `metadata.refName`, e.g. `"Path"`), so the signal isn't unrecoverable — but CodeGraph doesn't interpret it, and its own "fuzzy" resolution means the edge's *target* (which symbol the annotation resolves to) is often wrong for third-party annotations, since it's guessing by name rather than following a real import. **Reading `refName` directly and ignoring the resolved target is the only reliable path** — and that interpretation layer doesn't exist yet; it has to be built.

---

## 3. What this changes in the plan

- **New required component, not previously scoped:** an **Annotation/Decorator Interpretation Layer** sitting between raw CodeGraph `decorates` edges and the Heuristics Engine — a small lookup table mapping raw `refName` strings (`Path`, `GET`, `RestController`, `Entity`, `Component`...) to Appendix B signal categories. This is genuinely new build effort for Playbook Phase 2.4, not "thin config on top of CodeGraph's framework detection" as originally assumed — CodeGraph doesn't do that detection for JAX-RS or JPA, only for a narrow slice of Spring.
- **The confidence-scoring draft (§7 of the last document) needs a caveat:** CodeGraph's own `resolvedBy`/`confidence` values on `decorates` edges are a genuinely useful secondary signal (framework-resolved annotations are more trustworthy than fuzzy-resolved ones) and should probably be folded into the Decision Record's evidence snapshot — but the primary "is this an HTTP entry point" typing work is on us, not CodeGraph.
- **Persistence signal detection (Appendix B.2) needs rethinking too.** Fineract genuinely mixes both JPA (`@Entity`, 255 files) and raw JDBC (`JdbcTemplate`, 233 files) — neither shows up cleanly in CodeGraph's structured output (JPA missed entirely; raw JDBC types aren't tracked as named nodes since they're external library types). This will likely need its own lightweight detection pass reading import statements and field type signatures directly, same pattern as the annotation layer above.
- **This test does not validate polyglot coverage** — Fineract is 6,535 Java files vs. 1 JS and 1 Python file. Recommend a short follow-up spike against an actual Node/Python slice of *your* monorepo specifically to check whether the same annotation/decorator gap exists there too (e.g. Express route decorators, FastAPI path decorators) before finalizing effort estimates.
- **CodeGraph vendor-risk item (from the earlier gap tracker) gets more concrete:** the real risk isn't "tool disappears," it's "internal SQLite schema changes on upgrade and silently breaks the Orchestration Utility." Recommend pinning a specific CodeGraph version for the pilot and treating any upgrade as a re-validation event, not a routine bump.

---

## 4. Bottom line

CodeGraph is a solid, fast, genuinely real structural engine — the call graph, import graph, and dynamic dispatch resolution are exactly as advertised and performed well even at this scale. But the Solution Design's assumption that it also hands you framework-aware architectural typing is **only true for a narrow slice of Spring**, not for JAX-RS or JPA, both of which are alive and well in real enterprise Java fintech code (this repo included). That's not a reason to drop CodeGraph — the raw signal is recoverable — but it does mean **Phase 2's effort estimate needs to go up** to account for building the interpretation layer above, and that should happen before anyone commits to a pilot timeline.
