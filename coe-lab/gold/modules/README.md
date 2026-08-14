# GOLD ZONE — module output ground truth

## STOP

**Platform implementation agents: DO NOT READ these files to design module
logic.** Same isolation rule as `../packages/` and `../calm/` — see `../README.md`.

## What this is

T-LM-0 (`AGENT_TASKS_Ext_Lens_Modules.md`): a gold shape and scoring path for
**module outputs** (`outDir/modules/<name>/*.json`), distinct from the
architecture-level gold in `../packages/`/`../calm/` (units, routes,
persistence, controls — never module findings). Before this existed, a lens
module shipped unmeasurable — `threat-signals` itself shipped unscored.

## Contents

| Path | Purpose |
|---|---|
| `threat-signals/<pkg>.gold.json` | Expected `threat-signals-report.json` findings, per coe-lab core/trap package |

## Authoring rule (`CON-40`)

Every gold file here was authored by reading the **fixture source** directly
(`coe-lab/fixtures/monorepo/packages/<pkg>/`) — never by running the module
and copying its output, and never by reading `../packages/*.gold.json` for a
shortcut. `threat-signals`'s own real output was checked only *after* each
gold file below was written independently, as a verification step, not as
the source of the gold itself.

## Updating gold

Same three rules as `../README.md`: change fixture intentionally, update
gold in the same commit, note the reason — never adjust gold just to make a
failing check pass without a real product decision.
