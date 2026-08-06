# Requirements v0.1 — Polyglot CALM Generator (Analyser/Orchestrator Module)

**Status:** Draft for review. No implementation yet — this document specifies scope before any pipeline code is written, per this project's own Design → Review → Gap-Closure methodology (see `docs/spikes/`).

---

## 1. Purpose & Scope

The system under specification is an **Analyser/Orchestrator module whose primary objective is generating an authentic FINOS CALM 1.2 architecture document** from a real source repository. It is **polyglot from V1**, not Java-only: scope is **Java, Python, and Node/TypeScript** — the three languages `docs/spikes/Claude_Code_Handoff_Brief.md` already names as the actual target monorepo's stack. No LLM sits in the generation path (consistent with every prior design document in this repo).

**Per-language framework coverage for V1:**

| Language | Natively typed by CodeGraph | Requires our own interpretation layer |
|---|---|---|
| Java | Spring MVC (`@RestController`/`@GetMapping`/etc. → `route` nodes) | **JAX-RS** (`@Path`/`@GET`/…) and **JPA** (`@Entity`/`@Table`/`@Column`) — CodeGraph has no resolver for either |
| Python | FastAPI, Flask, Django (`fastapiResolver`/`flaskResolver`/`djangoResolver` all registered in the currently-installed CodeGraph v1.5.0) | None identified — but see §4, the `detect()`-gate risk applies regardless of native typing |
| Node/TypeScript | Express, NestJS (`expressResolver`/`nestjsResolver`) | None identified for these two; other JS frameworks (React/Vue/Svelte/Astro) are frontend, out of scope for a backend-architecture CALM document |

Persistence detection (JPA/JDBC for Java; ORM entities for Python/Node) is scoped as its own signal category — see §3.

---

## 2. CALM 1.2 Construct Coverage

CALM's full core-concept set, researched directly from calm.finos.org: **nodes, relationships, interfaces, controls, standards, timelines, decorators, metadata, patterns, widgets**. The root architecture document's top-level keys are `nodes`, `relationships`, `metadata`, `controls`, `flows`, `adrs` (schema is `additionalProperties: false`).

| Construct | Structure (verified against calm.finos.org) | In scope for V1? | Reason |
|---|---|---|---|
| **Nodes** | `unique-id`, `node-type` (enum: `actor, ecosystem, system, service, database, network, ldap, webclient, data-asset`), `name`, `description`, `interfaces`, `controls`, `data-classification`, `details` | **Yes** | Core deliverable — directly derived from annotated/decorated classes + confidence scoring. |
| **Relationships** | `unique-id`, `relationship-type` (exactly one of `interacts, connects, deployed-in, composed-of`, or `options`), `description`, `protocol` (enum incl. `HTTP, HTTPS, JDBC, AMQP, TCP, mTLS, WebSocket, …`), `controls` | **Yes** | Core deliverable — derived from `calls`/`imports`/`contains` edges, resolved DI/import references, and (where present) Kubernetes manifests for `deployed-in`. |
| **Interfaces** | `unique-id`, `type` (enum: `host-port-interface, hostname-interface, path-interface, oauth2-audience-interface, url-interface, rate-limit-interface, container-image-interface, port-interface`) | **Yes, partially** | `path-interface` from route extraction (native or built). `host-port-interface`/`container-image-interface` only where the repo ships Kubernetes manifests — confirmed available for Bank of Anthos (§5), use when present. |
| **Metadata** | Array of `{key, value}` (or free-form object); attachable at node, relationship, or whole-architecture level | **Yes** | Confidence score, evidence refs, and provenance land here, namespaced (`x-aac-confidence`, `x-aac-provenance`) per the CALM Studio integration contract already agreed in `docs/spikes/Gap_Closure_Build_Ready_Specs_v0.1.md` §3, so downstream CALM tooling doesn't choke on unrecognized fields. |
| **Controls** | Attached under a node/relationship's `controls` object; each entry has `requirements: [{control-requirement-url, control-config-url}]` pointing at externally-hosted schemas | **No** | Encodes organizational/compliance policy (e.g. "connections must use mTLS") — not inferable from source code alone. Phase 2. |
| **Standards** | JSON Schema documents that `allOf`-extend core CALM schemas with org-specific properties | **No** | Org-specific schema authoring exercise, not a scan output. |
| **Decorators** (deployment/k8s/business-metadata side-car documents) | `unique-id`, `type`, `target`, `applies-to`, `data` | **Stretch goal, not a blocker** | Genuinely derivable where Kubernetes manifests exist (image, namespace, ports) — Bank of Anthos confirms this (§5). Build only after nodes/relationships/interfaces/metadata are solid. |
| **Flows** | `unique-id`, `transitions: [{relationship-unique-id, sequence-number, summary}]` | **No** | Requires knowing *business* call sequencing, not just that a call edge exists between two nodes. |
| **Patterns** | JSON Schema templates (`const`/`prefixItems`) used to generate-and-validate architecture instances | **No** | An authoring tool for architects, not a scan output. |
| **Timelines / Widgets** | Documentation-generation tooling | **No** | Not architecture content. |

**V1 CALM output = `nodes` + `relationships` + `interfaces` + `metadata`.** Everything else in the table above is either explicitly deferred (Phase 2) or explicitly out of scope, not silently omitted.

---

## 3. Signal → CALM Mapping Table

Every row below is backed by real evidence pulled this session from Apache Fineract (`spikes/fineract/repo`) and Bank of Anthos (`spikes/boa/repo`) for Java, or cited from existing spike documents for Python/Node (per explicit decision to reuse rather than re-verify those two languages).

### Java

| Raw signal (found via `Node.decorators` off `getAllNodes()`, or CodeGraph-native `route` typing) | Evidence (file:line) | CALM output |
|---|---|---|
| `@RestController` + `@GetMapping("/balances/{accountId}")` (Spring, natively typed by CodeGraph as `route`) | `spikes/boa/repo/src/ledger/balancereader/src/main/java/.../BalanceReaderController.java:42-147` | `node-type: service`; `path-interface` per route |
| `@Path("/v1/charges")` on class + `@GET`/`@POST`/`@PUT`/`@DELETE` on methods (JAX-RS — **not** natively typed by CodeGraph; requires our own extractor modeled on `resolution/frameworks/java.js`'s `springResolver.extract()` regex approach) | `spikes/fineract/repo/fineract-charge/src/main/java/org/apache/fineract/portfolio/charge/api/ChargesApiResource.java:56,65,75-164` | `node-type: service`; `path-interface` per method |
| `@Entity` + `@Table(name = "m_charge")` + `@Column(...)` (JPA — **not captured by CodeGraph at all**, confirmed: 0 native typing) | `spikes/fineract/repo/fineract-charge/src/main/java/org/apache/fineract/portfolio/charge/domain/Charge.java:60-128` | `node-type: database` |
| `@Entity` + `@Table(name = "TRANSACTIONS")` + `@Id`/`@Column` + `@Repository`/`JpaRepository` | `spikes/boa/repo/src/ledger/balancereader/src/main/java/anthos/samples/bankofanthos/balancereader/Transaction.java:37-59` and `TransactionRepository.java:26-27` | `node-type: database`; `relationship-type: connects` from the owning service to this node |
| `calls`/`imports` edge (native CodeGraph edge kind) between an annotated controller class and an annotated repository/entity class | Structural — derived from CodeGraph's own call/import graph, not annotation-specific | `relationship-type: interacts` (service→service) or `connects` (service→database) |
| Kubernetes `Service.spec.ports[].port` | `spikes/boa/repo/kubernetes-manifests/balance-reader.yaml:16,27-28` (`kind: Service`, `port: 8080`) | `host-port-interface` |
| Kubernetes `Deployment.spec.template.spec.containers[].image` | `spikes/boa/repo/kubernetes-manifests/balance-reader.yaml:38,92` (`kind: Deployment`, `image: us-central1-docker.pkg.dev/.../balancereader:v0.6.10@sha256:...`) | `container-image-interface`; also feeds the stretch-goal `deployment` decorator (§2) |

### Python

| Raw signal | Evidence (cited source) | CALM output |
|---|---|---|
| `@router.get(...)`/`APIRouter()` (FastAPI, natively typed by CodeGraph — **when `detect()` fires**, see §4) | `docs/spikes/CodeGraph_Polyglot_Spike_Node_Python.md` — OpenBB, confirmed `APIRouter()`/`@router.get(...)` usage in provider code, 6 route nodes once indexed at the correct package root | `node-type: service`; `path-interface` per route |
| `@app.route('/users', methods=['POST'])` (Flask — CodeGraph's currently-installed v1.5.0 registers `flaskResolver`, absent from the original spike; new observation this session) | `spikes/boa/repo/src/accounts/userservice/userservice.py:46,52-66` (`Flask(__name__)`, `@app.route(...)`) | `node-type: service`; `path-interface` per route |
| ORM model classes (SQLAlchemy/Django) | Not directly evidenced this session — no Django/SQLAlchemy repo was inspected. Treat as **provisional**, same category as Java JPA, pending a real citation before implementation. | `node-type: database` |

### Node/TypeScript

| Raw signal | Evidence (cited source) | CALM output |
|---|---|---|
| `@Controller(...)` class + `@Get()`/`@Post()` methods (NestJS, natively typed by CodeGraph) | `docs/spikes/CodeGraph_Polyglot_Spike_Node_Python.md` — Ghostfolio, confirmed genuine `@Controller` usage, 115 real route nodes indexed cleanly from repo root | `node-type: service`; `path-interface` per route |
| TypeORM/Prisma entity decorators | Not directly evidenced this session. **Provisional**, pending a real citation before implementation. | `node-type: database` |

---

## 4. Cross-Language Risk: the `detect()` Gate

Proven in `docs/spikes/CodeGraph_Polyglot_Spike_Node_Python.md`: CodeGraph's framework `detect()` only checks the manifest (`pyproject.toml`/`requirements.txt`/`package.json`/`pom.xml`) **at the exact indexed root**, or a short list of hardcoded entrypoint filenames at that same root — it never searches subdirectories. In a monorepo with per-package manifests (OpenBB: 0 routes indexed from `openbb_platform/`, 6 routes from `openbb_platform/core/` — same code), this fails **silently**: zero routes is indistinguishable from "this package doesn't use the framework."

This is a **cross-language requirement**, not a Python-specific footnote: the Orchestrator/Analyser MUST index at (or explicitly enumerate and index) each package/module root individually, and MUST smoke-test that `nodesByKind.route` is non-zero for any package with grep-verified route-annotation usage — regardless of language. A single whole-monorepo index run is not sufficient for any of the three target languages.

---

## 5. Input Sources

- **Source code**, read via CodeGraph's public, typed SDK (`CodeGraph` class, `QueryBuilder.getAllNodes()`, `getOutgoingEdges()`/`getIncomingEdges()` — confirmed present and documented in the currently-installed v1.5.0's `dist/index.d.ts`). This **supersedes** the earlier spike-era plan to query raw `.codegraph/codegraph.db` SQLite directly; the "no bulk export, undocumented schema" finding in `docs/spikes/CodeGraph_vs_Graphify_Comparison.md` and `docs/spikes/CodeGraph_Discovery_Spike_Report.md` is now stale and should be corrected when the pipeline is built.
- **`Node.decorators?: string[]`**, populated generically for every language by CodeGraph's extraction layer (confirmed by reading `extraction/tree-sitter.js`'s shared decorator-collection path, not just Java's Lombok-specific logic) — this is the primary hook for the JAX-RS/JPA interpretation layer: read raw annotation names directly off class/method nodes, no need to chase low-confidence `decorates` edges the way the original spike had to.
- **Kubernetes manifests** (`kubernetes-manifests/*.yaml` or equivalent), when present — confirmed real material exists in Bank of Anthos (§3). Used for `host-port-interface`, `container-image-interface`, and the stretch-goal deployment decorator.
- **Build/dependency manifests** (`pom.xml`, `pyproject.toml`/`requirements.txt`, `package.json`) — already consumed by CodeGraph's own `detect()` gates; also usable directly as a "deployable package" confidence signal (§6).

---

## 6. Confidence Scoring

Reuses the weighted model already drafted in `docs/spikes/Gap_Closure_Build_Ready_Specs_v0.1.md` §7, generalized so signal names aren't Java-specific:

| Signal | Weight |
|---|---|
| HTTP entry point (`@RestController`/`@Path`/`@app.route`/`@router.get`/`@Controller` — any language) | 40 |
| Deployable package (own start script/container/manifest) | 30 |
| Framework bootstrap marker (`@SpringBootApplication`, `Flask(__name__)`, `FastAPI()`, NestJS `main.ts` bootstrap) | 25 |
| Persistence signal (`@Entity`, ORM model, `JpaRepository`) | 20 |
| Messaging signal (not yet evidenced this session — carried forward from the original draft) | 20 |
| Folder/naming convention only | 10 |
| Historical SME decision on similar pattern | +15 boost |

**Bands** (unchanged from the original draft): ≥70 auto-include; 40–69 auto-include but flagged; <40 routed to review queue; conflicting strong signals forced to review regardless of score.

---

## 7. Ignored Items Taxonomy

Reused as-is from `docs/spikes/Gap_Closure_Build_Ready_Specs_v0.1.md` §5 — already language-agnostic (`TEST_CODE`, `GENERATED_CODE`, `PURE_UTILITY`, `AMBIGUOUS_BOUNDARY`, `INSUFFICIENT_EVIDENCE`, `EXCLUDED_BY_CONFIG`, `CROSS_DOMAIN_UNRESOLVED`, `OTHER`). No changes needed for the polyglot scope.

---

## 8. Out of Scope for V1

| Item | Reason |
|---|---|
| CALM `controls`, `standards`, `patterns`, `flows`, `timelines`, `widgets` | Not source-derivable (org policy, authoring tooling, business sequencing) — see §2. |
| Two-tier mapping-config governance (global/domain split) | A multi-domain governance concern from `docs/spikes/Gap_Closure_Build_Ready_Specs_v0.1.md` §4 — irrelevant until there's more than one domain to test against. |
| Decision Records / Overrides capture and review workflow | A separate, later-phase concern (human-review loop) — this document specifies the *generation* side only. |
| Any language beyond Java, Python, Node/TypeScript | Not named as part of the actual target monorepo's stack in `docs/spikes/Claude_Code_Handoff_Brief.md`. CodeGraph has resolvers for others (Go, Rust, C#, Ruby, PHP, Swift) but they're unevidenced and unrequested. |
| Django/SQLAlchemy and TypeORM/Prisma persistence rows in §3 | Marked provisional — no real repo evidence gathered this session. Must be confirmed against a real repo before implementation claims to support them. |

---

## 9. Validation Plan

**Success criterion for this document:** every mapping-table row in §3 is backed by a real, cited file:line (Java) or a specific existing spike-document citation (Python/Node) — not a hypothetical. This document does not claim the pipeline runs; that's the next plan.

| Repo | Language/Framework | Role | Evidence gathered this session? |
|---|---|---|---|
| Apache Fineract (`spikes/fineract/repo`) | Java, JAX-RS + JPA | Primary evidence source for the two genuinely unsupported Java patterns | Yes — §3 |
| Bank of Anthos (`spikes/boa/repo`) | Java (Spring + JPA), Python (Flask), Kubernetes manifests | Evidence source for native-Spring baseline, JPA (second citation), Flask, and k8s-derived interfaces | Yes — §3 |
| OpenBB | Python, FastAPI | Python route evidence + the `detect()`-gate finding (§4) | Reused from `docs/spikes/CodeGraph_Polyglot_Spike_Node_Python.md`, not re-run |
| Ghostfolio | Node/TypeScript, NestJS | Node route evidence | Reused from `docs/spikes/CodeGraph_Polyglot_Spike_Node_Python.md`, not re-run |

**Open gaps to close before implementation starts:** a real Django/SQLAlchemy repo and a real TypeORM/Prisma repo, to convert the two provisional persistence rows in §3 into cited evidence.

---

## Sources

- [What is CALM?](https://calm.finos.org/introduction/what-is-calm/)
- [Core Concepts](https://calm.finos.org/core-concepts/)
- [Nodes](https://calm.finos.org/core-concepts/nodes/)
- [Relationships](https://calm.finos.org/core-concepts/relationships/)
- [Interfaces](https://calm.finos.org/core-concepts/interfaces/)
- [Controls](https://calm.finos.org/core-concepts/controls/)
- [Standards](https://calm.finos.org/core-concepts/standards/)
- [Decorators](https://calm.finos.org/core-concepts/decorators/)
- [Metadata](https://calm.finos.org/core-concepts/metadata/)
- [Patterns](https://calm.finos.org/core-concepts/patterns/)
