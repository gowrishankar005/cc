# Full CALM JSON validation (hand-authored gold vs generated)

## Opinion (why this design)

| Approach | Verdict |
|---|---|
| **Only** semantic gold (`gold/packages/*.gold.json`) | Good for P/R; weak on full CALM shape (controls, relationship shapes) |
| **Bootstrap expected CALM from generator** | **Rejected** — circular: you only ever catch regressions relative to yourself |
| **Hand-authored full CALM gold** | **Required** — independent architecture model, then `calm validate`, then semantic compare to platform output |

## Authoring process (independent of the platform)

1. Read fixture source under `fixtures/monorepo/...`.
2. Optionally consult semantic intent in `gold/packages/*.gold.json`.
3. Write real CALM 1.2 JSON under `gold/calm/<packageId>/architecture.calm.json`:
   - `$schema`: `https://calm.finos.org/release/1.2/meta/calm.json`
   - Top-level `unique-id`, `name`, `description`
   - Nodes: `unique-id`, `node-type`, `name`, `description`; HTTP routes as `path-interface` with `path: "METHOD /route"`
   - Relationships: prefer `connects` with `{ source: { node }, destination: { node } }`
   - Optional `system` + `composed-of` so spectral "nodes must be referenced" is clean
   - Controls: `requirement-url` + `config` (map via `pipeline/dist/rules/control-url-mapping.json`)
4. **Validate gold immediately:**

```bash
cd pipeline
npx --no-install calm validate \
  -u dist/rules/control-url-mapping.json \
  -a ../coe-lab/gold/calm/<packageId>/architecture.calm.json \
  -f pretty
```

5. Commit only after `hasErrors: false` (warnings should be fixed where practical).

Sources used for authoring rules: FINOS calm-cli guides (`architecture-creation.md`, `node-creation.md`, `relationship-creation.md`, `interface-creation.md`, `control-creation.md`) and schema release 1.2.

## Folders

| Path | Role | Git |
|---|---|---|
| `gold/packages/*.gold.json` | Semantic architecture (P/R scorer) | Commit |
| `gold/calm/<packageId>/architecture.calm.json` | **Hand-authored full CALM gold** | Commit |
| `generated/<packageId>/architecture.calm.json` | Platform output | Gitignore (always re-generate) |
| `eval-results/` | Optional scores + extras | Gitignore |

## Pipeline

```
fixtures → run-slice → generated/<id>/architecture.calm.json
                ↓
     calm validate (schema) on gold AND generated
                ↓
     semantic compare (node-type, paths, connects, controls)
                ↓
     optional score-calm vs gold/packages/
```

Compare is **semantic**, not unique-id equality: gold uses stable kebab-case ids (`accounts-api`); the generator uses file-based ids (`accounts_api.py`). That is intentional independence.

## Commands

```bash
# Validate all hand-authored gold only
node coe-lab/scripts/validate-calm-pair.mjs --all-gold --gold-only

# Generate platform output for core packages
node coe-lab/scripts/generate-calm.mjs --all-core
# or one package:
node coe-lab/scripts/generate-calm.mjs --package py-accounts-api

# Compare gold vs generated (schema + semantic)
node coe-lab/scripts/validate-calm-pair.mjs --all-core
node coe-lab/scripts/validate-calm-pair.mjs --package py-accounts-api --generate-first
```

`--bootstrap-expected` was removed from `generate-calm.mjs`.
