# Gap Closure & Build-Ready Specs v0.1
**Architecture-as-Code POC — decisions locked today + draft artefacts for review**

---

## 1. Updated Gap Tracker

| Item (from review) | Status | Notes |
|---|---|---|
| Repo topology (mono vs poly) | ✅ Resolved | Confirmed mono-repo, polyglot (Java/Node/Python) |
| Single-SME bottleneck | ✅ Resolved | Multiple architects across BUs + domain EAs — reframed as coordination challenge, not availability risk |
| CodeGraph selection | ✅ Resolved | Selected over Graphify/GitNexus |
| CodeGraph integration & real output schema | 🔴 **Open — next action** | Installed, not yet pointed at repo. This is the critical path item — see §2 |
| CALM Studio relationship | ✅ Resolved | Complementary; needs a shared contract (§3) |
| Companion interface hosting | ✅ Resolved | Standalone for pilot, merge later |
| Mapping-config governance | ✅ Resolved (structure) | Per-domain ownership → requires two-tier config model (§4) — introduces a new gap: cross-domain code, addressed in §5 |
| Decision Record / Override schema | 🟡 Drafted below | §6 — needs your review, not yet battle-tested |
| Confidence threshold methodology | 🟡 Drafted below | §7 — needs pilot calibration, this is a starting point not a final answer |
| Ignored Items taxonomy | 🟡 Drafted below | §5 — includes new cross-domain category |
| "Phase" naming collision | 🔴 Still open | Recommend renaming Playbook's Phase 0–5 to "Step 0–5" — cosmetic but do it before wider circulation |
| Data classification/handling policy | 🔴 Still open | Not addressed yet — flagging, will need a decision from you or your security/compliance contact |
| Access-control mechanism (companion interface) | 🟡 Partially resolved | Standalone app decided; actual auth method (SSO/Azure AD/etc.) still undefined |
| CodeGraph vendor fallback | 🟡 Partially resolved | Graphify/GitNexus already evaluated — document them as a fallback list rather than re-evaluating from scratch if CodeGraph disappoints |
| CALM version-drift stance | 🔴 Still open | Low urgency, revisit post-pilot |
| Numeric Success Metric targets | 🔴 Still open | Needs a baseline-effort number from your side — see §8 |
| Pipeline run-failure monitoring | 🔴 Still open | Low urgency for POC, needed before rollout |
| Heuristics testing/regression strategy | 🔴 Still open | Recommend addressing once real CodeGraph output exists (§2) |

---

## 2. Immediate Next Action: CodeGraph Discovery Spike (new — insert before Playbook Phase 2)

You only know CodeGraph from vendor material. Before designing the Heuristics Engine or mapping-config schema in detail, run a short, timeboxed spike:

**Goal:** point CodeGraph at the actual pilot slice and capture real raw output — not marketing claims.

**Steps:**
1. Point CodeGraph at the chosen pilot slice (once Playbook 1.1 picks it).
2. Pull raw output for one Java service, one Node service, one Python service (or whatever the slice contains) — capture actual JSON/graph structure, not just a success message.
3. Check specifically: does it actually detect `@RestController`/Express routers/FastAPI routes as claimed (§6.1)? Does it expose framework-detection and dynamic-dispatch info per language, or is language coverage uneven in practice?
4. Document the real schema — this becomes the input contract for the Graph Query Layer (Playbook 2.2).
5. Timebox: 3–5 days. Can run **in parallel with Playbook Phase 1** (Worked Example Design) rather than blocking it — Phase 1's hand-written "expected architecture" can and should be informed by real output once you have it, not written purely hypothetically.

**Why this matters:** every schema below (Heuristics Engine, mapping-config, confidence scoring) currently assumes CodeGraph's marketing description is accurate. If actual output differs — say, weaker Python framework detection than Java — you want to know that in week one, not mid-pilot.

---

## 3. CALM Studio Integration Contract

Since the companion interface is standalone-for-now but must merge into CALM Studio later without rework, lock down the shared surface now:

- **Shared artefact:** `architecture.calm.json` — same CALM 1.2 structure both directions consume/produce. Any custom metadata fields (confidence, provenance refs) added by this pipeline must use a namespaced key (e.g. `x-aac-confidence`, `x-aac-provenance`) so CALM Studio's own tooling doesn't choke on unrecognized fields.
- **Shared shape library:** the custom draw.io CALM shapes used for *generation* (this POC, CALM JSON → drawio) must be the same shape library your existing *reverse* converter (drawio → CALM JSON) expects. Recommend this shape library become a shared, versioned package/repo used by both tools — not maintained twice.
- **Round-trip test:** once both directions exist, run generated CALM JSON → drawio (this POC) → back through your existing drawio → CALM JSON converter, and diff the result against the original. Any drift here means the two tools disagree on conventions and will confuse architects who edit diagrams by hand.

---

## 4. Two-Tier Mapping-Config Structure (revised for per-domain ownership)

Original design assumed a single mapping-config owned solely by central EA. "Each domain owns its own slice" requires restructuring:

```
mapping-config/
├── global/                  # Owned by central EA / platform team
│   ├── signal-catalogue.yml # Appendix B signals — applies everywhere
│   ├── node-types.yml       # Base node type definitions
│   └── confidence-weights.yml
└── domains/
    ├── payments/             # Owned by Payments domain EA
    │   ├── boundaries.yml    # Folder/package → domain ownership mapping
    │   └── overrides.yml     # Domain-specific naming/exceptions
    ├── risk/
    └── <other-domains>/
```

**Merge rule:** Global rules apply first and are non-negotiable at the domain level (a domain cannot disable the "explicit ignorance" principle, for example). Domain rules layer on top and can extend or refine, but not silently contradict global integrity rules.

**The new problem this creates — cross-domain code:** any package/folder that isn't claimed by exactly one domain's `boundaries.yml` needs a defined behavior, not a silent drop. Handled via the new taxonomy category below.

---

## 5. Ignored Items Taxonomy (finalized draft)

| Code | Meaning |
|---|---|
| `TEST_CODE` | Test-only code, test frameworks detected |
| `GENERATED_CODE` | Generated sources, codegen markers, build output |
| `PURE_UTILITY` | Low-connectivity, no architectural relationships |
| `AMBIGUOUS_BOUNDARY` | Conflicting signals prevent confident type/boundary assignment |
| `INSUFFICIENT_EVIDENCE` | Too few signals to reach minimum confidence |
| `EXCLUDED_BY_CONFIG` | Explicitly excluded via global or domain mapping-config |
| `CROSS_DOMAIN_UNRESOLVED` **(new)** | Code that no domain's `boundaries.yml` claims, or that two domains both claim — routed here rather than silently assigned to either, until an explicit cross-domain Decision Record resolves it |
| `OTHER` | Free-text reason required |

This category is a direct consequence of today's federated-ownership decision — it didn't exist as a concept under the original single-owner model.

---

## 6. Decision Record & Override Schemas (draft)

### Decision Record

```json
{
  "decision_id": "uuid",
  "module": "architecture",
  "domain": "payments",
  "target_type": "node | relationship | ignored-item",
  "target_ref": "calm-element-id or ignored-item-id",
  "original_suggestion": {
    "proposed_type": "service",
    "confidence_score": 62,
    "evidence_refs": ["prov-001", "prov-004"]
  },
  "final_decision": {
    "action": "accepted | overridden | added | removed",
    "new_value": "…if changed"
  },
  "rationale": "free text — why the SME decided this",
  "evidence_snapshot": ["prov-001", "prov-004"],
  "reviewer": "architect-id",
  "reviewed_at": "iso-timestamp",
  "source_run_id": "generation-run-id",
  "status": "active | superseded",
  "supersedes": "decision_id | null"
}
```

### Override

```json
{
  "override_id": "uuid",
  "module": "architecture",
  "domain": "payments",
  "target_ref": "calm-element-id or 'new'",
  "override_type": "type_change | relationship_add | relationship_remove | node_add | node_remove | node_rename | boundary_change",
  "new_value": "…",
  "decision_record_ref": "decision_id",
  "applied_since_run": "generation-run-id",
  "status": "active | retired",
  "created_by": "architect-id",
  "created_at": "iso-timestamp"
}
```

**Integrity rule enforced by schema:** every Override must carry a `decision_record_ref` — no override can exist without a traceable Decision Record behind it. This makes §6.7's "core integrity rule" mechanically enforceable, not just a stated principle.

---

## 7. Confidence Scoring — Draft Weighted Model

Formalizes Appendix B.7's qualitative bands into something codeable. **Starting weights only — expect to recalibrate during the pilot.**

| Signal | Weight |
|---|---|
| HTTP entry point (Appendix B.1) | 40 |
| Deployable package (own start script/container) | 30 |
| Framework bootstrap marker | 25 |
| Persistence signal (Appendix B.2) | 20 |
| Messaging signal (Appendix B.3) | 20 |
| Folder/naming convention only | 10 |
| Historical SME decision on similar pattern | +15 boost |

**Bands:**
- **≥ 70** → High confidence, auto-include
- **40–69** → Medium, auto-include but flagged for spot-check
- **< 40** → Routed to review queue
- **Conflicting strong signals** (e.g. both service-like and library-like signals score high) → forced to review regardless of numeric score

---

## 8. Still Need From You

- **Numeric success-metric target:** even a rough number — e.g. "SME review of a ~15-service slice should take under X hours" — so Playbook Phase 4's pass/fail call has something objective to check against.
- **Data classification policy:** who's the right person to confirm handling/classification of `calm.json`/`provenance.json` (they describe internal system structure) — security team, compliance, or is this your call to make?
- **Auth mechanism for the standalone companion interface** — is there an existing SSO (Azure AD / Okta / internal) you'd point it at, or is this greenfield?

---

## 9. Recommended Immediate Sequence

1. **This week:** Run the CodeGraph discovery spike (§2) — you already have it installed, this is the fastest unblock.
2. **In parallel:** Run Playbook Phase 1 (Worked Example Design) using the pilot slice, informed by real CodeGraph output as it comes in.
3. **Once spike results are in:** revisit §7's confidence weights against what CodeGraph actually surfaces per language — Java/Node/Python may not produce equally rich signals.
4. **Before Phase 2 build starts:** confirm the two-tier mapping-config folder convention (§4) with the domain EAs so nobody starts building against the old single-owner assumption.
