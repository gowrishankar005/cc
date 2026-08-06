# Requirements v0.7 — Repo Analyser/Orchestrator Platform + CALM Generator Module

**Status:** Draft. Supersedes v0.6. Prompted by a direct question after Slice 1 was built: does the generated CALM capture authentication and flow? It didn't — this version re-derives CALM construct scope systematically (per calm.finos.org/core-concepts/, re-verified this session, not from memory) rather than patching the specific gap found. Solutioning pauses here for review before resuming.

---

## 0. Why this version exists, and what changed

Building Slice 1 (`pipeline/`) and then auditing its output against real source (not just schema-validating it) found a real, disclosed gap: the one genuine cross-service relationship in the Bank of Anthos test repo — `userservice` issues JWTs, five other services verify them — was completely invisible. Investigating *why* led somewhere more useful than a bug fix: the relationship isn't expressed in Python source at all. It's wired entirely through Kubernetes — both services mount the same Secret (`jwt-key`), `userservice`'s Deployment requests both the private and public key items, every verifying service requests only the public key. This is a **real, generalizable signal**, not a Bank-of-Anthos-specific quirk: any two services sharing a Kubernetes Secret/ConfigMap have an inferable relationship, and CALM already has a construct built for supplementary node facts like this (`decorators`) plus its core `relationships` construct for the trust edge itself.

**Was this already planned and missed, or genuinely new?** Both, depending on which piece:
- Kubernetes manifests as *a* signal source were already flagged — `docs/requirements/CALM_Generator_Requirements_v0.1.md` §2 listed interfaces/decorators from k8s manifests as a "stretch goal, not a blocker," and v0.5/v0.6 §3's "Infrastructure Manifests" section corrected an earlier overclaim about how easy this would be. So: not missed, deliberately deferred to backlog.
- **The specific mechanism — shared Secret/ConfigMap reference as evidence of a trust relationship between two services — was never identified anywhere in this project before this session.** That part is genuinely new, found only by auditing real output against real source and asking "why is this missing" rather than treating the audit as closed once schema validation passed.

This version's job: go through every CALM core concept systematically (re-fetched from calm.finos.org/core-concepts/ this session, not recalled) and decide, in light of everything Slice 1 actually taught us, what's now realistically in scope — not just react to the one gap that was found.

---

## 1. Purpose & Scope

Unchanged: Analyser/Orchestrator platform, CALM Generator as first module, deterministic core (no LLM in the generation path), typed-facts.json as the module contract. **Scope statement extended**: in-scope signal sources now explicitly include Kubernetes manifests when present, not source code alone.

---

## 1.5 Delivery Strategy

Unchanged vertical-slices strategy (v0.6 §1.5). The Kubernetes-manifest signal layer specified below is scoped as **an extension of Slice 1**, not a new slice — it's still Python/Node-only, still validated against the same real packages (Bank of Anthos already ships the manifests needed), and doesn't touch Java/Slice 2 concerns at all.

---

## 2. CALM Construct Coverage — systematically re-derived

Every construct from calm.finos.org/core-concepts/ (nodes, relationships, interfaces, controls, standards, timelines, decorators, metadata, patterns, widgets), reassessed against what Slice 1 actually proved is buildable — not the same table carried forward unchanged.

| Construct | v0.6 status | v0.7 status | Why it changed (or didn't) |
|---|---|---|---|
| **Nodes** | In scope | **Unchanged, in scope** | Proven working (Slice 1). |
| **Relationships** | In scope (calls/imports/connects) | **In scope, expanded** | New relationship source: config/secret-mediated trust, derived from Kubernetes manifests (§3 below) — a structural fact (these two services share a credential), not a business-flow claim. |
| **Interfaces** | In scope; k8s-derived `host-port-interface`/`container-image-interface` explicitly a "stretch goal, use if present" | **Promoted from stretch to active** | Building the secret-sharing detector requires parsing the same Deployment/Service YAML that port/image extraction needs — bundling both into one manifest-parsing pass is strictly cheaper than building them separately later. |
| **Metadata** | In scope (`x-aac-*` namespaced) | **Unchanged, in scope** | Working (Slice 1), including the `x-aac-scope-limitations` disclosure added after the first audit. |
| **Controls** | Out of scope — "organizational policy, not source-derivable" | **Still out of scope — reasoning sharpened, not just repeated** | A control is a *policy statement* ("connections must be authenticated"). What the new relationship-detector produces is *evidence of an existing wired fact* ("these two services share credential X"). That's a relationship, not a control — CALM's own model draws this line (controls carry `requirements` pointing at externally-governed policy schemas; relationships don't). Worth stating explicitly so a future session doesn't conflate "we can detect the JWT wiring" with "we can express the security policy behind it" — we can't, and shouldn't pretend to. |
| **Standards** | Out of scope | **Unchanged, out of scope** | Org-specific JSON Schema authoring — genuinely not a scan output, nothing learned changes this. |
| **Decorators** | "Maybe, stretch goal — if k8s manifests present" | **Promoted to active, scoped narrowly** | A `deployment`-type decorator (image, namespace — the documented CALM example shape) is genuinely derivable per node from the same Deployment YAML. Scoped to per-node deployment facts only — **not** used for the trust relationship itself (that's a `relationships` construct concern, not a per-node decoration; see §3). |
| **Flows** | Out of scope — "requires business call order, not just that an edge exists" | **Unchanged, out of scope — clarified for this session's question** | The user asked whether "flow" is captured. Two different things share that word: (a) CALM's formal `flows` construct (an ordered sequence of relationships, e.g. "login happens before contacts lookup") — still not reliably inferable from static structure, still out. (b) The general shape of "what talks to what" — that *is* covered, by the `relationships` construct, and got materially better this session (database relationships, and now trust relationships). If "flow" meant (b), it's answered by §3; if it meant (a), it remains explicitly deferred. |
| **Patterns** | Out of scope | **Unchanged, out of scope** | Architect-authoring tool (generate+validate), not a scan output. |
| **Timelines / Widgets** | Out of scope | **Unchanged, out of scope** | Documentation/versioning tooling, not architecture content. |

---

## 3. New: Kubernetes-Manifest Signal Layer

### 3.1 Trust relationships from shared Secret/ConfigMap references

**Verified this session against real Bank of Anthos manifests** (not hypothetical):

```yaml
# kubernetes-manifests/userservice.yaml:125-135 (Deployment volumes)
- name: keys
  secret:
    items:
      - key: jwtRS256.key       # PRIVATE key
        path: privatekey
      - key: jwtRS256.key.pub   # PUBLIC key
        path: publickey
    secretName: jwt-key

# kubernetes-manifests/contacts.yaml:118-126 (Deployment volumes)
- name: publickey
  secret:
    items:
      - key: jwtRS256.key.pub   # PUBLIC key only
        path: publickey
    secretName: jwt-key
```

Six services in this one repo mount `secretName: jwt-key`: `userservice`, `contacts`, `balance-reader`, `frontend`, `ledger-writer`, `transaction-history` — confirmed by grepping every file in `kubernetes-manifests/`, not assumed from the two services already under test.

**Detection rule (language/framework-agnostic — this is a Kubernetes-layer signal, not a source-code one):**
1. Parse each service's Deployment manifest for `spec.template.spec.volumes[].secret.secretName` (and the equivalent `envFrom`/`env[].valueFrom.secretKeyRef.name` / `configMapKeyRef.name` forms — the requirements v0.6 §3 Infrastructure Manifests section already scoped ConfigMap cross-file resolution for the DB-connection case; the same resolution mechanism applies here).
2. Group services by shared secret/configmap name.
3. Where the manifest's `items[].key` names distinguish issuer from verifier (a private-key-shaped item present vs. public-key-only), tag the relationship directionally; where they don't, emit an undirected "shares-config" relationship rather than guessing a direction — **do not infer a direction the manifest doesn't state**.
4. CALM mapping: `relationship-type: interacts`, `description` stating what's shared and the evidence file:line, metadata carrying the secret/configmap name and the specific keys involved. Not a `connects` (that's for interface-level network connections) and not a `decorator` (this is inherently a two-node fact).

**New relationship confidence needed:** `TypedRelationship` currently has no confidence field (only `TypedUnit` does) — this detector is the first case where relationship confidence actually varies (a shared-secret match is unambiguous; role inference — issuer vs. verifier — is heuristic and weaker). Add a confidence field to relationships when this is built, don't bolt the heuristic-role case onto the same certainty as the raw match.

### 3.2 Deployment decorators

Per-node `deployment`-type decorator (CALM's own documented shape: `unique-id`, `type: "deployment"`, `target`, `applies-to`, `data: {image, namespace, cluster, ...}`), sourced from the same Deployment YAML's `spec.template.spec.containers[].image` and `metadata.namespace`. Evidence already gathered in `docs/requirements/CALM_Generator_Requirements_v0_6.md` §3 (`balance-reader.yaml:38,92`) — re-usable directly, no new evidence-gathering needed.

### 3.3 What this does *not* solve

Stated plainly so it isn't assumed later: this detects that two services are *wired to the same credential*. It does not verify the credential is used correctly, does not know whether verification is actually enforced on every request (that's runtime behavior, not static structure), and does not produce a `controls` entry asserting "authentication is required here" (see §2's Controls row). It answers "are these two services connected via a shared secret," not "is this system secure."

---

## 4–10. Everything else

Unchanged from v0.6 (§4 cross-package `detect()` gate and Option A/B/C framing, §5 the resolved `extractFromSource()` mechanism, §6 confidence scoring for units, §7 Ignored Items taxonomy, §8 out-of-scope list, §9 validation-repo table). §9 gains one line: the Kubernetes-manifest work above is validated against Bank of Anthos's already-gathered manifests — no new repo needed.

---

## 11. Validation Plan — next spike before resuming solutioning

1. **Confirm the secret-sharing detection rule against all six BoA services sharing `jwt-key`**, not just `userservice`/`contacts` — the two originally audited. Check whether the issuer/verifier role-inference heuristic (private-key item present vs. not) holds for all six, or whether some mount the secret for an unrelated reason (worth checking before trusting the heuristic).
2. **Re-run `calm validate` after implementation** — same discipline as every prior change: real schema validation, not just "it compiled."
3. **Re-run the NestJS fixture regression** (`test/fixtures/nestjs-sample`) to confirm the new manifest layer doesn't regress the source-only path when no Kubernetes manifests are present at all (the fixture has none) — the layer must degrade gracefully, not error, when there's nothing to parse.

---

## Sources

Unchanged from v0.6, plus: [Core Concepts](https://calm.finos.org/core-concepts/) and [Decorators](https://calm.finos.org/core-concepts/decorators/) (re-fetched fresh this session per the user's request, not recalled); `spikes/boa/repo/kubernetes-manifests/{userservice,contacts,balance-reader,frontend,ledger-writer,transaction-history}.yaml` (grepped this session for `secretName: jwt-key`).
