# Phased CALM Extraction Process

A repo-agnostic, code-graph-tool-agnostic process for turning an existing codebase into
a complete, evidence-grounded `architecture.calm.json` using the `/calm` skill
(`calm init-ai -p <provider>`). Six small phases instead of one mega-prompt — each
phase is cheap enough to be its own separate invocation if a given model needs that.

## The four non-negotiables (keep this list short, on purpose)

1. **Enumerate before you judge.** Never let node/relationship decisions happen in the
   same breath as discovery — Phase 1 exists so nothing gets silently skipped by
   implicit scoping (measured failure: a code-graph-assisted run dropped 3 real domain
   packages it never explicitly looked at).
2. **Every node and relationship needs a real, nameable piece of evidence** — a file,
   symbol, import, call, or config key you can point to. No evidence, no construct.
3. **Never point a `requirement-url` (or any URL) at something you haven't confirmed
   resolves.** Use a local file + `--url-to-local-file-mapping` instead — see Phase 4.
4. **Actually run `calm validate` and read its output.** "This looks schema-correct"
   is not validation.

Everything else below is guidance and examples, not hard rules — leave room for the
model to use judgment on naming, granularity, and what's worth modeling in detail.

## Best practices for using a code-graph tool (CodeGraph, Graphify, CodeQL, etc.)

Synthesized from this tool's own repeated guidance (real, observed instructions, not
guessed) plus what tonight's measured A/B run actually showed:

1. **It's a targeted symbol/question tool, not a repo browser.** `codegraph_explore`
   answers "what does X do and what calls it," not "list everything in this repo."
   Don't ask a code-graph tool to enumerate a whole codebase from nothing — that's
   what Phase 1 below uses plain directory listing for. Feed the code-graph tool
   names you already have (from that listing, or from what you've read so far);
   let it tell you the call paths and blast radius around them.
2. **Batch symbol names into one query, don't loop one-symbol-per-call.** The tool's
   own guidance is explicit about this ("call ONCE with the relevant names in one
   query... cheaper and more complete than a grep+Read loop"). Every extra call is
   extra turns and tokens for no extra ground truth — tonight's measured cost gap
   (54% slower, 49% more expensive without a code-graph index) is largely turns and
   redundant re-reading, not the source text itself.
3. **Its returned source counts as already read — don't re-Read the same file.**
   If a code-graph query already returned a file's verbatim, line-numbered source,
   treat it as read; a second `Read` call on the same file is pure waste.
4. **Lean on it hardest for Phase 3 (relationships), where it earns its keep most.**
   Its real differentiator over grep is dynamic-dispatch/interface-to-impl edges —
   the cross-module wiring that goes through dependency injection or interfaces
   rather than a literal string match. A plain grep loop structurally can't find
   these; a code-graph tool's call-path output can.
5. **A structural index is not a substitute for Phase 1's enumeration.** This is
   the actual, measured cause of tonight's completeness gap: given an index and a
   single broad prompt, the agent explored less broadly than when forced to read
   everything by hand, and silently missed three real domain packages. The fix
   isn't avoiding the tool — it's not skipping the explicit "list every top-level
   package, from real files, before deciding anything" step just because an index
   exists to make deciding feel easy.
6. **If the tool offers a "sync"/incremental-reindex command, use it before a real
   run, not after.** A stale index answering confidently about code that's since
   changed is worse than no index — it looks authoritative and isn't.

## Setup (once per repo, no LLM cost)

```bash
# whichever code-graph tool is actually available — this process doesn't care which
codegraph init && codegraph sync        # or: graphify ...   or: codeql database create ...

npm install -g @finos/calm-cli          # if not already installed
calm init-ai -p <claude|copilot|kiro|codex>
```

If this repo's `.claude/skills/calm/calm-prompts/control-creation.md` still has the
fabricated-URL bug (check: does it show fictional-domain examples with no mention of
`--url-to-local-file-mapping`?), apply `../calm-skill-patches/apply-patch.sh` first.

---

## Phase 1 — Inventory (cheap; fixes the completeness gap)

```
First, list every top-level package, module, or directory under {scope} using a
plain directory listing (find/ls/Glob) — not your code-graph tool, which answers
symbol questions, not "what exists here." For each one, open enough of it (or query
your code-graph tool by the real names you now have) to write a one-line summary of
what it actually contains, based on real symbols/files — not inference from the
directory name alone. Do not skip anything, including things that look like
plumbing, infrastructure, generated code, or config — list them too, even if you
plan to mark them out of scope in the next phase.

Output a plain checklist: `- {name}: {one-line summary}`. Do not create any CALM
constructs yet.
```

## Phase 2 — Node authoring

```
For each item in the Phase 1 checklist, decide one of:
  (a) its own CALM node (service/database/queue/etc.)
  (b) part of an already-decided node — say which one and why
  (c) out of scope (tests, generated code, build tooling, vendored deps) — say why

For every node you create, cite the real file/symbol/directory evidence that
justifies it. Follow node-creation.md's schema exactly — required-property set,
node-type from the enum or a clear custom string, kebab-case unique-ids.

Do not create relationships or interfaces yet.
```

## Phase 3 — Relationships + interfaces, evidence-gated

```
For each node, use your code-graph tool's call-path / import / reference lookup
(or direct source reading if no such tool exists) to find REAL edges to other
already-defined nodes. Only emit a relationship backed by a concrete import, call,
route registration, or config reference you can name — cite it in the relationship's
description or in your own notes. If you can't find one, leave it out; do not infer
a plausible-sounding connection to fill a gap you'd expect a real system to have.

Add interfaces only for endpoints/ports/hosts you can point to in real source.
Pick exactly one of interface-definition or interface-type per interface — never
mix fields from both (see interface-creation.md's oneOf constraint).

Use relationship-creation.md's four types deliberately: connects (service-to-service/
database), interacts (actor-to-system), deployed-in (containment), composed-of
(logical grouping) — not everything is `connects`.
```

## Phase 4 — Controls / standards, with the URL fix baked in

```
For each real security/compliance mechanism you find in source (auth checks,
encryption, tenant isolation, RBAC, audit logging, etc.), write a control entry
per control-creation.md's schema.

For every `requirement-url` you write, you MUST also:
  1. Generate a real local requirement.json file in this output directory describing
     that requirement (JSON Schema 2020-12 shape is fine, doesn't need to be elaborate).
  2. Add an entry to url-mapping.json in this directory mapping the requirement-url
     you used to that local file's path.

Do not point requirement-url at any external domain you have not independently
confirmed resolves (fetch it and check, don't assume). If in doubt, use `https://`
with the `.invalid` TLD — an IANA-reserved domain (RFC 2606) guaranteed to never
resolve, e.g. `https://{repo-name}.invalid/controls/{control-id}/requirement.json`
(calm-cli only accepts http/https schemes for this field — a made-up scheme like
`internal://` fails a different validation check) — paired with the local file +
mapping. Never a real-looking vendor-domain URL that isn't actually real.

Decide deliberately WHERE a control attaches (architecture/node/flow level) per
control-creation.md's inheritance model — more specific overrides general, controls
are additive across levels. Don't duplicate the same control at every level "to be safe."
```

## Phase 5 — Self-validate loop

```
Run: calm validate -a {output-file} -u url-mapping.json -f pretty

Read the actual output. If hasErrors is true, fix the named issues and re-run.
Repeat until hasErrors: false and hasWarnings: false (or warnings are explicitly
acceptable — say which and why). Show me the final validator output, not a summary
of what you expect it to say.
```

## Phase 6 — Optional, kept OUT of calm.json

```
If a business-flow or sequence view is wanted: use CALM's own `flows` construct
(flow-creation.md) — it's a lightweight ordered list of relationship-unique-ids
already defined above, not a place for full sequence-diagram detail (payloads,
branches, alternate paths). If you need that level of detail, produce a separate
C4-style or PlantUML/Mermaid sequence diagram as its own artifact instead of
overloading calm.json's flows construct with it.
```

---

## Notes on running this against a different model/provider

- Every prompt above is plain instructions, not Claude-specific syntax — should
  transfer to Copilot/Kiro/Codex unchanged.
- If a given model handles the phases well in one long conversation, keep them
  together. If it starts skipping steps, drift, or re-merge phases under context
  pressure, split each phase into its own separate invocation — cheap to do, and
  the phases were designed to be self-contained enough for that.
- If output quality is inconsistent across runs on the same repo, try pinning a
  specific, capable model explicitly (e.g. `--model <model-id>`) rather than adding
  more guardrail text — a capability gap looks like a compliance gap but isn't fixed
  the same way.
