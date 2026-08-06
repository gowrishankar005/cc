# Requirements v0.8 — Repo Analyser/Orchestrator Platform + CALM Generator Module

**Status:** Draft. Supersedes v0.7. Reframes what "controls/standards/patterns out of scope" actually means once the real downstream use case is stated: the generated CALM JSON isn't just a diagram source, it's the **input to automated governance validation** — and that changes what "good enough" means for this generator, without changing what it's responsible for authoring.

---

## 0. Why this version exists

The user pointed at three pages this session: [What is CALM](https://calm.finos.org/introduction/what-is-calm), [Why use CALM](https://calm.finos.org/introduction/why-use-calm), and the [governance journey](https://calm.finos.org/learn/journeys/governance) — with a specific stated goal: the generated `architecture.calm.json` will be used to **automate controls, standards, and pattern validation**, not just get schema-validated once and archived.

That surfaced something every prior version of this doc got half-right. "Controls/standards/patterns are out of scope" (v0.1 §2 through v0.7 §2) is still true for **authoring** — this generator has never claimed to invent organizational policy, and shouldn't. But it was never explicit about the other half: **this generator's output is the thing controls, standards, and patterns get validated *against***. That's a real requirement on output quality that "out of scope" was quietly not addressing. This version adds that half explicitly, without changing the authoring boundary.

**Concretely, re-verified this session** (`calm-cli` search + `calm.finos.org/working-with-calm/`, not recalled): CALM validation has two distinct modes.
1. **Schema validation** — `calm validate -a architecture.json` — checks structural conformance to the CALM meta-schema. This is all this project has ever run. Passing this proves the JSON is *well-formed CALM*; it proves nothing about whether it matches what an organization actually requires.
2. **Pattern validation** — `calm validate -p pattern.json -a architecture.json` — checks the architecture against an org-authored **Pattern**: a JSON Schema using `const`/`prefixItems`/`minItems`/`maxItems` to require specific node IDs, types, and relationship structure to exist. This is the actual mechanism behind "automate governance" — an architect writes a Pattern once ("every service must connect to exactly one database," "the auth-gateway node must exist with this exact ID"), and every generated architecture gets checked against it in CI.

This project has **never run pattern validation**, only schema validation. That's a real gap in how "done" was being measured, not just a documentation gap.

---

## 1–1.5. Purpose, Scope, Delivery Strategy

Unchanged from v0.7.

---

## 2. CALM Construct Coverage — one addition, reasoning sharpened

Table unchanged from v0.7 for every row except **Controls**, whose reasoning needed the missing half stated:

| Construct | v0.7 status | v0.8 refinement |
|---|---|---|
| **Controls** | Out of scope — "a control is a policy statement, not source-derivable" | **Authoring stays out of scope — unchanged.** New: this generator is responsible for producing output **compatible with externally-attached controls**, not for writing them. Concretely: don't populate a node/relationship's own `controls` field (that's still not ours to author), but don't do anything that would prevent a later governance step from attaching one either — CALM's schema already allows `controls` as an optional field on any node/relationship, so as long as this generator's output validates cleanly against the base schema (already true), an external tool can add `controls` without touching what we generated. Nothing to build here; a boundary to state precisely so it isn't re-litigated. |

**Standards** reasoning also sharpened, no status change: an organization's Standard `allOf`-extends the core node/relationship schema with extra required properties (e.g. `costCenter`, `owner`). This generator already namespaces every custom field under `x-aac-*` inside `metadata` rather than adding top-level node properties — which means a Standard requiring additional top-level properties (like `costCenter`) can be satisfied by a *later*, human-driven enrichment step without needing to touch or regenerate this tool's output. Worth stating as a compatibility guarantee, not a new feature.

**Patterns** reasoning sharpened: this generator does not author Patterns (still an architect's job, still out of scope) — but per §0, it has never been **tested against one** either. §5 below fixes that.

---

## 3. Kubernetes-Manifest Signal Layer

Unchanged from v0.7 — still not implemented, still the next thing to build (see v0.7 §3 for the full spec: shared-Secret/ConfigMap trust relationships, deployment decorators).

---

## 4. Output Quality Requirements for Governance-Readiness — new

Derived directly from what pattern validation actually checks (`const` on `unique-id`, required relationship structure) and from the "why use CALM" framing (version-controlled, CI-integrated, audit trail — meaning **the same repo, scanned twice, should produce a stable, diffable output**, not incidental churn).

1. **`unique-id` stability.** Current scheme (`unit.id = filePath`, e.g. `"userservice.py"`) is already reasonably stable — it doesn't depend on line numbers or scan order — but is coupled to the file's literal path. A file rename changes the ID with no semantic change to the architecture. Worth flagging as a real design question before Pattern authors start writing `const` checks against these IDs: should a route-derived service unit's ID instead be derived from something more semantically stable (e.g., the base path of its routes, or an explicit service-name signal if one exists) rather than raw file path? **Not resolved here** — flagged as a decision to make before this generator's output is treated as a stable Pattern-validation target, not before.
2. **`protocol` field on relationships is currently never populated** (`CalmRelationship.protocol` exists in the type, `build-calm.ts` never sets it). Cheap, real gap: a `calls`/`imports` relationship between two Python units is implicitly a local function call, not a network protocol — `protocol` doesn't apply there and should stay unset. But the persistence relationships (`connects` to a `database` node) and the new trust relationships (v0.7 §3) have a real, known protocol/mechanism (`JDBC`-equivalent connection string, or "shared-secret" for the JWT case) that should be surfaced, since a Pattern or Control checking "database connections must use an approved protocol" needs the field populated to check anything at all.
3. **`data-classification` and `run-as`** (both real CALM node fields, both currently unpopulated): explicitly **not** attempted this version — inferring PII/data-sensitivity from source code is a materially harder, more speculative problem than anything built so far (route detection, persistence detection, and secret-sharing are all direct structural facts; data classification is a judgment call). Stays backlog, named explicitly rather than silently absent.

---

## 5. Validation Plan — pattern validation added

**Immediately actionable, before resuming feature work:**
1. **Write one minimal, realistic Pattern file** (e.g., requiring: every `service` node must have at least one `interacts`/`connects` relationship — directly exercises the exact gap the very first accuracy audit found, before the persistence-detector/reconciler fixes) and run `calm validate -p <pattern>.json -a architecture.calm.json` against the current pipeline's real output (Bank of Anthos `userservice`+`contacts`) for the first time. This is the actual measure of "is this generator's output governance-ready," not schema validation alone.
2. Carry forward v0.7 §11's plan (Kubernetes-manifest signal layer implementation + validation) unchanged — still next after this.

---

## 6–11. Everything else

Unchanged from v0.7 (§4 `detect()` gate/Option A/B/C, §5 resolved `extractFromSource()` mechanism, confidence scoring, Ignored Items taxonomy, out-of-scope list, evidence repos).

---

## Sources

Unchanged from v0.7, plus (fetched fresh this session): [What is CALM?](https://calm.finos.org/introduction/what-is-calm), [Why use CALM?](https://calm.finos.org/introduction/why-use-calm), [Governance journey](https://calm.finos.org/learn/journeys/governance), [CALM Patterns tutorial](https://calm.finos.org/tutorials/intermediate/17-patterns/) (concrete `calm validate -p ... -a ...` syntax and pattern-schema mechanics), search results confirming the two-mode validate command and controls/standards tutorial content (`calm.finos.org/tutorials/`).
