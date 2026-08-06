# Expected full CALM JSON (hand-authored gold)

Each subfolder holds a **hand-authored** FINOS CALM 1.2 `architecture.calm.json` for one lab package or scenario.

## STOP (implementation agents)

**Do not read these files to invent signal-catalogue rows or detectors.**  
Use only for **validation after** a generate run (eval agents / CI).

## How these files are created (required process)

1. **Read the fixture source** under `fixtures/monorepo/...` (and semantic gold under `gold/packages/` for intent).
2. **Author CALM independently** following FINOS CALM 1.2 (`$schema`, `unique-id`, `name`, `description`, `nodes`, `relationships`).
3. **Run `calm validate -a`** (with `-u` control URL mapping if the document has controls). Fix until `hasErrors: false`.
4. **Commit.** Never bootstrap by copying platform `generated/` output into this tree — that is circular.

Volatile generator fields (`x-aac-generated-at`, file-based unique-ids like `accounts_api.py`) are **not** part of gold. Comparison is **semantic** (node types, route paths, relationship topology, controls presence), not byte-identical unique-ids.

## Layout

```
gold/calm/
  py-accounts-api/architecture.calm.json
  java-rbac-datatable/architecture.calm.json
  fineract-charge/architecture.calm.json      # wild-type Apache Fineract (deep)
  fineract-core/architecture.calm.json        # wild-type core slice
  fineract-system-map/architecture.calm.json  # wild-type module map
  FINERACT_GOLD.md
  ...
```

**Wild-type Fineract gold lives only under `coe-lab/gold/`** — never under `spikes/` (experiments are not eval contract). See `FINERACT_GOLD.md`.

## Validate gold alone

```bash
cd pipeline
for d in ../coe-lab/gold/calm/*/architecture.calm.json; do
  echo "=== $d ==="
  npx --no-install calm validate -u dist/rules/control-url-mapping.json -a "$d" -f pretty
done
```

## Compare gold vs generated

```bash
node coe-lab/scripts/generate-calm.mjs --all-core
node coe-lab/scripts/validate-calm-pair.mjs --all-core
```

## Schema notes (researched from calm-cli 1.2 guides)

| Field | Rule |
|---|---|
| `$schema` | `https://calm.finos.org/release/1.2/meta/calm.json` |
| Top-level | `unique-id`, `name`, `description` required for complete docs |
| Node | `unique-id`, `node-type`, `name`, `description` |
| Interfaces | Flexible `interface-type` with `unique-id` + props (we use `type: path-interface`, `path: "METHOD /route"`) |
| Relationships | `connects` → `{ source: { node }, destination: { node } }`; never `interacts` with source/destination |
| Controls | `requirement-url` + `config` or `config-url`; URLs must pass calm-cli allowlist via `-u` mapping |
