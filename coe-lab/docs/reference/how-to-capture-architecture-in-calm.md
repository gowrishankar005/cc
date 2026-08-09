# How to capture an application's architecture in a CALM JSON file

**What this is:** a practical, step-by-step guide to hand-authoring (or reviewing generator output against) a FINOS CALM 1.2 `architecture.calm.json`. Grounded in four sources, each checked, not assumed:

1. `calm.finos.org/introduction/what-is-calm/`, `.../why-use-calm/`, `.../core-concepts/` — the conceptual framing (fetched this session).
2. The authoritative JSON Schema, fetched fresh via `gh api repos/finos/architecture-as-code/contents/calm/release/1.2/meta/*.json` — the actual field-level truth, which occasionally differs in small ways from the docs site's prose (noted where it matters).
3. `calm.finos.org/tutorials/intermediate/08-controls` through `20-multi-pattern-validation` (13 pages) — the practical, worked-example layer: this is where the "controls have four attachment levels, not three" correction and the whole Standards/Patterns governance workflow in Step 9 came from.
4. `coe-lab/docs/reference/rich-calm-example/architecture.calm.json` (+ its `patterns/` and `standards/` subfolders) — a worked, **`calm validate`-clean** example built alongside this guide that puts every construct below into one internally-consistent file, plus an actually-executed Standards-enforcement-via-Pattern run. Read the two side by side; this guide explains the *why*, that folder shows the *what*.

This guide is written for anyone authoring or reviewing CALM by hand. If you're improving `pipeline/src/modules/calm-generator` specifically, read `coe-lab/docs/reference/rich-calm-example/README.md` §5–§7 instead — it maps these same constructs against Weaver's actual current build state.

---

## 1. What CALM is for, and why it's worth doing properly

CALM (Common Architecture Language Model) is a FINOS open-source specification for describing software architecture as a **machine-readable, version-controllable JSON document**, instead of a diagram someone drew once and never updated. Per the docs site's own framing:

- **The problem it solves**: architecture is normally captured in "static diagrams, informal notations, or ad hoc documentation, leading to inconsistencies and a lack of traceability," and "architecture is often treated separately from the actual code" — so the diagram and the system drift apart silently.
- **What you get instead**: a document you can `git diff`, run through CI (`calm validate`), generate accurate diagrams from (never hand-redrawn, so never stale), and — the part most relevant to this repo — validate against a **pattern** to check compliance automatically instead of manually.

The practical implication for authoring: **treat `architecture.calm.json` like source code, not documentation.** It should be reviewable in a PR diff, it should validate in CI, and every claim in it should be traceable back to something real (a route definition, an entity annotation, a deployment manifest) — not aspirational. That last point is this project's own hard-won lesson (`CLAUDE.md`'s "Think Before Coding" principle) and it applies just as much to hand-authoring as to generation: **an unevidenced node or relationship is worse than a missing one**, because it looks authoritative.

## 2. The document skeleton

A CALM document's root object has exactly these properties (confirmed against `core.json`'s `properties`, not the docs prose):

```json
{
  "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
  "unique-id": "...",
  "name": "...",
  "description": "...",
  "nodes": [ ... ],
  "relationships": [ ... ],
  "metadata": [ ... ],
  "controls": { ... },
  "flows": [ ... ],
  "adrs": [ ... ]
}
```

**Real caveat, verified live this session**: `core.json`'s object schema has an authoring bug — its `additionalProperties: false` keyword is nested one level too deep (inside `properties`, not as its sibling), so it doesn't actually close the object. A scratch test with a `decorators` array and a nonsense top-level key both added still passed `calm validate -a` with 0 errors. **Don't rely on `calm validate` to catch a typo'd top-level key** — it won't, today. Stick to the properties above (plus `decorators`, see Step 8 below) deliberately, not because the schema will stop you from drifting.

## 3. Step-by-step authoring workflow

This is the order that produces the fewest rewrites, based on how the reference example was actually built this session (including one real correction along the way — the RBAC control's `requirement-url` initially pointed at a URL that isn't in this repo's local `calm-cli` allowlist mapping, caught by running `calm validate`, not by re-reading the JSON).

### Step 1 — Inventory real nodes first, resist the urge to model relationships yet

For each thing your architecture claims to have (a service, a database, a queue, an actor), you need at minimum: `unique-id`, `node-type`, `name`, `description`. **Every one of those four is `required`** per `core.json#/defs/node` — a node missing any of them is invalid, not just incomplete.

`node-type` is an open enum (`core.json#/defs/node-type-definition` is `anyOf[enum(...), string]`) — the nine named values are `actor, ecosystem, system, service, database, network, ldap, webclient, data-asset`, but **any string is technically valid**. Use the named ones where they fit before inventing your own; they're what tooling built against CALM will recognize. In the reference example: `actor` for the end user, `webclient` for the presentation layer they actually use, `service` for the backend application services, `database` for Postgres, `network` for the Kafka topic (a judgment call — CALM has no `topic`/`queue` node-type, and `network` is the closest real fit), and `system` for **three** different boundary concepts (see Step 4) — don't assume `system` only ever means "the whole app" or that you'll only ever need one.

### Step 2 — Model relationships as the *shape that's actually true*, not just "a connection"

CALM has **five** relationship-type shapes, not one generic "edge" — picking the wrong one changes what the relationship means:

| Shape | Real fields (`core.json#/defs/...`) | Use when |
|---|---|---|
| `connects` | `{source:{node}, destination:{node}}` | A directed dependency between two peer nodes — the shape you'll use most (service→service, service→database) |
| `interacts` | `{actor, nodes[]}` — **fan-out from one actor to many nodes, not pairwise** | A human/external actor's interaction with one or more entry points. Don't reach for this to mean "two services interact" — that's `connects`. |
| `composed-of` | `{container, nodes[]}` | Logical/domain containment — "these nodes are part of this system," independent of where they run |
| `deployed-in` | `{container, nodes[]}` | Physical/runtime placement — "these nodes currently execute inside this boundary." **Not the same claim as `composed-of`** — see the reference example's `platform-system` vs `k8s-cluster` split for why conflating them loses information (a managed cloud dependency is logically yours but not deployed-in your cluster). |
| `options` | array of `decision` objects | Alternative/optional architecture decisions inside one relationship — the least common shape, not used in the reference example |

Populate `protocol` (a sibling field of `relationship-type`, not nested inside it) whenever you actually know it — it's a closed 12-value enum: `HTTP, HTTPS, FTP, SFTP, JDBC, WebSocket, SocketIO, LDAP, AMQP, TLS, mTLS, TCP`. **If the real protocol doesn't fit the enum (Kafka is the clearest example — it's neither AMQP nor meaningfully `TCP`), leave `protocol` unset.** Forcing a misleading or uselessly-generic value is worse than omitting the field — the same "don't guess" discipline this project already applies to other detection gaps.

### Step 3 — Interfaces: pick the informal or formal shape, don't mix conventions within one node type

CALM allows two different interface shapes on any node (`interface.json`'s `node.interfaces[]` is `anyOf[interface-definition, interface-type]`):

- **Informal (`interface-type`)**: `{unique-id, ...anything}` — completely freeform beyond `unique-id`. The common convention for HTTP routes is `{unique-id, type: "path-interface", path: "GET /v1/payments"}`, but that `type`/`path` shape is a *convention*, not schema — CALM doesn't know what `path-interface` means.
- **Formal (`interface-definition`)**: `{unique-id, definition-url, config}` — references a real external JSON Schema and provides config that must conform to it. FINOS publishes a few real ones you can reference directly instead of inventing your own: `calm.finos.org/interfaces/example/{tcp-host-port, container-image, url, tcp-port}`. `tcp-host-port` requires `{host, port}`; `container-image` requires `{image}`.

Use informal for anything route-shaped (a decorator or manifest tells you a path, not a formal schema); use formal for anything that maps cleanly onto a published schema (a host:port, a container image) — reusing FINOS's own schema beats inventing a project-local convention for the same data.

### Step 4 — One `system` node answers one question; don't make it answer two

Each `system` node should represent exactly one boundary question, and a real architecture usually needs more than one:

- **Logical domain** — "what belongs to this platform?" → `composed-of`.
- **Runtime placement** — "where does it actually run?" → `deployed-in`. Collapsing this into the domain node forces you to either lie about what's deployed where, or lose the logical grouping — see §2.1 of the reference example's README for the worked case (a managed database and a managed message queue that are logically part of the platform but not cluster-deployed).
- **Compliance/regulatory scope** — a third, independent question a domain-specific `system` node can answer. The reference example's `pci-cde` node (§2.3, §8 of the README) is the worked case: for a *payment* platform specifically, "which nodes touch raw cardholder data" is a real architectural fact, distinct from both the domain grouping and the runtime boundary — it gets its own `system` node and its own `composed-of` (a **second**, independent `composed-of` relationship in the same document, pointing at a different node subset). The general lesson: don't assume one `composed-of` per architecture is a schema limit — it isn't, and a second orthogonal boundary is often the honest way to answer a second real question.

Ask "what question does this boundary answer?" before adding a `system` node — if the answer is "the same question `platform-system` already answers," you don't need a new node, you need a new node *in* the existing one.

### Step 5 — Attach controls where the requirement actually lives, not just at the top

`controls` (`control.json#/defs/controls`) can attach at **four different levels** — confirmed by the intermediate tutorial (`08-controls`: *"Architecture level, Node level, Relationship level, Flow level"*) and by the schema (`flow.json#/defs/flow` has its own `controls` property, `$ref`'d to the same `control.json#/defs/controls` shape) — and each level means something different:

```json
"controls": {
  "<control-id>": {
    "description": "...",
    "requirements": [
      { "requirement-url": "...", "config-url": "..." }
      // OR: { "requirement-url": "...", "config": { ... inline ... } }
    ]
  }
}
```

- **Node-level** — a requirement scoped to one component (e.g. RBAC enforcement on one service).
- **Relationship-level** — a requirement scoped to one connection (e.g. "this edge must use a permitted protocol").
- **Flow-level** — a requirement scoped to a whole traced business process, not any single hop in it (e.g. "this end-to-end payment flow must be auditable," which no single relationship in it fully captures).
- **Document-root level** — a requirement that applies to the whole architecture, not tied to any single element (e.g. an org-wide network-segmentation policy). This is a real, distinct construct — `core.json`'s top-level `properties.controls` — easy to miss because most published examples (including FINOS's own `getting-started` pattern) only show node/relationship-level usage.

`requirement-url` is required; you need **exactly one** of `config-url` (points at an external file describing how the requirement is met) or `config` (the same information, inline). If you don't have a real published control schema to point at, author your own local one (see this repo's own `pipeline/src/rules/control-requirements/*.requirement.json` for the pattern) rather than inventing a URL that resolves nowhere — **`calm-cli` does a live host-allowlist check against every `requirement-url`, even under plain schema validation**, and a bare placeholder `https://` URL will fail validation outright unless it's either a real allowlisted host or mapped locally via `calm validate -u <mapping.json>`. This is a real, previously-surprising finding from earlier in this project (`CLAUDE.md`'s `requirement-url` allowlist finding) — don't rediscover it the hard way.

### Step 6 — Attach evidence, but know there's no schema-enforced slot for it yet

`evidence.json` (`{evidence: {unique-id, evidence-paths[], control-config-url}}`) is a real, published CALM construct that's a strong fit for "here's the exact file:line this control detection came from." **But it isn't `$ref`'d from anywhere in `core.json` or `control.json`** — confirmed by grepping every `release/1.2/meta/*.json` file for `evidence.json` and finding zero references. The most defensible placement, until FINOS wires it up formally, is nesting it inside a `control-detail.config` object (which is genuinely open — `type: object`, no fixed shape) — that's what the reference example does. Don't expect `calm validate` to check its shape; it won't.

### Step 7 — Add `flows[]` if you have a real multi-step business process worth tracing

A `flow` (`flow.json#/defs/flow`) is `{unique-id, name, description, transitions[]}`, where each `transition` references an existing relationship's `unique-id`, a `sequence-number`, and its own `description` — plus an optional `direction` (`source-to-destination` | `destination-to-source`, defaulting to the former). The intermediate tutorial's own worked example states `direction` explicitly on every transition even though it's optional; do the same for readability — it makes request/response pairs (a request going `source-to-destination`, its response reusing the same relationship `destination-to-source`) unambiguous rather than implied. This is how you say "here is the order these five relationships fire in, for this one business scenario" — a payment flow, an onboarding flow — without inventing new nodes or relationships, just sequencing the ones you already modeled. Skip this if you don't have a real named business process to trace; don't invent one for coverage's sake.

### Step 8 — `adrs[]` and `decorators[]`: cheap to add, but know their real limits

- `adrs` is just an array of plain strings (URLs or paths — relative paths to local Markdown files, or absolute URLs to an external wiki/tool are both fine) — no format constraint, so linking to your real ADR documents costs nothing and adds real traceability. The tutorial's own convention places `adrs` near the top of the document ("after `$schema` and before `metadata`") — purely cosmetic (JSON key order has no schema meaning) but worth matching if you're following this guide alongside the tutorial. It also mandates **MADR** (Markdown Any Decision Records: Title, Status, Context, Decision, Consequences) as the format for whatever those linked files contain — CALM doesn't enforce this (they're plain strings), but it's a reasonable default if you don't already have an ADR convention.
- `decorators` (`decorators.json#/defs/decorator`: `{unique-id, type, target[], applies-to[], data}`) is for cross-cutting annotations (deployment metadata, threat-model tags) that apply to multiple elements at once without cluttering every node's own object. **Same caveat as evidence.json**: not `$ref`'d from `core.json`'s root `properties`, so it's schema-legal (nothing rejects it) but not schema-validated (nothing checks its shape either). Useful, but know you're on your own for correctness.

### Step 9 — Extend with your own fields via "Standards," don't invent ad hoc metadata for structured data

If you need org-specific structured fields on a node (a cost center, an owner, a compliance tag) that should be **validated**, not just tolerated, the CALM docs describe this as "Standards": your own JSON Schema, `allOf`-composed against `core.json#/defs/node` (or the relationship/interface equivalents), published wherever your org publishes schemas. The technique:

```json
{
  "allOf": [
    { "$ref": "https://calm.finos.org/release/1.2/meta/core.json#/defs/node" },
    { "$ref": "https://your-org.example/standards/company-node.json" }
  ]
}
```

Note this is **not** a new meta-schema file shipped by FINOS (there's no `standards.json` in `release/1.2/meta/`) — it's a documented pattern for using plain JSON Schema composition against the published `core.json` defs. In practice, because `node`'s own schema already sets `additionalProperties: true`, you can add a structured field like `"ownership": {"costCenter": "...", "owner": "..."}` directly on a node right now without a Standards schema existing anywhere yet — `calm validate -a` will accept it either way.

**The important part, easy to miss and confirmed by `19-enforcing-standards`: a Standard does not enforce itself.** Writing the `allOf`-composed schema file above and never referencing it anywhere changes nothing about what `calm validate -a architecture.json` checks — that command only ever validates against `core.json`. **A Standard is only actually checked once a Pattern references it via `$ref`, and you run `calm validate -p <pattern> -a <architecture>` instead of plain `-a`.** Concretely, a standards-enforcing Pattern looks like this (note `items`, not `prefixItems` — this says "*every* node must comply," not "these exact N nodes in this exact order," which is the structural-pattern use case from §4 below):

```json
{
  "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
  "type": "object",
  "properties": {
    "nodes": { "type": "array", "items": { "$ref": "https://your-org.example/standards/company-node.json" } },
    "relationships": { "type": "array" }
  },
  "required": ["nodes", "relationships"]
}
```

Two real gotchas, found only by actually running this (see `coe-lab/docs/reference/rich-calm-example/patterns/company-base-pattern.json` + `standards/company-node-standard.json` + `url-mapping.json` for the full worked, executed version):

1. **`calm-cli` has its own pattern-authoring lint**, `pattern-has-nodes-relationships`, that fires even on a purely standards-enforcing pattern that only cares about `nodes` — it wants **both** `nodes` and `relationships` declared as top-level `properties`, even if `relationships` is left maximally permissive (`{"type": "array"}`). Not mentioned on the tutorial page itself; only surfaced by running `calm validate -p ...` and reading the error.
2. **`-u <url-mapping.json>` needs every referenced URL in one file**, not just the Standard's canonical `$id`. If your architecture also has `controls` with their own `requirement-url`s (Step 5), those need entries in the *same* mapping file passed to `-p ... -a ... -u ...` — a mapping file that only maps the Standard's URL will validate the Standard fine and then fail on the first control it hits.

Run against the reference example (only `payments-service`/`payments-db` carry `ownership`), this correctly produces one `must have required property 'ownership'` error per node that doesn't have it — and stays silent on the two that do. That's the actual mechanism working, not a description of it. (The exact error count in the reference example has changed across revisions as nodes were added — check `coe-lab/docs/reference/rich-calm-example/README.md`'s current inventory line rather than trusting a number frozen in this guide.)

### Step 10 — Validate, don't just eyeball

```bash
cd pipeline
npx --no-install calm validate -a path/to/architecture.calm.json -f pretty
# add -u <mapping.json> if your document has controls pointing at requirement-urls
# that need local resolution — dist/rules/control-url-mapping.json covers this
# repo's own catalogue controls; if you also author your own local controls or
# Standards (Step 9), merge them into one -u file rather than juggling several,
# the way coe-lab/docs/reference/rich-calm-example/url-mapping.json does
```

Zero errors doesn't mean zero problems — remember §2's finding that the document root doesn't actually reject unknown keys. Schema-valid and *true* are different claims (this project's own "Think Before Coding" principle) — cross-check node/relationship claims against the real source they're supposed to represent, the same way this project's gold-authoring process requires (`coe-lab/gold/calm/README.md`: *"Read the fixture source... Author CALM independently... never bootstrap by copying generated output"*).

## 4. What's deliberately out of scope here

Two more constructs the docs site names that this guide and the reference example don't cover, on purpose:

- **Timelines** (`calm-timeline.json`/`timeline.json`) — tracking architecture evolution across multiple points in time. Real and schema-backed, but a different unit of work than authoring one snapshot; worth its own guide once there's a real multi-snapshot use case.
- **Widgets** — a Markdown-documentation-generation feature, not a JSON construct you author into `architecture.calm.json` at all. Not applicable to this guide.
- **Patterns as a *structural* authoring artifact** — Step 9 above covers the *standards-enforcing* flavor of a Pattern (agnostic about which nodes exist, strict about what properties they carry) because that's the flavor this guide's worked example actually runs. A **structural** Pattern is the other flavor: it pins an *exact* required shape — `const` for fixed values, `prefixItems`/`minItems`/`maxItems` for a fixed node/relationship list — the kind FINOS's own real worked example is, `calm/getting-started/conference-signup.pattern.json` (fetched and read in full while building this guide; also the source of several `controls`/`protocol` examples reused directly in the reference example). A structural Pattern has a second real superpower beyond validation: **`calm generate -p my-pattern.json -o new-architecture.json`** scaffolds a starting architecture document straight from the pattern, with placeholder values (`"[[ DESCRIPTION ]]"`, `-1`) marking what still needs real content — a legitimate starting point for a new architecture that must conform to an existing structural pattern, distinct from Step 9's compliance-checking use case. Architectures satisfying either flavor of pattern are always free to add extra nodes/relationships/interfaces/metadata beyond what the pattern names — a pattern only constrains what it explicitly specifies, never closes the document to more.
- **Combining multiple patterns** — if you have both a structural pattern (what must exist) and a standards-enforcing pattern (what properties everything must carry), the tutorial's own guidance is to run them as **two separate `calm validate -p ... -a ...` invocations** — structure first, then standards — rather than merging both into one pattern file. The stated reason scales directly: if an org's Standards change, you update one shared standards-pattern file; if instead every architecture-type's pattern had the standards rules folded in, you'd update N files for the same change.

## 5. Quick reference — construct → where to look

| Want to model... | Use | See |
|---|---|---|
| A component | `nodes[]`, pick a real `node-type` | §3 Step 1 |
| A dependency between two components | `relationships[].connects` | §3 Step 2 |
| An actor using your system | `relationships[].interacts` | §3 Step 2 |
| Logical domain grouping | `relationships[].composed-of` | §3 Steps 2 & 4 |
| Runtime placement | `relationships[].deployed-in` | §3 Steps 2 & 4 |
| An exposed route | Informal `interface-type` | §3 Step 3 |
| An exposed host:port / image | Formal `interface-definition` | §3 Step 3 |
| A compliance/security requirement scoped to one node, edge, flow, or the whole architecture | `controls` — **four** attachment levels (node/relationship/flow/document-root) | §3 Step 5 |
| Where a control's evidence came from | `evidence.json`-shaped object inside `control-detail.config` | §3 Step 6 |
| A traced, ordered business process | `flows[]` (with `direction` on each transition) | §3 Step 7 |
| Links to design decisions | `adrs[]` (near the top, MADR format) | §3 Step 8 |
| Cross-cutting annotations | `decorators[]` | §3 Step 8 |
| Org-specific structured fields that should just be *accepted* | Add the field directly — `node`'s schema already allows it | §3 Step 9 |
| Org-specific structured fields that should actually be *validated* | A Standard (`allOf`-composed schema) **referenced by a Pattern** — a Standard alone enforces nothing | §3 Step 9 |
| Pinning an exact required node/relationship shape | A **structural Pattern** (`const`/`prefixItems`) — also usable with `calm generate` to scaffold a new architecture | §4 |
| Checking an architecture against both structure and org standards at once | Two separate `calm validate -p ... -a ...` runs, not one merged pattern | §4 |
