# Requirements v0.10 — Repo Analyser/Orchestrator Platform + CALM Generator Module

**Status:** Draft. Supersedes v0.9. Addresses the four items flagged as unresolved since before v0.1 (`docs/spikes/CALM_Generator_Requirements_Enterprise_Readiness_Review.md`), and corrects a real scope miss: controls/standards/patterns "out of scope" was written to mean "we don't author new policy," but was applied as if it meant "we don't capture evidence of controls/patterns that already exist in the code" — those are different claims, and only the first one was ever intended.

---

## 0. The controls/standards/patterns correction, precisely

**What v0.7 §2 actually said:** "A control is a policy statement... What the new relationship-detector produces is evidence of an existing wired fact. That's a relationship, not a control." That reasoning was specific to the JWT trust relationship (correctly a `relationships` construct, not a `controls` one). It never actually examined whether *other* kinds of control evidence — security annotations, RBAC expressions, encryption config — exist in real code and are detectable the same way routes and persistence are. Nobody looked. That's the miss, not a reversal of a considered decision.

**The corrected boundary, stated precisely this time:**
- **Authoring net-new organizational policy** (deciding *what* controls an org requires) — stays out of scope. Still an architect/security-team job.
- **Running validation** (`calm validate -p`/checking against controls) — stays out of scope, confirmed again this round. Still a downstream, external activity.
- **Capturing evidence of controls/patterns that are already implemented in the code or infrastructure** — **was always intended to be in scope**, follows the exact same evidence-based methodology already built for routes (decorator detection) and persistence (Graphify import detection). This version specifies it.

**Real evidence gathered this session, not hypothesized:**
- Fineract: `fineract-core/.../DatatableWriteService.java:27,30,33,36` — `@PreAuthorize(value = "hasAnyAuthority('ALL_FUNCTIONS', 'REGISTER_DATATABLE')")`. A genuine, decorator-detectable RBAC control — same extraction mechanism (`extractFromSource()`'s `decorates` refs) already built and working for JAX-RS/JPA.
- Bank of Anthos: `contacts.py:77,112` — JWT verification is **not** a decorator. It's an inline `jwt.decode(auth_payload, ...)` call inside each route handler. This means control detection needs **two different mechanisms**, not one — decorator-based (Spring `@PreAuthorize`/`@Secured`, NestJS `@UseGuards`/`@Roles`) and call-based (detecting a call to a known auth-verification function/library within a handler, the same shape of problem as detecting a `calls` edge to a database class already solved for persistence). Stated honestly: this generalizes the same way every other signal type in this project has — differently per framework, not uniformly.

**How this maps to CALM's `controls` construct, concretely:** `control.json`'s schema requires `{<control-id>: {description, requirements: [{requirement-url, config-url|config}]}}` — every control needs a `requirement-url` pointing at a schema describing what the control type means. **Checked this session** (`gh api repos/finos/architecture-as-code/contents/calm/controls`): FINOS's own published catalog for this is **empty** — just a README describing the intended domain structure (Security/Performance/Compliance/Operational/Quality), no actual schemas published yet, unlike `calm/interfaces/` which at least has a populated `example/` folder. So this project cannot lean on an existing catalog and must author its own. **New, small artefact needed**: `rules/control-requirement-catalogue.yml` (same pattern as `signal-catalogue.yml`) mapping detected control signals (`@PreAuthorize`, `@Secured`, a detected `jwt.decode` call, etc.) to a control-id, a human-readable description, and a `requirement-url` — pointing at project-owned placeholder schema locations, explicitly flagged as **not yet real, dereferenceable schemas** until this project hosts them for real. Populating `controls` with a placeholder `requirement-url` is still schema-valid CALM (the field just needs to be a string) but should be labeled honestly as provisional in `x-aac-*` metadata alongside it.

**Patterns — narrower, lower-priority correction:** "found in the code" for CALM's `Patterns` construct most plausibly means the observable architectural *shape* (e.g. "N services, each owning its own database" — a pattern this pipeline can already recognize from the topology it builds), not code-level design patterns (Factory/Singleton/etc., a much more speculative, different kind of detection this project has no evidence-gathering basis for and shouldn't attempt). Scoped as a **stretch goal**: an `x-aac-detected-pattern` metadata tag at the architecture level when the topology matches a small, named set of recognizable shapes — descriptive only, never a generated Pattern *file* (that stays an architect's authoring job, unchanged).

**Standards — no change, and this one really is out of scope as originally reasoned.** CALM Standards are specifically org-authored JSON Schema extensions (`allOf`-extending the core node/relationship schema with new required properties like `costCenter`). There's no code-level evidence to "capture" here — a Standard is inherently something an organization writes, not something a scan discovers. Confirmed by re-reading `control.json`/Standards' actual definition, not just re-asserted.

---

## 1. Resolving the four open items (Gap_Closure §8 + the audit trail)

None of these were answerable by re-reading code — they needed real proposals, not more silence. Proposed here as concrete defaults with explicit ownership of what's still provisional, rather than left blank again.

### 1.1 Numeric success metric
**Proposed** (pending real stakeholder sign-off — flagged as provisional, not fabricated as settled): generation should complete in **under 2 minutes per package** for Slice-1-scale input (confirmed achievable — actual measured runs this session were well under that), and an architect's review of one generated package's output (routes + database units + relationships, ~5-15 CALM nodes) should take **under 15 minutes** to confirm or reject against their own knowledge of the service. Both numbers are defensible starting points based on what's actually been measured, not aspirational guesses — but they're a proposal for a business stakeholder to ratify, not a resolved fact. State them as such wherever cited.

### 1.2 Data-classification policy
**Cannot resolve who the real policy owner is** — that's genuinely an organizational decision this project has no authority to make. **Can and does resolve the technical default in the meantime**: `architecture.calm.json`, `typed-facts.json`, and any Kubernetes-manifest-derived output describe internal system topology and should be treated as **Internal/Confidential by default** — not committed to a public or shared repo location, not retained beyond the run that produced them unless explicitly archived by someone with authority to make that call. This default should be stated in generated output's own metadata (extending the existing `x-aac-scope-limitations` pattern) so it travels with the artefact, not just with this doc.

### 1.3 Companion-interface auth mechanism
**Addressed by making an explicit decision, not by inventing an org's SSO setup**: this component (draw.io review UI, CALM Studio round-trip) has had zero design or implementation activity since before v0.1 — the enterprise-readiness review correctly named this a second instance of the exact silent-drift pattern the project caught once already with jQAssistant. The honest resolution is **not** to answer the auth-mechanism question (there's no interface to authenticate into yet) — it's to formally state the component's status: **explicitly backlog, same tier as jQAssistant/Graphify-Option-C**, not a live open question implying near-term work. The auth-mechanism question gets re-opened only when this component is actually prioritized for building, not before.

### 1.4 Decision Record / Override audit trail
**The most concretely resolvable of the four — specified precisely enough to build in the next solution round, not just re-flagged.** Design, extending the schema already drafted in `Gap_Closure_Build_Ready_Specs_v0.1.md` §6:
- `overrides/` directory alongside a run's output, containing Override JSON files (existing schema: `override_id`, `target_ref`, `override_type`, `new_value`, `decision_record_ref`, `status`).
- `modules/calm-generator/`'s construction layer reads this directory (if present) **after** building the deterministic output from `typed-facts.json`, and applies active (`status: "active"`) overrides as a final pass — a type-change override changes a node's `node-type`, a relationship-add/remove override adds or removes a `CalmRelationship`, etc.
- **Integrity rule, mechanically enforced this time, not just stated**: the builder should refuse to apply any Override whose `decision_record_ref` doesn't resolve to a real Decision Record file in the same directory — making Gap_Closure §6's "no override without a traceable decision" rule an actual runtime check, not a documented convention someone could bypass by hand-editing JSON.
- This is now a scoped, buildable item for the next solution round — not resolved in this requirements-only version, but no longer just a drafted schema with no path to implementation.

---

## 2. CALM Construct Coverage — table updated

| Construct | v0.9 status | v0.10 status |
|---|---|---|
| **Controls** | Out of scope (authoring); compatible-with-external-attachment only | **Capture in scope** (evidence-based, per §0 above) — authoring net-new policy and running validation both remain out of scope. New: `rules/control-requirement-catalogue.yml` needed. |
| **Standards** | Out of scope | **Unchanged, out of scope** — confirmed this really is authoring-only, no code-level evidence to capture. |
| **Patterns** | Out of scope (authoring/validation) | **Unchanged for authoring/validation.** New, narrow stretch goal: descriptive `x-aac-detected-pattern` topology-shape tagging, metadata only, not a generated Pattern file. |

Everything else (Nodes/Relationships/Interfaces/Metadata in scope; Flows out of scope with v0.7's clarified reasoning) unchanged.

---

## 3. Everything else

Unchanged from v0.9 (the `interacts`/`connects` bug fix still scoped for the next solution round, not applied yet; `node-type`/interface-`type` open-enum finding; language-agnosticism requirement; Kubernetes-manifest signal layer spec from v0.7 §3, still unbuilt).

---

## 4. Validation Plan — additions

12. ~~Confirm whether a real, matching control-requirement schema already exists in FINOS's own published catalog~~ — **checked this session, resolved: no, it's empty.** This project must author its own placeholder catalogue (§0 above).
13. Evidence at least one NestJS/Node auth-decorator pattern (`@UseGuards`/`@Roles`) against a real repo — not yet done, same evidence bar as everything else before it's trusted.
14. Build and test the Decision Record/Override read-and-apply pass (§1.4) against a real, deliberately-wrong generated output, confirming an Override can correct it and that an Override with a dangling `decision_record_ref` is correctly rejected.

---

## Sources

Unchanged from v0.9, plus: `spikes/fineract/repo/fineract-core/.../DatatableWriteService.java:27,30,33,36` (real `@PreAuthorize` evidence, this session); `spikes/boa/repo/src/accounts/contacts/contacts.py:77,112` (real inline `jwt.decode()` evidence, this session, confirming controls need more than one detection mechanism).
