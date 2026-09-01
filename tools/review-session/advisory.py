#!/usr/bin/env python3
"""advisory.py — T-RT-4: reviewer-assistance advisory layer.

BACKLOG.md's own acceptance wording ("Reviewer-assistance layer (advisory,
off the generation path)"): explains evidence, proposes hypotheses for
flagged unknowns, and drafts catalogue-rule candidates -- NEVER writing
facts. Candidate facts surface only in the review queue; on acceptance
they are recorded as the human's own claim -- the existing card -> answer
-> Decision Record path (examples/README.md), completely unchanged by
this file.

HARD BOUNDARY (`OOS_Registry.md`'s `OOS-llm-core-path`, revisit trigger
"Never"): this file is never imported by
`pipeline/src/orchestration/run-slice.ts` or anything in its call graph --
same offline-only discipline `suggest-rules.ts` and `draft_tier_b.py`
already established for this codebase.

WHY THIS IS NOT draft_tier_b.py: `draft_tier_b.py` (T-FS-1, Tier B) is
allowed to draft an actual Decision Record + Override pair -- still
human-gated by `apply.py`, but a real *fact draft* all the same, scoped to
residuals whose evidence clears a bar. T-RT-4's own acceptance text says
"never writing facts" -- a stricter boundary than that. This file's
guardrail (`parse_and_validate_response`) therefore rejects ANY response
shaped like a decision/override outright, and this module never touches
`drafts/decisions` or `drafts/overrides` at all -- not even to write one.
Its only outputs are:

  1. An advisory block of prose (an explanation + hypotheses) attached to
     a residual's own entry in `residuals.json` as an additive `advisory`
     field -- same discipline `consequence.py` already established for
     its own additive `consequence` field (`residuals-schema.json`
     updated to match). Surfaced to the human alongside the residual's
     existing choice card in the review queue; never acted on
     automatically, never counted as a second, independent corroborating
     signal for a hard-gated fact (a human accepting a hypothesis by
     picking a card option is ONE human judgement, not two -- same rule
     this lane's README already states for Tier B).

  2. Optionally, ONE catalogue-rule candidate per residual, appended to
     `advisory/catalogue-rule-candidates.json` in the SAME `ProposedRule`
     shape `suggest-rules.ts` already writes to `rules/proposed-updates.json`
     (`rule-schema.ts`'s `CatalogueRule` fields + `rationale`/`proposedAt`/
     `status: "proposed"`) -- reusing the existing catalogue lane (this
     directory's own README rule 11: "Unmapped signal clusters go through
     the catalogue lane... never an auto-merge into signal-catalogue.yml")
     rather than inventing a second promotion mechanism. Never merged into
     `signal-catalogue.yml` by this file or any other code path here.

  3. An append-only episode log (`advisory/episodes.json`) recording,
     for EVERY residual processed regardless of outcome: the model name
     sent to the API (its "version"), the input context actually given to
     it (the evidence refs used -- not a duplicate of the raw text), a
     timestamp, and the outcome. "Logs each episode as a candidate for a
     deterministic rule": a recurring pattern across episodes (the same
     trigger/class producing the same kind of catalogue-rule-candidate
     repeatedly) is itself the evidence a future `signal-catalogue.yml`
     row would cite -- this file does not attempt that aggregation, only
     the durable log it would be computed from.

T-1 (AGENT_TASKS_Residual_Assist_Redesign.md, 2026-08-23): backend is the
`claude` CLI only, deliberately not a raw `ANTHROPIC_API_KEY` from the
environment -- this project's own target-customer profile (fintechs)
doesn't leave API keys in environment variables for an LLM to pick up
(owner directive, 2026-08-23); the realistic path is an already-
authenticated coding-assistant CLI, same as draft_tier_b.py. No `claude`
CLI on `PATH` -> reports what would be attempted, writes nothing (same
convention `suggest-rules.ts` already uses for "LLM backend optional").
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import llm_common  # noqa: E402
from llm_common import _call_llm, _llm_backend_available, _strip_markdown_json_fence  # noqa: E402

MODEL = llm_common.DEFAULT_MODEL

SYSTEM_PROMPT = """You are the reviewer-assistance advisory layer for a Weaver
residual review session. You are ADVISORY ONLY.

You never decide. You never write a Decision Record or an Override. You
never propose a decision/override pair, a node_add, a relationship_add, a
type_change, or any other fact. Your entire output is explanation and
hypotheses for a human to weigh -- nothing you say is applied
automatically, and nothing you say counts as a second, independent
corroborating signal for a hard-gated fact (a human accepting your
hypothesis by picking a card option is ONE human judgement, not two).

INPUTS you may read for this residual, and nothing else:
  - residuals.json entry for this residual ID
  - evidence/packs.json entries referenced by this residual's own unit ids
  - evidence/unit-index.json entries for the specific unit ids involved

HARD RULES (violating any of these means: say so plainly in "explanation",
propose no hypotheses, and leave catalogue_rule_candidate null):
  1. Never introduce a node, relationship, unit id, file path, or line
     number that does not already appear in your inputs.
  2. Never claim confidence beyond what the evidence supports -- if the
     evidence is thin, say so; do not manufacture a hypothesis to fill a
     gap.
  3. You may optionally propose ONE catalogue-rule candidate -- a
     candidate row for signal-catalogue.yml's rule table (fields: id,
     language, framework, matchSignal, matchSource, category, weight,
     calmNodeType, rationale) -- ONLY if this residual's own evidence
     names a raw signal (a decorator, annotation, or framework construct)
     that the existing catalogue plainly does not cover. This is a
     PROPOSAL for a human to review and manually merge -- never assume it
     will be accepted, and never claim it already IS a catalogue rule.
  4. Output format is fixed JSON, EXACTLY these top-level keys, nothing
     else:
     {"explanation": "<1-3 sentences, plain language, evidence-only>",
      "hypotheses": ["<hypothesis 1>", "<hypothesis 2>", ...],
      "catalogue_rule_candidate": <object per rule 3, or null>}
     Never include a "decision" key or an "override" key -- those belong
     to a different, stricter-gated tool (Tier B drafting), not this one.
     No prose outside these three fields.

You are being run on ONE residual for one advisory episode. Do not
summarize or comment on residuals outside this one."""


def build_advisory_prompt(residual: dict, unit_index: dict, packs: dict) -> str:
    """Pure, testable -- same INPUTS-only assembly discipline
    draft_tier_b.py's build_user_prompt already established (scoped to
    this residual's own unit ids only, nothing else leaked into the
    prompt). Delegates to llm_common.build_evidence_prompt -- the shared
    implementation both files (and dossier.py) now call."""
    return llm_common.build_evidence_prompt(residual, unit_index, packs)


REQUIRED_ADVISORY_KEYS = {"explanation", "hypotheses", "catalogue_rule_candidate"}
REQUIRED_CANDIDATE_FIELDS = {"id", "language", "framework", "matchSignal", "matchSource", "category", "weight", "calmNodeType", "rationale"}
VALID_MATCH_SOURCES = {"native-route", "decorator", "call", "field-type", "extends"}
VALID_CATEGORIES = {"http-entry-point", "framework-bootstrap", "persistence", "messaging", "folder-convention", "security-control", "resilience"}
VALID_CALM_NODE_TYPES = {"service", "database", "topic"}
_EVIDENCE_REF_RE = re.compile(r"\b([\w./-]+\.[a-zA-Z]+):(\d+)\b")


def parse_and_validate_response(raw_text: str, residual: dict, unit_index: dict | None = None) -> dict:
    """Pure, fully testable without any network call -- the actual
    guardrail (hard rules 1-4 above), not the model's own good behavior,
    which this tool structurally cannot verify or trust on its own.

    `unit_index` (optional, defaults to {}) matches dossier.py's own
    parse_and_validate_dossier_response fix (found live, 2026-08-23,
    BACKLOG.md): residual.evidenceRefs is genuinely EMPTY for whole-unit
    trigger classes (e.g. S2-http-without-security-control) -- the real
    evidence that reached the model's prompt lives on the unit's own
    evidenceRefs in unit_index instead. Without this, a real, correctly
    evidence-grounded response citing unit-level evidence would be
    spuriously rejected.

    Returns {"outcome": "advised", "explanation": ..., "hypotheses": [...],
    "catalogue_rule_candidate": ... or None}
    or {"outcome": "invalid_response", "reason": ...} -- a REJECTION,
    never silently treated as advice, no matter how plausible-looking the
    response is (README S6: never fabricate, never guess)."""
    unit_index = unit_index or {}
    try:
        parsed = json.loads(_strip_markdown_json_fence(raw_text))
    except (json.JSONDecodeError, TypeError):
        return {"outcome": "invalid_response", "reason": "response was not valid JSON -- rejected, not guessed at"}

    if not isinstance(parsed, dict):
        return {"outcome": "invalid_response", "reason": "response JSON was not an object"}

    # T-RT-4's own hard boundary, mechanically enforced, not just
    # instructed: this layer NEVER writes a fact. Any response shaped
    # like a decision/override -- even a well-formed one -- is rejected
    # outright, never routed anywhere near drafts/.
    if "decision" in parsed or "override" in parsed:
        return {"outcome": "invalid_response", "reason": "advisory response must never contain a decision/override key -- T-RT-4 never writes a fact (see draft_tier_b.py for the separate, stricter-gated tool that may)"}

    missing = REQUIRED_ADVISORY_KEYS - parsed.keys()
    if missing:
        return {"outcome": "invalid_response", "reason": f"advisory response missing required field(s): {sorted(missing)}"}

    explanation = parsed["explanation"]
    if not isinstance(explanation, str) or not explanation.strip():
        return {"outcome": "invalid_response", "reason": "explanation must be a non-empty string"}

    hypotheses = parsed["hypotheses"]
    if not isinstance(hypotheses, list) or not all(isinstance(h, str) and h.strip() for h in hypotheses):
        return {"outcome": "invalid_response", "reason": "hypotheses must be a list of non-empty strings"}

    candidate = parsed["catalogue_rule_candidate"]
    if candidate is not None:
        candidate_error = _validate_catalogue_rule_candidate(candidate)
        if candidate_error:
            return {"outcome": "invalid_response", "reason": candidate_error}

    # Hard rule 1 (mechanically enforced, prose form): every file:line-
    # shaped token anywhere in the free-text fields must already be one of
    # this residual's own evidenceRefs -- the same practical, testable
    # proxy draft_tier_b.py's own hard rule 2/3 checks use for structured
    # fields, adapted for prose (see that file's module docstring for the
    # same honest disclosure: this can't detect prior-knowledge USE, only
    # reject any concrete ref that isn't actually in the pack).
    known_refs = llm_common.known_evidence_refs(residual, unit_index)
    free_text = explanation + " " + " ".join(hypotheses) + " " + (candidate.get("rationale", "") if isinstance(candidate, dict) else "")
    for match in _EVIDENCE_REF_RE.finditer(free_text):
        ref = f"{match.group(1)}:{match.group(2)}"
        if ref not in known_refs:
            return {"outcome": "invalid_response", "reason": f"response cites '{ref}', which is not one of this residual's own evidenceRefs {sorted(known_refs)} -- hard rule 1 (never introduce something not in the pack)"}

    return {"outcome": "advised", "explanation": explanation, "hypotheses": hypotheses, "catalogue_rule_candidate": candidate}


def _validate_catalogue_rule_candidate(candidate) -> str | None:
    if not isinstance(candidate, dict):
        return "catalogue_rule_candidate must be an object or null"
    missing = REQUIRED_CANDIDATE_FIELDS - candidate.keys()
    if missing:
        return f"catalogue_rule_candidate missing required field(s): {sorted(missing)}"
    if candidate["matchSource"] not in VALID_MATCH_SOURCES:
        return f"catalogue_rule_candidate.matchSource '{candidate['matchSource']}' is not one of {sorted(VALID_MATCH_SOURCES)}"
    if candidate["category"] not in VALID_CATEGORIES:
        return f"catalogue_rule_candidate.category '{candidate['category']}' is not one of {sorted(VALID_CATEGORIES)}"
    if candidate["calmNodeType"] not in VALID_CALM_NODE_TYPES:
        return f"catalogue_rule_candidate.calmNodeType '{candidate['calmNodeType']}' is not one of {sorted(VALID_CALM_NODE_TYPES)}"
    if not isinstance(candidate["weight"], int) or not (0 <= candidate["weight"] <= 40):
        return "catalogue_rule_candidate.weight must be an integer in [0, 40]"
    return None


def advise_for_residual(residual: dict, unit_index: dict, packs: dict) -> dict:
    if not _llm_backend_available():
        return {"outcome": "no_key", "reason": "no LLM backend available (`claude` CLI not found on PATH) -- nothing advised"}
    user_prompt = build_advisory_prompt(residual, unit_index, packs)
    raw = _call_llm(SYSTEM_PROMPT, user_prompt)
    return parse_and_validate_response(raw, residual, unit_index)


def process_advisory_batch(
    residuals: list[dict],
    unit_index: dict,
    packs: dict,
    advise_fn=advise_for_residual,
    now_fn=lambda: datetime.now(timezone.utc).isoformat(),
    id_fn=lambda: uuid.uuid4().hex[:12],
) -> tuple[list[dict], list[dict], list[dict]]:
    """Runs advise_fn over every residual, attaching advisory results
    in-place (returned as a new list, the input residuals are not
    mutated) and building the episode log + catalogue-rule-candidate
    list. `advise_fn`/`now_fn`/`id_fn` are injectable (default to the
    real implementations) so this is fully testable without a live
    network call or a wall-clock/uuid dependency -- same convention
    draft_tier_b.py's process_tier_b_batch already established with its
    own injectable draft_fn.

    Returns (updated_residuals, episodes, catalogue_rule_candidates).
    A duplicate catalogue-rule-candidate id within this same batch is
    refused (not written a second time), the same collision-safety
    discipline draft_tier_b.py's own batch processor already applies to
    decision/override ids."""
    updated: list[dict] = []
    episodes: list[dict] = []
    candidates: list[dict] = []
    seen_candidate_ids: set[str] = set()

    for residual in residuals:
        result = advise_fn(residual, unit_index, packs)
        episode = {
            "episodeId": id_fn(),
            "residualId": residual["id"],
            "model": MODEL,
            "generatedAt": now_fn(),
            "inputContext": {"evidenceRefs": residual.get("evidenceRefs", []), "unitIds": residual.get("unitIds", [])},
            "outcome": result["outcome"],
        }

        r = dict(residual)
        if result["outcome"] == "advised":
            episode["explanation"] = result["explanation"]
            episode["hypothesesCount"] = len(result["hypotheses"])
            r["advisory"] = {
                "explanation": result["explanation"],
                "hypotheses": result["hypotheses"],
                "hasCatalogueRuleCandidate": result["catalogue_rule_candidate"] is not None,
                "model": MODEL,
                "generatedAt": episode["generatedAt"],
            }
            candidate = result["catalogue_rule_candidate"]
            if candidate is not None:
                candidate_id = candidate["id"]
                if candidate_id in seen_candidate_ids:
                    episode["outcome"] = "candidate_id_collision"
                    episode["reason"] = f"catalogue_rule_candidate.id '{candidate_id}' collides with another candidate already proposed in this same batch -- not written, would silently overwrite"
                else:
                    seen_candidate_ids.add(candidate_id)
                    candidates.append({**candidate, "rationale": candidate["rationale"], "proposedAt": episode["generatedAt"], "status": "proposed", "sourceResidualId": residual["id"]})
        else:
            episode["reason"] = result.get("reason", "")

        episodes.append(episode)
        updated.append(r)

    return updated, episodes, candidates


def render_advisory_report(residuals: list[dict]) -> str:
    """Pure, testable — the actual human-readable surface for this task's
    own acceptance wording ("candidates surface only in the review
    queue"). Same role queue_rank.py's own render_report() plays for
    T-RT-2's consequence field: residuals.json carries the raw data, but a
    human reading a Session Pack needs a rendered artifact, not raw JSON.
    Every block is explicitly labeled non-authoritative — this is prose
    for a human to weigh, never a decision, never rendered as if it were
    one of cards.py's own fixed options."""
    advised = [r for r in residuals if r.get("advisory")]
    lines = ["# Reviewer-assistance advisory notes (T-RT-4)", "", "Advisory only — explanation and hypotheses for a human to weigh, never a decision. Accepting a hypothesis below is ONE human judgement (via the residual's own choice card), never a second corroborating signal for a hard-gated fact.", ""]
    if not advised:
        lines.append("_No residual in this pack has been advised on yet — run `advisory.py --session-dir ...` (needs the `claude` CLI on `PATH`)._")
        return "\n".join(lines) + "\n"

    for r in advised:
        adv = r["advisory"]
        lines.append(f"## {r['id']} (Tier {r['tier']}: {r['class']})")
        lines.append("")
        lines.append(adv["explanation"])
        lines.append("")
        if adv["hypotheses"]:
            lines.append("**Hypotheses:**")
            for h in adv["hypotheses"]:
                lines.append(f"- {h}")
        else:
            lines.append("**Hypotheses:** none proposed.")
        lines.append("")
        if adv.get("hasCatalogueRuleCandidate"):
            lines.append(f"A catalogue-rule candidate was also proposed for this residual — see `advisory/catalogue-rule-candidates.json` (`sourceResidualId: {r['id']}`). A proposal only; never auto-merged into `signal-catalogue.yml`.")
            lines.append("")
        lines.append(f"_{adv['model']}, {adv['generatedAt']}_")
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="T-RT-4 reviewer-assistance advisory layer. Never writes a fact. No API key -> reports what would be attempted, writes nothing.")
    parser.add_argument("--session-dir", required=True)
    parser.add_argument("--residual", action="append", default=None, help="scope to specific residual id(s); default is every open residual in the pack")
    args = parser.parse_args()

    session_dir = Path(args.session_dir).resolve()
    residuals_path = session_dir / "residuals.json"
    if not residuals_path.exists():
        print(f"[advisory] {residuals_path} not found -- is this a real Session Pack?", file=sys.stderr)
        return 1

    pack = json.loads(residuals_path.read_text())
    all_residuals = pack.get("items", [])
    targets = [r for r in all_residuals if r.get("status") == "open"]
    if args.residual:
        wanted = set(args.residual)
        targets = [r for r in targets if r["id"] in wanted]

    if not targets:
        print("[advisory] no open residual(s) to advise on this run -- nothing to do")
        return 0

    unit_index = json.loads((session_dir / "evidence" / "unit-index.json").read_text()) if (session_dir / "evidence" / "unit-index.json").exists() else {}
    packs = json.loads((session_dir / "evidence" / "packs.json").read_text()) if (session_dir / "evidence" / "packs.json").exists() else {}

    if not _llm_backend_available():
        print(f"[advisory] no LLM backend available (`claude` CLI not found on PATH) -- would attempt to advise on {len(targets)} residual(s), writing nothing: {[r['id'] for r in targets]}")
        return 0
    print("[advisory] backend: claude CLI")

    updated_targets, episodes, candidates = process_advisory_batch(targets, unit_index, packs)

    updated_by_id = {r["id"]: r for r in updated_targets}
    pack["items"] = [updated_by_id.get(r["id"], r) for r in all_residuals]
    residuals_path.write_text(json.dumps(pack, indent=2))

    advisory_dir = session_dir / "advisory"
    advisory_dir.mkdir(exist_ok=True)
    _append_json_list(advisory_dir / "episodes.json", episodes)
    if candidates:
        _append_json_list(advisory_dir / "catalogue-rule-candidates.json", candidates)
    # Regenerated fresh each run from residuals.json's own current state
    # (which only ever gains advisory fields, never loses them) — the
    # actual human-readable review-queue surface, not raw JSON.
    (advisory_dir / "report.md").write_text(render_advisory_report(pack["items"]))

    for episode in episodes:
        if episode["outcome"] == "advised":
            print(f"[advisory] {episode['residualId']}: advised ({episode['hypothesesCount']} hypothesis/es)")
        elif episode["outcome"] == "candidate_id_collision":
            print(f"[advisory] {episode['residualId']}: REFUSING catalogue_rule_candidate -- {episode['reason']}")
        else:
            print(f"[advisory] {episode['residualId']}: {episode['outcome']} -- {episode.get('reason', '')}")

    return 0


def _append_json_list(path: Path, new_items: list[dict]) -> None:
    """Append-only, never overwrites a prior run's log -- same
    "never resurrect, never silently overwrite" discipline
    fact-history.ts's appendFactHistory already established for this
    codebase's own analysis-side status-history log."""
    existing = json.loads(path.read_text()) if path.exists() else []
    existing.extend(new_items)
    path.write_text(json.dumps(existing, indent=2))


if __name__ == "__main__":
    raise SystemExit(main())
