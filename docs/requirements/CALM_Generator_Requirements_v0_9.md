# Requirements v0.9 — Repo Analyser/Orchestrator Platform + CALM Generator Module

**Status:** Draft. Supersedes v0.8. Grounds every CALM construct claim in this project against the **authoritative JSON Schema and real production files** from `github.com/finos/architecture-as-code`, fetched this session via `gh api` — not the calm.finos.org prose pages alone, which turn out to describe some things loosely or incompletely. Finds and documents one live, unfixed bug in the current pipeline. Still a requirements round — no code changed this version, per explicit direction to get requirements right before returning to solution work.

---

## 0. Why this version exists

Before resuming solution work, the user asked two things: (1) confirm every CALM construct requirement is actually captured, checked against a real reference file, not prose descriptions; (2) keep the design explicitly language/framework-agnostic, since Java and other frameworks are coming soon. Fetched three classes of ground truth directly from the FINOS repo to answer (1) properly:

- **The authoritative schema files**: `calm/release/1.2/meta/{core,interface,control,decorators,flow,units}.json`.
- **Real production examples**: `calm/architecture/{calm-3,calm-hub-detail}.architecture.json` — CALM's own team modeling their own system.
- **The separate interfaces catalog**: `calm/interfaces/` — shows how interface "types" are actually used in practice, which differs from what the docs prose implied.

This found real corrections, not just confirmations — most importantly a **relationship-type bug already present in `pipeline/src/modules/calm-generator/build-calm.ts`** that passed `calm validate` only because it was never exercised by the specific relationships generated so far.

---

## 1. Correction — `relationship-type` is not what earlier versions of this doc assumed

**What every version through v0.8 assumed** (and what `build-calm.ts` currently generates for the `interacts` branch):
```json
"relationship-type": { "interacts": { "source": {"node": "A"}, "destination": {"node": "B"} } }
```

**What the authoritative schema (`core.json#/defs/interacts-type`) actually requires**, confirmed against real usage in `calm-3.json`:
```json
"relationship-type": { "interacts": { "actor": "calm-user", "nodes": ["calm-hub-ui"] } }
```

`interacts` is **actor-centric fan-out** — one actor node's `unique-id`, plus an array of node `unique-id`s it interacts with. It is not a general-purpose pairwise edge type. The pairwise, `{source, destination}` shape this project has been using belongs to **`connects`**, confirmed by both the schema and by real usage (`calm-hub-detail.architecture.json` uses `connects` even for in-process, non-network delegation — e.g. `"description": "Delegates business logic for validated requests to"` between two Java layers in the same process — so `connects` is the real-world default for node-to-node relationships generally, not strictly "network connections" as earlier versions of this doc implied).

**Why this bug is real but wasn't caught:** every relationship this pipeline has generated so far has been a service→database edge, which the existing (accidentally-correct-by-luck) `isDbEdge` check already routes to `connects`. The broken `interacts` branch has simply never fired yet — no service-to-service relationship has been generated in any test run this session. It will fire the moment a service-to-service relationship exists (exactly what the new Kubernetes-manifest trust relationships and any future cross-package service call would produce), and `calm validate` would then correctly reject it.

**Full authoritative `relationship-type` reference (all five variants, none previously fully specified in this project's docs):**

| Variant | Shape | Real use |
|---|---|---|
| `connects` | `{source: {node, interfaces?}, destination: {node, interfaces?}}` | The default for node-to-node relationships — network or in-process. **This is almost certainly what every relationship this pipeline generates should use.** |
| `interacts` | `{actor: <node unique-id>, nodes: [<node unique-id>, ...]}` | An `actor`-node fanning out to one or more nodes it uses. Only applicable once this pipeline detects `actor` nodes (end users, external callers) — **not built, not attempted yet**. |
| `deployed-in` | `{container: <node unique-id>, nodes: [...]}` | Nodes deployed inside a container node (e.g. a k8s namespace or cluster modeled as its own node). Plausible future use for the Kubernetes-manifest layer, not required for v0.7's trust-relationship scope. |
| `composed-of` | `{container: <node unique-id>, nodes: [...]}` | Hierarchical composition (a system node composed of sub-nodes). Not used by this pipeline currently — no composite/system-level nodes are generated. |
| `options` | array of `{description, nodes[], relationships[], controls?[]}` | Alternative/optional architecture decisions. Out of scope — decision-authoring, not scan output. |

**Action for the next solution round (not done this version):** `build-calm.ts`'s relationship-type-mapping must default to `connects` for every relationship kind this pipeline currently produces (`calls`, `imports`, `connects`-to-database, the new `shares-secret` trust relationship). `interacts` should not be emitted at all until actor-node detection exists.

---

## 2. Correction — `node-type` and interface `type` are not closed enums

**`node-type`** (`core.json#/defs/node-type-definition`): `anyOf [enum(actor, ecosystem, system, service, database, network, ldap, webclient, data-asset), string]` — the enum is the *common, recommended* set, but the schema accepts **any string**. Confirmed by nothing in real files actually needing a value outside the enum, but the schema explicitly allows it.

**Interface `type`** (`interface.json#/defs/interface-type`): `{unique-id: string, ...}` with `additionalProperties: true` — **`type` itself isn't even a named property in the base schema**, let alone an enum. It's pure convention. Real production files confirm this two different ways in practice:
- `calm-3.json`/`calm-hub-detail.architecture.json` use minimal, informal types: `type: "api"`, `type: "port-interface"` — not the 8-item enum (`host-port-interface`, `hostname-interface`, `path-interface`, `oauth2-audience-interface`, `url-interface`, `rate-limit-interface`, `container-image-interface`, `port-interface`) that the calm.finos.org prose pages describe.
- The separate `calm/interfaces/` catalog defines fuller, named schemas (`tcp-host-port` with `{host, port}`, `container-image` with `{image}`) meant to be referenced via `$ref`/`definition-url`, a more formal mechanism this project isn't using.

**Practical conclusion, not just a note:** this project's existing convention (`{unique-id, type: "path-interface", path: "..."}`) is valid — confirmed by `calm validate` passing — but is one convention among several real ones in use, not "the" schema-mandated shape. **This is good news for the "language/framework-agnostic" goal**: since neither `node-type` nor interface `type` is a closed enum, this pipeline is free to introduce new, precise types as new signal sources are added (e.g. a `message-queue` node-type for a future Kafka signal, a `cache` node-type for Redis) without any schema compatibility risk — a real, concrete way the CALM spec itself supports staying generic across languages and frameworks, not just this project's design choices.

---

## 3. Confirmed, unchanged from prior versions (re-verified against the real schema, not just re-asserted)

- **`decorators.json`**: `{unique-id, type (free string), target[] (min 1), applies-to[] (min 1), data (object, min 1 property)}`, all required, `additionalProperties: false`. Matches v0.7's understanding exactly.
- **`control.json`**: controls are a `patternProperties`-keyed object — **the control-id is the object key itself**, not a separate field inside it (a small precision earlier versions didn't state exactly right) — `{<control-id>: {description, requirements: [{requirement-url, config-url|config}]}}`.
- **`flow.json`**: a `flow` requires `{unique-id, name, description, transitions[]}`; each `transition` requires `{relationship-unique-id, sequence-number, description}` and must reference a `relationship-unique-id` that already exists in the architecture. **New, useful implication for future work, not previously stated**: because a flow only *references* existing relationship IDs and adds sequencing/description on top, a human could manually sequence this pipeline's auto-detected relationships into a flow *without* this pipeline needing to auto-detect business sequencing itself — a materially cheaper hybrid path than "flows are entirely out of scope" implied. Still not built, but worth noting as lower-effort than previously framed if ever prioritized.
- **`details.detailed-architecture` / `details.required-pattern`**: real, in production use (`calm-hub` node in `calm-3.json` links to `calm-hub-detail.architecture.json` via `detailed-architecture`) — confirms drill-down/hierarchical architecture documents are a real pattern, though still an architect-authored link, not something this pipeline would populate from a single-package scan.
- **Root document**: `{nodes[], relationships[], metadata, controls, flows[], adrs[]}` — `adrs` is confirmed to be an array of plain strings (URLs/links), nothing more structured.

---

## 4. Language/framework-agnosticism — reaffirmed as an explicit, checked requirement

The user's direction: this pipeline must stay generic across languages and frameworks, with Java support coming next. Checked against the current design (not just asserted):

- **`TypedUnit.kind`** (`service`/`database`/`unresolved`) and **`TypedRelationship.kind`** (`calls`/`imports`/`connects`) are already language-neutral — nothing in `typed-facts.ts` encodes Python or Node concepts.
- **`rules/signal-catalogue.yml`** is the only place language/framework-specific knowledge lives (Flask, FastAPI, NestJS today) — adding Java/Spring or JAX-RS support (Slice 2, already scoped in `docs/requirements/CALM_Generator_Requirements_v0_6.md` §1.5) means adding catalogue rows, not touching construction logic. This was true before this version; re-confirmed as a hard requirement here given the explicit reminder.
- **What still needs stating explicitly for the next solution round**: the CALM-construction layer (node-type-mapping, relationship-type-mapping — specified but not yet built, see the paused solution-architecture round) must key off `TypedUnit.kind`/`TypedRelationship.kind`/evidence `category` — never off raw signal names or language — or the genericity claim breaks the moment Java rows are added. This is now a stated design constraint for that work, not an assumption to verify after the fact.

---

## 5. Everything else

Unchanged from v0.8 (§1-1.5 purpose/scope/delivery strategy, §3 Kubernetes-manifest signal layer spec, §4 governance-readiness output requirements — `protocol`/relationship-confidence/`unique-id` stability — §5 validation plan, backlog).

---

## Sources

Unchanged from v0.8, plus (fetched directly via `gh api repos/finos/architecture-as-code/contents/...` this session, not recalled or paraphrased from search results):
- `calm/release/1.2/meta/core.json`, `interface.json`, `control.json`, `decorators.json`, `flow.json`, `units.json` — authoritative schema.
- `calm/architecture/calm-3.json`, `calm-hub-detail.architecture.json` — real production examples (CALM's own team modeling their own system).
- `calm/interfaces/README.md`, `calm/interfaces/example/{tcp-host-port,container-image}.json` — the separate interfaces catalog and its real naming conventions.
