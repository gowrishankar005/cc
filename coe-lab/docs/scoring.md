# Scoring specification

## 1. Inputs

- **CALM:** `architecture.calm.json` from a pipeline run.
- **Gold:** `gold/packages/<id>.gold.json` conforming to `gold/schema/gold-architecture.schema.json`.

## 2. Normalization

| Entity | Match key |
|---|---|
| Node | Prefer gold `match.nameContains` against calm `name` or `unique-id` (case-sensitive substring or exact `unique-id` if `match.uniqueId` set) |
| Interface | Normalize `METHOD` + path: uppercase method, collapse `//`, strip trailing slash except root |
| Relationship | Pair of matched endpoint node keys + optional `kind` if gold specifies |

## 3. Metrics

### 3.1 Nodes

```
TP = gold nodes matched to ≥1 calm node of allowed node-types
FP = calm nodes (service|database|network|system) not matching any gold node
     and not listed in gold.ignoreCalmNameContains
FN = gold nodes with no match

precision = TP / (TP+FP)   (1.0 if TP+FP=0)
recall    = TP / (TP+FN)   (1.0 if TP+FN=0)
f1        = harmonic mean
```

### 3.2 Interfaces (optional section in gold)

Same TP/FP/FN on normalized `METHOD path` strings attached to any matched service node (or global if gold says `scope: package`).

### 3.3 Relationships

```
TP = gold edge where both ends matched and calm has connects/calls-like edge between them
FN = gold edge missing
FP = optional; default off in v0.1 (calm is edge-sparse)
```

### 3.4 Must-not-detect

```
violations = calm nodes matching gold.mustNotDetect name patterns
score penalty: report count; fail gate if violations > 0 when --strict
```

### 3.5 Out of scope

Gold `outOfScope` items are **never** FN.

## 4. Platform efficiency (optional fields in score.json)

| Field | Source |
|---|---|
| `calmNodeCount` | len(nodes) |
| `calmRelationshipCount` | len(relationships) |
| `durationMs` | if passed via --duration |
| `pass` | boolean vs thresholds |

## 5. Default thresholds (v0.1 gates)

| Package tier | Node recall | Node precision | Must-not-detect |
|---|---|---|---|
| `core` (py-accounts, ts-nestjs, java-jaxrs) | ≥ 0.8 | ≥ 0.7 | 0 violations |
| `stretch` (kafka, dynamo, k8s) | ≥ 0.0 report-only | report-only | 0 if lib trap present |

Stretch packages document **expected current fails** until platform X-waves land.

## 6. Scorer CLI

```bash
node scripts/score-calm.mjs \
  --calm <path/architecture.calm.json> \
  --gold <path/package.gold.json> \
  [--out score.json] \
  [--strict]
```

Exit code `1` if `--strict` and core thresholds fail or must-not-detect violated.
