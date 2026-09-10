# CALM AI Toolkit

A reusable process + patch for turning `@finos/calm-cli`'s `calm init-ai` skill into
something that reliably produces a complete, evidence-grounded `architecture.calm.json`
from a real codebase — across repos, languages, and code-graph tools.

Born from a real, measured comparison (2026-09-10, Bank of Anthos + Apache Fineract):
the `/calm` skill on its own is a schema reference library, not a workflow. Handed a
single "build me the architecture" prompt, it produced good-but-inconsistent results —
a real, fabricated (404) control-requirement URL on *every* run, and a real completeness
gap (3 genuine domain packages silently skipped) on the run that used a code-graph index.
Both are traceable to specific, fixable causes — not "LLMs are unreliable," a mechanism
class each, same discipline this project applies everywhere else.

## What's here

- **`PHASED_EXTRACTION_PROCESS.md`** — the actual reusable prompt pack. Six small,
  ordered prompts instead of one mega-prompt. Copy-paste per repo; parametrized by
  `{scope}` and whatever code-graph tool is actually available.
- **`calm-skill-patches/control-creation.md`** — a drop-in replacement for
  `.claude/skills/calm/calm-prompts/control-creation.md` that fixes the fabricated-URL
  bug at its real source (see that file's own header for the diagnosis).
- **`apply-patch.sh`** — copies the patched file over a repo's freshly-generated
  `calm init-ai` output.

## Two real findings this toolkit exists because of

1. **The fabricated-URL bug is not vague hallucination — it's example-following.**
   `control-creation.md`'s schema makes `requirement-url` required on every control,
   and *every worked example in the file* uses a fictional-but-plausible domain
   (`schemas.company.com`). The model doesn't invent randomly — it pattern-matches
   the skill's own convention and substitutes the real target repo's real domain,
   producing something that looks resolvable but 404s. The fix already exists in the
   CLI (`--url-to-local-file-mapping`, documented in `calm-cli-instructions.md` for
   exactly this "resources live in the repo but aren't public yet" case) — the skill
   just never tells the agent to use it. Patched below.

2. **A single mega-prompt with a code-graph index silently drops whole subsystems.**
   Measured, not assumed: given an index and one broad "build the architecture"
   prompt, the run explored *less* broadly than a raw-source-reading run and missed 3
   real subsystems entirely — the index makes deciding feel safe before enumeration is
   done. The fix isn't "don't use code-graph tools," it's "make enumeration its own
   explicit, ungapped step before any node decision," which is why the process below
   starts there. (The initial comparison also suggested a large speed/cost win from
   the index; an isolated re-test — same prompt, same skill, only the index varying —
   put the real, repeatable payoff at ~20% cost / ~40% tokens, no speed change. See
   the Verified section below.)

## On guardrails: keep the non-negotiables short

`calm init-ai` targets four different providers/models (Claude, Copilot, Kiro, Codex).
A long wall of "NEVER do X" rules gets processed differently by each — some models
over-comply (refuse to model anything they're not 100% sure of, tanking recall), others
start ignoring rules once the list gets long. `PHASED_EXTRACTION_PROCESS.md` keeps to
five sharp, load-bearing rules (enumerate first; one node per inventory item; cite
evidence; never fake a URL; validate for real including dangling-node-ref checks) and
leaves everything else as guidance/examples, not hard constraints. If a given model
still doesn't comply well, the fix is usually pinning a more capable model for the
invocation (`--model <a strong, recent model>`) or splitting a phase into its own
separate prompt/call rather than adding another rule to the pile.

## Verified (2026-09-10, real runs)

### The two bugs, fixed (Apache Fineract's fineract-core module, ~836 files)

| | original single-prompt, unpatched skill, with codegraph | **refined: patched skill + phased prompt, with codegraph** |
|---|---|---|
| Nodes | 13 (missed 3 real subsystems) | **24** (all present) |
| Relationships | 19 | **35** |
| `calm validate` errors | 12 (fabricated URLs) | **0** |
| Cost | $1.82 | $2.18 |
| Duration | 10.3 min | 13.5 min |

The refined process closes both gaps — the completeness loss from skipping explicit
enumeration, and the fabricated-URL bug — for a ~20-30% cost premium over the broken
version. That premium buys correctness; it is a fraction of the cost of getting
completeness by brute-force reading every file with no code-graph tool ($3.55, the
original no-codegraph run).

### Does a code-graph tool actually help? (isolated: same patched skill + phased prompt, only codegraph varies)

| Repo | | Cost | Tokens (cache-read) | Turns | Nodes / Rels | valid? |
|---|---|---|---|---|---|---|
| spring-petclinic (30 files, fits in context) | with cg | $1.19 | 1.48M | 61 | 8 / 7 | 0 |
| | no cg | $1.52 | 2.49M | 77 | 7 / 6 | 0 |
| fineract-core (~836 files) | with cg (2 runs) | $2.18-2.29 | 3.9-4.1M | 56-62 | 24/35, 16/26 | 0 |
| | no cg | $2.86 | 6.73M | 90 | 23 / 35 | 0 |
| DI-heavy repo (~575 files, Guice) | with cg | $2.07 | 3.76M | 48 | 21 / 33 | 0 |
| | no cg | $2.66 | 6.61M | 63 | 20 / 50 | **3** (dangling node refs) |

**Consistent finding across all three:** with a code-graph tool = **~20% lower cost,
~40% fewer tokens, ~25% fewer turns** — a roughly fixed discount that does *not* scale
with repo size, does *not* vanish when the repo fits in context, and does *not* grow
with dependency-injection density. **No** reliable speed benefit, **no** completeness
or accuracy benefit. One weak signal (N=1): on the DI-heavy repo the no-codegraph run
over-produced relationships and 3 referenced nodes it never defined; the codegraph run
was sparser but valid.

A vendor benchmark for one of these tools reports ~44% cost / ~62% token savings — but
that's for targeted code *navigation*, where a file-reading baseline flails through
30-40 tool calls chasing one call path. Architecture extraction is a survey task with
far less of that waste, hence roughly half the payoff here.

## Status

Exploratory toolkit, not a Weaver capability. Lives outside `pipeline/` deliberately —
this is a different tool for a different job (fast, LLM-driven architecture summarization
from an existing codebase), evaluated as a complement to, not a replacement for, Weaver's
deterministic pipeline. See the session's own comparison notes for what each is actually
good at.
