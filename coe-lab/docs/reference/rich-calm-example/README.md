# Reference CALM example — construct coverage + Weaver gap map

**What this is:** `architecture.calm.json` in this folder is a small, hand-authored, **`calm validate`-clean** (0 errors, 0 warnings, confirmed this session — command below) fintech-shaped architecture that deliberately exercises every CALM 1.2 construct this project's research has confirmed against the *real* FINOS schema, not recalled from memory. Built across four review passes: (1) the initial construct-coverage pass, (2) a pass against `calm.finos.org/core-concepts/` that added `decorators` and Standards, (3) a pass against `calm.finos.org/tutorials/intermediate/` that corrected the controls-attachment-level count and added a fully executed Standards-enforcement-via-Pattern workflow, (4) a payment-domain solution-design review (§8) that added a presentation-layer node and a PCI DSS scope boundary — the two structural gaps a from-scratch solution-design read of this example actually found. This is **not** gold for any `coe-lab` package and **not** platform output — it's a teaching reference for improving `pipeline/src/modules/calm-generator`. See also the companion guide one level up: [`../how-to-capture-architecture-in-calm.md`](../how-to-capture-architecture-in-calm.md), a general-purpose "how to author a CALM document" write-up that this example illustrates.

**Current inventory** (counted from the file, not estimated): 10 nodes, 9 relationships (5 `connects`, 2 `composed-of`, 1 `deployed-in`, 1 `interacts`), 1 flow (6 transitions), 6 control blocks across all four attachment levels (node/relationship/flow/document-root), 1 decorator, 2 ADRs.

```bash
cd pipeline
npx --no-install calm validate -u ../coe-lab/docs/reference/rich-calm-example/url-mapping.json \
  -a ../coe-lab/docs/reference/rich-calm-example/architecture.calm.json -f pretty
# Summary — Errors: no (0), Warnings: no (0), Info/Hints: 0
```

(Note: the local `url-mapping.json` in this folder — not `pipeline/dist/rules/control-url-mapping.json` — is now the canonical `-u` file for this example. It's a superset: it merges the pipeline's own control mappings with this example's own local Standards and PCI-control mappings, since `pci-cde`'s control (added in pass 4) resolves to a locally-authored requirement file the pipeline's own mapping doesn't know about.)

---

## 1. Construct-by-construct — what's in the example, and where it's proven real

| Construct | Real shape (schema source) | Where it's used in this example |
|---|---|---|
| `node-type: actor` | `core.json#/defs/node-type-definition` enum | `end-user` |
| `node-type: webclient` | same enum | `checkout-webapp` — added in pass 4 (§8), see §2.1 for why an actor talking directly to a backend service was a real gap |
| `node-type: service` | same enum | `api-gateway`, `payments-service`, `notification-service` |
| `node-type: database` | same enum | `payments-db` |
| `node-type: network` | same enum | `settlement-events` (a Kafka topic — see §5 caveat) |
| `node-type: system` | same enum | **three** separate `system` nodes, each answering a different question: `platform-system` (logical domain, §2.1), `k8s-cluster` (runtime boundary, §2.1), `pci-cde` (PCI DSS compliance scope, §2.3 — added in pass 4) |
| Informal interface (`interface-type`) | `interface.json#/defs/interface-type`: `{unique-id, ...freeform}` | `payments-service`'s `path-interface` entries — the convention Weaver already emits |
| Formal interface (`interface-definition`) | `interface.json#/defs/interface-definition`: `{unique-id, definition-url, config}`, real published schemas at `calm.finos.org/interfaces/example/{tcp-host-port,container-image,url}` | `api-gateway`'s host/port + container-image interfaces, `payments-db`'s host/port interface, `checkout-webapp`'s `url` interface (a third published schema, first used in pass 4) — **Weaver has never emitted this shape**, see §5 |
| `connects` | `core.json#/defs/connects-type`: `{source:{node}, destination:{node}}` | `webapp-to-gateway`, `gateway-to-payments`, `payments-to-db`, both Kafka edges (5 total) |
| `interacts` | `core.json#/defs/interacts-type`: `{actor, nodes[]}` (fan-out, NOT pairwise) | `end-user-uses-webapp` — re-pointed at `checkout-webapp` in pass 4; originally (incorrectly) pointed straight at `api-gateway`, skipping the presentation layer entirely, see §2.1 |
| `composed-of` | `core.json#/defs/composed-of-type`: `{container, nodes[]}` | **Two** independent uses, proving one architecture can have more than one: `platform-composed-of` (logical domain grouping) and `pci-composed-of` (PCI scope declaration, pass 4, §2.3) — different container, different node subset |
| `deployed-in` | `core.json#/defs/deployed-in-type`: `{container, nodes[]}` | `k8s-deployed-in` — runtime placement, **deliberately a different node set** than either `composed-of` use (see §2.1, §2.3) |
| `protocol` (relationship-level, sibling of `relationship-type`) | `core.json#/defs/protocol`, enum of 12 values | `HTTPS` on `webapp-to-gateway` and `gateway-to-payments`, `JDBC` on the db edge — **omitted** on both Kafka edges, see §5 |
| Node-level `controls` | `control.json#/defs/controls` + `control-detail` | `payments-service` (RBAC, inline `config`), `k8s-cluster` (micro-segmentation, `config-url`), `pci-cde` (PCI DSS scope declaration, inline `config` — pass 4) |
| Relationship-level `controls` | same | `gateway-to-payments` (permitted-connection) |
| Flow-level `controls` | same | `process-card-payment` (RBAC, end-to-end review) |
| Document-root `controls` | `core.json` top-level `properties.controls` — confirmed a **real, distinct** construct from node/relationship controls, not previously distinguished in this project's docs before the deep-dive spike | top-level `controls.security` — an org-wide requirement not scoped to one element |
| `evidence`-shaped provenance | `evidence.json`: `{evidence:{unique-id, evidence-paths[], control-config-url}}` | nested inside `payments-service`'s RBAC `control-detail.config` — **placement is a judgment call**, see §5 |
| `flows[]` | `flow.json#/defs/flow` + `transition` | `process-card-payment` — now a 6-step business flow (webapp hop added in pass 4) referencing relationship `unique-id`s in sequence |
| `adrs[]` | `core.json`: array of plain strings, no format constraint | two illustrative ADR path references |
| `decorators[]` | `decorators.json#/defs/decorator`: `{unique-id, type, target[], applies-to[], data}` | root-level `decorators` array, one `deployment`-typed entry targeting `api-gateway` — **added on second pass**, see §3.1 for a real caveat about this construct |
| Standards (org schema extension) | Not a `calm.finos.org` meta-schema file — a documented **technique**: your own JSON Schema `allOf`-composed against `core.json#/defs/node` (or `relationship`/interface), adding org-specific typed fields | `payments-service` and `payments-db`'s `ownership: {costCenter, owner}` — the field itself added on second pass (see §3.2), the Standard schema that actually validates it (`standards/company-node-standard.json`) built and enforced via a Pattern on the third pass, see §4.3 |

## 2. Design choices worth calling out explicitly

### 2.1 `platform-system` vs `k8s-cluster` — `composed-of` and `deployed-in` are not the same question

This example deliberately uses **two separate `system` nodes** for these two relationship-types (a third `system` node, `pci-cde`, is a different question again — see §2.3) to keep two genuinely different questions separate, because collapsing them loses real information:

- **`composed-of`** answers *"what logically belongs to this domain?"* — `platform-system` is composed of all six application units (`checkout-webapp` included as of pass 4), full stop.
- **`deployed-in`** answers *"where does it actually run right now?"* — only `api-gateway`, `payments-service`, and `notification-service` are `deployed-in` `k8s-cluster`. `checkout-webapp` (statically hosted, CDN-shaped), `payments-db` (managed RDS), and `settlement-events` (managed Kafka) are logically part of the platform but **not** cluster-hosted, and the example encodes that by simply leaving them out of the `deployed-in` node list.

A generator that only ever emits one of these two relationship-types (or worse, always puts every node into both) silently discards the "this is logically ours but someone else operates it" distinction — a real, common shape for managed cloud dependencies (RDS, MSK/Confluent Cloud, managed Redis, static frontend hosting, etc.).

**Pass 4 also fixed a real structural gap in this example itself, not just a documentation gap**: the original version had `end-user` (an `actor`) `interacts`-ing directly with `api-gateway` — a backend service — with no presentation layer between them. No real payment platform works that way; a cardholder never talks to an API gateway directly. `checkout-webapp` (`node-type: webclient`, an enum value this example had never used before) now sits between them: `end-user --interacts--> checkout-webapp --connects (HTTPS)--> api-gateway`. This is the kind of gap a schema-conformance review never catches (the old version was perfectly `calm validate`-clean) but a solution-design review — asking "does this actually describe a real payment platform?" rather than "is this valid CALM?" — catches immediately. See §8 for the full review that found this.

### 2.2 The Kafka topic has no `protocol` — an honest schema-fit gap, not an oversight

`core.json#/defs/protocol` enum is exactly: `HTTP, HTTPS, FTP, SFTP, JDBC, WebSocket, SocketIO, LDAP, AMQP, TLS, mTLS, TCP`. **There is no `Kafka` value**, and Kafka's wire protocol is not AMQP (that's RabbitMQ's protocol) — the only technically-true value would be `TCP`, which is true but throws away everything useful (nobody querying this graph for "which edges use Kafka" would find it under `protocol: TCP`, since so would a raw socket connection). This example leaves `protocol` unset on both Kafka edges rather than force a misleading or uselessly-generic value — same "don't guess, name the gap" discipline this project already applies elsewhere (`CLAUDE.md`'s `protocol` finding, `x-aac-scope-limitations`).

**This is a real, reusable finding for Weaver, not just for this example**: if/when messaging-relationship building is wired into `relationship-builder.ts` (per `docs/requirements/CALM_Generator_Requirements_v0_11.md`'s two-mechanism messaging design, still backlog per `docs/solution/STATUS.md`), it should **not** default `protocol` to `TCP` or `AMQP` for Kafka/SQS/SNS edges — leave it `null`/absent, exactly as this example does.

### 2.3 `pci-cde` — a third `system` node for a third question, and why its scope is deliberately larger than a "good" design would want

`platform-system` answers "what belongs to the domain," `k8s-cluster` answers "where does it run." `pci-cde` (added in pass 4, §8) answers a third, independent question specific to a *payment* platform: **which nodes are actually in PCI DSS compliance scope** — i.e. which components store, process, or transmit raw cardholder data. This gets its own `system` node + its own `composed-of` (`pci-composed-of`, pointing at a different node subset than `platform-composed-of`) rather than being folded into an existing boundary, because "logically part of the platform" and "touches raw card data" are genuinely different questions with genuinely different answers — `notification-service` and `settlement-events` are unambiguously part of the platform but never see a PAN, so they're correctly excluded from `pci-cde`'s scope.

**The scope declared here is real but not ideal, and the control's own `config.scope-rationale` says so plainly**: `checkout-webapp` and `api-gateway` are both in PCI scope because raw card data genuinely flows through them — there's no tokenizing PSP or hosted-fields boundary in this reference (deliberately deferred, see §9) that would let card data bypass them entirely. A real payment platform's next architectural move is usually to shrink this exact scope by inserting that boundary. Modeling the *current, larger* scope honestly — rather than the *aspirational, smaller* one — is the same "don't fabricate a mechanism that isn't there yet" discipline this project applies everywhere else; a CALM document should describe what the architecture actually does, not what a future version of it should do.

## 3. Two more findings, from a second review pass grounded in `calm.finos.org`'s own docs site

This example was first authored against the GitHub-hosted JSON Schema files directly (`gh api repos/finos/architecture-as-code/...`). A follow-up pass read the live docs site (`core-concepts/`, `introduction/what-is-calm/`, `introduction/why-use-calm/`) to check the example against FINOS's own explanation of the constructs, not just the schema — and that pass surfaced two things worth stating precisely, both verified live against `calm-cli` rather than assumed.

### 3.1 `decorators` and `evidence` are real published schemas, but neither is wired into the document root

`core.json`'s top-level `properties` object lists exactly six keys: `nodes`, `relationships`, `metadata`, `controls`, `flows`, `adrs`. **Neither `decorators` nor `evidence` appears there**, and grepping every other `release/1.2/meta/*.json` file for `"decorators.json"` or `"evidence.json"` finds zero `$ref`s to either — confirmed by fetching and grepping all eleven `release/1.2/meta/` files fresh this session. Both are real, independently valid schema files (used elsewhere — `decorators.json` is the mechanism the CALM docs describe for deployment/business/threat-model annotations; `evidence.json` is the natural fit this project's own deep-dive spike already found for control provenance), but as of `release/1.2` **there is no typed, schema-enforced place to attach either one at the document root.** This example's `decorators` array (added on this pass) is schema-legal but *unvalidated* — see §3.2 for why it's accepted at all.

### 3.2 `core.json`'s own top-level `additionalProperties: false` doesn't actually work — verified live, not just read

Look closely at the raw schema:

```json
"properties": {
  "nodes": { ... },
  "relationships": { ... },
  "metadata": { ... },
  "controls": { ... },
  "flows": { ... },
  "adrs": { ... },
  "additionalProperties": false
}
```

`"additionalProperties": false` is nested **one level too deep** — inside `properties`, as if it were a property schema for a field literally named `additionalProperties`, instead of being a sibling keyword of `properties` at the object-schema level (the correct, intended placement to close the object to unknown keys). This looks like a real authoring slip in FINOS's own schema, not a deliberate design.

**Verified, not just read**: a scratch copy of this example with `"decorators": [...]` and a nonsense `"bogus-unknown-root-key": "..."` both added at the document root still validates with `calm validate -a` → **0 errors, 0 warnings**. If the `additionalProperties: false` keyword actually worked, either addition should have failed schema validation. It doesn't, which means **the CALM 1.2 document root currently accepts arbitrary extra top-level keys** — a real, checkable fact worth knowing before assuming `calm validate` will catch a typo'd or invented top-level key in a hand-authored or generated file. (This is exactly the class of "verify against the real tool" finding this project's own `CLAUDE.md` working principles ask for — stated once here rather than re-discovered by a future session.)

## 4. A third pass — `calm.finos.org/tutorials/intermediate/` — corrected two things and added a fully executed governance workflow

This third review pass read the intermediate tutorial series (13 pages: `08-controls` through `20-multi-pattern-validation`), fetched and summarized this session. Two of this example's earlier claims needed correcting, and one new construct (Standards enforced via a Pattern) was built and **actually run against `calm-cli`**, not just described.

### 4.1 Correction: `controls` attach at **four** levels, not three — flow-level was missing

§1's table only listed node/relationship/document-root. The tutorial (`08-controls`) states controls can attach at **"Architecture level, Node level, Relationship level, Flow level."** `flow.json#/defs/flow` confirms this in the schema too (`flow` has its own `controls: {$ref: control.json#/defs/controls}` property) — it just wasn't exercised in the first two passes. **Fixed**: `architecture.calm.json`'s `process-card-payment` flow now carries a `security-rbac-001` control, re-validated clean (0 errors). This is the fourth and last attachment level — the example now demonstrates all four.

### 4.2 Correction: "Standards don't enforce themselves" — a real mechanism, not just a naming nuance

§1 described Standards as "extend a node/relationship with your own JSON Schema via `allOf`" and left it there. The tutorial (`18-standards`, `19-enforcing-standards`) states the missing half plainly: **a Standard by itself is inert.** Nothing about putting `allOf`-composed fields on a node causes `calm validate -a` to check them — `-a` (plain architecture validation) only ever checks against `core.json`. **A Standard is only enforced when a Pattern references it via `$ref`, and you validate with `calm validate -p <pattern> -a <architecture>`.** This is a materially different claim from "Standards are schema extensions" — it's "Standards are schema extensions that do nothing until a Pattern opts an architecture into checking them."

### 4.3 New, fully executed: Standards enforced via a Pattern, run against this example's real gaps

Two new files in this folder put §4.2's mechanism into practice, and the result was **run for real**, not asserted:

- `standards/company-node-standard.json` — an illustrative org Standard: every node must carry `ownership: {costCenter (pattern `^CC-[0-9]{4}$`), owner}`, `allOf`-composed against the real `core.json#/defs/node`. Matches the tutorial's own worked example almost exactly (independently arrived at in the first pass of this example, before this tutorial was read — a reassuring sign the earlier `ownership` field on `payments-service`/`payments-db` was already the right shape).
- `patterns/company-base-pattern.json` — a **standards-enforcing** Pattern (not a structural one): agnostic about which nodes must exist, but requires *every* node to comply with the Standard above, via `items: {$ref: ...}` (not `prefixItems`, which would instead pin an exact node list — the distinction the tutorial draws between "structural" and "standards-enforcing" patterns).
- `url-mapping.json` — merges this example's Standard URL mapping with this repo's own `pipeline/dist/rules/control-url-mapping.json`, since `calm validate -p ... -u <mapping>` needs **every** referenced URL resolvable, both the pattern's Standard reference and the architecture's own control `requirement-url`s — found the hard way (first run failed on the control URLs because the first `-u` file only had the Standard entry).

```bash
cd pipeline
npx --no-install calm validate \
  -p ../coe-lab/docs/reference/rich-calm-example/patterns/company-base-pattern.json \
  -a ../coe-lab/docs/reference/rich-calm-example/architecture.calm.json \
  -u ../coe-lab/docs/reference/rich-calm-example/url-mapping.json -f pretty
```

**Real output**: 6 errors, each `must have required property 'ownership'` — one per node that doesn't have it (`end-user`, `api-gateway`, `notification-service`, `settlement-events`, `platform-system`, `k8s-cluster`), and correctly **silent** on the two that do (`payments-service`, `payments-db`). This is the exact "non-compliant test" shape the tutorial's own two-test structure (fail then pass) describes — only the fail case is built here, deliberately: forcing `ownership` onto every node (including the actor and the two boundary `system` nodes, which don't obviously have a single cost-center owner in most real orgs) would have manufactured a clean pass instead of representing a real, honest gap.

**A second real finding, found only by running it**: `calm-cli`'s pattern validator has its own lint check, `pattern-has-nodes-relationships`, that fires even for a Pattern that only cares about `nodes` — *"Should have `nodes` and `relationships` as top level properties on the CALM document."* The first version of `company-base-pattern.json` (declaring only `nodes`) failed this check; adding a permissive `"relationships": {"type": "array"}` fixed it. Not documented on the tutorial page (which only shows the pattern's *intent*, not this lint rule) — a real `calm-cli`-specific requirement worth knowing before authoring any Pattern, structural or standards-enforcing.

**Known limitation, disclosed rather than left silent**: `url-mapping.json` in this folder is checked in (not gitignored) with **absolute, machine-specific paths** baked in (`/Users/.../coe-lab/docs/reference/...`, `/Users/.../pipeline/dist/rules/...`). This is a real portability gap — it works on this checkout right now (verified above) but will not resolve correctly from a different clone path without regenerating it. This is the opposite of this repo's own established convention for the equivalent pipeline file: `docs/solution/STATUS.md` and `CLAUDE.md` both note `pipeline/dist/rules/control-url-mapping.json` is deliberately **not** checked in and is regenerated fresh per `npm run build` for exactly this reason. If this Standards/Pattern example graduates from "reference" to something re-run regularly (e.g. in CI), regenerate `url-mapping.json` from relative paths or a small script the way the pipeline already does, rather than trusting the committed absolute-path version.

### 4.4 Smaller corrections, folded into §1's table and the companion how-to guide

- `flows[].transitions[]` — the tutorial's worked example includes `"direction": "source-to-destination"` explicitly on every transition (it's optional, defaulting to that value per `flow.json`, but the tutorial always states it). Added to all five transitions in `architecture.calm.json` for parity.
- `adrs[]` — the tutorial places the array "after `$schema` and before `metadata`," near the top of the document, and mandates MADR (Markdown Any Decision Records: Title/Status/Context/Decision/Consequences) as the format for the linked files. `architecture.calm.json`'s `adrs` array moved up to right after `description` to match (cosmetic — JSON key order carries no schema meaning — but worth matching for anyone reading this file next to the tutorial).
- Patterns can **generate**, not just validate: `calm generate -p my-pattern.json -o new-architecture.json` scaffolds a new architecture from a pattern, with placeholder values (`"[[ DESCRIPTION ]]"`, `-1`) marking what still needs real content. Not exercised in this example (no pattern here is structural/generation-shaped — `company-base-pattern.json` is standards-enforcing only), but worth knowing this is the "other half" of what a Pattern is for.
- Multi-pattern validation: the tutorial's own guidance is to run structural and standards-enforcing patterns as **separate** `calm validate -p ... -a ...` invocations (structure first, then standards) rather than merging them into one pattern file — "update 1 standards pattern" instead of "update 10 combined patterns" when an org standard changes. Relevant if this repo ever builds a governance CI step per `docs/requirements/CALM_Generator_Requirements_v0_8.md`'s "two validation modes" framing (`calm validate -a` vs `calm validate -p pattern.json -a architecture.json`) — worth keeping structural and standards patterns as separate files from day one rather than combining them.

## 5. What Weaver's calm-generator does NOT do yet — mapped against this example, cited against real code state

Every claim below is checked against what `CLAUDE.md`'s own "Pipeline architecture" section and `docs/solution/STATUS.md` currently say is built, not assumed:

| Construct in this example | Weaver's current state | Evidence |
|---|---|---|
| `interacts` | **Never emitted.** `relationship-type-mapping.yml`'s only rows resolve to `connects`; `interacts` has no row. | `CLAUDE.md`: *"`relationship-type-mapping.yml`'s only rows resolve to `connects`; `interacts` has no row and is therefore never emitted, matching v0.9 §1's explicit recommendation."* This was the right call **at the time** (no actor-detection mechanism existed to populate the `actor` field correctly) — but it means **no generated CALM file has ever contained an `interacts` relationship**, and there is currently no code path that could produce this example's `end-user-uses-gateway` edge even if actor detection existed tomorrow, since the relationship-builder has no branch that reaches for `interacts` at all. |
| `node-type: actor` | **Never emitted** — no actor-detection mechanism exists. Confirmed as an open, named gap: *"`actor` — still requires real actor-detection logic to populate... confirming the enum value exists doesn't reduce that work."* (deep-dive spike §6) | Same |
| `node-type: system` (as a real top-level app-boundary node, distinct from a k8s namespace) | Backlog. `STATUS.md`: k8s trust provider is **backlog**; no code path builds a `composed-of`-container `system` node the way this example's `platform-system` is built. | `docs/solution/STATUS.md` §A.1 |
| `node-type: network` (message broker/topic) | Backlog — messaging detection is designed (`CALM_Generator_Requirements_v0_11.md`) but not wired to node-building; SQS producer/consumer detection exists per `STATUS.md`'s Fidelity yardstick program, but no evidence it types the topic itself as `node-type: network` rather than folding it into a relationship endpoint. | `docs/solution/STATUS.md`, `CLAUDE.md` messaging notes |
| `deployed-in` vs `composed-of` as two distinct relationship types on the same node set | **Not distinguished.** `relationship-type-mapping.yml` rows all resolve to `connects` per the note above; nothing in the codebase currently builds a `deployed-in` relationship at all — k8s manifest ingestion (the mechanism that would supply "what's actually deployed where") is explicitly named as **not implemented**: *"the code below doesn't touch Kubernetes manifests at all yet."* | `CLAUDE.md` Pipeline architecture status note |
| Formal `interface-definition` (`{unique-id, definition-url, config}`) | **Never emitted.** Every interface Weaver builds uses the informal `interface-type` convention (`{unique-id, type: "path-interface", path: "..."}`). Deep-dive spike §7: *"not used anywhere in this pipeline."* | Confirmed unchanged — no `definition-url` string appears anywhere in `pipeline/src/modules/calm-generator/`. |
| Document-root `controls` | **Never emitted.** `metadata-builder.ts`/`control-builder.ts` build node- and relationship-level controls only (`STATUS.md`: control catalogue + builder marked **built**, but scoped to per-element controls — the deep-dive spike's finding that root-level `controls` is a real, separate construct was never carried into a builder change). | `docs/solution/STATUS.md` §A.1 control-builder row + deep-dive spike §9 |
| `evidence.json`-shaped provenance | **Not adopted.** Weaver still uses the informal `x-aac-provenance`-style metadata for evidence, not the native `evidence.json` construct the deep-dive spike identified as a materially better fit for control-detection provenance specifically. Deep-dive spike §3's own recommendation (*"emit real `evidence.json`-shaped evidence objects for control detections... never adopted"*) is still open. | `docs/spikes/CALM_Construct_Reference_Deep_Dive_Spike.md` §3, §10 summary table |
| `flows[]` | **Never emitted.** No code references `flow.json` or builds a `flows` array; Weaver has no concept of a multi-hop business-flow sequence distinct from individual relationships. | Grep-confirmed: no `flows` key anywhere in `pipeline/src/modules/calm-generator/`. |
| `adrs[]` | **Never emitted.** No mechanism ingests ADR documents as evidence at all — `docs/solution/Architecture_as_Code_Solution_Design_v2.md` §4.1 names ADRs as a source *"not currently leveraged as evidence sources at all."* | `CLAUDE.md` doc-map entry for Solution Design v2 |
| `node-type: webclient`, `data-asset` | Unused enum values, no detection mechanism claims them. Not modeled in this example either (kept the example to constructs that are directly actionable near-term) — named here only so this table stays honest about what it does *not* cover, matching this project's own "state what's out of scope, don't silently omit it" convention. | Deep-dive spike §6 |

## 6. What Weaver already does well, confirmed by this example NOT finding a gap

For completeness, in case a future reader wonders why these aren't listed above:

- `connects` with `protocol` populated (HTTPS/JDBC) — **built and regression-tested** (`interacts`/`connects` fix, `CLAUDE.md`).
- Node/relationship-level `controls` with `requirement-url` + `config`, validated against the real `calm-cli` host-allowlist via `-u`/local mapping — **built** (`control-builder.ts`), and this example reuses that exact mechanism (`dist/rules/control-url-mapping.json` already contains `security-rbac-001`, which is what let this example's RBAC control validate cleanly with zero extra setup).
- Informal `path-interface` interfaces — **built**, this example's `payments-service` interfaces use exactly Weaver's existing convention.

## 7. Suggested next step, in priority order (not a commitment — for discussion)

Ranked by "smallest change that unlocks the most real architecture," reusing this project's own catalogue-driven discipline (a new construct should be a catalogue row plus one of the four proven mechanisms, not a fifth mechanism):

1. **Document-root `controls`** — smallest gap. `control-builder.ts` already knows how to build a `control-detail`; the only change is a place to attach an architecture-wide control (e.g. a repo-level compliance annotation with no single owning node). Low risk, no new detection mechanism needed.
2. **`node-type: system` for a real top-level app-boundary node + `composed-of`** — the mechanism (grouping all `TypedUnit`s under one container) needs no new signal detection, just a new node-builder step. This is the most-cited "still missing" gap across multiple prior design docs (`v0.9`, deep-dive spike §6, `Architecture_as_Code_Solution_Design_v2.md`).
3. **Formal `interface-definition`** for k8s-manifest-derived host/port and container-image data — real signal already gathered for deployment decorators per `CLAUDE.md`'s v0.7 §3.2 note, just never emitted as an *interface* rather than metadata. Blocked on the same k8s-manifest provider that `deployed-in` needs, so worth building alongside it.
4. **`deployed-in`** from k8s manifests — larger, since it needs the not-yet-built k8s-manifest provider, but directly closes the "shared-Secret/ConfigMap trust relationship" gap named since `requirements v0.7 §3` and gives `deployed-in` a real data source for the first time.
5. **`interacts`** — correctly deferred until real actor-detection exists (inventing a fake actor to justify the relationship-type would violate this project's own "never fabricate" discipline); not worth building the relationship-type branch before the node-type it depends on exists.
6. **`flows[]` / `adrs[]` / `evidence.json`** — real and valuable, but each needs a new evidence source (business-flow modeling, ADR ingestion, a provenance-shape migration) rather than a small addition to an existing builder — correctly lower priority under this project's "simplicity first, no speculative mechanism" principle until one of them is actually blocking a named use case.

## 8. Pass 4 — a payment-domain solution-design review, not another schema-construct pass

The first three passes all asked "does this example correctly demonstrate CALM constructs?" and the answer was yes at every checkpoint — the file was `calm validate`-clean from the very first version. Pass 4 asked a different, harder question: **"if you review this as a payment platform's actual solution design, not as a CALM-syntax demo, what's structurally missing?"** That question found two real gaps neither schema validation nor the first three passes surfaced, because schema-conformance and architectural truthfulness are different properties — a document can be perfectly valid CALM and still misdescribe the system it claims to model.

**Found and fixed:**

1. **No presentation layer** (§2.1) — `end-user` `interacts`-ed directly with `api-gateway`. Fixed: added `checkout-webapp` (`node-type: webclient`, this example's first use of that enum value), rewired `interacts` to target it, added `webapp-to-gateway` (`connects`, `HTTPS`), added a `url`-shaped formal interface (`calm.finos.org/interfaces/example/url` — this example's third distinct formal interface schema), threaded it through `platform-composed-of` (in scope, logically) and correctly left it out of `k8s-deployed-in` (CDN-hosted, not cluster-hosted — a *third*, differently-shaped example of the composed-of/deployed-in distinction §2.1 already made with two backend cases), and inserted it as the new first hop in `process-card-payment`'s flow (6 transitions now, was 5).
2. **No PCI DSS scope boundary** (§2.3) — for a payment platform specifically, *which components touch raw cardholder data* is a first-class architectural fact, not an afterthought. Fixed: added `pci-cde` (a third, orthogonal `system` node), `pci-composed-of` (a *second* independent `composed-of` relationship in this document — proof one architecture can have more than one), and a new, locally-authored control (`controls/pci-dss-scope.requirement.json`, following this repo's own `pipeline/src/rules/control-requirements/*.requirement.json` convention rather than inventing a one-off shape) declaring the in-scope/out-of-scope node lists with an honest rationale.

**Re-validated after both additions** (not assumed): `calm validate -a` still 0 errors/0 warnings; the Standards-enforcement Pattern from §4.3 now correctly reports **8** `ownership` errors, not 6 — `checkout-webapp` and `pci-cde` are new nodes that don't carry the `ownership` field either, and the pattern check catches that automatically without needing any change to the pattern itself. That's the Standards-enforcement mechanism from pass 3 working exactly as intended against a document it had never seen before.

## 9. Explicitly considered and deferred this round (not silently out of scope)

A payment-domain review surfaces more real gaps than are worth adding to a *construct-coverage* reference in one pass. Named here, not silently dropped, per this project's own "backlog table, not silent omission" discipline:

- **Card network / PSP authorization step** — the architecture currently ends at "persisted to `payments-db` + published a settlement event," which models *recording* a payment, not *authorizing* one. A real payment platform's authorization hop (calling out to a PSP/card network before the payment is considered successful) is the single biggest remaining structural gap, and also the one that would let `pci-cde`'s scope legitimately shrink (§2.3) via tokenization. Deferred because it's a genuinely bigger addition (a new external node, a new relationship, a real question about whether the current linear flow shape still fits) — not because it's less real than what was added this round.
- **Fraud/risk check** — a real pre-authorization step in most payment flows, and a natural home for a non-RBAC-shaped control example (this reference's only two control types so far are RBAC and PCI scope, both access/compliance-shaped rather than risk-scored).
- **Ledger separate from `payments-db`** — real payment platforms typically separate the transactional payment record from a double-entry ledger, for audit reasons. `payments-db` currently conflates both roles.
- **Observability** (logging/monitoring/alerting) — no node represents this at all. Lower priority for a construct-coverage reference specifically; more relevant if this file's purpose shifts from "CALM constructs" toward "what does a production-ready payment platform's architecture actually look like."
