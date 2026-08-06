# Isolation — keep the lab from biasing platform agents

## Why

If an agent implementing scanners/catalogues **reads gold**, it can hardcode expectations and inflate scores without generalizing. Gold is for **scoring after** a run, not for **authoring** detection rules.

## Rules

| Actor | May read `fixtures/` | May read `gold/` | May write catalogues from lab |
|---|---|---|---|
| **Platform implementation agent** | No (prefer public spikes + synthetic unit tests in `pipeline/test`) | **No** (`packages/` **and** `calm/`) | **No** |
| **Evaluation agent / CI** | **Yes** | **Yes** | No (only score / compare reports) |
| **Lab author (human or lab-only task)** | Yes | Yes | Only lab docs + intentional gold/calm bumps, not platform rules |
| **Human architect** | Yes | Yes | Via normal catalogue review process after eval |

## Technical boundaries

1. **`gold/`** — ground truth. Marked in `gold/README.md`. Listed in repo root **`.cursorignore`** / **`.grokignore`** so IDE agents default-skip it.
2. **`fixtures/`** — scannable code. Safe for **eval** pipeline runs; not a substitute for wild-type repos when designing rules.
3. **Pipeline default roots** — never point `run-slice` at `coe-lab/gold`.
4. **CLAUDE.md / agent prompts** — platform tasks must say: *do not open `coe-lab/gold/`*.

## Eval-only agent prompt snippet

```text
You are running EVALUATION only.
You MAY read coe-lab/fixtures and coe-lab/gold.
You MUST NOT change pipeline signal-catalogue or detectors to match gold in the same session.
Report scores and gap hypotheses only.
```

## Implementation agent prompt snippet

```text
You are implementing the platform (pipeline/).
Do NOT open coe-lab/gold/ or coe-lab/docs/*scoring* gold examples to invent rules.
Use pipeline/test fixtures and public spikes only.
```
