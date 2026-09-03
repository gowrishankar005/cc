"""Deterministic choice-card generator.

Design authority: Architect_Residual_Review_Session.md §2.1 (choice-driven
UX) + §3 (per-class option shapes) + §4.4 (cards render as ordinary
Copilot Chat markdown, not a custom widget).

Hard rule (S7 / §2.1): options come from a FIXED GENERATOR per residual
class, never from an LLM inventing plausible-sounding categories. Same
residual + same evidence -> same card, always (tested in test_cards.py).
Every "real unit" option below is a real, already-existing unit in this
run's own facts — never an invented/fabricated node name.
"""

from __future__ import annotations

import re

OTHER_OPTION = {"key": "other", "label": "Other…", "detail": "free text — requires a 1-line rationale, captured verbatim into the Decision Record"}
LEAVE_OPEN_OPTION = {"key": "leave-open", "label": "Leave open", "detail": "insufficient confidence to decide now — stays flagged for a future session"}

MAX_CANDIDATES = 10  # same capping discipline as unmapped-signals.ts's MAX_CLUSTERS — never dump an unbounded list into a card


def _multi_candidate_bridge_options(residual: dict, unit_index: dict) -> list[dict]:
    """S1 / low-architecture-coverage: 'each in-scope candidate unit' per
    §3's own table — real units already in this pack's unit-index, never
    invented. Candidate kind is the complement of the residual's own unit
    kind (a service missing a store connection is offered real stores in
    this pack, and vice versa)."""
    unit_ids = residual.get("unitIds", [])
    own_kind = unit_index.get(unit_ids[0], {}).get("kind") if unit_ids else None
    target_kinds = {"database", "topic"} if own_kind == "service" else {"service"} if own_kind else set()

    candidates = sorted(uid for uid, info in unit_index.items() if info.get("kind") in target_kinds and uid not in unit_ids)
    options = [{"key": str(i + 1), "label": f"Connect to {uid}", "detail": f"real {unit_index[uid]['kind']} unit in this scan"} for i, uid in enumerate(candidates[:MAX_CANDIDATES])]
    if len(candidates) > MAX_CANDIDATES:
        options.append({"key": "more", "label": f"(+{len(candidates) - MAX_CANDIDATES} more real candidates not shown)", "detail": "see evidence/unit-index.json for the full list"})
    options.append({"key": "none", "label": "None of these", "detail": "no real unit in this pack is the right target — a rescan or a missing root may be needed"})
    return options


def _security_authority_policy_options(residual: dict, unit_index: dict) -> list[dict]:
    """S2: 'policy options + leave-open + other' — v1 does not invent
    control_add (H4), so no option here proposes fabricating a control."""
    return [
        {"key": "1", "label": "Real auth exists in source, this pipeline's catalogue doesn't detect it", "detail": "candidate for a new signal-catalogue.yml row (catalogue lane, suggest-rules.ts) — not a one-off fix here"},
        {"key": "2", "label": "No auth present — a real, confirmed gap", "detail": "document as a known gap; v1 residual cannot author a control_add (H4)"},
    ]


def _ontology_judgment_options(residual: dict, unit_index: dict) -> list[dict]:
    """S5-zero-service-units-with-store-present: real store, no entry point
    anywhere in this run — is the entry point out of scan scope, or is this
    genuinely unowned/library code."""
    return [
        {"key": "1", "label": "The owning entry point exists but wasn't scanned this run", "detail": "candidate for a multi-root rescan including the missing package"},
        {"key": "2", "label": "This is genuinely library/shared code with no owning service", "detail": "no rescan will find an owner — document as such"},
    ]


def _missing_intermediates_options(residual: dict, unit_index: dict) -> list[dict]:
    """S5-cfn-routes-found-but-unbound (Tier C): real infra evidence, no
    code-side match. Per §3's Tier C table for this exact class — never a
    relationship_add without both endpoints already in TypedFacts."""
    return [
        {"key": "1", "label": "Document as out-of-scope for this run", "detail": "the handler's package root wasn't included in this scan"},
        {"key": "2", "label": "Multi-root rescan (if the missing root is known)", "detail": "re-run run-slice including the package that owns this route's handler"},
    ]


def _single_candidate_below_threshold_options(residual: dict, unit_index: dict) -> list[dict]:
    """T-FS-1 (Tier B): multi-hop-bridge-detector.ts found exactly ONE real
    database/topic-typed candidate among a bridge interface's several
    syntactic implementers -- a real, medium-confidence signal, distinct
    from Tier A's multi-candidate-bridge class (no single candidate stands
    out there). The candidate's own unit id is already named in the
    residual's rationale text (the detector's own tier-b-single-candidate
    ignored-item) -- this template never re-derives or invents one of its
    own, same S5/S7 discipline every other template here follows."""
    return [
        {"key": "1", "label": "Accept the identified candidate", "detail": "promote to a real architecture relationship at the confidence named in the rationale above -- the one candidate this pipeline already found, not a new guess"},
        {"key": "2", "label": "Reject -- not the right candidate", "detail": "the syntactic implementer count was misleading (e.g. a decoy/mock/legacy alternative implementation); document as such"},
    ]


def _low_confidence_emitted_relationship_options(residual: dict, unit_index: dict) -> list[dict]:
    """§3.3 (Architect_Residual_Review_Session.md): a relationship that's
    ALREADY sitting in the canonical architecture.calm.json today, at low
    confidence, with nothing ever surfacing it for a second look. Only two
    real options -- the relationship's own id (needed for target_ref) and
    its evidence are already named in the residual's own rationale text,
    same "never re-derive or invent" discipline as
    _single_candidate_below_threshold_options above. Confirm needs no
    Override at all (a Decision Record alone, final_decision
    {"action": "accepted", "new_value": None} -- the documented, most
    common real outcome); reject needs a relationship_remove Override,
    target_ref the same relationship id."""
    return [
        {"key": "1", "label": "Confirm — this relationship is real", "detail": 'Decision Record only, no Override — target_type "relationship", target_ref the relationship id named in the rationale above, final_decision {"action": "accepted", "new_value": null}'},
        {"key": "2", "label": "Reject — remove it", "detail": "Decision Record + relationship_remove Override, target_ref the same relationship id — deletes an admitted scan fact, per this pack's own AGENTS.md hard rule 8"},
    ]


def _messaging_producer_unverified_options(residual: dict, unit_index: dict) -> list[dict]:
    """BACKLOG.md "Messaging-producer usage verification" -- a topic unit
    typed purely from field-type/import-only messaging evidence, never
    paired with a real .send()/.publish() call-site check (no such
    mechanism exists in this pipeline yet). Only two real options, same
    minimal shape as _low_confidence_emitted_relationship_options above.
    Confirm needs no Override at all (a Decision Record alone -- the
    documented, most common real outcome); reject needs a node_remove
    Override (already fully supported, including cascading relationship
    cleanup), target_ref the unit's own id (already the CALM node's own
    unique-id, per node-builder.ts)."""
    return [
        {"key": "1", "label": "Confirm — this is a real messaging producer", "detail": "Decision Record only, no Override — the field-type/import evidence is correct even without a call-site check"},
        {"key": "2", "label": "Reject — remove it", "detail": "Decision Record + node_remove Override (already fully supported, including cascading relationship cleanup) — the field is declared but never actually used to send/publish, or belongs to a different client entirely"},
    ]


def _catalogue_candidate_options(residual: dict, unit_index: dict) -> list[dict]:
    """Unmapped-signal cluster: catalogue lane first (S11), optional
    one-off construct only if a packed sample already names a real unit —
    never auto-merge signal-catalogue.yml."""
    return [
        {"key": "1", "label": "Catalogue-rule candidate", "detail": "propose a signal-catalogue.yml row (suggest-rules lane) — not a one-off CALM node"},
        {"key": "2", "label": "One-off construct from a packed sample", "detail": "only if a sample ref in this pack already names a real unit — HITL still applies"},
        {"key": "3", "label": "Ignore this cluster for this run", "detail": "document as not-in-scope / noise for this scan"},
    ]


def _insufficient_evidence_options(residual: dict, unit_index: dict) -> list[dict]:
    """Ignored INSUFFICIENT_EVIDENCE leftover (not an unmapped catalogue miss)."""
    return [
        {"key": "1", "label": "Promote — the snippet is enough to type/connect this unit", "detail": "draft a CALM construct only from packed evidence; otherwise cannot_decide"},
        {"key": "2", "label": "Confirmed insufficient — leave as a known gap", "detail": "scope-limitation, not a fabricated node"},
        {"key": "3", "label": "Need a bounded extra-read", "detail": "architect runs pack.py fetch-span for this residual — Copilot does not read the repo"},
    ]


def _ambiguous_boundary_options(residual: dict, unit_index: dict) -> list[dict]:
    """Ignored AMBIGUOUS_BOUNDARY leftover (not a T-FS-3 contradiction)."""
    return [
        {"key": "1", "label": "Pick the boundary named in the packed evidence", "detail": "only if exactly one candidate is named in this residual's snippet"},
        {"key": "2", "label": "Leave ambiguous — do not pick", "detail": "0 or 2+ candidates → cannot_decide, same as R2"},
        {"key": "3", "label": "Need a bounded extra-read", "detail": "architect runs pack.py fetch-span for this residual — Copilot does not read the repo"},
    ]


def _contradicting_evidence_options(residual: dict, unit_index: dict) -> list[dict]:
    """T-FS-3: two real evidence sources assert DIFFERENT values for the
    same fact (e.g. a k8s deployment manifest names one datastore engine,
    the live spring-config names another) -- contradiction-detector.ts
    already named BOTH conflicting values in the rationale text above.
    Never averaged, never auto-picked: the architect decides which source
    is actually current."""
    return [
        {"key": "1", "label": "Trust the code-level config (spring-config)", "detail": "the deployment manifest is stale -- update it, or document the drift"},
        {"key": "2", "label": "Trust the deployment manifest", "detail": "the code-level config is stale/wrong -- flag for a code fix"},
        {"key": "3", "label": "Both are correct for different environments", "detail": "e.g. a per-profile override this run's evidence doesn't capture -- document as such, not a real contradiction"},
    ]


_CLASS_TEMPLATES = {
    "multi-candidate-bridge": _multi_candidate_bridge_options,
    "security-authority-policy": _security_authority_policy_options,
    "ontology-judgment": _ontology_judgment_options,
    "missing-intermediates-not-in-scan": _missing_intermediates_options,
    "single-candidate-below-threshold": _single_candidate_below_threshold_options,
    "contradicting-evidence": _contradicting_evidence_options,
    "catalogue-candidate": _catalogue_candidate_options,
    "insufficient-evidence": _insufficient_evidence_options,
    "ambiguous-boundary": _ambiguous_boundary_options,
    # §3.2 (Architect_Residual_Review_Session.md) says this class "reuses
    # single-candidate-below-threshold's card shape" -- literally the same
    # generator, not a near-duplicate: the candidate is already named in
    # the residual's own rationale text here too (outbound-http-detector.ts/
    # env-soft-graph-detector.ts's own evidence string), same "accept the
    # one real candidate already found, or reject it" shape, same S5/S7
    # discipline against inventing one. Real gap found on review (2026-09-02):
    # this row was missing entirely, so build_options silently fell through
    # to zero real options (only leave-open/other) for every real
    # unresolved-outbound-target residual -- caught by actually rendering a
    # card, not by inspecting residuals.json alone.
    "unresolved-outbound-target": _single_candidate_below_threshold_options,
    "low-confidence-emitted-relationship": _low_confidence_emitted_relationship_options,
    "messaging-producer-unverified": _messaging_producer_unverified_options,
}


def build_options(residual: dict, unit_index: dict) -> list[dict]:
    """Fixed per-class option list + leave-open (if the class template
    didn't already offer an equivalent) + Other, always in that order.
    Deterministic: same residual + same unit_index -> same options."""
    generator = _CLASS_TEMPLATES.get(residual["class"])
    options = list(generator(residual, unit_index)) if generator else []
    if not any(o["key"] in ("leave-open", "none") for o in options):
        options.append(LEAVE_OPEN_OPTION)
    options.append(OTHER_OPTION)
    return options


def render_card_markdown(residual: dict, unit_index: dict, evidence_packs: dict, similar_ids: list[str], context_lines: int = 15, evidence_paths: dict | None = None) -> str:
    """§4.4: renders as ordinary Copilot Chat markdown — numbered options,
    an evidence blockquote, a follow-up reply of a key or 'other: ...'.
    context_lines must match whatever pack.py actually used to build
    evidence_packs's snippets (default 15 = pack.py's own
    DEFAULT_CONTEXT_LINES) -- see _anchor_line_preview's own docstring for
    why this has to agree with the real build-time value.

    evidence_paths (Architect_Pilot_Feedback_Notes.md Entry 20): optional
    ref -> REPO_ROOT-relative "path:line" map from pack.py's
    _build_evidence_packs. When present for a ref, the evidence line shows
    that real, VS-Code-workspace-openable path instead of the raw scan ref
    (which is only relative to whichever package root produced it, not to
    the workspace root an architect has open). Optional and defaulted so
    every existing caller/test that only ever passed a bare ref->snippet
    dict keeps working unchanged.

    Architect_Pilot_Feedback_Notes.md Entry 23: the "My read (not a
    decision):" recommendation paragraph is rendered HERE, deterministically,
    from residual["dossier"] (dossier.py's own validated {explanation,
    hypotheses, evidenceRefsUsed} shape, attached by pack.py's
    _run_dossier_pass BEFORE cards are built when --with-dossier is set) --
    it is never left to the live chat model to author on demand. Two real,
    live-reproduced attempts (Entries 21/22) showed that asking the ambient
    chat model to freshly generate a grounded paragraph on every card is
    unreliable, the same class of problem dossier.py's own structured-
    response validation exists to avoid for exactly this reason. When no
    dossier is present (no --with-dossier, or no LLM backend at pack-build
    time), the card says so plainly instead of asking the chat model to
    invent one."""
    options = build_options(residual, unit_index)
    lines = [
        f"### {residual['id']} (Tier {residual['tier']}: {residual['class']})",
        "",
        residual["rationale"],
        "",
    ]
    for opt in options:
        lines.append(f"- **[{opt['key']}]** {opt['label']} — {opt['detail']}")
    lines.append("")

    evidence_lines = _evidence_lines(residual, unit_index, evidence_packs, context_lines, evidence_paths)
    if evidence_lines:
        lines.append("**Evidence:**")
        for e in evidence_lines:
            lines.append(f"> {e}")
    else:
        lines.append("**Evidence:** none captured for this residual's unit(s) in this pack.")
    lines.append("")

    lines.append(_dossier_block(residual.get("dossier")))
    lines.append("")

    if similar_ids:
        lines.append(f"**Similar residuals this session:** {', '.join(similar_ids)} (same class — you may answer once and apply to all, but each still gets its own Decision Record, S9)")
    else:
        lines.append("**Similar residuals this session:** none yet")
    lines.append("")
    return "\n".join(lines)


def _dossier_block(dossier: dict | None) -> str:
    """Renders dossier.py's own validated {explanation, hypotheses,
    evidenceRefsUsed} shape as the card's "My read (not a decision):"
    paragraph (Entry 23) -- deterministic reproduction of an already-
    validated LLM response, never live authoring by whatever chat model is
    reading this card. No dossier -> say so plainly; never a blank gap that
    invites the reading model to fill it in on its own."""
    if not dossier or not dossier.get("explanation"):
        return "**My read (not a decision):** no evidence dossier available for this residual (run `pack.py --with-dossier` to generate one) — this is not a recommendation, decide from the evidence above."
    lines = [f"**My read (not a decision):** {dossier['explanation']}"]
    for h in dossier.get("hypotheses") or []:
        lines.append(f"- {h}")
    used = dossier.get("evidenceRefsUsed") or []
    if used:
        lines.append(f"  _(based on: {', '.join(used)})_")
    return "\n".join(lines)


_REF_RE = re.compile(r"^(.*):(\d+)$")


def _anchor_line_preview(ref: str, snippet: str, context_lines: int) -> str:
    """Real bug found live (Architect_Pilot_Feedback_Notes.md Entry 19):
    evidence_packs[ref] is a multi-line CONTEXT WINDOW built by pack.py's
    _read_snippet/_window_for_line -- context_lines before AND after the
    ref's own claimed line, not starting at that line. The old code just
    took the snippet's first non-blank line as "the evidence at this
    ref," which is almost always context padding, not the actual match
    (confirmed: a real "Column" cluster ref showed an unrelated import
    line instead of the real @Column(...) annotation 15 lines later).

    Recomputes the SAME window-start math pack.py's own _window_for_line
    uses (start = max(0, line - 1 - context_lines)) to find the anchor
    line's own position within the snippet, without needing pack.py's
    n_lines (this repo's default context_lines=15 never triggers
    _window_for_line's own MAX_SNIPPET_WINDOW re-centering, since
    15+15+1=31 <= 40 -- only a much larger custom --context-lines would).
    Falls back to the old first-non-blank-line heuristic whenever the
    computed index doesn't land inside the actual snippet -- e.g. a
    custom context_lines that DID trigger re-centering, or a
    synthetic/test snippet that isn't a real windowed capture -- rather
    than indexing out of bounds or guessing."""
    lines = snippet.splitlines()
    m = _REF_RE.match(ref)
    if m:
        line_1indexed = int(m.group(2))
        window_start = max(0, line_1indexed - 1 - context_lines)
        anchor_idx = (line_1indexed - 1) - window_start
        if 0 <= anchor_idx < len(lines) and lines[anchor_idx].strip():
            return lines[anchor_idx]
    return next((line for line in lines if line.strip()), "")


def _evidence_lines(residual: dict, unit_index: dict, evidence_packs: dict, context_lines: int = 15, evidence_paths: dict | None = None) -> list[str]:
    seen_refs = set()
    out = []
    evidence_paths = evidence_paths or {}

    def _add(ref: str) -> None:
        if not ref or ref in seen_refs:
            return
        seen_refs.add(ref)
        snippet = evidence_packs.get(ref)
        if not snippet:
            return
        preview = _anchor_line_preview(ref, snippet, context_lines)
        label = evidence_paths.get(ref, ref)
        out.append(f"`{label}`: {preview}")

    for ref in residual.get("evidenceRefs") or []:
        _add(ref)
    for unit_id in residual.get("unitIds", []):
        unit = unit_index.get(unit_id)
        if not unit:
            continue
        # A unit can carry more than one Evidence entry pointing at the same
        # file:line (e.g. both native-route and decorator evidence citing
        # the same line) — real, not a bug in the underlying data, but the
        # card must show each ref once, not once per evidence entry.
        for ref in unit.get("evidenceRefs", []):
            _add(ref)
    return out


def group_by_class(residuals: list[dict]) -> dict[tuple, list[str]]:
    """{(tier, class): [residual_id, ...]} — the same "similar residuals"
    grouping build_all_cards uses for its sibling note, factored out so
    bulk_apply.py (T-RT-1) can find a residual's siblings without
    re-deriving the grouping rule a second time."""
    groups: dict[tuple, list[str]] = {}
    for r in residuals:
        groups.setdefault((r["tier"], r["class"]), []).append(r["id"])
    return groups


def build_all_cards(residuals: list[dict], unit_index: dict, evidence_packs: dict, context_lines: int = 15, evidence_paths: dict | None = None) -> dict:
    """Returns {residual_id: markdown_card}. Also computes the real
    'similar residuals' grouping (same tier+class), shared across all cards
    in the group — not per-card in isolation. context_lines must match
    whatever pack.py actually used to build evidence_packs (see
    render_card_markdown's own docstring). evidence_paths is optional (see
    render_card_markdown's own docstring, Entry 20)."""
    groups = group_by_class(residuals)

    cards = {}
    for r in residuals:
        siblings = [rid for rid in groups[(r["tier"], r["class"])] if rid != r["id"]]
        cards[r["id"]] = render_card_markdown(r, unit_index, evidence_packs, siblings, context_lines, evidence_paths)
    return cards
