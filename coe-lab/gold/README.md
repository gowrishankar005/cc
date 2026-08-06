# GOLD ZONE — Ground truth architecture

## STOP

**Platform implementation agents: DO NOT READ the JSON files in `packages/` to design scanners, catalogues, or builders.**

Doing so biases the platform and invalidates evaluation.

You may read this README only if you need the isolation rule.

## Allowed readers

- Evaluation agents / CI scoring
- Lab maintainers updating gold with fixture changes
- Humans reviewing score misses

## Contents

| Path | Purpose |
|---|---|
| `schema/gold-architecture.schema.json` | Shape of semantic gold files |
| `packages/*.gold.json` | Semantic expected architecture (P/R scorer) |
| `calm/<id>/architecture.calm.json` | Hand-authored full CALM 1.2 gold (`calm validate` + semantic compare) |

## Updating gold

1. Change fixture code intentionally.
2. Update gold in the **same commit**.
3. Note reason in gold `changelog` field.
4. Never change gold solely to make a failing detector “pass” without a product decision.
