# CALM AI Toolkit

Turn any codebase into a complete, validated `architecture.calm.json` — using FINOS
`@finos/calm-cli`'s `/calm` skill, driven by a phased prompt process instead of one
"build me the architecture" prompt.

On its own, the `/calm` skill is a schema reference, not a workflow. Handed a single
broad prompt it produces good-but-inconsistent results: a fabricated (404)
control-requirement URL on every run, and whole subsystems silently skipped. This
toolkit is a **process** (`PHASED_EXTRACTION_PROCESS.md`) plus a **one-file patch**
(`calm-skill-patches/`) that fix both, repo- and language-agnostically.

---

## Quickstart

You need: Node.js, and an AI coding assistant that supports `calm init-ai`
(Claude Code, GitHub Copilot, Kiro, or Codex).

```bash
# 1. install the CLI and scaffold the skill into your repo
npm install -g @finos/calm-cli
cd /path/to/your-repo
calm init-ai -p claude          # or: copilot | kiro | codex

# 2. apply the patch (fixes the fabricated-URL bug in the generated skill)
/path/to/calm-ai-toolkit/calm-skill-patches/apply-patch.sh /path/to/your-repo

# 3. (optional but recommended) set up a code-graph tool for ~20% lower cost
codegraph init && codegraph sync    # or graphify / codeql — the process doesn't care which
```

Then open your AI assistant in the repo and run the phases from
**`PHASED_EXTRACTION_PROCESS.md`** — either paste them one after another in a single
session, or run each as its own prompt if the model drifts. In short, the phases are:

0. **Query the graph** *(if you set up a code-graph tool)* — a few bulk queries against
   its database for the module list and the whole cross-module edge graph, up front.
1. **Inventory** — every module/folder → a one-line-each checklist (from Phase 0, or a
   plain directory listing if you have no tool).
2. **Nodes** — one CALM node per checklist item (or an explicit merge/drop reason).
3. **Relationships + interfaces** — map Phase 0's edge graph to CALM edges; only ones you can back with a real import/call/binding.
4. **Controls** — each with a local `requirement.json` + `url-mapping.json` entry (never a fake URL).
5. **Validate** — run `calm validate -a <file> -u url-mapping.json`, fix, repeat until clean.
6. *(optional)* **Flows** — CALM's lightweight `flows` construct; detailed sequence diagrams stay a separate artifact.

Output: `<repo>.architecture.json` (+ `controls/` + `url-mapping.json`), passing
`calm validate` with zero errors.

**Run it twice.** A single run's node/relationship counts aren't "the answer" — if two
runs diverge by more than ~10-15%, tighten Phase 1's checklist (see the process doc).

---

## What's in here

| File | What it is |
|---|---|
| `PHASED_EXTRACTION_PROCESS.md` | The reusable prompt pack — the six phases above, in full, with the rules and rationale. Copy-paste per repo. |
| `calm-skill-patches/control-creation.md` | Drop-in replacement for the skill's generated `calm-prompts/control-creation.md`, fixing the fabricated-URL bug at its source. |
| `calm-skill-patches/apply-patch.sh` | Copies that patched file over a repo's freshly-generated `calm init-ai` output (backs up the original). |

## When to use this

- **Good fit:** you have an existing codebase and want a high-level, service-and-
  connection architecture model in CALM, fast, without hand-authoring it.
- **Turn on a code-graph tool if:** you'll run this repeatedly or across many repos —
  it's a steady ~20% cost / ~40% token saving (details below). For a genuine one-off,
  the setup isn't worth it.
- **Not what this is:** a deterministic, regression-testable, CI-gating extraction
  pipeline. This is LLM-driven summarization — reproducible on *what gets covered*,
  not on exact node granularity between runs.

---

## Background: the two bugs this fixes

1. **The fabricated-URL bug is example-following, not vague hallucination.** The
   skill's `control-creation.md` makes `requirement-url` required on every control,
   and every worked example in it uses a fictional domain (`schemas.company.com`). The
   model pattern-matches that convention and substitutes the real target repo's real
   domain — producing a URL that looks resolvable but 404s. The fix already exists in
   the CLI (`--url-to-local-file-mapping`, documented for exactly this "resources live
   in the repo but aren't public" case); the skill just never points the agent at it.
   The patch makes local requirement files + a URL mapping the default taught pattern,
   using the RFC 2606 `.invalid` TLD for placeholder URLs.

2. **A single broad prompt drops whole subsystems.** Given a code-graph index and one
   "build the architecture" prompt, runs explored *less* broadly and missed real
   subsystems entirely — the index makes deciding feel safe before enumeration is
   done. The fix is making enumeration (Phase 1) its own explicit step, done the same
   way with or without a code-graph tool, before any node decision.

Keeping the rule list short is deliberate: `calm init-ai` targets four different
models, and a long wall of "NEVER do X" gets processed differently by each (some
over-comply and tank recall, others start ignoring it). The process keeps to five
load-bearing rules and leaves the rest as guidance.

## Background: does a code-graph tool actually help?

Isolated test — same patched skill, same phased prompt, only the code-graph tool
varies, across three repos of very different size and style:

| Repo | | Cost | Tokens (cache-read) | Turns | Nodes / Rels | valid? |
|---|---|---|---|---|---|---|
| spring-petclinic (30 files, fits in context) | with cg | $1.19 | 1.48M | 61 | 8 / 7 | 0 |
| | no cg | $1.52 | 2.49M | 77 | 7 / 6 | 0 |
| fineract-core (~836 files) | with cg (2 runs) | $2.18-2.29 | 3.9-4.1M | 56-62 | 24/35, 16/26 | 0 |
| | no cg | $2.86 | 6.73M | 90 | 23 / 35 | 0 |
| DI-heavy repo (~575 files, Guice) | with cg | $2.07 | 3.76M | 48 | 21 / 33 | 0 |
| | no cg | $2.66 | 6.61M | 63 | 20 / 50 | **3** (dangling node refs) |

**Consistent across all three:** a code-graph tool = **~20% lower cost, ~40% fewer
tokens, ~25% fewer turns** — a roughly fixed discount that does *not* scale with repo
size, does *not* vanish when the repo fits in context, does *not* grow with
dependency-injection density. **No** reliable speed benefit, **no** completeness or
accuracy benefit. One weak signal (N=1): the no-codegraph DI-heavy run over-produced
relationships and referenced 3 nodes it never defined; the codegraph run was sparser
but valid.

A vendor benchmark for one of these tools reports ~44% cost / ~62% token savings —
that's for targeted code *navigation* (a file-reading baseline flailing through 30-40
tool calls chasing one call path). Architecture extraction is a survey task with far
less of that waste, hence roughly half the payoff here.

**Caveat: these numbers predate Phase 0.** The measured runs only used the
symbol-question interface, loosely, in Phase 3 — they never ran the bulk database
queries that get the whole module list and cross-module edge graph in a handful of
statements. Phase 0 (added after this measurement) should push the payoff higher and
cut turns further; not yet re-measured.

### Bugs fixed — before/after (fineract-core, ~836 files)

| | original broad prompt, unpatched skill | **this toolkit** |
|---|---|---|
| Nodes | 13 (missed 3 subsystems) | **24** (all present) |
| Relationships | 19 | **35** |
| `calm validate` errors | 12 (fabricated URLs) | **0** |
| Cost | $1.82 | $2.18 |

The ~20-30% cost premium over the broken version buys correctness — and is a fraction
of the cost of getting completeness by brute-force reading every file with no
code-graph tool ($3.55).

## Status

Exploratory toolkit, evaluated as a complement to — not a replacement for — a
deterministic architecture-extraction pipeline. Lives outside `pipeline/`
deliberately: different tool, different job (fast LLM-driven summarization vs.
deterministic, regression-tested extraction).
