# Requirements v0.6 — Repo Analyser/Orchestrator Platform + CALM Generator Module

**Status:** Final draft for this requirements phase. Solutioning proceeds from here.

---

## 0. Changes from v0.5 — reconciling two branches

Two independent v0.5 drafts were produced from v0.4 in parallel and need reconciling before solutioning starts:

- **Branch A (user-authored, uploaded this turn):** the substantive strategic pivot — **§1.5 Delivery Strategy: Vertical Slices**, reconnecting to the original Playbook's own Phase 0/1 scope discipline. Also corrected an earlier overclaim about infrastructure manifests as a primary signal source, and added real Kafka messaging evidence. This is the branch that matters for what gets built next.
- **Branch B (this session's earlier v0.5):** closed out `docs/requirements/CALM_Generator_Requirements_v0_4.md` §11 items 1–2 (see `docs/spikes/CodeGraph_Annotation_Extraction_Reconciliation_Spike.md`) and added Graphify as a provisional "Option C" for the cross-package edge problem. Branch A doesn't have this — its §5 still lists the `Node.decorators` spike as "unowned, still first," which is now stale.

**This version (v0.6) = Branch A's structure and strategy, with Branch B's resolved findings folded in.** Specifically:

1. **§5 is corrected: the `Node.decorators` spike is RESOLVED, not blocking.** It was run against real Fineract code this session. Result: the assumption was **wrong** — `node.decorators` does not generically capture Java annotations (populated only for Lombok-synthesized members). The reliable mechanism, also verified: `CodeGraph.extractFromSource(filePath, source)`'s raw `unresolvedReferences` filtered to `referenceKind === 'decorates'`. Full evidence in the spike doc. This closes §11's former blocking item 1 and removes it from Slice 1's critical path.
2. **§4 gains a status note on jQAssistant (Option A):** this project's current working environment has no JVM, Maven, or Docker, confirmed by checking, not assumed. Doesn't change Option A's deferred-to-Slice-2 status, but means Slice 2 planning should account for needing a different environment to actually run that spike when the time comes.
3. **§4 backlog gains Option C (Graphify) as a documented-but-unbuilt alternative** to Option B for the cross-package edge problem, for symmetry with Option A's treatment — provisional, real performance risk unresolved (Graphify's only full-repo run against a comparable-scale target, Fineract at 7,062 files, timed out; succeeded only on a 692-file slice). Not adopted, not discarded — same posture as jQAssistant.
4. **Independently re-verified this session** (not just re-cited): the Fineract Kafka docker-compose evidence and the Bank of Anthos `balance-reader.yaml` → `ledger-db-config` → `SPRING_DATASOURCE_URL` cross-file ConfigMap chain both check out — exact lines below, differing slightly from the original citation's line numbers but confirming the same facts. The Ghostfolio docker-compose citation was **not** independently re-verified this session (that repo isn't cloned here) — treat as cited-pending-verification, not settled, until someone checks it directly.

Everything else in Branch A (§1.5's vertical-slices strategy, §3's slice-tagged signal tables, the corrected infra-manifest effort estimates, the reorganized §11) is adopted as-is — it's sound, and the spot-checks above confirm the specific evidentiary claims in it hold up.

---

## 1. Purpose & Scope

Unchanged: Analyser/Orchestrator platform, CALM Generator as first module, deterministic core (no LLM in the generation path), typed-facts.json as the module contract.

---

## 1.5. Delivery Strategy: Vertical Slices, Not Broad Coverage

**Why this section exists:** several sessions of testing against public repos (Fineract, OpenBB, Ghostfolio, Bank of Anthos) surfaced real, valuable gaps — the `detect()`-gate silent failure, the JAX-RS coverage gap, jQAssistant's Java-only reach, docker-compose's reliability variance. That discovery work was legitimate risk reduction, not wasted effort. But it has no natural stopping point on its own, and the original Playbook already specifies the discipline that was missing: *lock a bounded pilot scope, build against it, and treat everything else as deferred* (Playbook Phase 0–1; Appendix A: "lock V1 boundary early").

**Slice 1 (active scope, starting now):**
- **One real package/module from the actual target monorepo** — not a public proxy repo. This is the single highest-leverage unresolved item across this whole project; every test so far has used a stand-in.
- **Language: Python or Node, whichever the real target module actually uses** — not Java. Both proved to work end-to-end in testing once indexed at the correct package root; Java concentrates every open problem (JAX-RS, JPA clustering, jQAssistant, and the language-agnostic §4 cross-package issue all surfaced in Java context) and should not be the first thing attempted end-to-end.
- **Frameworks in scope: FastAPI/Flask (Python) or NestJS (Node) only** — whichever matches the real target. No Django/SQLAlchemy/TypeORM/Prisma yet, even though those are already scoped as provisional rows below.
- **Deliverable:** `architecture.calm.json` + `ignored-items-report.json` + `provenance.json` for that one real package, passing `calm validate`, reviewed by at least one architect against the Playbook's own Phase 1 success checklist.
- **§4's cross-package resolution (Option B: in-house FQN-based stitching) gets built here**, tool-agnostically, benefiting every later slice. §4's Option A (jQAssistant) and Option C (Graphify) are explicitly deferred — Option A is Java-only and irrelevant to Slice 1; Option C's performance risk at real-repo scale is still unverified either way.
- **§5's `Node.decorators` mechanism is resolved and ready to use as-is**: build annotation/decorator extraction against `extractFromSource()`, not `node.decorators` or persisted `decorates` edges (see §5 below). No further spike needed before Slice 1 code starts.

**Slice 2 (next, not started): Java — Spring MVC + JAX-RS + JPA only**, against a real Java package from the same target monorepo. Platform/orchestration mechanics already proven by Slice 1; this slice tackles Java's specific complexity deliberately, with the annotation-interpretation layer (now precisely mechanism-specified, §5) and clustered-database design (§3) already fully specified from prior evidence.

**Backlog (deferred, not discarded — everything below is tagged accordingly):** WebFlux, Micronaut, Quarkus, Dropwizard, Vert.x, plain Servlets, gRPC; MyBatis, jOOQ, plain JDBC; Kafka/JMS/RabbitMQ beyond the one Kafka citation now in hand; Django/SQLAlchemy, TypeORM/Prisma, Express; jQAssistant (§4 Option A); Graphify (§4 Option C); docker-compose/k8s manifest enrichment (§3); OpenAPI/AsyncAPI ingestion; the FINOS Architecture Discovery Skill as a validation oracle.

**The stopping rule, so this doesn't recur:** anything newly discovered from here forward — a new repo, tool, or framework — goes into the backlog table below. It does not become active work unless it blocks Slice 1's specific scope as defined above. This is a process requirement, not a suggestion.

---

## 2. CALM 1.2 Construct Coverage

Unchanged from v0.3/v0.4/v0.5.

---

## 3. Signal → Typed-Fact Mapping — tagged by slice

### Python / Node — **Slice 1 (active)**

| Framework | Signal | Status | Notes |
|---|---|---|---|
| FastAPI | `@router.get(...)`/`APIRouter()` | ✅ evidenced (OpenBB); `detect()`-gate risk applies (§4) | |
| Flask | `@app.route(...)` | ✅ evidenced (Bank of Anthos `userservice.py:46,52-66`) | |
| NestJS | `@Controller`/`@Get()`/`@Post()` | ✅ evidenced (Ghostfolio, 115 routes) | |
| Django/SQLAlchemy, TypeORM/Prisma, Express | — | **Backlog**, provisional, no repo evidence yet | Stays out of Slice 1 even if the real target repo happens to use one of these — confirm actual framework first, don't assume. |

### Java — **Slice 2 (next, not started)**

| Framework | Signal | Status |
|---|---|---|
| Spring MVC | `@RestController`+`@GetMapping` | ✅ evidenced (Bank of Anthos, CodeGraph-native) |
| JAX-RS | `@Path`+`@GET`/etc. | ✅ evidenced (Fineract), extraction mechanism now specified — see §5 |
| JPA | `@Entity`/`@Table`/`@Column` | ✅ evidenced (Fineract + Bank of Anthos), clustered-database design (v0.2 §3, unchanged), extraction mechanism now specified — see §5 |

### Java — **Backlog**

WebFlux, Micronaut, Quarkus, Dropwizard, Vert.x, Servlets, gRPC (HTTP entry points); JDBC/Spring JDBC, MyBatis, jOOQ (persistence); Kafka (✅ evidenced — see below), JMS, RabbitMQ (messaging).

**Messaging — Kafka evidenced, re-verified this session:**
```yaml
# spikes/fineract/repo/docker-compose-postgresql-kafka.yml:22-23
kafka:
  image: "apache/kafka:4.2.0-rc2"
# lines 43-44
kafka:
  condition: service_started
```
This is infra-manifest evidence, not code-level evidence — the *fact* (Fineract uses Kafka) is confirmed, but the *code-level signal* (`@KafkaListener`, `KafkaTemplate`) that a source-scanning pipeline would need is still unverified. Backlog item, partially de-risked.

### Infrastructure Manifests — **Backlog, corrected effort estimate**

An earlier draft in this project suggested docker-compose/k8s manifests could be elevated to a primary signal source, reducing reliance on annotation parsing. Retested against Bank of Anthos and found this overstated. Corrected findings:

| Source | Reliability | Real effort found | Evidence |
|---|---|---|---|
| docker-compose, **when genuinely the deployment mechanism** | High — direct `depends_on` edges, no parsing needed | Low | Ghostfolio (`docker-compose.yml`): `ghostfolio` service `depends_on: {postgres, redis}`, real healthcheck path *(cited, not independently re-verified this session — repo not cloned here)* |
| docker-compose, **when a dev/test convenience file** | **Unreliable — may not represent real topology at all** | N/A, don't use as architectural evidence | Fineract's own compose files are labeled *"FOR TESTING PURPOSES ONLY! NOT SUITABLE FOR PRODUCTION USAGE!"* — re-verified this session at `spikes/fineract/repo/docker-compose-postgresql-kafka.yml:19`. This must be checked per-file before trusting it, not assumed. |
| Kubernetes manifests | Medium — real signal, but requires its own extraction logic | Medium-high, not low | Bank of Anthos, re-verified this session: `kubernetes-manifests/balance-reader.yaml`'s Deployment has **two** `configMapRef`s (`environment-config` and `ledger-db-config`, ~line 91) — the DB dependency isn't a direct edge, it's resolved only by finding `ledger-db-config` defined in a *different file* (`kubernetes-manifests/ledger-db.yaml:31`) and parsing a raw JDBC URL out of its `SPRING_DATASOURCE_URL` key (`ledger-db.yaml:21`: `jdbc:postgresql://ledger-db:5432/postgresdb`). Needs its own small rule-table (ConfigMap/Secret cross-file name resolution + connection-string parsing), not a free structured read. |
| Kustomize/Helm-templated manifests | Lower until resolved | Adds a resolution step | Bank of Anthos uses `base/`+`overlays/development/` — the checked-in YAML may not be what's actually deployed; a full extraction would need `kustomize build` or equivalent before trusting values. |

**Conclusion:** infra manifests remain a genuinely useful *additional*, partial signal source — worth building eventually — but they don't reduce Slice 1 or Slice 2's core scanning work, and each source (compose vs. k8s vs. templated k8s) needs its own reliability check per real repo before being trusted, not a blanket assumption. Backlog, not active.

---

## 4. Cross-Language Risk: the `detect()` Gate and Cross-Package Edges

The per-package indexing requirement (the `detect()` gate) is unchanged from v0.3/v0.4. Per §1.5: **Option B (in-house FQN-based stitching) is Slice 1's responsibility to build**, since it's language-agnostic and Slice 1 needs it regardless of language.

**Option A (jQAssistant) — deferred to Slice 2 evaluation, if still needed once Option B exists.** Slice 2 may find Option B alone is sufficient for Java too, in which case the jQAssistant question resolves itself by not being necessary. **Status note:** this project's current environment has no JVM, Maven, or Docker (checked directly, not assumed) — Option A's validation spike will need a different environment when Slice 2 planning takes it up.

**Option C (Graphify) — backlog, documented, not adopted.** Graphify has no per-root `detect()` gate at all — a single whole-repo pass sidesteps the cross-root partitioning problem structurally rather than needing it stitched after the fact, which is a real, distinct advantage over Option B for the specific cross-package-edge problem. Held at the same evidence bar as Option A: unverified for this purpose, and the one real data point is unfavorable — the original tool comparison's Graphify run against Fineract (7,062 files) **timed out**, completing only against a 692-file slice. Not ruled out; not something Slice 1 or Slice 2 should be designed around without a dedicated re-scale spike first.

---

## 5. Input Sources & the `Node.decorators`/Annotation-Extraction Mechanism — RESOLVED

**This spike is closed.** Run this session against real Fineract code (`fineract-charge` module, `codegraph init`, queried via the public SDK): the assumption that `node.decorators` generically captures real annotations was **tested and falsified**. On the persisted, indexed graph, `node.decorators` was `undefined` for the JAX-RS-annotated `ChargesApiResource` class and the JPA-annotated `Charge` entity — it's populated only by `java.js`'s hardcoded Lombok-synthesis special case. Persisted `decorates` edges were also empty (0/0) in a small single-module index, since resolution has no local symbol to fuzzy-match external annotation types against at that scale.

**The reliable mechanism, also verified:** `CodeGraph.extractFromSource(filePath, source)` — a public, documented, no-persistence-required method. The orchestrator reads a source file itself and passes its content in; `result.unresolvedReferences` filtered to `referenceKind === 'decorates'` returns the correct raw annotation names (`Path`, `GET`, `Entity`, `Column`, …), correctly attributed via `fromNodeId` to the right class/method/field — independent of indexing, persistence, or resolution succeeding. Verified counts: 36 correctly-attributed refs for `ChargesApiResource.java`, 48 for `Charge.java`.

**Caveat, also verified:** this does not substitute for the full indexed pipeline where native framework route-typing is the goal (Spring's `@GetMapping` → native `route` node, or Flask/FastAPI/NestJS route typing) — a side-check found `extractFromSource()` on a bare single Python file with no project context produces zero native `route` nodes. **The orchestrator needs both**: `extractFromSource()` for raw annotation-name capture (gate-free, all languages), and the full per-package index for native framework route/typing where a resolver exists.

Full evidence: `docs/spikes/CodeGraph_Annotation_Extraction_Reconciliation_Spike.md`.

---

## 6–10. Confidence Scoring, Ignored Items Taxonomy, Output Artefacts, `.drawio` Scope, Out of Scope

Unchanged from v0.4/v0.5. Out of Scope (§10) retains its v0.5 clarifying note: everything in §3's "Backlog" tags is out of scope *for Slice 1/2 specifically*, not out of scope for the project — the distinction matters so backlog items don't get silently forgotten the way the jQAssistant hybrid idea nearly was.

---

## 11. Validation Plan — reorganized around Slice 1

**Resolved, no longer blocking:**
1. ~~§5 `Node.decorators` SDK reconciliation spike~~ — **RESOLVED.** See §5 above and the spike doc.

**Blocking, before any Slice 1 code:**
2. §4 Option B feasibility sizing (in-house FQN stitching, Python/Node import-resolution conventions specifically — Java's version is Slice 2's problem, not Slice 1's).
3. Identify the actual target-monorepo package for Slice 1, confirm its real framework (FastAPI/Flask/NestJS), and confirm real access before writing pipeline code.

**Deferred to Slice 2 planning (not blocking Slice 1):**
4. §4 Option A jQAssistant multi-module spike — needs a JVM/Maven/Docker-capable environment, unavailable here.
5. Evidence at least one JAX-RS implementation beyond Fineract (Quarkus/Dropwizard/Micronaut).
6. Evidence JMS/RabbitMQ (Kafka now partially done, per §3).

**Backlog, no timeline:**
7. §4 Option C (Graphify) re-scale spike, if the cross-package problem ever needs revisiting beyond what Option B delivers.
8. Django/SQLAlchemy, TypeORM/Prisma, Express evidence.
9. Infra-manifest extraction rule-table (ConfigMap/Secret resolution, connection-string parsing, Kustomize awareness) per §3's corrected findings.
10. OpenAPI/AsyncAPI ingestion (noting: not statically present in any tested repo so far — would need a build-time generation step, not just file discovery).
11. FINOS Architecture Discovery Skill as a diff-oracle against Slice 1/2 output, once both exist.

---

## Sources

Unchanged from v0.4, plus: `docs/spikes/CodeGraph_Annotation_Extraction_Reconciliation_Spike.md` (this session); `spikes/fineract/repo/docker-compose-postgresql-kafka.yml:19,22-23,43-44` (re-verified this session); `spikes/boa/repo/kubernetes-manifests/balance-reader.yaml:87-92` and `kubernetes-manifests/ledger-db.yaml:21,31` (re-verified this session); `ghostfolio/docker-compose.yml` (cited in the source draft, not independently re-verified this session); original Playbook document (Phase 0–1, Appendix A) — cited as the basis for the §1.5 strategy pivot.
