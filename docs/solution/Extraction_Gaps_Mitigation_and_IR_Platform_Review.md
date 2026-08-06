# Extraction Gaps, Mitigations & IR as Platform Intelligence

**Purpose:** Solid inventory of what still limits “more architecture into CALM,” with address vs mitigate options; plus a redesign stance on the Intermediate Representation (IR) so it captures **shared intelligence**, not CALM-only views.

**Grounded in:** requirements v0.6–v0.14 coverage matrix, Solution Design v2, Java annex, modularity assessment, live `pipeline/src/` (including current `x-aac-scope-limitations`), HITL/override path.

**Companion reading:** `Modularity_and_Integration_Assessment.md`, `AGENT_TASKS_*.md` Waves M/E.

---

## 0. Completeness model (so “more CALM” is measurable)

| Layer | Question | What improves it |
|---|---|---|
| **L1 Evaluation** | Did we *look* at architecturally relevant surfaces? | Scanners, file sets, manifests, OpenAPI, multi-root |
| **L2 Interpretation** | Did we *recognize* frameworks/signals? | Signal catalogue, composers, persistence strategies, controls |
| **L3 Emission** | Did confident facts become CALM constructs? | Construct mappings, builders, relationship kinds, `system`/`network` nodes |
| **L4 Authorization** | Did humans/LLM close residual ambiguity? | Ignored-items quality, evidence packs, IR, DR/Override |
| **L5 Disclosure** | Can consumers see what is still missing? | Coverage appendix, scope-limitations, unmapped-signal report |

HITL only moves **L4**. “Extract more for CALM” primarily moves **L1–L3**. IR should make **L1–L4** legible to every module.

Current emitted honesty (`metadata-builder.ts`):

```
HTTP-entry-point and Graphify-visible-persistence signals only…
Config/env-var-mediated relationships not detected…
Intra-file business logic not modeled…
High confidence ≠ completeness…
```

This review targets gaps that keep those lines true longer than they need to be.

---

## 1. Gap inventory (researched + repo-grounded)

Each gap: **ID · name · layer · severity · address? · mitigate? · enrichment impact · effort · notes**.

Severity: **H** = large CALM richness loss for fintech monorepos · **M** = material · **L** = polish / niche.

### 1.1 Discovery / evaluation (L1)

| ID | Gap | Sev | Address (fix extraction) | Mitigate (if not full fix) | Impact if closed | Effort |
|---|---|---|---|---|---|---|
| **G-L1-01** | **Monorepo / wrong-root `detect()` silence** — zero routes indistinguishable from “no framework” | H | Per-package smoke test already exists; fail CI on zero routes for packages with route greps; multi-root orchestration discipline | Coverage report “0 routes + framework deps present” | Recovers whole services | S |
| **G-L1-02** | **File language set hardcoded** (`.py/.ts/.java`) | M | Configurable extensions / language packs | Explicit “languages in this run” in coverage | New languages visible to index | S |
| **G-L1-03** | **k8s manifests unbuilt** — shared Secret trust, deploy decorators, optional Ingress→actor | H | k8s-manifest provider + trust detector (v0.7) | Manual DR for known trust pairs | Cross-service trust edges, deploy metadata | M |
| **G-L1-04** | **OpenAPI/Swagger unbuilt** — routes, schemas, `securitySchemes` | H | api-contract provider; static file + annotation fallback | Spot-check routes only from code | Richer interfaces + control evidence | M |
| **G-L1-05** | **AsyncAPI / messaging contracts unbuilt** | M | AsyncAPI parser for channels/messages | Kafka/SQS import-only partial | Network/topic nodes with real names | M |
| **G-L1-06** | **Config/env-mediated relationships** (JWT key, DB URL hosts) | H | Bounded env/config graph: shared secret names, known env keys → soft edges | Scope-limitations + HITL `relationship_add` when implemented | Real trust topology BoA-style | M–L |
| **G-L1-07** | **Infra-as-code beyond flat k8s** (Helm/Kustomize resolve, Terraform, CloudFormation) | L→M | Backlog; start with pre-rendered manifests only (already scoped) | Don’t claim cloud topology | Cloud/deploy nodes later | L |
| **G-L1-08** | **ADR / docs not harvested** into CALM `adrs[]` | L | Glob `docs/adr/**` → document links | Architect attaches ADRs by hand | Traceability, not structure | S |
| **G-L1-09** | **Graphify fail-soft drops all cross-package edges** | M | Configurable fail-closed; retry; cache | Provenance flags “cross-package incomplete” | Relationship completeness | S |

### 1.2 Interpretation / signal recognition (L2)

| ID | Gap | Sev | Address | Mitigate | Impact | Effort |
|---|---|---|---|---|---|---|
| **G-L2-01** | **Persistence single shape** (wrapper-class / L1 / single contains) | H | Persistence strategy catalogue (JPA entity done partially; Spring Data, jOOQ, multi-driver) | HITL node_add for known DBs | Database nodes + connects | M |
| **G-L2-02** | **Node DynamoDB / SQS/SNS catalogue** (v0.14) | M | Import-strategy rows + optional SDK call patterns | Unverified row + fixture | Cloud-native persistence/messaging | S–M |
| **G-L2-03** | **Messaging producers/consumers** Kafka/JMS two-mechanism (decorator + typed field) | H | Catalogue + composer similar to JAX-RS; `topic` kind (contract bump) | Partial import detection only | `network` nodes + connects | M |
| **G-L2-04** | **Spring Batch / scheduled jobs** | M | Batch signals → `batch-job` kind mapping | Treat as service via override | Batch architectural category | S–M |
| **G-L2-05** | **Auth: call-based** (`jwt.decode`) + **OAuth2 library** imports | M | Call-edge / import catalogue rows (v0.10/v0.14) | Decorator-only controls | Control evidence density | M |
| **G-L2-06** | **Resiliency / logging** as evidence (designed, thin in product) | L–M | Catalogue rows + metadata/controls | x-aac-observability only | Governance-useful evidence | S |
| **G-L2-07** | **Unmapped signals invisible** (no catalogue match → not always ignored) | H | Force every raw signal into unmapped bucket + per-run report | Offline `suggest-rules` only | Catalogue growth + HITL visibility | S–M |
| **G-L2-08** | **Framework-specific composers only for JAX-RS** | M | Route-composer plugin registry (Wave M T-M8) | One-off composers per language | Future frameworks without kernel forks | M |
| **G-L2-09** | **Annotation argument extraction limited** (line regex for `@Path`) | M | Generalize literal extract; tree-sitter for nested args | Manual path overrides | Correct interfaces | M |
| **G-L2-10** | **Python decorator path weak** vs native routes (known CodeGraph gap) | M | Rely on native typing; Graphify corroboration; don’t claim extractFromSource for Flask | Document limitation | Slice 1 already mostly covered | S |
| **G-L2-11** | **Quarkus / Spring Data / multi-vocab auth** open catalogue | M | Extensible control catalogue (v0.11) | Per-repo overrides | Fintech framework breadth | S–M |
| **G-L2-12** | **gRPC / frontend / Scala** | L–H* | New language/concern slices | Explicit out-of-scope | *H only if target estate needs them | L |

### 1.3 Emission / CALM construction (L3)

| ID | Gap | Sev | Address | Mitigate | Impact | Effort |
|---|---|---|---|---|---|---|
| **G-L3-01** | **Few node kinds** (`service`/`database` mainly) | H | `system` composite, `network`, later `webclient`; contract policy for new kinds | Force everything into service | Topology richness | M |
| **G-L3-02** | **Relationship vocabulary thin** (`calls`/`imports`/`connects`); `shares-secret` not live | H | Expand TypedRelationship + mapping rows; implement relationship overrides | Node-only architecture | Real edges for trust/messaging | M |
| **G-L3-03** | **`protocol` sparsely populated** | M | Infer from evidence (HTTP/JDBC/AMQP) | Leave null honestly | Consumer usefulness | S |
| **G-L3-04** | **Interfaces incomplete** (no schemas, status codes) | M | OpenAPI-driven interface enrichment | Path+method only | API architecture detail | M |
| **G-L3-05** | **Controls incomplete** (placeholder requirement-urls, few detection mechanisms) | M | Local control catalogue + more detectors | Evidence without false compliance claims | Security-relevant CALM | M |
| **G-L3-06** | **`composed-of` / `deployed-in` underused** | M | Emit system + cluster nodes from package roots / k8s | Flat service list | C4-like layering | S–M |
| **G-L3-07** | **unique-id stability / rename** | L | Document + optional semantic IDs later | Overrides for rename | Diffability | S |

### 1.4 Review / HITL surfaces (L4)

| ID | Gap | Sev | Address | Mitigate | Impact | Effort |
|---|---|---|---|---|---|---|
| **G-L4-01** | **Evidence packs thin** (refs only, no snippet attach) | H for HITL quality | Attach N-line snippets + neighbor units to ignored-items / IR | Architect opens IDE at ref | Decision quality | S–M |
| **G-L4-02** | **No coverage appendix** (scanned vs units vs ignored vs unmapped) | H | Per-run `coverage-report.json` + IR section | Manual counting | “What don’t we know?” | S–M |
| **G-L4-03** | **IR not built / currently framed CALM-centric** | H | **Platform IR** (see §3) | JSON-only review | Multi-module + HITL | M |
| **G-L4-04** | **LLM advisory not built** | M | Bounded suggest-classification CLI | Pure HITL | Faster residual closure | M |
| **G-L4-05** | **Relationship overrides not fully implemented** | M | Complete override types | Node-only authorization | Edge completion via HITL | M |
| **G-L4-06** | **Reconstruct-only mode missing** | L | `--from-facts` rebuild | Full re-scan each review | Review loop speed | S |

### 1.5 Platform / multi-module (affects “more value from same extraction”)

| ID | Gap | Sev | Address | Mitigate | Impact | Effort |
|---|---|---|---|---|---|---|
| **G-P-01** | **Intelligence only fully “lived” in CALM path** | H | TypedFacts + Platform IR as shared product | Modules re-read JSON ad hoc | Threat/green reuse | M |
| **G-P-02** | **Closed TypedFacts unions** | M | Contract evolution policy (exists) + planned kind extensions | Catalogue-only forever | New architectural categories | S |
| **G-P-03** | **No engine capability matrix driving run** | M | Wave M T-M10 | Always CG+Graphify | Targeted enrichment | S–M |

---

## 2. Review: what we *should* do to extract more for CALM

### 2.1 Prioritized “enrichment portfolio” (impact × feasibility)

#### Tier 1 — High impact, feasible without new engines (do first)

| Priority | Gaps closed | What to build | Why this extracts more CALM |
|---|---|---|---|
| **1** | G-L2-07, G-L4-02 | **Unmapped-signal + coverage report** every run | Makes dark matter visible → catalogue rows → more units next run |
| **2** | G-L2-01, G-L2-02 | **Persistence strategy catalogue** + Dynamo/driver rows | More `database` nodes and service→db edges |
| **3** | G-L1-04, G-L3-04, G-L2-05 | **OpenAPI provider** (static first) | Interfaces + securitySchemes → controls without guessing |
| **4** | G-L1-03, G-L3-02 | **k8s trust + shares-secret** | Cross-service relationships currently impossible from code alone |
| **5** | G-L3-01, G-L3-06 | **`system` node + composed-of** | Composite architecture, not only leaf services |
| **6** | G-L4-01, G-L4-03 | **Evidence packs + Platform IR** | Better HITL/LLM → authorized nodes/edges that scanners missed narrowly |
| **7** | G-L2-03, G-P-02 | **Messaging detection + `network`/`topic` kind** | Missing fintech backbone (Kafka/SQS) |

#### Tier 2 — High impact, more cost / risk

| Priority | Gaps | Approach |
|---|---|---|
| **8** | G-L1-06 | Config/env soft-graph (shared secret *names*, not secret values) |
| **9** | G-L2-05, G-L2-09 | Call-based auth; richer annotation arguments |
| **10** | G-L1-05 | AsyncAPI |
| **11** | Phase 2 CodeQL/scip-java | Only when Phase 1 metrics show precision gaps |

#### Tier 3 — Scope expansion (not “enhance Slice 1/2,” new programmes)

Frontend, Scala/Spark, gRPC, full cloud topology, trading/payments domain packs.

### 2.2 Explicit non-goals (do not “mitigate” by pretending)

| Do not | Reason |
|---|---|
| Model every class as a node | Noise; breaks CALM usefulness |
| LLM rewrite typed-facts in-core | Breaks determinism / Goal A |
| Claim high confidence = complete | Already disclosed; keep |
| One mega Engine interface | Modularity assessment anti-pattern |

### 2.3 Mitigations when full address is deferred

| Gap class | Mitigation that still helps CALM |
|---|---|
| Missing detector | Scope-limitations line + coverage “0 detections for X” |
| Ambiguous unit | HITL node_add/type_change with DR |
| Missing edge | Relationship override (when built) or documented manual gap |
| Systemic signal miss | `suggest-rules` → catalogue (better than permanent overrides) |
| Cross-package incomplete | Flag in provenance; fail-closed in CI optional |

### 2.4 Success metrics for “more extraction” (pilot-friendly)

| Metric | Direction |
|---|---|
| % package roots with ≥1 architectural unit | ↑ |
| Relationships per service (median) | ↑ toward grepped reality |
| Ignored / unmapped count trend after catalogue sprints | ↓ unmapped; ignored may stay if honest |
| Override rate per 100 nodes | ↓ over time (catalogue absorbs learning) |
| calm validate 0 errors | Hold |
| Coverage: units / graphify nodes (order of magnitude) | Track, not maximize to 100% |

---

## 3. IR reconsidered: platform intelligence, not CALM-only

### 3.1 Your instinct is correct

> *“IR is specific to calm generation — can’t we use it for other modules? The idea behind IR is capture the intelligence gathered.”*

**Yes.** In the current Solution Design v2 §13, IR is described too narrowly as:

- rendering `typed-facts` + builder output toward CALM review  
- override blocks aimed at CALM node types  
- sibling of calm-generator artefacts  

That **underuses** the real platform idea:

| Concept | Role |
|---|---|
| **Raw scanner graphs** | Too big, untyped, engine-specific |
| **`typed-facts.json`** | **Machine contract** for all modules (canonical intelligence product) |
| **Platform IR** | **Human/LLM-facing rendering of that intelligence** (+ optional proposals) |
| **Module outputs** | CALM / threat-signals / green — **projections**, not the intelligence store |

So: **intelligence gathered = TypedFacts (+ coverage + unmapped + optional raw summary)**.  
**IR = legible, multi-audience view of that intelligence**, not “draft CALM markdown.”

### 3.2 Recommended IR architecture

```
Scanner engines ──► Analysis ──► TypedFacts (contractVersion)
                         │              │
                         │              ├──► Module: calm-generator ──► architecture.calm.json
                         │              ├──► Module: threat-signals ──► threat report
                         │              └──► Module: green / future
                         │
                         └──► Platform IR renderer (deterministic)
                                    │
                                    ├── intelligence-ir.md  (or .json + .md)
                                    │     sections: units, relationships, ignored,
                                    │     unmapped clusters, coverage appendix,
                                    │     evidence snippets
                                    │
                                    └── optional proposal blocks
                                          (HITL / LLM) ──► Decision Records
                                                │
                                                ├── apply to CALM (overrides)
                                                └── optional: module-specific override packs
```

**Rules (keep determinism):**

1. IR is **generated one-way** from TypedFacts (+ coverage/unmapped), never the reverse source of truth.  
2. Modules **must not require** IR; they read TypedFacts. IR is for humans, LLM advisory, and authoring overrides.  
3. Override blocks may be **typed by concern**: `architecture` (node-type), `threat` (accept/dismiss finding), later `green` — all still Decision-Record backed if they change durable artefacts.  
4. CALM-specific construct names belong in **calm-generator’s projection**, or in an IR *appendix* “CALM preview,” not as the only IR schema.

### 3.3 What Platform IR should contain (minimum viable)

| Section | Source | Consumers |
|---|---|---|
| Run header | packageRoots, contractVersion, catalogue version | All |
| **Coverage appendix** | Scanner counts + unit/ignored/unmapped | HITL, platform owners |
| **Units** | TypedUnit + evidence + confidence | All modules’ reviewers |
| **Relationships** | TypedRelationship | CALM, threat (trust paths) |
| **Ignored / ambiguous** | IgnoredItem + snippets | HITL, LLM advisory |
| **Unmapped signals** | New report | Catalogue authors (`suggest-rules`) |
| **Module projections (optional tabs/sections)** | Read module outputs after run | e.g. “CALM preview”, “Threat findings” |
| **Proposal fences** | Human/LLM editable | Authorization only |

### 3.4 Naming (avoid CALM lock-in)

| Avoid | Prefer |
|---|---|
| `architecture-ir.md` as sole name | `intelligence-ir.md` or `platform-ir.md` |
| Framing IR as “CALM draft” | Framing as “intelligence notebook” |
| Storing only CALM node-types in frontmatter | Store **TypedUnit.kind + categories + refs**; CALM mapping is a derived column |

### 3.5 How this enhances “more for CALM” *and* other modules

| Without Platform IR | With Platform IR |
|---|---|
| Threat module authors re-parse JSON | Same unit list + missing-auth evidence readable once |
| HITL only sees ignored codes | Snippets + neighbors → better `node_add` |
| Catalogue gaps hidden | Unmapped section → more L2 extraction next sprint |
| Green module reinvent narrative | Reuses units/relationships intensity proxies |

**Extraction enhancement loop:**  
Coverage/unmapped in IR → human/LLM/catalogue fixes → richer TypedFacts → richer CALM *and* threat/green — without CALM owning the intelligence layer.

### 3.6 What not to put in IR

- Full Graphify dump (link or sample only)  
- Secret values from env/k8s  
- LLM text as facts  
- Module-private intermediate noise  

---

## 4. Consolidated roadmap (extraction + IR)

Aligned with existing agent waves where possible.

| Phase | Deliverables | Gaps primarily closed |
|---|---|---|
| **E0 — Visibility** | `coverage-report.json`, unmapped-signal report, update scope-limitations text | G-L2-07, G-L4-02 |
| **E1 — Persistence & cloud libs** | Strategy catalogue, Dynamo/SQS rows | G-L2-01, G-L2-02 |
| **E2 — Platform IR v1** | Renderer from TypedFacts + coverage + ignored + unmapped; no CALM-only naming | G-L4-03, G-P-01, G-L4-01 |
| **E3 — OpenAPI** | Static contract → interfaces + securitySchemes | G-L1-04, G-L3-04 |
| **E4 — k8s trust** | shares-secret + decorators | G-L1-03, G-L3-02 |
| **E5 — Messaging kinds** | Kafka/SQS → network/topic | G-L2-03, G-L3-01 |
| **E6 — HITL depth** | Snippets, relationship overrides, advisory LLM, reconstruct-only | G-L4-01/04/05/06 |
| **E7 — Env soft-graph** | Shared config keys (careful security) | G-L1-06 |

Do **E0–E2 before** large language expansion so every new detector improves a **shared** intelligence product, not only CALM JSON.

---

## 5. Answers to the direct questions

### Can we address/mitigate gaps to extract more for CALM generation?

**Yes.** The largest *near-term* gains are not “more LLM,” they are:

1. Make invisible misses **visible** (coverage + unmapped).  
2. **Persistence strategies** + cloud SDK catalogue rows.  
3. **OpenAPI** and **k8s trust** (non-code intelligence).  
4. **Richer emission** (`system`/`network`, relationships).  
5. **Platform IR + evidence packs** so HITL/LLM can authorize residuals with enough context.  

Full-repo omniscience remains out of scope; **much denser fintech-relevant CALM** is realistic.

### Is IR specific to CALM? Should it capture intelligence for all modules?

**It should not be CALM-specific.**  
- **Canonical intelligence:** `TypedFacts` (+ coverage/unmapped).  
- **IR:** human/LLM **view and proposal surface** over that intelligence for **the platform**.  
- **CALM / threat / green:** modules that **project** intelligence into domain artefacts.  

Your idea — *IR captures the intelligence gathered* — is the right product framing; v2’s CALM-centric IR description should be **upgraded** to Platform IR as above.

---

## 6. Suggested doc / task follow-ups

1. Amend Solution Design v2 §13 title/scope → **Platform IR / intelligence notebook**.  
2. Add agent tasks **T-E0** (coverage + unmapped), **T-IR1** (platform IR renderer) to `AGENT_TASKS_*.md` if desired.  
3. Keep CALM generator as first consumer of richer TypedFacts, not owner of IR.

---

## 7. Sources (internal)

- `docs/requirements/CALM_Generator_Requirements_v0_14.md` (coverage matrix)  
- `docs/requirements/CALM_Generator_Requirements_v0_7.md` (k8s trust)  
- `docs/solution/Architecture_as_Code_Solution_Design_v2.md` §4–§7, §13  
- `docs/solution/language/java.md`  
- `docs/solution/Modularity_and_Integration_Assessment.md`  
- `pipeline/src/modules/calm-generator/metadata-builder.ts` (live scope-limitations)  
- `pipeline/src/types/typed-facts.ts`, `overrides.ts`, modules registry  

**External patterns (researched stance, not re-spiked here):** architecture extraction systems that scale (e.g. code property graphs, SCIP indexes, OpenAPI-first API inventory, K8s topology tools) all separate **index/intelligence** from **views** (security graph, service catalog, diagrams). Aligning IR with that split matches industry practice and this programme’s Goal A.

---

## 8. Meta-review of this inventory (capture quality + missed gaps + mitigation fitness)

**Review date:** post-draft critical pass against live `pipeline/src/`, coverage matrix, Gap_Closure taxonomy, modularity assessment.

### 8.1 What was captured well

| Strength | Why it holds |
|---|---|
| L1–L5 completeness model | Separates “extract more” from HITL; prevents selling overrides as full coverage |
| Platform IR vs CALM-only IR | Aligns with Goal A and multi-module reality |
| Tiered portfolio (E0 before engines) | Visibility-first is correct; matches evidence-before-adoption culture |
| Non-goals (no every-class nodes, no LLM-in-core) | Protects CALM usefulness and determinism |
| k8s / OpenAPI / persistence / messaging as H gaps | Match real fintech monorepos and stated scope-limitations |

### 8.2 Mitigation fitness — good enough? Where to strengthen

| Mitigation in §1–2 | Fit? | Required hardening for agents |
|---|---|---|
| HITL `node_add` for missing DBs | **Partial** | Works only if evidence pack + IR exist; else architects guess. **Depend on E0/E2.** |
| HITL `relationship_add` for trust | **Weak today** | Override type exists in schema but **not implemented** in applier. Address must include implementing relationship overrides **before** relying on this mitigate. |
| “Scope-limitations line” | **Good disclosure, not extraction** | Must pair with coverage metrics or it becomes wallpaper. |
| Unmapped → every raw signal | **Risky if naive** | Full dump can be huge. **Mitigation of the fix:** cluster by signal name, cap samples, severity buckets. |
| OpenAPI primary routes | **Good** | Must **dedupe** against native/decorator interfaces or double-count. Specify merge precedence: native path > OpenAPI > decorator. |
| Env soft-graph | **Good if bounded** | **Hard rules:** never store secret *values*; only key *names* / shared Secret *names*; optional allowlist of env key patterns; data-class Internal. |
| Graphify fail-soft | **Good resilience, bad completeness** | Mitigate with explicit `crossPackageStatus: partial|failed|ok` in provenance **and** optional `--fail-on-graphify-error`. |
| Partial import-only messaging | **Weak** | Import of kafka client ≠ topic topology. Label confidence low; don’t emit high-confidence network nodes from import alone. |
| Force everything into `service` | **Bad long-term** | Only temporary; prefer kind extension + contract bump. |

**Verdict on mitigations:** Directionally sound; **not good enough as written for agents** until (1) relationship overrides are real, (2) unmapped is capped/clustered, (3) OpenAPI dedupe is specified, (4) env graph security bounds are mandatory, (5) evidence packs land with IR.

### 8.3 Obvious gaps that were under-specified or missing

| ID | Gap | Sev | Why obvious / why it matters | Address | Mitigate |
|---|---|---|---|---|---|
| **G-L1-10** | **Deployable-unit manifests** (`pom.xml`/`build.gradle` modules, `package.json` name, Dockerfile CMD) not used as service boundary signals | H | Fintech monorepos already encode “what is a deployable” in build files; pipeline almost ignores them | Manifest-as-bootstrap signal → service unit candidates | Coverage lists “manifest present, 0 units” |
| **G-L1-11** | **docker-compose / local stack topology** | M | BoA-class repos declare service↔db↔broker in compose | Parse compose services → nodes + connects (low confidence) | Scope-limitations; HITL promote |
| **G-L2-13** | **Outbound HTTP clients** (RestTemplate, WebClient, axios, fetch, feign) → service→service edges | H | Biggest missing *code-level* relationship class after DB; currently almost no app-to-app edges from code | Call/import detection + optional URL/base-path literals; relationship kind `calls` service→service | OpenAPI servers only; HITL relationship_add |
| **G-L2-14** | **Test / generated code still polluting** if not filtered early | M | False architecture from `*Test`, `target/generated` | Path filters + TEST_CODE/GENERATED taxonomy enforcement in scanner | Manual exclude config |
| **G-L2-15** | **Shared library vs service misclassification** | M | Utility jars become “services” if they have annotations | Require deployable-unit OR http-entry-point for service emission | HITL type_change / ignore |
| **G-L3-08** | **Interface/route dedupe** across native + decorator + OpenAPI | M | Double interfaces already bitten NestJS once | Single precedence policy in interface-builder | Manual cleanup overrides |
| **G-L4-07** | **Snippet / IR data sensitivity** (PII/secrets in evidence packs) | M | HITL packs can leak credentials into out/ | Redact patterns; max lines; no .env file contents | Opt-in snippets; default refs only |
| **G-P-04** | **Extraction regression / recall gates** missing or thin | H | Catalogue growth will regress silently without golden counts | npm test: BoA + NestJS + Fineract-charge route/db counts | Manual runs (current) |

### 8.4 Less obvious gaps (easy to miss, still material)

| ID | Gap | Sev | Why less obvious | Address | Mitigate |
|---|---|---|---|---|---|
| **G-L1-12** | **Maven/Gradle multi-module boundaries ≠ packageRoots** | M | Indexing one module misses cross-module Java edges | Auto-discover modules from reactor POM or explicit roots file | Document manual multi-root CLI |
| **G-L1-13** | **Generated OpenAPI at build time** not on disk | M | springdoc often has no checked-in yaml | Fallback annotation extraction; don’t require static file | Document + fail soft |
| **G-L2-16** | **Caching / Redis dual nature** (db vs network) | L | Catalogue may emit wrong calmNodeType | Heuristic: redis client → database *or* network by usage | Metadata only |
| **G-L2-17** | **Feature flags / tenant routers** as architecture | L | Rarely in first-pass catalogues | Backlog signal family | Ignore as pure logic |
| **G-L2-18** | **Idempotent re-runs / clock in generatedAt** only non-determinism | L | Diff noise | Stable sort; optional strip timestamps for diff mode | Accept timestamp drift |
| **G-L3-09** | **Confidence not on relationships**; control confidence flattened | M | v0.7 named relationship confidence; multi-signal auth tiers | TypedRelationship.confidence; control-level scores | Single unit score only |
| **G-L3-10** | **Actor / interacts permanently unused** without Ingress or gateway | L | Schema branch dead | k8s Ingress → actor (v2 backlog) | Stay on connects only |
| **G-L4-08** | **Stale overrides after rename/delete** | M | DR points at ghost nodes | Orphan detection in override-applier | Manual audit |
| **G-L4-09** | **CROSS_DOMAIN_UNRESOLVED has no two-tier config** to feed it | M | Taxonomy exists; federated ownership config doesn’t | global/domains boundaries.yml | Always OTHER/ignore |
| **G-P-05** | **Inter-module artefact contract** (threat reading calm?) undefined | L | Modules should only read TypedFacts | Document ban on calm→threat coupling | Convention only |
| **G-P-06** | **Incremental scan / cache invalidation** | M | Large monorepo cost limits how often enrichment runs | Package-level cache keys (hash) | Full rescan only |

### 8.5 Coverage of original inventory after meta-review

| Area | Original §1 | After §8 |
|---|---|---|
| Code routes / JAX-RS / Spring | Strong | + dedupe, outbound HTTP |
| Persistence | Strong | + deployable-unit coupling |
| Non-code (k8s, OpenAPI) | Strong | + compose, static-OpenAPI fallback |
| Messaging | Strong | + confidence honesty on import-only |
| HITL / IR | Strong | + sensitivity, stale overrides, relationship override dependency |
| Build/deployable identity | **Weak** | **Added G-L1-10, G-L1-11, G-L1-12** |
| Service-to-service from code | **Weak** | **Added G-L2-13** |
| Quality gates | **Weak** | **Added G-P-04** |

### 8.6 Final fitness statement

The original gap list is a **solid backbone** for extraction enrichment and Platform IR. It is **not complete** without §8.3–8.4. Mitigations are **directionally right** but several are **not implementable as written** until dependencies land (relationship overrides, capped unmapped, OpenAPI merge policy, redaction).  

**Agent work must encode those dependencies** — see `AGENT_TASKS_Extraction_Enrichment.md`.
