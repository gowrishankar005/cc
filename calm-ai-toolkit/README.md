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

2. **A single mega-prompt trades completeness for a code-graph index's efficiency.**
   Measured, not assumed: with a code-graph index, the same task ran 54% faster and
   49% cheaper — genuinely worth having — but silently dropped 3 real domain packages
   that a raw-source-reading run correctly found. The fix isn't "don't use code-graph
   tools," it's "make enumeration its own explicit, ungapped step before judgment,"
   which is why the process below starts there.

## On guardrails: keep the non-negotiables short

`calm init-ai` targets four different providers/models (Claude, Copilot, Kiro, Codex).
A long wall of "NEVER do X" rules gets processed differently by each — some models
over-comply (refuse to model anything they're not 100% sure of, tanking recall), others
start ignoring rules once the list gets long. `PHASED_EXTRACTION_PROCESS.md` keeps to
four sharp, load-bearing rules (enumerate first, cite evidence, never fake a URL, always
actually run the validator) and leaves everything else as guidance/examples, not hard
constraints. If a given model still doesn't comply well, the fix is usually pinning a
more capable model for the invocation (`--model <a strong, recent model>`) or splitting
a phase into its own separate prompt/call rather than adding another rule to the pile.

## Verified (2026-09-10, Apache Fineract's fineract-core module, real runs)

| | **Condition A** — original single-prompt, with codegraph, unpatched skill | **Condition B** — original single-prompt, no codegraph | **Condition A, refined** — patched skill + phased prompt, with codegraph |
|---|---|---|---|
| Nodes | 13 (missed 3 real domains) | 25 | **24** (all domains present) |
| Relationships | 19 | 38 | **35** |
| `calm validate` errors | 12 (fabricated URLs) | 12 (fabricated URLs) | **0** |
| Cost | $1.82 | $3.55 | **$2.18** |
| Duration | 10.3 min | 22.6 min | **13.5 min** |

("Condition A" / "Condition B" are this session's own names for the two arms of the
original with/without-codegraph comparison — kept here so the labels match across
both the session's working notes and this file.)

The refined process closes both real gaps found in the initial comparison — the
completeness loss from skipping explicit enumeration, and the fabricated-URL bug —
while keeping most of codegraph's cost/speed advantage over reading raw source
(39% cheaper, 40% faster than the no-codegraph run, for a comparably complete model).

## Status

Exploratory toolkit, not a Weaver capability. Lives outside `pipeline/` deliberately —
this is a different tool for a different job (fast, LLM-driven architecture summarization
from an existing codebase), evaluated as a complement to, not a replacement for, Weaver's
deterministic pipeline. See the session's own comparison notes for what each is actually
good at.
