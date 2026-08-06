# Wild-type Fineract gold (under coe-lab only)

**Location:** `coe-lab/gold/calm/fineract-*` — never under `spikes/`.

Spikes/clones are disposable experiment state. Gold for evaluation lives only in the CoE lab gold zone so:

- eval agents / CI read gold here
- platform implementation agents still must **not** use gold to invent detectors (see `ISOLATION.md`)
- nothing under `spikes/` is part of the committed eval contract

## Recommendation (why three docs, not one mega-file)

Full Apache Fineract ≈ 171 JAX-RS resources and ≈ 256 JPA entities across ~34 modules. A single complete hand gold is multi-week and will bit-rot. Project success needs **honest depth where the platform is judged** and **honest grain elsewhere**:

| Gold package | Grain | Purpose |
|---|---|---|
| `fineract-charge` | Routes + entity + connects | Deep Java happy path (platform Slice 2 proof module) |
| `fineract-core` | All module `*ApiResource` routes + RBAC service + representative entities | Controls + multi-API core; documents remaining entities as out-of-scope |
| `fineract-system-map` | Gradle modules as nodes | Monorepo topology without inventing every class |

## Method (do this; do not bootstrap from generator)

1. Inventory **source** (`@Path` / `@Entity` / `@PreAuthorize`) — not `generated/` output.
2. Hand-author CALM 1.2 under this tree.
3. `calm validate -a … -u pipeline/dist/rules/control-url-mapping.json`.
4. Optionally run platform on the same module roots and `validate-calm-pair` for semantic compare.

## Source used for this revision

Authoring evidence was taken from a local Apache Fineract tree (module paths as in gold metadata). That clone is **not** the gold; only these JSON files are.

## Validate

```bash
cd pipeline
for d in fineract-charge fineract-core fineract-system-map; do
  npx --no-install calm validate -u dist/rules/control-url-mapping.json \
    -a ../coe-lab/gold/calm/$d/architecture.calm.json -f pretty
done
```
