# Hard-test eval playbook (wild-type / CoE class)

**Purpose:** Run **one real repo at a time** through: hand gold → platform generate → compare / RCA.  
**Isolation:** This track is **evaluation only**. It must **not** drive coding-agent catalogue patches in the same session. Findings go to **`coe-lab-hard-test-backlog.md`**, not silent detector edits.

**Owner of track:** human eval (Gowri / eval agent).  
**Platform implementers:** may later pick backlog rows; they must **not** open gold while implementing.

---

## 0. Isolation (non-negotiable)

| Actor | May do | Must not |
|---|---|---|
| **This hard-test session** | Read spikes, author/update wild gold under `coe-lab/gold/`, run `run-slice`, write backlog + findings docs under `coe-lab/` | Edit `pipeline/src/**` catalogues/detectors to match gold in this session |
| **Coding agents** | Implement from **backlog rows** after human prioritization | Open `coe-lab/gold/` or hard-test gold while coding |
| **`pipeline/test`** | Existing regression suite | Depend on new wild gold files for green CI (optional gated tests only, later) |

Outputs of scans live under **`tmp/coe-lab-hard-tests/<package-id>/`** (gitignored via `tmp/`).  
Gold lives only under **`coe-lab/gold/calm/<package-id>/`**.  
Source clones stay under **`spikes/<name>/repo`** (disposable; not gold).

---

## 1. One-repo cycle (always this order)

```text
0. Pick package from hard-test-repo-registry.md (status: queued)
1. TASK A — Review source → hand-author gold CALM
2. TASK B — Run platform → generated CALM
3. TASK C — Compare → strengths / weaknesses / issues → backlog (+ RCA if warranted)
4. Mark package status: gold-done | compared | blocked
```

**Do not** start repo N+1 until repo N has at least a backlog entry summarizing compare (even if gold is partial).

---

## 2. TASK A — Hand-author gold CALM

### A.1 Scope the package

Before writing JSON, record in registry + gold metadata:

| Field | Example |
|---|---|
| `package-id` | `waltz-data`, `boa-userservice`, `ghostfolio-api` |
| Source root(s) | `spikes/waltz/repo/waltz-data` |
| Scan mode | single-root \| multi-root (list roots) |
| Grain | class/file \| module |
| Intent | routes + DBs + key connects + controls (what we *judge*) |
| Out of scope | e.g. “not every entity”, command-bus, frontend |

Prefer **deep slice** over whole monorepo (Fineract gold model: charge/core, not 6618 files in one gold).

### A.2 Authoring rules

1. Derive from **source** (grep annotations, imports, routes) — **never** copy `generated/` or platform output into gold.  
2. CALM 1.2: `$schema`, `unique-id`, `name`, `description`, `nodes`, `relationships`.  
3. Metadata: `x-lab-gold-source: hand-authored`, `x-lab-wild-repo`, `x-lab-module` / roots, `x-lab-scan-mode`, optional `x-lab-terminal-grain`, `x-lab-coverage` / `x-lab-out-of-scope`.  
4. `calm validate -u pipeline/dist/rules/control-url-mapping.json -a …` → **0 errors**.  
5. Document in package README or parent `WILD_GOLD.md` note if multi-package.

### A.3 Exit A

- [ ] `coe-lab/gold/calm/<package-id>/architecture.calm.json` exists  
- [ ] `calm validate` 0 errors  
- [ ] Registry row: gold status `done`  
- [ ] Scope/out-of-scope written  

---

## 3. TASK B — Platform generate

### B.1 Commands (template)

```bash
cd pipeline && npm run build   # if needed

# Single root
NODE_OPTIONS='--max-old-space-size=8192' \
  node dist/orchestration/run-slice.js \
  <absolute-or-repo-relative-package-root> \
  --out ../tmp/coe-lab-hard-tests/<package-id>

# Multi-root (only if gold/registry says multi-root)
NODE_OPTIONS='--max-old-space-size=8192' \
  node dist/orchestration/run-slice.js \
  <root1> <root2> \
  --out ../tmp/coe-lab-hard-tests/<package-id>
```

Optional: copy gen to `coe-lab/generated/<package-id>/` for validate-calm-pair (generated is gitignored).

### B.2 Capture run metadata

Write `tmp/coe-lab-hard-tests/<package-id>/RUN.md`:

- command, roots, date, git commit of codescanner if known  
- graphify status, unit counts, silenceFlags, arch coverage  
- calm validate result on generated  

### B.3 Exit B

- [ ] `architecture.calm.json` + `typed-facts.json` + `coverage-report.json` present  
- [ ] Generated `calm validate` recorded (pass/fail)  
- [ ] RUN.md filled  

---

## 4. TASK C — Compare, strengths/weaknesses, backlog

### C.1 Compare layers (always report all)

| Layer | How | Pass means |
|---|---|---|
| **L0** | `calm validate` gold + gen | Schema-valid |
| **L1** | Paths, node kinds, controls presence vs gold (semantic; not unique-id equality) | Units gold cares about present |
| **L2** | Connects / architecture story vs gold (type pair and/or endpoint if used) | Story gold asserts |
| **L3** | Silence / completeness honesty | S1/S2 appropriate |

Use `validate-calm-pair.mjs --package <id> [--require-l2]` when package is registered; otherwise manual table.

### C.2 Write finding note (short)

`coe-lab/docs/findings/<package-id>-gold-vs-platform.md` (create `findings/` as needed):

1. Scorecard table (L0–L3)  
2. Strengths (what platform got right)  
3. Weaknesses / gaps (mechanism class, not “fix Fineract”)  
4. Issues / errors (crashes, schema fail, timeouts)  
5. RCA only if **errors** or **systematic miss** (1 page max): symptom → chain → not-causes  
6. Claim language: allowed vs forbidden after this sample  

### C.3 Backlog capture (mandatory)

Append rows to **`coe-lab/docs/coe-lab-hard-test-backlog.md`**:

| Fields | |
|---|---|
| `id` | HT-001, … |
| `package-id` | |
| `severity` | blocker / high / medium / low / note |
| `class` | mechanism (R2, C-call, …) \| eval \| crash \| gold-ambiguity \| env |
| `summary` | one line |
| `detail` | pointer to finding section |
| `for-platform?` | yes → later coding backlog candidate / no (gold fix / OOS / env) |

**Do not** open a detector PR from this session to clear HT rows.

### C.4 Exit C

- [ ] Finding note committed (or ready)  
- [ ] ≥1 backlog row (even “no new issues — L1 strong L2 N/A”)  
- [ ] Registry status `compared`  
- [ ] Human brief: 5–10 line summary  

---

## 5. Agent / human roles

### Eval agent prompt (hard-test)

```text
You are a CoE HARD-TEST EVAL agent (one wild-type package at a time).

You MAY:
- Read spikes/<name>/repo source for gold authoring
- Write coe-lab/gold/calm/<package-id>/
- Run pipeline run-slice; write tmp/coe-lab-hard-tests/
- Write coe-lab/docs/findings/*, coe-lab/docs/coe-lab-hard-test-backlog.md, registry updates

You MUST NOT:
- Edit pipeline/src/** (catalogues, detectors, builders) to match gold
- Edit pipeline/test to depend on this gold for suite green
- Start the next package before this package has a backlog summary
- Bootstrap gold from generated CALM

Follow coe-lab/docs/hard-test-eval-playbook.md tasks A → B → C.
Package under test: <package-id> (only).
```

### Platform agent prompt (later, separate session)

```text
You implement pipeline/ from prioritized HT-* backlog rows.
Do NOT open coe-lab/gold/ to invent rules.
Use synthetic fixtures + generic mechanisms only.
```

---

## 6. Related docs

| Doc | Role |
|---|---|
| [`hard-test-repo-registry.md`](./hard-test-repo-registry.md) | Which clones / package slices / status |
| [`coe-lab-hard-test-backlog.md`](./coe-lab-hard-test-backlog.md) | Issues from compares |
| [`ISOLATION.md`](../ISOLATION.md) | Gold vs implementers |
| [`wild-type-gold-policy.md`](./wild-type-gold-policy.md) | Wild gold location rules |
| [`validation-approach-vnext.md`](./validation-approach-vnext.md) | L0–L5 |
| [`multi-root-l2-protocol.md`](./multi-root-l2-protocol.md) | Multi-root claims |
