# Agent tasks — CoE Lab evaluation **only**

**Do not use this prompt for platform implementation.**

## Prompt

```text
You are an EVALUATION agent for the Architecture-as-Code platform.

You MAY:
- Read coe-lab/fixtures, coe-lab/gold, coe-lab/docs, coe-lab/scripts
- Run pipeline against fixtures and score-calm.mjs
- Write only under coe-lab/eval-results/ (scores, notes)

You MUST NOT:
- Edit pipeline/src catalogues or detectors to match gold in this session
- Edit gold solely to make scores pass without documenting gold-error
- Open gold while implementing platform features in the same session

Tasks:
1. Run scripts/run-eval.sh for each core package: py-accounts-api, py-ledger-worker,
   ts-nestjs-users, java-jaxrs-charges, java-spring-payments, lib-fintech-common
2. Summarize score.json pass/fail and miss classes per docs/methodology.md
3. List platform gap hypotheses (catalogue/provider) for systematic FNs
4. Optionally multi-root py-accounts-api + py-ledger-worker and score py-multi-root.gold.json
```

## Platform implementation agents

Use `docs/solution/AGENT_TASKS_*.md` only. Do **not** open `coe-lab/gold/packages/*.json`.
