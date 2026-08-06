# Evaluation methodology

## 1. Hypothesis

If the platform’s scanners, catalogues, and CALM construction are sound, then for each lab package:

- **High recall** of gold nodes/interfaces/relationships that are **in-scope** for the current platform version.
- **High precision** (few false services/libs).
- Misses form **systematic gap classes** (persistence shape, messaging, k8s) — not random noise.

## 2. Protocol

```
For each package P in catalog:
  1. run-slice on fixtures/.../P → architecture.calm.json
  2. score-calm vs gold/packages/P.gold.json
  3. store score.json under eval-results/
  4. classify misses into gap taxonomy (below)
  5. open platform work ONLY from miss classes (catalogues/providers)
     — never by hardcoding package ids
```

## 3. Gap taxonomy (map misses → platform work)

| Miss class | Example | Platform response |
|---|---|---|
| `eval-coverage` | File not scanned | Language extensions / roots |
| `signal-unmapped` | Decorator not in catalogue | Catalogue row / unmapped report |
| `persistence-shape` | Spring Data repo | Strategy catalogue |
| `messaging` | @KafkaListener | Messaging pass (X7) |
| `cloud-sdk` | Dynamo/SQS import | Import strategies (X2) |
| `cross-package` | Missing edge | Graphify multi-root |
| `k8s-trust` | Shared secret | k8s provider (X5) |
| `false-positive` | lib as service | Deployable gate / ignore rules |
| `gold-error` | Gold wrong | Fix gold (lab maintainer) |
| `out-of-scope` | Frontend screen | Ignore in score |

## 4. Version alignment

| Artefact | Version field |
|---|---|
| Gold file | `goldVersion`, `platformMinContract` |
| Score output | `scorerVersion`, calm path, gold path, git commit if available |
| Platform | `CONTRACT_VERSION`, catalogue `version` in provenance |

Bump gold when intentional architecture changes; never silent-edit gold to match a buggy generator.

## 5. What “excellent” validation includes

| Layer | Lab provides |
|---|---|
| Requirements | Package catalog maps to coverage-matrix cells |
| Solution under test | `pipeline/` CALM generator |
| Fixtures | Minimal honest code |
| Gold | Expected architecture |
| Scoring | Deterministic P/R |
| Process metrics | Optional override count (manual) |
| Isolation | Gold not used in implementation |
| Wild-type | Documented companion runs (not automated here) |

## 6. Anti-patterns

- Tuning catalogue by opening gold in the same PR as detector changes without a **miss-class** write-up.
- Scoring whole monorepo as one gold when packages differ.
- Counting out-of-scope frontend as failure.
- One giant “fidelity clone” app no one can maintain.
