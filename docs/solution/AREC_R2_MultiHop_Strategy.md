# AREC R2 — Multi-Hop Architecture Relation Strategy (design note)

**Status:** Wave 3 T-B2 — design spike only. No default pipeline behavior change in this document. Implementation is Session C (T-C1).
**Depends on:** `Architecture_Relation_Evidence_Completeness.md` §3 (R2), `Claim_Register.md` (R0/R1/R2 rows, Q11), `coe-lab/docs/fineract-gold-vs-platform-finding.md`.

## 0. Why this document exists

The Fineract finding is precise: `fineract-charge`'s gold expects 1 `service->database` `connects` relationship (`ChargesApiResource` → `Charge`); the platform produces 0. Root cause named in the finding doc: the dual-unit Graphify gate only emits an edge when BOTH endpoints are already `TypedUnit`s, and `ChargesApiResource` does not import `Charge` directly — there is a real intermediate layer between them.

T-B2's job is to design the **generic strategy class** that recovers this shape (and shapes like it) without special-casing `ChargesApiResource`/`Charge` by name. This document is grounded in a fresh, real investigation of the actual Fineract source (2026-08-07), not assumed from the finding doc alone — every claim below traces to a specific file/line/edge found by grep or a real Graphify extraction, or is explicitly marked "not yet checked."

## 1. What's actually there (real evidence, checked this session)

Investigated `spikes/fineract/repo/fineract-charge` directly, plus a real `graphify extract` run against it (405 nodes, 817 edges, `/tmp/fineract-charge-graphify/graphify-out/graph.json`).

- **`ChargesApiResource.java`** (real `service` unit, module `fineract-charge`) constructor-injects `PlatformSecurityContext context` and `ChargeReadPlatformService readPlatformService` — confirmed via source (`ChargesApiResource.java:69-70`).
- **Graphify DOES capture this as a real edge**: a file-level `imports` edge from `ChargesApiResource` to `.../charge/service/ChargeReadPlatformService` exists in the real extraction. This is a genuinely discoverable, same-module, single-root signal — not a gap in Graphify's coverage.
- **`ChargeReadPlatformService`** is a bare interface (`ChargeReadPlatformService.java:25`, method signatures only) — no HTTP route, no persistence-library import, no decorator. Under the CURRENT catalogue, it matches zero signal-catalogue rules and becomes zero `TypedUnit`s. **This is the actual mechanism of the dual-unit gate failure**: it's not that Graphify misses the edge, it's that one endpoint of the edge is architecturally real but has no catalogue-recognized evidence of its own, so it never becomes a unit for the edge to attach to.
- **The interface's real implementation, `ChargeReadPlatformServiceImpl`, lives in a DIFFERENT Gradle module (`fineract-provider`)** — not `fineract-charge`, not `fineract-core`. Confirmed via `grep -rl "implements ChargeReadPlatformService"`. It's a raw-JDBC/RowMapper implementation (imports `JdbcSupport`, `ResultSet`) — it never imports the `Charge` entity class at all, only a SQL table name (`m_charge`) as a string literal. **A single-root scan of `fineract-charge` structurally cannot see this class at all.**
- **The write path is worse, not better**: `ChargesApiResource`'s write methods go through `PortfolioCommandSourceWritePlatformService` (confirmed via the same Graphify extraction — a generic, Charge-agnostic command bus) plus a `CommandWrapperBuilder`. The actual `Charge`-specific write logic (`ChargeWritePlatformServiceJpaRepositoryImpl`, confirmed real, imports `Charge` AND `ChargeRepository` directly) is resolved at RUNTIME by a command-name string, via a `Map<String, NewCommandSourceHandler>` Spring wiring — there is no static import/reference from `ChargesApiResource` to this class at all. This is genuinely undiscoverable by any source-level static-analysis mechanism this project has ever built (CodeGraph, Graphify, or a hypothetical CodeQL pass) — it needs either Spring bean-graph resolution or runtime tracing.
- **A separate, real, SAME-MODULE persistence bridge exists but isn't reachable from `ChargesApiResource`**: `ChargeRepository.java` (module `fineract-charge`, same module as `Charge.java`) is a real `interface ChargeRepository extends JpaRepository<Charge, Long>` — the exact "Spring Data repository interface" persistence strategy already named `not-implemented` in `persistence-detection-catalogue.yml`. It's used by `ChargeWritePlatformServiceJpaRepositoryImpl` (the same unreachable-via-static-import class above), not directly by `ChargesApiResource`.

**Conclusion from real evidence, not assumption**: even a well-designed R2 strategy CANNOT recover the exact real Fineract `service->database` edge from `fineract-charge` alone — the interface's implementation lives in a third module. Full recovery requires either (a) a multi-root scan including `fineract-provider` (per the Q11 decision — real, supported, but a different, larger, explicitly-labeled claim), or (b) accepting a lower-confidence, interface-level architecture edge (`ChargesApiResource → ChargeReadPlatformService`, both real, same-module) as the honest ceiling for a single-root scan, clearly distinguished from a full entity-level edge.

## 2. Strategy class (generic, catalogue-driven — not "add ChargesApi→Charge")

### 2.1 What counts as an "architecture endpoint" candidate (no name lists)

A candidate SOURCE for an R2 edge is any `service`-kind `TypedUnit` (already discovered by existing mechanisms — HTTP route, decorator, etc). No new source-side detection.

A candidate BRIDGE is a Java/TS/Python **interface or abstract type** that:
1. Is referenced (Graphify `imports`/`references` edge) by a candidate source unit, AND
2. Currently produces **zero** `TypedUnit`s under the existing catalogue (no HTTP/persistence/messaging/security-control evidence of its own) — i.e. it's exactly the shape the dual-unit gate silently drops today.

This is a structural test (no evidence of its own kind + referenced by a service), not a name-suffix list (`*PlatformService`, `*Repository`, etc. are NOT hardcoded — a name-suffix heuristic was considered and rejected: Fineract's own vocabulary alone has at least three different suffixes (`PlatformService`, `ReadPlatformService`, `Repository`) and a new framework would need a new suffix, which is exactly the per-repo patching this task forbids).

### 2.2 How the hop resolves (Graphify paths through non-unit nodes)

Given a bridge candidate (interface, zero-unit), search the SAME scanned-root set (single or multi-root, honestly labeled per Q11) for a class with a Graphify `implements` edge targeting that interface (Graphify's relation vocabulary confirmed to include `implements` — `scanner/graphify-provider.ts`'s own documented relation list, verified against the real fineract-charge extraction's edge-kind set: `contains, method, imports, references, inherits, calls, case_of, implements`).

- If **exactly one** implementing class is found within scanned roots, AND that class itself has real persistence/messaging evidence (its own driver-import, `@Entity` reference, or a `TypedUnit` it directly imports) → emit an architecture-grade `TypedRelationship` from the original service unit to that persistence/messaging unit, `kind: 'calls'` (it's a call/reference chain, not a direct import — distinct from R1 one-hop's `imports`/`connects` kind so a reader can tell R1 and R2 edges apart in `coverage-report.json`'s `relationshipsByKind`).
- If the implementing class ITSELF is not a unit (e.g. only imports another bridge interface), the search continues one more hop — bounded (§2.4) not unbounded.
- If the bridge interface has **zero or multiple** implementing classes within scanned roots → do not guess. Emit a `CROSS_DOMAIN_UNRESOLVED` ignored-item (`unresolved-multi-hop: <interface> has N candidate implementation(s) in scanned roots`), same honest-silence convention as `outbound-http-detector.ts`/`k8s-trust-detector.ts` already use. **This is the exact real Fineract case for `fineract-charge` alone** (zero implementing classes in scope) — the design does not force a false edge just because R2 is expected to "work."

### 2.3 Confidence caps

- R1 one-hop (existing): confidence from the normal evidence-weight model, no new cap.
- R2 one-bridge-hop (service → bridge interface → impl → persistence unit, all within the SAME scanned root set): capped **below** the lowest R1 confidence this pipeline currently emits for a same-package edge — R2 is real but is one inference layer removed from a direct import, and must never look more certain than a direct one-hop edge in `x-aac-confidence`.
- R2 across a multi-root boundary (bridge resolved in a DIFFERENT root than the source unit): capped lower again than same-root R2 — this is the `fineract-charge`+`fineract-provider` case named in §1, and per Q11 it's also a claim that only holds for that specific multi-root run.
- Every R2 edge carries `grade: 'architecture'` (T-A2) like R1 — R2 is not a new grade, it's a new PRODUCTION MECHANISM for the same grade, distinguished instead by `kind: 'calls'` + a lower `confidence` value.

### 2.4 False-positive controls

1. **Ambiguous bridge (0 or 2+ implementers in scope) → never guess** (§2.2).
2. **Hop bound**: maximum 2 bridge hops (service → interface → impl-or-second-interface → unit). Unbounded traversal risks connecting a service to an unrelated persistence unit through an accidental long chain (e.g. a shared utility interface) — bounding to 2 hops matches the real depth found in §1 (`ChargesApiResource → ChargeReadPlatformService → [impl, out of single-root scope]`) without inviting speculative deep chains.
3. **Bridge must be interface/abstract-type only** — a candidate that is itself a concrete class with real business logic is not eligible as a bridge (would risk silently absorbing unrelated call chains as "architecture").
4. **No name-suffix allowlist** (§2.1) — a strategy that only fires on `*PlatformService`/`*Repository` names is exactly the per-repo-shaped patch this task forbids; the structural test (zero-unit interface referenced by a service) generalizes to any framework's own naming convention.
5. **Command-bus / dynamic-dispatch resolution is explicitly OUT OF SCOPE for R2** (§1's write-path finding) — no heuristic is proposed to guess a runtime-resolved command handler from a string key. Named as a permanent non-goal, not a "Phase 2 will fix this" deferral, unless a future engine (Spring bean-graph analysis, not scip-java/CodeQL alone) is separately justified.

### 2.5 Phase 1 (source-only) vs Phase 2 (build-dependent / optional power engines)

- **Phase 1 (this design, source-only)**: Graphify `imports`+`implements` edge chasing as described above. Works today, no new engine dependency, real evidence already gathered (§1). Ships in Session C (T-C1) if approved.
- **Phase 2 (optional, not required for Session C)**: scip-java or a Spring-aware CodeQL query could resolve interface→impl bindings via real `@Autowired`/constructor Spring bean wiring instead of a naive "exactly one `implements` edge in scope" heuristic — this matters when a codebase has genuinely 2+ implementations of the same interface behind a `@Profile`/`@Qualifier` selector, which Phase 1's ambiguity rule (§2.4.1) would correctly but conservatively skip. Named as optional power per `Architecture_Relation_Evidence_Completeness.md` §3 rule 4 — not a blocker for Phase 1 shipping.

### 2.6 Forbidden hardcodes (explicit, matching §0.3's integrity table)

- No `if (path.includes('ChargesApi'))` or any Fineract class/interface name literal anywhere in the strategy code.
- No name-suffix allowlist (`*PlatformService`, `*ReadPlatformService`, `*Repository`) — the bridge test is structural (§2.1), not lexical.
- No attempt to resolve the command-bus write path (§2.4.5) — named as unbuilt, not faked.
- No new `TypedUnit`s created FOR bridge interfaces themselves — they remain non-units (matching the honest "zero evidence of their own kind" finding); only the RELATIONSHIP they mediate is new. This avoids inflating node counts with pure-plumbing interfaces that would show up as unexplained extra nodes in `validate-calm-pair.mjs`'s L1 comparison (T-A3).

## 3. What success looks like (and what it explicitly is not)

**Success** (per the task's own criterion): at least one real `service → database` (or `service → topic`) `TypedRelationship`, `grade: architecture`, produced via this bridge mechanism on `fineract-charge` and/or `fineract-core`, that a human can trace back to real source (the bridge interface + its resolved implementer), not a fabricated edge.

**Success is NOT**: any new edge appearing at all — entity↔entity edges (R0) are already abundant and were never the gap. Success is specifically closing the `serviceTouchingRelationshipCount === 0` gap T-A1's S1 flag names, with a real, traceable, non-hardcoded mechanism.

**Known, honestly-stated residual after Phase 1 ships**: per §1's finding, `fineract-charge` scanned ALONE may still land in the "0 or 2+ candidates" ambiguous-skip path for `ChargeReadPlatformService` (its one real implementer is in `fineract-provider`, out of scope) — Phase 1 alone does not guarantee `fineract-charge`'s S1 flag clears. A multi-root scan including `fineract-provider` is the more likely real success case, and per Q11 that is a separate, larger, explicitly-labeled claim, not silently substituted for the single-root one. T-C1 should attempt both and report which one (if either) closes the gap for the specific gold packages in scope — not assume Phase 1 alone succeeds before it's actually run.

## 4. Non-goals (Wave 3-B, restated from AREC §9)

- Implementing this in production code (Session C, T-C1).
- Hardcoding Fineract class/interface names.
- Replacing R0 (dual-unit structural edges stay, graded `structural` per T-A2).
- Resolving the command-bus/dynamic-dispatch write path.
