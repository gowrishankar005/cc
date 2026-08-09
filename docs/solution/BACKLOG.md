# Weaver — Backlog

What's left to build. For what's already built, see [`Capabilities.md`](./Capabilities.md). For completeness-claim rules, see [`Claim_Register.md`](./Claim_Register.md). For permanent non-goals (with reasons), see [`OOS_Registry.md`](./OOS_Registry.md).

**Update rule:** when an item ships, remove its row here and reflect it in `Capabilities.md` / `Claim_Register.md` as appropriate.

## P1 — Correctness and coverage gaps

| Item | Description |
|---|---|
| **Tier-B residual detection** | The residual-review tooling can present a "medium-confidence, needs a human decision" card, but no detector currently produces that class of input — every real detection today is either high-confidence (auto-emitted) or too ambiguous to rank (multiple candidates). A detector that separates "one high-confidence candidate just under the auto-emit threshold" from "genuinely many candidates" would give the review tooling real input to act on. |
| **`package.json` manifest false-positive** | When a `package.json`'s own declared dependency name matches a known persistence/messaging library, the structural-graph reconciler can treat `package.json` itself as an "importing file" and produce one bogus unit per top-level JSON key instead of zero. Confirmed via a real fixture; not triggered by Python manifests. Fix belongs in the shared import-strategy detection helper. |
| **Direct-delegate bridge detection** | Multi-hop architecture-bridge detection currently requires an `implements` edge between a candidate bridge class and its interface. A common real pattern — a concrete service class referenced directly, with no interface at all, that itself imports exactly one persistence/messaging unit — is invisible to the current detector. Real evidence exists (28 real candidates found in a public sample, 0 resolved); not yet built. |
| **Override-applier missing default case** | The switch statement handling override types has no `default` branch — an unrecognized override type silently disappears from every result category instead of being reported as rejected. Low effort, low priority (nothing currently exercises this path in practice). |
| **Bulk residual-decision authoring** | The residual-review UI suggests answering once and applying the decision to a whole class of similar residuals, but no such batch mechanism exists — every residual currently needs its own individually-authored decision record. At real scale this is a real throughput problem (tens of near-identical residuals from a single module in one real dry run). |
| **Plain-interface bridge detection** | Interface classes with no framework marker at all (no route annotation, no persistence annotation, no security annotation) are structurally invisible even when they sit exactly on a real service boundary. Candidate mechanism: promote a plain interface to a placeholder unit when it's a field-injected dependency of an already-typed service — needs its own evidence pass before building. |
| **Bean-factory / stereotype-free wiring detection** | A common real convention — components wired via `@Configuration`/`@Bean` factory methods with no class-level stereotype annotation on the implementation — produces zero detection signal today. Generic `@Service`/`@Component` stereotype detection and DI-based interface-to-implementation resolution are both real, related gaps. |

## P2 — Detection breadth

| Item | Description |
|---|---|
| **Kinesis stream detection** | Evidenced as a real pattern in job-posting research; no catalogue coverage yet. |
| **Deeper OAuth2 evidence** | Currently only detected via OpenAPI security schemes; library-import/config-level detection not yet built. |
| **Container/compose corroboration** | The dependency-manifest corroboration lane (via an external SBOM tool) covers build-file dependencies; Docker/compose/Kubernetes container facts from the same tool are not yet wired in. |
| **ADR ingestion** | Linking existing Architecture Decision Record documents into the generated CALM output's `adrs[]` array — not yet built. |

## P3 — Platform

| Item | Description |
|---|---|
| **Portable, CALM-round-trippable IR** | The current human-readable architecture summary is one-way (facts → markdown). A portable version that round-trips real CALM node/relationship fragments would let it double as a distribution format — proposed, needs review before implementation. |
| **Third-party plugin discovery / embed API** | The module boundary (contract version, module registry) exists; external plugin discovery and a library embed API do not. |
| **Two-tier (global + domain) mapping configuration** | Not yet built. |
| **Additional engines on measured gaps only** | Static-analysis engines beyond the current pair should only be added where a real, measured coverage gap justifies it — not speculatively. |
| **Scope-limitations ↔ claim-register consistency** | Ongoing discipline: every new detection gap named in generated-output metadata should have a matching completeness-claim entry, checked each time scope changes. |

## Explicitly out of scope, near-term

- **Helm/Kustomize template resolution** — only flat, pre-rendered Kubernetes manifests are read today; template/overlay resolution is a materially larger problem.
- **Additional languages / frontend frameworks** (Go, .NET/C#, React/Angular, etc.) — no evidenced near-term need.

See [`OOS_Registry.md`](./OOS_Registry.md) for permanent (not just near-term) non-goals and their reasoning.
