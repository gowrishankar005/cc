# Compact Prompt: Readiness Gate → Solution Design (Modular AaC Platform)

**Use:** Paste **Role** as system/project instructions; paste **Task** as the user message. Claude Fable / medium. Full version: `Solutioning_Readiness_and_Solution_Design_Prompt.md`.

---

## ROLE

```
You are a Principal Enterprise Architect for a deterministic Architecture-as-Code
platform (polyglot monorepo → shared code intelligence → pluggable modules).

Two peer goals of this programme (both first-class in the solution):
1. Build the modular analyser/orchestrator platform (foundations for many modules).
2. Construct valid CALM 1.2 JSON from a source repo (first module; proves the platform).

CALM Generator is the first module; future modules include threat modeller, green
software analyser, etc.

Out of scope: CALM governance itself (pattern policy engines, org control
catalogues as a product, governance workflows). Generated architecture.calm.json
must be schema-valid and consumable so *other* systems can validate and govern
against it — this solution produces the artefact, it does not implement governance.

Principles: evidence over assertion; no LLM in core generation (offline rule
authoring only); modularity via real contracts; honesty about gaps; harvest prior
design—upgrade or trash by fitness, don't reinvent settled work.
```

---

## TASK

### Part A — Readiness gate (do first)

Using the docs below, answer: **are we ready for solutioning?** against the dual
goals (platform + CALM construction). Do **not** treat CALM governance as a
requirement or readiness criterion for this solution.

- Verdict: `READY` | `READY WITH CONDITIONS` | `NOT READY`
- Blockers vs open-as-risk; conditions; assumptions for Part B
- What not to re-litigate (spike/pipeline findings)

**Stop after Part A if NOT READY.** Else continue.

### Part B — Research + Solution Design v2

Produce `docs/solution/Architecture_as_Code_Solution_Design_v2.md` that is **modular, hybrid, extensible**.

**Dual goals (state explicitly in exec summary and scope):**

| Goal | In this solution |
|---|---|
| **A. Platform** | Modular analyser/orchestrator + intelligence + module framework so more modules can plug in |
| **B. CALM construction** | Deterministic extraction from source repo → valid, provenance-backed `architecture.calm.json` |
| **Not a goal** | **CALM governance** — validation/enforcement of org patterns/policies against CALM is done by *external* systems. Design only for a clean handoff (schema-valid JSON, stable shape, namespaced metadata). |

**Must encode:**

1. **Platform (goal A)** — Analyser/Orchestrator + module framework. Foundations must support threat/green modules without re-architecture. CALM Generator *proves* the framework; it is not the whole product.
2. **CALM construction (goal B)** — Systematic construct mapping (signals → nodes/relationships/interfaces/controls-*evidence*/metadata) + staged construction of valid CALM JSON from the repo. Design out the known bug: `interacts` = `{actor, nodes[]}`, not `{source, destination}` (`connects` is pairwise). Output must be fit for *downstream* schema validation and external governance consumers — do not design pattern-governance, policy engines, or control catalogues as part of this solution.
3. **Code intelligence backbone** — Multi-language/framework; modular adapters; upgrade engines without breaking modules. Intermediate contract (typed-facts or successor) **versioned** for multi-module consumers.
4. **Hybrid** — Multi-engine possible; global + domain config; deterministic core; offline LLM rule suggestion only.
5. **Tool research (serious)** — Do not default to CodeGraph+Graphify. Compare alternatives (e.g. SCIP/LSIF, Joern, CodeQL, jQAssistant, tree-sitter custom, Semgrep, language servers, others). Recommend with evidence level (spiked / researched / assumed), risks, fallback. “Fool-proof” = bulk export, multi-root monorepo, framework typing, annotations, cross-package edges, vendor risk, determinism.
6. **Legacy design** — Harvest from critical review + gap-closure (two-tier mapping-config, ignored-items, DR/overrides for *generation accuracy*, confidence, CALM Studio artefact contract, no-LLM-core). Discard CALM-governance product framing if present. Discard what no longer fits; say why.

**Pillars to specify (contract-level, not slogans):** Orchestration · Intelligence adapters · Rules/signal catalogue · Typed facts · Module API · **CALM constructor module** · Architect review aids (confidence, ignored-items, optional DR/overrides for generation quality) · Artefact handoff (schema-valid CALM for external validators/governance systems; CALM Studio/draw.io if still relevant) · NFRs · Slice delivery (what platform must ship in Slice 1 so module 2 isn't blocked).

**Do not** add pillars for “CALM governance platform,” pattern validation product, or org policy authoring — those are consumers of our JSON, not requirements on this design.

**Prove extensibility:** short interface sketch for threat modeller + green analyser consuming the same intelligence layer.

**Pipeline code** (`pipeline/`): use as evidence of what works; design may generalize; note align vs diverge.

### Read (order; later wins)

1. `Claude.md`
2. `docs/spikes/Claude_Code_Handoff_Brief.md`
3. `docs/spikes/AaC_Solution_Design_Critical_Review.md` + `Gap_Closure_Build_Ready_Specs_v0.1.md`
4. **`docs/requirements/CALM_Generator_Requirements_v0_14.md`** (current)
5. As needed: v0.6 slices, v0.7 k8s trust, v0.9 schema, v0.10 enterprise/controls
6. Spikes: CodeGraph vs Graphify, annotation reconciliation, enterprise readiness
7. Optional honesty check: `pipeline/src/types/typed-facts.ts`, `build-calm.ts`, `signal-catalogue.yml`

Attach original Solution Design v1 / Playbook if available; else harvest via critical review.

### Deliverables

1. **Readiness assessment** (short)
2. **Solution Design v2** — dual goals up front; architecture (Mermaid OK); pillars/contracts; intelligence research + recommendation; CALM construct mapping + construction plan; future modules; architect review aids (not CALM governance); artefact handoff to external validators; NFRs; slices; risks/opens; requirements→design traceability; appendix (tools table; harvest/discard from v1)
3. **Build plan** (slice milestones for platform + CALM construction)
4. **Decision log** (options → choice → why)

### Quality bar

- [ ] Explicit readiness verdict  
- [ ] Dual goals clear: platform + CALM construction; CALM governance explicitly out of scope  
- [ ] Output designed for consumption by other systems (schema-valid, stable, metadata-safe)  
- [ ] Platform ≠ CALM-only script; second module path real  
- [ ] Intelligence upgrade path isolated from modules  
- [ ] Tool research beyond CodeGraph/Graphify  
- [ ] CALM mapping + construction concrete; schema bug designed out  
- [ ] Determinism + offline-LLM boundary kept  
- [ ] Settled requirements not reopened as “open points”  
- [ ] Implementable without chat history  

**Effort:** prioritize readiness → contracts → intelligence recommendation → CALM construction mapping. Skip UI polish, CALM governance product design, and full threat/green internals.

### Kickoff one-liner

```
Run the compact Solutioning Readiness + Solution Design prompt.
Part A first. If READY/CONDITIONS, write docs/solution/Architecture_as_Code_Solution_Design_v2.md.
Dual goals: modular platform + CALM construction from source. CALM governance is out of scope
(external systems consume our JSON). Research code intelligence beyond CodeGraph/Graphify.
```
