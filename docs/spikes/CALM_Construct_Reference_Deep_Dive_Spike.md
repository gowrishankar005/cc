# CALM Construct Reference Deep-Dive — What the Real Schema and Examples Actually Show

**Why this exists:** requested reinvestigation of CALM constructs specifically for architecture-governance capture (auth/logging/security/resiliency evidence), grounded in the authoritative schema and real reference files — not recalled from `v0.9`'s earlier pass, which is now stale in places. Everything below was fetched fresh this session via `gh api repos/finos/architecture-as-code/...`, not recalled or assumed. Two genuinely new files exist in the schema directory that `v0.9`'s pass never saw: `control-requirement.json` and `evidence.json` — the schema has moved since the last time this project looked.

---

## 1. What's new since v0.9's pass

`v0.9` fetched `core.json`, `interface.json`, `control.json`, `decorators.json`, `flow.json`, `units.json`. The directory now also contains **`control-requirement.json`** and **`evidence.json`** (confirmed via `gh api repos/finos/architecture-as-code/contents/calm/release/1.2/meta`, not assumed) — neither examined before, and both directly relevant to this project's governance-evidence goal.

## 2. `control-requirement.json` — the exact shape for the catalogue this project already promised to author

`v0.10 §0` committed to authoring `rules/control-requirement-catalogue.yml` (mapping detected control signals to a control-id/description/`requirement-url`) since FINOS's own `calm/controls/` catalog is empty. The real schema for what a `requirement-url` should point at:

```json
{
  "control-id": "CR-001",
  "name": "Access Control",
  "description": "Ensure that access to sensitive information is restricted."
}
```
`{control-id, name, description}`, all required. Confirmed in real use, `getting-started/controls/micro-segmentation.requirement.json` and `permitted-connection.requirement.json` both extend this via `allOf` + `const`-pinned fields, adding their own typed properties on top (e.g. `permitted-connection.requirement.json` adds `reason: string` and `protocol: {enum: [...]}` as control-specific fields). **This means a control requirement isn't just a description — it can carry its own typed schema fields**, exactly the shape this project's decorator/annotation evidence (an `@PreAuthorize` value, a `jwt.decode()` call's algorithm parameter) would populate.

## 3. `evidence.json` — a construct this project didn't know existed, and a strong architectural fit

```json
{
  "evidence": {
    "unique-id": "string, for future linking",
    "evidence-paths": ["array of strings — paths to the evidence relating to a specific control"],
    "control-config-url": "URI for the control configuration this evidence relates to"
  }
}
```
**This is CALM's own native home for exactly what `x-aac-provenance` currently does informally.** `evidence-paths` is unopinionated about shape — a `file:line` reference (this project's existing `Evidence.ref` convention, already used for every signal type) fits directly. This is a genuine, concrete opportunity: instead of `x-aac-provenance` being a namespaced metadata escape hatch, control evidence specifically has a real, first-class CALM construct designed for it. **Recommendation, carried into the design doc**: keep `x-aac-provenance` for non-control evidence (routes, persistence — no CALM-native equivalent exists for those), but emit real `evidence.json`-shaped evidence objects for control detections specifically, linked via `control-config-url` back to the control instance. This is a materially better fit than another metadata array for the one category of evidence CALM actually built a construct for.

## 4. `controls` — confirmed real production usage, at both node AND relationship level, with a live worked example

Fetched `calm/getting-started/conference-signup.pattern.json` (461 lines) — a full worked pattern, not a toy snippet. Confirmed:

- **Node-level control**, on a `node-type: "system"` node representing a Kubernetes cluster:
```json
{
  "unique-id": "k8s-cluster", "node-type": "system",
  "controls": { "security": {
    "description": "Security requirements for the Kubernetes cluster",
    "requirements": [{
      "requirement-url": "https://calm.finos.org/getting-started/controls/micro-segmentation.requirement.json",
      "config-url": "https://calm.finos.org/getting-started/controls/micro-segmentation.config.json"
    }]
  }}
}
```
- **Relationship-level control**, on a `connects` relationship, alongside a top-level `protocol` field:
```json
{
  "unique-id": "conference-website-load-balancer",
  "protocol": "HTTPS",
  "relationship-type": { "connects": { "source": {"node": "conference-website"}, "destination": {"node": "load-balancer"} } },
  "controls": { "security": {
    "description": "Security Controls for the connection",
    "requirements": [{
      "requirement-url": ".../permitted-connection.requirement.json",
      "config-url": ".../permitted-connection-http.config.json"
    }]
  }}
}
```
Referenced config (`permitted-connection-http.config.json`): `{control-id: "security-002", name: "Permitted Connection", reason: "Required to enable flow between architecture components", protocol: "HTTP"}` — confirming the earlier finding that a control instance carries its own typed fields (`reason`, `protocol`), not just a generic description.

**This directly confirms the gap flagged last review** ("no control-builder exists") and gives it a concretely modeled target: controls attach to both `TypedUnit`-derived nodes (auth/RBAC evidence — `@PreAuthorize`) and `TypedRelationship`-derived relationships (a permitted-connection control on a service→service call, once actor/trust relationships exist).

## 5. `protocol` — confirmed a real, top-level, enum-constrained field, not something to bury in an interface

`core.json#/defs/protocol`: `enum: [HTTP, HTTPS, FTP, SFTP, JDBC, WebSocket, SocketIO, LDAP, AMQP, TLS, mTLS, TCP]`. Lives as a **sibling property directly on `relationship`** (`core.json#/defs/relationship`), not nested inside `relationship-type` or an interface. Confirmed in real use (`HTTPS`, `mTLS` in the pattern file above). **This closes the exact gap `v0.8 §4` named ("`protocol` never populated") with a precise, buildable target**: HTTP-route-derived relationships can populate `HTTP`/`HTTPS` from evidence already gathered; a k8s shared-secret trust relationship's protocol is genuinely unknown and should stay `null` rather than guessed (same honesty discipline already applied elsewhere in this project).

## 6. `node-type` enum — confirmed complete list, several unused types are real fits for named gaps

`core.json#/defs/node-type-definition`: `anyOf[enum(actor, ecosystem, system, service, database, network, ldap, webclient, data-asset), string]`. Of the nine enum values, this pipeline has only ever emitted `service`/`database`. Concretely:
- **`system`** — confirmed real usage (the k8s-cluster example above) for a composite/boundary node. This is the exact construct that closes the "no top-level composite node representing the application" gap named in the last review — a `system` node, `composed-of` the discovered services, is CALM's own idiomatic answer, not a new invention.
- **`network`** — a real fit for message brokers/topics (Kafka, SQS/SNS — evidenced, backlog per v0.11/v0.14) once that detection is built, rather than forcing a topic to be a `service`.
- **`webclient`** — a real fit for the frontend concern dimension Fidelity evidence surfaced (v0.14 §2.4, Angular/TypeScript) — CALM already has a node-type for this, it isn't a "new concern needing a new node-type" as v0.14 assumed, just an unused existing one.
- **`data-asset`** — a plausible fit for non-relational data stores this project hasn't modeled distinctly from `database` (S3 buckets, blob storage) — not yet evidenced in any repo checked, named here as a real option, not a commitment.
- **`actor`** — still requires real actor-detection logic to populate (unchanged finding from v0.9); confirming the enum value exists doesn't reduce that work.

## 7. Formal interface definitions — a second, richer interface convention this project hasn't used at all

`interface.json#/defs` now has **two** valid shapes (confirmed via `node`'s schema: `interfaces[].anyOf[interface-definition, interface-type]`):
- **`interface-type`** (what this project already uses): `{unique-id, ...freeform}` — the informal convention (`{unique-id, type: "path-interface", path: "..."}`).
- **`interface-definition`** (not used anywhere in this pipeline): `{unique-id, definition-url, config}` — a modular reference to an *external* schema plus config conforming to it. Real catalog examples fetched: `calm/interfaces/example/{url,tcp-port,tcp-host-port,container-image}.json` — e.g. `container-image.json` requires `{image: string}`, `tcp-host-port.json` requires `{host, port}`.

**Concretely buildable now**: a k8s-derived interface for a service's exposed port becomes `{unique-id: "...", definition-url: "https://calm.finos.org/interfaces/example/tcp-host-port", config: {host: "...", port: 8080}}` — reusing FINOS's own published schema rather than inventing a project-local convention. Container image data (already gathered for deployment decorators, v0.7 §3.2) fits `container-image.json` the same way — meaning image data could be emitted as a real *interface*, not only a decorator, if it's more useful modeled as something the node "exposes" rather than metadata about the node.

## 8. `units.json` — genuinely new relevance to resiliency capture, not previously connected

Confirmed defs: `time-unit` (`{unit: enum[...seconds..years], value: number}`), `rate-unit` (`{rate: number, per: enum[...]}`), `cron-expression` (validated pattern). **Not referenced anywhere in this project's requirements chain until now.** Concrete fit: a detected `@Retry(maxAttempts=3, backoff=500ms)` or `@CircuitBreaker(waitDuration=10s)` annotation's parameters map directly to `time-unit`/`rate-unit` values inside a control's `config` object (§4's `control-detail.config`, an open object — no schema barrier to putting a `units.json`-shaped value inside it). A Spring Batch `@Scheduled(cron="...")` job's schedule maps directly to `cron-expression`. This turns "resiliency evidence" from a vague aspiration into something with a real, precise CALM-native data shape to populate once the annotation is detected.

## 9. Document root — one correction to prior understanding

`core.json`'s actual top-level document shape: `{nodes[], relationships[], metadata, controls, flows[], adrs[]}`. **`controls` exists at the document root too**, not just per-node/per-relationship — for architecture-wide controls not tied to one element (e.g. "this whole system requires SOC2 evidence," not scoped to a single node). Not previously distinguished from per-element controls in this project's docs. The `decision` def found in `core.json#/defs` is **not** a top-level construct — cross-checked against `option-type`'s shape and confirmed it's the schema for entries inside a relationship's `options` variant (alternative/optional architecture decisions), not a separate governance construct.

---

## 10. Summary table — construct, real shape confirmed this session, and this project's status

| Construct | Real shape (confirmed this session) | This project's status |
|---|---|---|
| `control-requirement.json` | `{control-id, name, description}` + extensible typed fields | Catalogue promised (v0.10), zero code |
| `evidence.json` | `{evidence: {unique-id, evidence-paths[], control-config-url}}` | **Newly discovered.** Strong fit for control-detection provenance — not adopted, not previously known to exist |
| `controls` (node + relationship + document-level) | `{<id>: {description, requirements: [{requirement-url, config-url\|config}]}}` | Specified, zero code, real worked example now in hand |
| `protocol` (relationship-level) | Enum, 12 values | Named gap since v0.8, now has an exact target |
| `node-type: system` | Composite/boundary node | Not used; direct fix for "no top-level application node" gap |
| `node-type: network`/`webclient`/`data-asset` | Enum values | Not used; real fits for messaging/frontend/non-relational-store gaps already named |
| `interface-definition` (formal) | `{unique-id, definition-url, config}` | Not used at all — only the informal convention is in use |
| `units.json` (time/rate/cron) | Structured timing values | Not connected to resiliency capture until this session |

---

## Sources

Fetched this session via `gh api repos/finos/architecture-as-code/contents/...`, not recalled: `calm/release/1.2/meta/{core,interface,control,control-requirement,evidence,decorators,flow,units,calm}.json`; `calm/getting-started/conference-signup.pattern.json`; `calm/getting-started/controls/{permitted-connection.requirement.json,permitted-connection-http.config.json,micro-segmentation.requirement.json,micro-segmentation.config.json}`; `calm/interfaces/example/{url,tcp-port,tcp-host-port,container-image}.json`; `calm/architecture/{calm-1,calm-2,calm-3,calm-hub-detail.architecture,calm.timeline}.json` (checked for real `controls`/`decorators` usage — **none of FINOS's own production architecture examples actually populate `controls` or `decorators`**, worth noting honestly: the richest real example of `controls` in use is the `getting-started` pattern/config pair, not a production architecture file).
