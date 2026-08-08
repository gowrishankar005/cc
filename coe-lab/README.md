# CoE Lab — Architecture Evaluation Benchmark

**Purpose:** Controlled fintech-shaped code packages with **authored ground-truth architecture** (“gold”), used only to **validate** the Architecture-as-Code platform / CALM generator — not to design catalogues by reading gold.

**Isolation:** Platform-implementation agents must **not** open `gold/` or use gold contents to tune detectors. See [`ISOLATION.md`](./ISOLATION.md).

**Hard-test track (wild-type, one package at a time):** [`docs/hard-test-eval-playbook.md`](./docs/hard-test-eval-playbook.md) · registry · [`docs/coe-lab-hard-test-backlog.md`](./docs/coe-lab-hard-test-backlog.md). Eval only — not the coding-agent suite.

```
coe-lab/
  CHARTER.md                 # why this lab exists, non-goals
  ISOLATION.md               # agent / tooling boundary
  docs/                      # methodology, scoring, fidelity mapping
  fixtures/monorepo/         # candidate code (OK to scan for EVAL only)
  gold/                      # ground truth — DO NOT READ for implementation
  scripts/                   # score harness
  eval-results/              # gitignored outputs
```

## Quick start (evaluation only)

```bash
cd pipeline && npm run build
cd ../coe-lab

# A) Semantic P/R vs gold/packages (architecture facts)
./scripts/run-eval.sh py-accounts-api
node scripts/scoreboard.mjs

# B) Full CALM: hand-authored gold (calm validate) vs platform generated
node scripts/validate-calm-pair.mjs --all-gold --gold-only   # schema-check gold alone
node scripts/generate-calm.mjs --all-core                    # → generated/<id>/
node scripts/validate-calm-pair.mjs --all-core               # semantic compare gold vs generated
```

Gold under `gold/calm/` is **hand-authored** from fixture source (never copied from the generator). See `docs/calm-snapshot-validation.md` and `gold/calm/README.md`.

## Design principle

| Layer | Location | Who uses it |
|---|---|---|
| **Code under test** | `fixtures/` | Pipeline scanners (eval runs) |
| **Expected architecture** | `gold/` | Scoring scripts + human reviewers only |
| **Platform** | `../pipeline/` | Implementation — never imports gold |

This is a **benchmark suite**, not a fintech product portfolio. Packages are minimal but intentional.

## Trustworthiness

Read **[`docs/TRUSTWORTHINESS_REVIEW.md`](./docs/TRUSTWORTHINESS_REVIEW.md)** and measured scores in **[`docs/BASELINES.md`](./docs/BASELINES.md)**.

**Short version (baseline 2026-08-07, post-MVP):** **Core** semantic + full-CALM gates green. **Kafka consumer** detected on lab. **K8s trust** green. **Dynamo** still 0 units (stretch). See **`docs/BASELINES.md`**. Cross-check wild-type: `cd pipeline && npm test`.

```bash
# Re-score everything under eval-results/ into a markdown table
node scripts/scoreboard.mjs
```
