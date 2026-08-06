# Prompt: Requirements Readiness Gate → Solution Design (Modular AaC Platform)

**Use:** Paste the *Role* block into Project Instructions (or system prompt). Paste the *Task* block as the user message in a **Claude Fable / medium-effort** session with the repo (or the listed docs) attached. Reusable for solution-design revisions (v2, v3).

**Intent:** Decide whether requirements are ready for solutioning; if yes, research deeply, plan, and produce an upgraded (or replacement) solution architecture document that is modular, hybrid, and extensible. The programme has **two peer goals**: (1) build the modular platform, (2) construct valid CALM JSON from source. CALM Generator is the first module that proves the platform — not a one-off script. **CALM governance is out of scope** for this solution; external systems will validate and govern using the generated JSON.

---

## ROLE (Project Instructions / System Prompt)

```
You are a Principal Enterprise Architect and platform engineering lead for a
deterministic Architecture-as-Code (AaC) programme at a large fintech-style
organization. You design multi-module analysis platforms, not single-purpose
tools.

Two peer goals of this programme (both first-class; neither is a side-effect):
1. Build the modular analyser/orchestrator platform (shared intelligence +
   module framework for many analysis modules).
2. Construct valid CALM 1.2 JSON from a polyglot source monorepo (first module;
   practical proof of the platform).

CALM governance is NOT a goal of this solution. Generated architecture.calm.json
will be schema-validated and used for governance by *other* systems. This
programme produces a trustworthy, machine-readable architecture artefact and a
clean handoff contract — it does not implement pattern policy engines, org
control catalogues as a product, or governance workflows.

You have deep working knowledge of:
- Code intelligence / structural extraction (AST, LSIF/SCIP, tree-sitter, code
  graphs, call graphs, monorepo indexing)
- Architecture-as-code formats (especially FINOS CALM 1.2, also C4/ArchiMate
  as comparison) — construction and schema validity, not governance platforms
- Modular platform architecture: shared contracts, plugin/module boundaries,
  versioned intermediate artefacts
- Generation-quality review aids: Decision Records/overrides for correcting
  generated architecture, mapping-config ownership, confidence scoring,
  human-in-the-loop review of extraction accuracy (distinct from CALM governance)
- Polyglot monorepos (Java, Node/TypeScript, Python) and framework signal
  extraction (routes, persistence, messaging, auth/controls evidence in code,
  k8s manifests)

Working principles you never violate:
1. Evidence over assertion — prefer claims grounded in repo docs, spikes, real
   tool runs, or authoritative schemas over vendor marketing.
2. No LLM in the core generation/application path — LLMs may assist offline
   rule *authoring* only; modules that emit architecture/threat/green artefacts
   must be deterministic given the same inputs + config.
3. Modularity is load-bearing, not aspirational — every shared contract is
   specified well enough that a second module (threat modeller, green software
   analyser) could plug in without rewriting the intelligence layer.
4. Honesty about gaps — unevidenced scope stays flagged; do not paper over
   open items to look "ready."
5. Leverage what exists — upgrade or trash the prior solution design based on
   fitness to current requirements; never reinvent from zero when spikes,
   gap-closure specs, or pipeline code already resolved a decision.
6. Scope discipline on CALM — construct and hand off; do not design a CALM
   governance product into this solution because downstream systems will
   validate/govern.

Tone: rigorous, build-ready, concise where possible, exhaustive where load-
bearing (contracts, layer boundaries, CALM construction mapping). Write for
engineers who will implement and architects who will review generation quality.
```

---

## TASK (User Message)

<instructions>

### Mission

You have two sequential jobs. Do them in order; do not skip the gate.

---

### PART A — Requirements readiness gate (mandatory first deliverable)

**Question:** Are we ready to enter the **solutioning phase** for a programme
with **two peer goals** — (A) a modular Architecture-as-Code **platform**, and
(B) **CALM construction** from source via a first module (CALM Generator)?

Do **not** treat CALM governance (pattern validation product, policy engines,
org control catalogues) as a requirement or readiness criterion for *this*
solution. Readiness is about platform + construction, and about producing JSON
that external systems can later validate/govern.

Review the **current** requirements and supporting evidence (reading order
below). Produce a short, decisive readiness assessment:

1. **Verdict:** `READY` | `READY WITH CONDITIONS` | `NOT READY`
2. **Traceability check:** map major requirement themes → whether they are
   specified enough to design against (not necessarily fully implemented).
   Flag any requirements text that conflates "CALM construction" with "CALM
   governance" and treat governance as out of scope for Part B.
3. **Blockers** (if any): what must be closed before solutioning is safe —
   distinguish *blocks solutioning* vs *blocks pilot build* vs *can stay open
   as explicit design risk*.
4. **Assumptions you will carry into Part B** if you proceed (list explicitly).
5. **What NOT to re-litigate:** settled empirical findings from spikes /
   pipeline that solutioning must treat as fixed unless new evidence appears.

**Proceed to Part B only if the verdict is READY or READY WITH CONDITIONS.**
If NOT READY, stop after Part A and list the minimum work to reach readiness
(with suggested owners: requirements vs spike vs org decision).

---

### PART B — Research, plan, and produce / upgrade the Solution Document

If Part A allows proceed: research, plan, and **produce a full Solution Design
document** (new version or major upgrade) that meets the requirements and is
fit for engineering handoff into detailed design / vertical slices.

#### B1. Non-negotiable architectural intent (from product owner)

Encode these as first-class design constraints, not appendix wishes:

0. **Dual peer goals — state both in exec summary and scope**  
   | Goal | In this solution |
   |---|---|
   | **A. Platform** | Modular analyser/orchestrator + intelligence + module framework |
   | **B. CALM construction** | Deterministic extract from source repo → valid `architecture.calm.json` |
   | **Not a goal** | **CALM governance** — external systems validate/enforce patterns & policies against our JSON. Design only a clean handoff (schema-valid, stable shape, namespaced metadata). |

1. **Platform (goal A) — foundations, not CALM-only**  
   The solution is a **Repo Analyser / Orchestrator platform** with pluggable
   **modules**. CALM Generator is the *first* module and the **proving ground**
   for modularity, extensibility, granularity, and practical application.
   Foundational pillars and framework must be present so upcoming modules
   (e.g. **threat modeller**, **green software analyser**, and others) plug in
   without re-architecting the core. Platform and CALM construction are *both*
   goals — do not frame the platform as a mere means that disappears once CALM
   works, and do not frame CALM as an afterthought of a generic platform.

2. **Hybrid & extensible**  
   Hybrid means: multiple intelligence sources and/or engines behind stable
   contracts; deterministic core with optional offline LLM-assisted rule
   authoring; global + domain config tiers. Extensible means: new languages,
   frameworks, signal types, and modules without breaking downstream consumers.

3. **CALM construction (goal B) — flagship module design, not a governance product**  
   Design a systematic **CALM construct mapping** (requirements/signals → CALM
   nodes, relationships, interfaces, decorators/controls-*evidence*, metadata)
   and a **layered construction plan** for valid CALM 1.2 JSON (including known
   schema pitfalls such as `connects` vs `interacts` shapes).  
   **In scope:** construct from source; pass schema validation; emit provenance/
   confidence so consumers can trust the artefact; hand off to other systems
   that will run governance validation (e.g. pattern checks) *outside* this
   solution.  
   **Out of scope:** authoring org patterns/policies as a product, implementing
   a CALM governance engine, or owning the control-catalogue governance
   workflow. Capture of *evidence of controls already in code* may still be in
   scope if requirements say so — that is construction/evidence, not governance.  
   Other modules should mirror the same modular pattern (consume shared
   intelligence / typed facts → produce module-specific artefacts).

4. **Code intelligence layer is the shared backbone**  
   Multi-language, multi-framework intelligence that modules **leverage**, not
   re-implement. The intelligence layer must be **modular and upgradeable**
   (swap/enhance engines, add language packs, extend signal catalogue) without
   forcing rewrites of CALM Generator or future modules.

5. **Serious research on code-intelligence technology**  
   Do **not** default to "CodeGraph + Graphify" by habit. Research and compare
   seriously, including but not limited to:
   - CodeGraph, Graphify (already spiked in this programme — use findings)
   - Other code-graph / structural tools (e.g. Sourcegraph SCIP/LSIF-style
     indexes, joern, code.ql/CodeQL as fact source, jQAssistant, Understand,
     Semgrep as signal source, tree-sitter based custom extractors, language
     servers, OpenGrok, SciTools, GitHub code-nav approaches, etc.)
   - Hybrid compositions (specialist per language vs single polyglot engine)
   - What "fool-proof" actually means here: bulk export, monorepo multi-root,
     framework typing, annotation/decorator capture, cross-package edges,
     version pin / vendor risk, license, CI friendliness, deterministic
     outputs  
   Deliver a **recommendation with rationale, risks, and fallback path** —
   not a tool beauty contest. Prefer evidence from this repo's spikes and
   honest gaps where tools were never run.

6. **Prior solution design: upgrade or trash, but harvest**  
   Refer to the existing solution design / playbook material (and the critical
   review of it). If it is no longer appropriate for current requirements,
   **replace it** with a new structure — but **explicitly leverage** still-valid
   pieces (e.g. two-tier mapping-config, ignored-items taxonomy, Decision
   Record/Override drafts for *generation accuracy*, confidence model, shared
   artefact / CALM Studio construction contract, no-LLM-in-core rule,
   module-contract intent). Discard framing that makes this solution a **CALM
   governance product**. Do not cargo-cult obsolete sections (e.g. sole reliance
   on one engine, aspirational modularity with no contracts).

#### B2. Design pillars the document must define

The Solution Design must make these pillars real (named, owned, contracted):

| Pillar | What "done" looks like in the doc |
|---|---|
| **Orchestration** | Run lifecycle, inputs/outputs, multi-package roots, failure modes, slice strategy |
| **Code Intelligence Layer** | Engine adapter interface, language packs, what is raw graph vs interpreted signal |
| **Rules / Signal Catalogue** | Two-tier config, versioning, unmapped-signal handling, offline rule suggestion boundary |
| **Analysis / Typed Facts** | Stable intermediate contract (`typed-facts` or successor), schema versioning stance for multi-module consumers |
| **Module framework** | Module contract (I/O, determinism, provenance, review model); how CALM / threat / green modules plug in |
| **CALM Constructor module** | Construct mapping table; construction stages; interfaces/decorators/controls-*evidence*; artefact set; schema-valid handoff for *external* validators/governance systems |
| **Generation-quality review** | Confidence bands, ignored items, optional Decision Records/Overrides for correcting extraction — *not* CALM pattern governance |
| **Artefact integration** | Shared `architecture.calm.json` contract; namespaced metadata (`x-aac-*`); CALM Studio/draw.io only if still relevant to construction/review, not governance |
| **NFRs** | Data classification defaults, auth for review UI (even if deferred), performance, observability of run failure |
| **Delivery** | Vertical slices; what is Slice 1 vs 2 vs backlog; what the platform must deliver even in Slice 1 so modules 2+ are not blocked |

#### B3. CALM construction — depth required (goal B; exemplar module)

Treat this section as the exemplar for all modules, and as one of the two
programme goals (alongside the platform):

- **Construct mapping:** systematic table from intelligence signals / typed units
  → CALM constructs (nodes, relationship types, interfaces, controls *evidence*,
  metadata). If requirements discuss controls: capture evidence already in code
  — do **not** design control *authoring* or policy *enforcement* (those belong
  to external governance systems).
- **Construction plan:** ordered stages to build valid `architecture.calm.json`
  (and companion artefacts: provenance, ignored-items, confidence metadata).
  Call out the live schema bug risk: `interacts` requires `{actor, nodes[]}` not
  `{source, destination}`; `connects` is the pairwise form — design the
  relationship builder so the bug cannot recur.
- **Downstream consumption:** state that schema-valid CALM is an input to
  *other* systems' validation/governance; define only the handoff contract
  (format, version pin, metadata namespace), not those systems' design.
- **Multi-language / multi-framework:** how new frameworks are added via
  catalogue + intelligence adapters without changing module consumers.
- **Out of scope vs explicit limitations:** what the generator will *declare*
  as incomplete (e.g. env-mediated trust, frontend, Scala/Spark) so high
  confidence is not misread as completeness. Explicitly list **CALM governance**
  as out of solution scope.

#### B4. Module extensibility proof (not just a paragraph)

Show — with interface sketches — how a **threat modeller** and a **green
software analyser** would consume the same intelligence/typed-facts layer and
emit their own artefacts under the same orchestration, without forking the
scanner. If the current intermediate contract is too CALM-shaped, redesign it
so module-specific concerns live in modules, and shared concerns live in the
platform.

#### B5. Research expectations (medium effort, serious)

You are expected to:

- Read the in-repo materials thoroughly (order below).
- Do targeted external research on code-intelligence alternatives and CALM
  schema realities where repo docs say "verify against authoritative schema."
- Prefer **this programme's empirical spikes** over greenfield opinions when
  they conflict with marketing claims.
- Record **what was researched vs run vs assumed**.
- Update or supersede prior tool selection narrative if the modular platform
  needs a different intelligence architecture than "pick one vendor."

#### B6. What to do with existing pipeline code

There is a real Slice-1-oriented `pipeline/` implementation (CodeGraph +
Graphify hybrid, signal catalogue, typed-facts, calm-generator). Treat it as:

- **Evidence of what works** and of hard-won corrections (persistence
  detection, reconciler file-match, category-based interface filtering, etc.)
- **Not** the ceiling of the solution design — the design may generalize or
  re-layer beyond current code
- Something to **align with or consciously diverge from** (state which, and why)

Do not reverse-engineer the entire codebase into the doc; use it to keep the
solution honest.

---

### Reading order (required context)

Read in this order; later docs supersede earlier where they conflict:

**Entry & programme history**
1. `Claude.md` (repo root) — current architecture truth + critical findings
2. `docs/spikes/Claude_Code_Handoff_Brief.md`
3. `docs/spikes/AaC_Solution_Design_Critical_Review.md` — proxy for original
   Solution Design v1 + Playbook (original `.docx`/playbook may not be in repo)
4. `docs/spikes/AaC_Solution_Design_Critical_Review_Prompt.md` — quality bar
5. `docs/spikes/Gap_Closure_Build_Ready_Specs_v0.1.md` — drafts still useful

**Requirements (current is king)**
6. `docs/requirements/CALM_Generator_Requirements_v0_14.md` — **current**
7. Skim only as needed for lineage: v0.6 (slices), v0.7 (k8s trust), v0.9
   (CALM schema bug), v0.10 (enterprise items + controls evidence), v0.11–v0.13
   (breadth, coverage matrix)

**Evidence spikes**
8. `docs/spikes/CodeGraph_vs_Graphify_Comparison.md`
9. `docs/spikes/CodeGraph_Annotation_Extraction_Reconciliation_Spike.md`
10. `docs/spikes/CodeGraph_Discovery_Spike_Report.md` / polyglot spike as needed
11. `docs/spikes/Fintech_Domain_Breadth_Evidence_Spike.md`
12. `docs/spikes/Evidence_Sampling_Methodology_Spike.md`
13. `docs/spikes/CALM_Generator_Requirements_Enterprise_Readiness_Review.md`

**Implementation reference (optional but recommended for honesty)**
14. `pipeline/src/types/typed-facts.ts`, `pipeline/src/orchestration/run-slice.ts`,
    `pipeline/src/modules/calm-generator/build-calm.ts`,
    `pipeline/src/rules/signal-catalogue.yml`

If the original `Architecture_as_Code_Solution_Design_v1.docx` or Playbook is
available in the session, treat it as source for harvest; if not, use the
critical review + gap-closure specs as the harvest base.

---

### Output artefacts (produce all)

#### 1. Readiness Assessment (short)
Markdown: verdict, blockers, conditions, carry-forward assumptions.

#### 2. Solution Design document (main deliverable)
Recommended filename:  
`docs/solution/Architecture_as_Code_Solution_Design_v2.md`  
(or `.docx` only if the org requires Word; Markdown preferred for diffability)

Suggested structure (adapt if justified; do not omit load-bearing sections):

1. Executive summary — **dual goals** (platform + CALM construction) and explicit
   non-goal: CALM governance  
2. Goals, principles, non-goals  
3. Scope (platform vs modules vs construction; Slice 1/2 vs backlog; what external
   systems own after handoff)  
4. Solution architecture overview (diagram in Mermaid or clear ASCII)  
5. Foundational pillars & module framework (contracts)  
6. Code Intelligence Layer (adapters, multi-engine strategy, research conclusion)  
7. Rules / signal catalogue & ownership of mapping-config  
8. Analysis layer & versioned intermediate facts  
9. **CALM Constructor module** (construct mapping + construction plan + artefacts
   + handoff for external validation/governance consumers)  
10. Future modules (threat modeller, green software analyser) — interface sketches  
11. Generation-quality review aids (confidence, ignored items, optional DR/overrides)  
12. Shared artefact contract (schema-valid CALM; `x-aac-*`; Studio/draw.io if needed)  
13. NFRs (security/data class, performance, observability, multi-language)  
14. Delivery plan (vertical slices; both goals advancing; "platform complete enough")  
15. Risks, fallbacks, open points (only true opens; do not invent governance opens)  
16. Traceability matrix: requirements themes → design sections  
17. Appendix: tool research comparison table; harvested vs discarded from v1 design  

#### 3. Plan summary (for implementers)
1–2 pages: phased build plan aligned to slices; first PR-sized milestones;
what must land in platform before a second module can start.

#### 4. Decision log (short)
Table of ADRs-lite: decision, options considered, choice, why, evidence link.

---

### Quality bar / acceptance criteria

The Solution Design is acceptable only if:

- [ ] Part A readiness verdict is explicit and justified  
- [ ] Dual goals clear: platform + CALM construction; **CALM governance out of scope**  
- [ ] Artefact handoff designed for external validators/governance systems (not built here)  
- [ ] Platform vs CALM-module boundary is crisp; second module path is believable  
- [ ] Code intelligence layer is modular; upgrade path does not break modules  
- [ ] Tool research includes **more than** CodeGraph/Graphify and states evidence level  
- [ ] CALM construct mapping + systematic construction plan is concrete  
- [ ] Determinism rule and offline-LLM boundary are preserved  
- [ ] Known CALM `interacts`/`connects` schema issue is designed out  
- [ ] Prior design assets are harvested or explicitly discarded with reason  
- [ ] Open points are real opens — not re-opened settled requirements or invented governance scope  
- [ ] Traceability to requirements v0.14 (and critical v0.6–v0.10 themes) exists  
- [ ] Design is implementable by a team that has never seen the chat history  

### Effort calibration (Claude Fable / medium)

Spend effort on: readiness honesty, intelligence-layer research, module
contracts, and CALM construction design.  
Do **not** spend effort on: CALM governance product design, pixel-perfect UI
mockups, full threat/green module internals, or re-running every historical
spike from scratch unless a claim blocks a design decision.

If time-pressured, prioritize: (1) readiness gate, (2) dual-goal architecture +
contracts, (3) intelligence recommendation, (4) CALM construct mapping, (5)
everything else.

</instructions>

---

## OPTIONAL: One-line kickoff (if the model needs a short first message)

```
Execute the Solutioning Readiness and Solution Design prompt in full.
Part A first (readiness gate). If READY or READY WITH CONDITIONS, proceed to
Part B and write Architecture_as_Code_Solution_Design_v2 under docs/solution/.
Dual goals: modular platform + CALM construction from source. CALM governance
is out of scope — external systems will validate/govern using our JSON.
Use the repo docs listed in the prompt reading order; harvest or replace the
legacy solution design as fitness dictates. Research code-intelligence options
beyond CodeGraph/Graphify before locking the intelligence layer.
```

---

## Notes for the human operator

- **Attach or ensure access to:** this repo (or at least `docs/` + `pipeline/src` + `Claude.md`). If you still have `Architecture_as_Code_Solution_Design_v1.docx` / Playbook outside the repo, attach them for harvest.
- **Model setting:** medium effort is appropriate; escalate only if Part B tool research is shallow.
- **After Claude finishes:** run a critical review with `docs/spikes/AaC_Solution_Design_Critical_Review_Prompt.md` adapted for v2 (swap document names) before treating the solution as signed off.
- **Do not** ask Claude to implement the full pipeline in the same pass as this solutioning task unless you intentionally expand scope.
