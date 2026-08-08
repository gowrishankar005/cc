# Hard-test repo registry

**Status:** prepared for eval track (2026-08-08).  
**Clones:** `spikes/<name>/repo` (scratch; gitignored).  
**Gold:** only under `coe-lab/gold/calm/<package-id>/`.

Update **Status** as packages move: `queued` → `gold-wip` → `gold-done` → `scanned` → `compared` → `blocked`.

---

## Available clones (local)

| Sample | Path | Approx scale | Languages | Notes |
|---|---|---|---|---|
| **boa** | `spikes/boa/repo` | ~35 Java, ~20 Python | Java, Python, k8s | Bank of Anthos; good R1 / k8s trust |
| **calm-hub** | `spikes/calm-hub/repo` | ~434 Java | Java (Quarkus-class) | FINOS CALM Hub; distinct stack |
| **fineract** | `spikes/fineract/repo` | ~6600+ Java | Java | Large; use **module slices**, not whole tree |
| **ghostfolio** | `spikes/ghostfolio/repo` | ~820 TS/TSX | TypeScript/Nest | Prisma / Node; ontology evidence |
| **waltz** | `spikes/waltz/repo` | ~1100 Java | Java | jOOQ / RBAC evidence |
| **maven-doxia** | `spikes/maven-doxia/repo` | ~158 Java (shallow clone) | Java library | [apache/maven-doxia](https://github.com/apache/maven-doxia) — content framework, not HTTP app |
| **aws-saas-boost** | `spikes/aws-saas-boost/repo` | ~239 Java + client JS | Java Lambda, React | [awslabs/aws-saas-boost](https://github.com/awslabs/aws-saas-boost) — multi-tenant SaaS control plane |

---

## Package slices (eval packages)

One clone → one or more **package-ids** (scoped roots). Prefer deep slices.

| package-id | Source root(s) | Scan mode | Gold exists? | Status | Priority (suggested) |
|---|---|---|---|---|---|
| `fineract-charge` | `spikes/fineract/repo/fineract-charge` | single | yes | compared (prior) | re-baseline only if claims change |
| `fineract-charge-provider` | charge + provider | multi | yes (access-layer) | layered-story track | coordinate with L-story; don’t duplicate |
| `fineract-core` | `…/fineract-core` | single | yes | compared (prior) | optional recheck |
| `boa-userservice` | TBD (accounts userservice path) | single | no | **queued** | high (R1 / Python) |
| `boa-contacts` | TBD | single | no | **queued** | high |
| `boa-multi` | userservice + contacts | multi | no | **queued** | high (cross-package) |
| `waltz-data` | TBD waltz-data module | single | no | **queued** | high (jOOQ) |
| `waltz-web` | TBD waltz-web | single | no | **queued** | medium (C-call / RBAC) |
| `ghostfolio-api` | TBD apps/api slice | single | no | **queued** | high (Nest/Prisma) |
| `calm-hub-core` | TBD scoped module | single | no | **queued** | medium (Quarkus/new shape) |
| **`maven-doxia-system-map`** | `spikes/maven-doxia/repo` (whole tree) | single-root | **yes** (module grain) | **compared** 2026-08-08 | first hard-test; empty platform CALM |
| **`aws-saas-boost-tier-service`** | `spikes/aws-saas-boost/repo/services/tier-service` | single-root | **yes** (class grain) | **compared** 2026-08-08 | Dynamo detected; Lambda HTTP not; handler mis-kinded DB |
| `aws-saas-boost-tenant-service` | `…/services/tenant-service` | single | no | **queued** | similar Lambda+Dynamo shape |
| `aws-saas-boost-services-multi` | multiple `services/*` | multi | no | **queued** | cross-service later |

**Fill TBD paths** on first package kickoff (ls module dirs, pick real scan roots).

---

## Queue discipline

1. Human picks **one** `package-id` with status `queued`.  
2. Eval session runs playbook A→B→C for **that id only**.  
3. No second package until backlog + finding note exist for the first.  
4. Coding agents **do not** auto-consume this registry mid-hard-test.

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | Initial registry from local spikes inventory; Fineract gold already present |
