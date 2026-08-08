"""T-RS1-4 — deterministic choice-card generator.

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


_CLASS_TEMPLATES = {
    "multi-candidate-bridge": _multi_candidate_bridge_options,
    "security-authority-policy": _security_authority_policy_options,
    "ontology-judgment": _ontology_judgment_options,
    "missing-intermediates-not-in-scan": _missing_intermediates_options,
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


def render_card_markdown(residual: dict, unit_index: dict, evidence_packs: dict, similar_ids: list[str]) -> str:
    """§4.4: renders as ordinary Copilot Chat markdown — numbered options,
    an evidence blockquote, a follow-up reply of a key or 'other: ...'."""
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

    evidence_lines = _evidence_lines(residual, unit_index, evidence_packs)
    if evidence_lines:
        lines.append("**Evidence:**")
        for e in evidence_lines:
            lines.append(f"> {e}")
    else:
        lines.append("**Evidence:** none captured for this residual's unit(s) in this pack.")
    lines.append("")

    if similar_ids:
        lines.append(f"**Similar residuals this session:** {', '.join(similar_ids)} (same class — you may answer once and apply to all, but each still gets its own Decision Record, S9)")
    else:
        lines.append("**Similar residuals this session:** none yet")
    lines.append("")
    return "\n".join(lines)


def _evidence_lines(residual: dict, unit_index: dict, evidence_packs: dict) -> list[str]:
    seen_refs = set()
    out = []
    for unit_id in residual.get("unitIds", []):
        unit = unit_index.get(unit_id)
        if not unit:
            continue
        # A unit can carry more than one Evidence entry pointing at the same
        # file:line (e.g. both native-route and decorator evidence citing
        # the same line) — real, not a bug in the underlying data, but the
        # card must show each ref once, not once per evidence entry.
        for ref in unit.get("evidenceRefs", []):
            if ref in seen_refs:
                continue
            seen_refs.add(ref)
            snippet = evidence_packs.get(ref)
            if not snippet:
                continue
            preview = next((line for line in snippet.splitlines() if line.strip()), "")
            out.append(f"`{ref}`: {preview}")
    return out


def build_all_cards(residuals: list[dict], unit_index: dict, evidence_packs: dict) -> dict:
    """Returns {residual_id: markdown_card}. Also computes the real
    'similar residuals' grouping (same tier+class), shared across all cards
    in the group — not per-card in isolation."""
    groups: dict[tuple, list[str]] = {}
    for r in residuals:
        groups.setdefault((r["tier"], r["class"]), []).append(r["id"])

    cards = {}
    for r in residuals:
        siblings = [rid for rid in groups[(r["tier"], r["class"])] if rid != r["id"]]
        cards[r["id"]] = render_card_markdown(r, unit_index, evidence_packs, siblings)
    return cards
