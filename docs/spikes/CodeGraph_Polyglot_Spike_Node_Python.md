# CodeGraph Polyglot Spike — Node & Python (Real Fintech Repos)

**Why:** the earlier CodeGraph spike and the CodeGraph-vs-Graphify comparison both ran against Apache Fineract, which is 99.9% Java. This closes that gap using two real, production open-source fintech platforms in the languages your monorepo actually uses.

**Repos:** OpenBB (`OpenBB-finance/OpenBB`) — Python, genuine FastAPI usage (`APIRouter()`, `@router.get(...)`) confirmed in provider code before testing. Ghostfolio (`ghostfolio/ghostfolio`) — TypeScript, genuine NestJS usage (`@Controller`) confirmed the same way.

---

## Headline finding: not a coverage gap this time — a silent detection-gate failure

Unlike JAX-RS (genuinely unsupported), **FastAPI is on CodeGraph's supported list, and OpenBB uses the exact idiom its resolver looks for.** It still produced **zero** route nodes on the first run. Proved out why, rather than assuming:

| Indexed from | Result |
|---|---|
| `openbb_platform/` — the natural pilot-slice root, contains `pyproject.toml` with no mention of fastapi | **0 route nodes** (out of 16,038 nodes total) |
| `openbb_platform/core/` — one level down, where `fastapi` is actually declared in `pyproject.toml` | **6 route nodes** — same code, same regex, now it fires |

Read the actual resolver source to confirm the mechanism: `detect()` only checks the **exact indexed root's** `pyproject.toml`/`requirements.txt` content, or three hardcoded filenames (`app.py`/`main.py`/`api.py`) at that same root. It never looks at subdirectories. In a Python monorepo where dependencies are declared per-package (a very common convention, and likely the one your own Python packages follow), pointing CodeGraph at anything above the specific package that declares `fastapi` makes the entire framework-resolver layer for that run **silently go dark** — no warning, no error, just zero routes, indistinguishable from "this codebase doesn't really use FastAPI."

**Ghostfolio, tested the same way from its actual repo root, worked cleanly: 115 real route nodes**, because Node/Nx monorepos conventionally declare all dependencies in one root `package.json` — which is exactly what the NestJS resolver checks. Same tool, same rigor, opposite result — purely because of where the manifest lives relative to the indexed root, not because Node support is better engineered than Python support.

---

## Why this matters more than the JAX-RS finding

The JAX-RS gap was "this pattern isn't supported — build an interpretation layer." That's a known, scoped, one-time cost. This is different: **a genuinely supported framework can fail completely, invisibly, purely as a function of directory structure** — and you would have no way to know it happened unless you specifically check for non-zero route counts after every run. That's a process risk, not a one-off coverage gap, and it applies to every "supported" framework in a monorepo with per-package manifests — plausibly including parts of your own Node and Python code, not just Python specifically, if any package's dependency declaration doesn't happen to sit at whatever root gets indexed.

---

## Performance (for completeness, same rigor as the Fineract numbers)

| Repo | Files | Nodes / Edges | Core index time |
|---|---|---|---|
| OpenBB (`openbb_platform/`) | 1,528 | 16,038 / 39,380 | 8.9s |
| OpenBB (`core/` only) | 351 | 3,827 / 8,208 | 1.3s |
| Ghostfolio (repo root) | 820 | 10,864 / 23,205 | 3.0s |

Consistent with the earlier Fineract result — CodeGraph is fast at this scale regardless of language.

---

## What this changes in the plan

1. **The Discovery Spike methodology needs a mandatory check, not just a one-time run.** After indexing any pilot slice, verify `codegraph status --json`'s `nodesByKind` shows a non-zero `route` count *for each package/module in the slice*, not just once for the whole run. A zero count doesn't mean "no HTTP entry points here" — it might mean "the detection gate didn't fire from this root."
2. **For Python specifically, index at the package level, not the platform/monorepo level**, if dependencies are declared per-package — or add an explicit pre-check (grep each package's own manifest for the frameworks in use) before trusting a bulk run's route counts.
3. **This reinforces, rather than replaces, the annotation-interpretation layer decision already made.** Even when detection *does* fire correctly (Ghostfolio, OpenBB's `core/`), we still only get route nodes for the specific decorator patterns each resolver's regex targets — the interpretation layer is still the right general-purpose fix, and it sidesteps this whole detection-gate fragility too, since it would read raw annotation/decorator data directly rather than depend on a framework's own `detect()` heuristic succeeding first.
4. **Recommend a smoke-test script** as part of Playbook Phase 2.1 (CodeGraph running on pilot slice): for every package/module folder in the pilot slice, index it individually and log `nodesByKind.route`, flagging any zero-route package that has known REST-annotation usage (grep-verified) as a detection-gate miss requiring manual attention.
