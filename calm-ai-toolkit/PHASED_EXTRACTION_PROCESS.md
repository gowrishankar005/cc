# Phased CALM Extraction Process

A repo-agnostic, language-agnostic, code-graph-tool-agnostic process for turning an
existing codebase into a complete, evidence-grounded `architecture.calm.json` using
the `/calm` skill (`calm init-ai -p <provider>`). Small ordered phases instead of one
mega-prompt — each phase is self-contained enough to be its own separate invocation
if a given model drifts when they're run together.

## The five non-negotiables (kept short on purpose)

1. **Enumerate before you judge.** Discovery and node decisions never happen in the
   same step — Phase 1 exists so nothing is silently skipped by implicit scoping
   (measured failure: runs that decided nodes while exploring dropped whole real
   subsystems they never explicitly listed).
2. **One node per inventory item, or an explicit reason not to.** Phase 1 produces a
   checklist; Phase 2 turns each item into exactly one node, OR merges/drops it with
   a one-line reason. Never split one item into several nodes, never silently drop
   one. This is the single biggest lever on run-to-run consistency (measured: 24 vs.
   16 nodes on identical inputs when granularity was left to judgment).
3. **Every node and relationship needs a real, nameable piece of evidence** — a file,
   symbol, import, call, binding, route, or config key you can point to. No evidence,
   no construct. A sparse graph where every edge is real beats a dense one with
   unverified edges.
4. **Never point a `requirement-url` (or any URL) at something you haven't confirmed
   resolves.** Local file + `--url-to-local-file-mapping` instead — see Phase 4.
5. **Actually run `calm validate` and read its output** — and before you do, confirm
   every relationship references only node ids that exist. "Looks schema-correct" is
   not validation (measured failure: a run emitted relationships pointing at nodes it
   never defined).

Everything else below is guidance and examples, not hard rules — leave the model room
to judge naming, node-type choice, and what's worth describing in detail. Granularity
is *not* in that set anymore: rule 2 governs it.

## What to decide before you start (no LLM cost)

- **Scope of constructs.** Cost scales with output verbosity, not just repo size.
  Decide upfront what you actually need: nodes + relationships is the minimum useful
  model; `controls` / `standards` / `flows` / `patterns` each add real tokens and
  turns. Only ask for the ones you'll use.
- **Scope of the codebase.** Define `{scope}` concretely: for a multi-module repo it's
  the set of module/component directories; for a single-component repo it's the
  immediate sub-folders / packages / namespaces under the source root. Say it in the
  prompt so "top-level" isn't ambiguous.

## Best practices for using a code-graph tool (CodeGraph, Graphify, CodeQL, ...)

Synthesized from these tools' own guidance plus this toolkit's own multi-repo
measurements (spring-petclinic 30 files, a ~575-file DI-heavy repo, an ~836-file
module):

1. **It's a targeted symbol/question tool, not a repo browser.** It answers "what does
   X do, what calls it, what breaks if it changes" — not "list everything here."
   Enumeration (Phase 1) is a plain directory listing, not a code-graph query. Feed
   the code-graph tool names you already have.
2. **Batch names into one query; don't loop one-symbol-per-call.** Every extra call is
   turns and tokens for no extra ground truth.
3. **Its returned source counts as already read.** If a query already returned a
   file's verbatim source, don't `Read` it again.
4. **Lean on it hardest for Phase 3.** Its real edge over grep is indirect wiring —
   interface-to-implementation, dependency injection, dynamic dispatch — that a
   literal text search can't follow.
5. **A structural index is not a substitute for Phase 1.** Given an index, models
   explore *less* broadly, not more — the index makes deciding feel safe before
   enumeration is done. Do Phase 1 the same way with or without a code-graph tool.
6. **Refresh the index before the run, not after.** A stale index answering
   confidently about since-changed code is worse than no index.

**What the measured payoff actually is** (isolated: same prompt, same skill, only the
code-graph tool varies, across three repos of very different size and style):

| | with a code-graph tool |
|---|---|
| Cost | **~20% lower** |
| Tokens processed | **~40% lower** |
| Tool calls / turns | **~25% fewer** |
| Wall-clock speed | no reliable change (faster on small, slower on one large) |
| Completeness / accuracy | no measurable change |
| Run-to-run consistency | no improvement |

It's a roughly *fixed* efficiency discount — it does **not** grow with repo size, does
not vanish when the whole repo fits in context, and does not scale with how much
dependency injection the codebase uses. Worth turning on for repeated / at-scale runs
where token budget compounds; skip the setup for a genuine one-off.

> A vendor benchmark for one of these tools reports ~44% lower cost / ~62% fewer
> tokens — but that's for *targeted code navigation* ("answer this question", "make
> this change"), where a file-reading baseline burns 30-40 tool calls chasing one
> call path. Broad architecture extraction is a survey task with far less of that
> waste to remove, which is why the measured payoff here is roughly half. A more
> code-graph-forced prompt (drop Phase 1's `find`, route Phase 3 entirely through the
> tool) would likely narrow the gap — untested.

## Setup (once per repo)

```bash
# whichever code-graph tool is available — this process doesn't care which
codegraph init && codegraph sync        # or: graphify ... | codeql database create ...

npm install -g @finos/calm-cli          # if not already installed
calm init-ai -p <claude|copilot|kiro|codex>
```

If this repo's generated `control-creation.md` still has the fabricated-URL bug
(fictional-domain examples, no mention of `--url-to-local-file-mapping`), apply
`../calm-skill-patches/apply-patch.sh <repo-path>` first.

---

## Phase 1 — Inventory

```
List every top-level module / package / folder / namespace under {scope} using a
plain directory listing (find/ls/glob) — NOT your code-graph tool, which answers
symbol questions, not "what exists here". For each item, open enough of it (or
query your code-graph tool by the real names you now have) to write a one-line
summary of what it actually contains, from real files/symbols — not inference from
the name alone.

Do not skip anything: include things that look like plumbing, infrastructure,
generated code, config, or glue. List them; you can mark them out of scope in
Phase 2.

Output a plain checklist, one line per item: `- {name}: {one-line summary}`.
This list is a contract: Phase 2 creates at most one node per line. Do not create
any CALM constructs yet.
```

## Phase 2 — Node authoring

```
For each line in the Phase 1 checklist, choose exactly one:
  (a) it becomes one CALM node — give it a unique-id (kebab-case), a node-type
      (from node-creation.md's enum, or a clear custom string), name, description
  (b) it merges into another node you're creating — name that node and say why
  (c) it's out of scope (tests, generated code, build tooling, vendored deps,
      pure config) — say why

Rules:
- Never split one checklist line into multiple nodes.
- Never drop a line silently — every line gets an (a)/(b)/(c) disposition on the record.
- For every node, cite the real file / symbol / directory evidence that justifies it.

Follow node-creation.md's schema exactly. Do not create relationships or interfaces yet.
```

## Phase 3 — Relationships + interfaces (evidence-gated)

```
For each node, find REAL edges to other nodes you defined in Phase 2 — using your
code-graph tool's call-path / import / binding / reference lookup (batch the names),
or direct source reading if no such tool exists. Pay attention to indirect wiring:
dependency injection, interface-to-implementation, plugin/registry dispatch, event
listeners, config-driven targets.

Only emit a relationship backed by a concrete import, call, binding, route
registration, or config reference you can name — put the evidence in the
relationship's description or your notes. If you can't find one, leave it out. Do
not add a plausible-sounding edge just because a real system "would" have it. More
relationships is not a better model.

Every relationship's endpoints — source, destination, actor, container, composed-of
members — MUST be the unique-id of a node you created in Phase 2. If a real edge
points at something you didn't model, go back to Phase 2 and add that node first;
never reference a node that doesn't exist.

Use relationship-creation.md's types deliberately: connects (component-to-component,
component-to-datastore), interacts (actor-to-system), deployed-in (containment),
composed-of (logical grouping). Not everything is `connects`.

Add interfaces only for endpoints / ports / hosts you can point to in real source.
Pick exactly ONE of interface-definition or interface-type per interface — never mix
fields from both (interface-creation.md's oneOf constraint).
```

## Phase 4 — Controls / standards (only if in your construct scope)

```
For each real security / compliance / governance mechanism you find in source
(authentication, authorization, encryption, tenant isolation, audit, input
validation, ...), write a control per control-creation.md's schema.

For every `requirement-url` you write, you MUST also:
  1. Generate a real local requirement.json file in the output directory (a small
     JSON Schema 2020-12 document — it does not need to be elaborate).
  2. Add an entry to url-mapping.json mapping that requirement-url to the local
     file's path.

Never point requirement-url at an external domain you have not fetched and confirmed
resolves. Default to `https://` with the `.invalid` TLD — an IANA-reserved domain
(RFC 2606) guaranteed never to resolve, e.g.
`https://{repo-name}.invalid/controls/{control-id}/requirement.json`. (calm-cli
only accepts http/https for this field; a custom scheme like `internal://` fails a
different check.) Never a real-looking vendor-domain URL that isn't real.

Attach each control deliberately at architecture / node / flow level per
control-creation.md's inheritance model (more specific overrides general, controls
are additive). Don't duplicate the same control at every level "to be safe".
```

## Phase 5 — Self-validate loop

```
First: re-read your own output and confirm every relationship references only node
unique-ids that exist in the nodes array. Fix any dangling reference (add the missing
node, or remove the relationship) before validating.

Then run:  calm validate -a {output-file} -u url-mapping.json -f pretty

Read the actual output. If hasErrors is true, fix the named issues and re-run.
Repeat until hasErrors: false (warnings are acceptable only if you say which and
why). Show the final validator output verbatim, not a summary of what you expect.
```

> **Operational note:** this phase needs the agent to be able to write files and run
> `calm validate`. In a sandboxed / headless run where writes are blocked, the agent
> instead prints every file in its own fenced code block and states the exact
> `calm validate` command; the operator writes the files and runs the loop. Every
> file in the printed set must still be internally consistent (mapping keys match
> requirement-file paths, relationship endpoints match node ids).

## Phase 6 — Optional, kept OUT of calm.json

```
For a business-flow or sequence view: use CALM's own `flows` construct
(flow-creation.md) — a lightweight ordered list of relationship-unique-ids already
defined above, NOT a place for full sequence-diagram detail (payloads, branches,
alternate paths). For that level of detail, produce a separate C4-style or
PlantUML / Mermaid sequence diagram as its own artifact.
```

---

## Verifying the result

- **Run the process at least twice** on the same repo. If node or relationship counts
  differ by more than ~10-15%, rule 2 (one node per inventory item) isn't being
  followed tightly enough — tighten Phase 1's checklist wording and Phase 2's
  disposition requirement, don't just average the runs.
- A single run's counts are not "the answer" — a measured 24-vs-16-node swing on
  identical inputs only surfaced because the run was repeated.

## Running against a different model / provider

- Every prompt above is plain instructions, not Claude-specific syntax — should
  transfer to Copilot / Kiro / Codex unchanged.
- If a model handles the phases in one conversation, keep them together. If it skips
  steps, drifts, or re-merges phases under context pressure, split each phase into its
  own invocation — they're built to be self-contained.
- If output is inconsistent across runs, pin a specific capable model (`--model
  <model-id>`) before adding more guardrail text — a capability gap looks like a
  compliance gap but isn't fixed the same way.
