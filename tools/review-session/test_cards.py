"""Exit criteria: same residual + evidence -> same options,
deterministic, generated from a fixed template per class — never an LLM
inventing plausible-sounding categories."""

import unittest

from cards import build_all_cards, build_options, render_card_markdown


class TestCardDeterminism(unittest.TestCase):
    def test_same_residual_same_options_every_time(self):
        residual = {"id": "R-001", "tier": "A", "class": "security-authority-policy", "unitIds": ["svc.py"], "rationale": "r"}
        unit_index = {"svc.py": {"kind": "service", "confidence": 60, "evidenceRefs": []}}
        first = build_options(residual, unit_index)
        second = build_options(residual, unit_index)
        self.assertEqual(first, second)

    def test_multi_candidate_bridge_offers_real_units_only(self):
        residual = {"id": "R-001", "tier": "A", "class": "multi-candidate-bridge", "unitIds": ["svc.py"], "rationale": "r"}
        unit_index = {
            "svc.py": {"kind": "service", "confidence": 40, "evidenceRefs": []},
            "db1.py": {"kind": "database", "confidence": 40, "evidenceRefs": []},
            "db2.py": {"kind": "database", "confidence": 40, "evidenceRefs": []},
        }
        options = build_options(residual, unit_index)
        labels = [o["label"] for o in options]
        self.assertIn("Connect to db1.py", labels)
        self.assertIn("Connect to db2.py", labels)
        # never offers to connect to itself
        self.assertNotIn("Connect to svc.py", labels)
        # never invents a unit that doesn't exist in the pack
        self.assertFalse(any("Connect to " in l and l not in ("Connect to db1.py", "Connect to db2.py") for l in labels))

    def test_multi_candidate_bridge_caps_at_max_candidates(self):
        residual = {"id": "R-001", "tier": "A", "class": "multi-candidate-bridge", "unitIds": ["svc.py"], "rationale": "r"}
        unit_index = {"svc.py": {"kind": "service", "confidence": 40, "evidenceRefs": []}}
        for i in range(15):
            unit_index[f"db{i}.py"] = {"kind": "database", "confidence": 40, "evidenceRefs": []}
        options = build_options(residual, unit_index)
        connect_options = [o for o in options if o["label"].startswith("Connect to")]
        self.assertEqual(len(connect_options), 10)  # MAX_CANDIDATES
        self.assertTrue(any("+5 more" in o["label"] for o in options))

    def test_missing_intermediates_never_offers_relationship_add(self):
        """Tier C command-bus-style class: never a raw 'add this edge' option."""
        residual = {"id": "R-001", "tier": "C", "class": "missing-intermediates-not-in-scan", "unitIds": [], "rationale": "r"}
        options = build_options(residual, {})
        for o in options:
            self.assertNotIn("relationship_add", o["label"].lower() + o["detail"].lower())
            self.assertNotIn("connect to", o["label"].lower())

    def test_single_candidate_below_threshold_offers_accept_reject_never_invents_candidate(self):
        """T-FS-1 (Tier B): the card template must never re-derive or invent
        a candidate id of its own — the candidate is already named in the
        residual's own rationale text (multi-hop-bridge-detector.ts's
        tier-b-single-candidate ignored-item), not something cards.py
        generates. Only two real options: accept the already-found
        candidate, or reject it — no fabricated relationship_add target."""
        residual = {
            "id": "R-001",
            "tier": "B",
            "class": "single-candidate-below-threshold",
            "unitIds": ["WidgetApiResource.java"],
            "rationale": 'tier-b-single-candidate: "WidgetApiResource.java" references bridge "..." which has 2 candidate implementation(s)... exactly 1 ("WidgetReadServiceImpl.java") is itself a real database/topic unit...',
        }
        options = build_options(residual, {})
        labels = [o["label"] for o in options]
        self.assertIn("Accept the identified candidate", labels)
        self.assertIn("Reject -- not the right candidate", labels)
        self.assertEqual(options[-1]["key"], "other")

    def test_contradicting_evidence_never_auto_picks_a_winner(self):
        """T-FS-3: the card must offer real choices (trust config / trust
        manifest / both-correct-for-different-envs) but never silently
        auto-resolve the conflict itself — same S6 non-fabricate discipline
        as every other template, applied to 'don't average or auto-pick'
        instead of 'don't invent a node'."""
        residual = {
            "id": "R-001",
            "tier": "A",
            "class": "contradicting-evidence",
            "unitIds": ["application.yml::spring-datasource"],
            "rationale": 'contradiction: ... names "postgresql" ... names a DIFFERENT engine "mysql" ...',
        }
        options = build_options(residual, {})
        labels = [o["label"] for o in options]
        self.assertIn("Trust the code-level config (spring-config)", labels)
        self.assertIn("Trust the deployment manifest", labels)
        self.assertEqual(options[-1]["key"], "other")

    def test_every_card_ends_with_leave_open_or_none_and_other(self):
        for cls in (
            "multi-candidate-bridge",
            "security-authority-policy",
            "ontology-judgment",
            "missing-intermediates-not-in-scan",
            "single-candidate-below-threshold",
            "contradicting-evidence",
            "unclassified",
        ):
            residual = {"id": "R-001", "tier": "A", "class": cls, "unitIds": [], "rationale": "r"}
            options = build_options(residual, {})
            self.assertEqual(options[-1]["key"], "other", f"class {cls} must always end with Other")
            self.assertTrue(any(o["key"] in ("leave-open", "none") for o in options), f"class {cls} must always offer a leave-open equivalent")

    def test_other_requires_rationale_is_documented_in_card_text(self):
        residual = {"id": "R-001", "tier": "A", "class": "security-authority-policy", "unitIds": [], "rationale": "r"}
        options = build_options(residual, {})
        other = next(o for o in options if o["key"] == "other")
        self.assertIn("rationale", other["detail"].lower())

    def test_bulk_apply_grouping_lists_siblings_same_class(self):
        residuals = [
            {"id": "R-001", "tier": "A", "class": "security-authority-policy", "unitIds": ["a.py"], "rationale": "r"},
            {"id": "R-002", "tier": "A", "class": "security-authority-policy", "unitIds": ["b.py"], "rationale": "r"},
            {"id": "R-003", "tier": "A", "class": "ontology-judgment", "unitIds": ["c.py"], "rationale": "r"},
        ]
        unit_index = {uid: {"kind": "service", "confidence": 40, "evidenceRefs": []} for uid in ("a.py", "b.py", "c.py")}
        cards = build_all_cards(residuals, unit_index, {})
        self.assertIn("R-002", cards["R-001"])
        self.assertIn("R-001", cards["R-002"])
        self.assertNotIn("R-001", cards["R-003"])  # different class, not a sibling

    def test_evidence_lines_deduped_when_unit_has_repeated_refs(self):
        """Real shape found against the NestJS fixture: a unit can carry
        multiple Evidence entries (native-route + decorator) pointing at
        the SAME file:line — the card must show each ref once, not once
        per evidence entry."""
        residual = {"id": "R-001", "tier": "A", "class": "security-authority-policy", "unitIds": ["svc.ts"], "rationale": "r"}
        unit_index = {"svc.ts": {"kind": "service", "confidence": 100, "evidenceRefs": ["svc.ts:5", "svc.ts:5", "svc.ts:10"]}}
        packs = {"svc.ts:5": "\n@Get()\nfindAll() {}", "svc.ts:10": "@Post()\ncreate() {}"}
        card = render_card_markdown(residual, unit_index, packs, [])
        self.assertEqual(card.count("`svc.ts:5`"), 1, "same ref must appear once even if the unit has 2 evidence entries citing it")

    def test_evidence_preview_skips_blank_first_line(self):
        residual = {"id": "R-001", "tier": "A", "class": "security-authority-policy", "unitIds": ["svc.ts"], "rationale": "r"}
        unit_index = {"svc.ts": {"kind": "service", "confidence": 100, "evidenceRefs": ["svc.ts:5"]}}
        packs = {"svc.ts:5": "\n\n@Get()\nfindAll() {}"}  # first 2 lines blank, matches a real +/- window landing on blank source lines
        card = render_card_markdown(residual, unit_index, packs, [])
        self.assertIn("@Get()", card)

    def test_bulk_apply_note_says_one_dr_per_residual(self):
        residuals = [
            {"id": "R-001", "tier": "A", "class": "security-authority-policy", "unitIds": ["a.py"], "rationale": "r"},
            {"id": "R-002", "tier": "A", "class": "security-authority-policy", "unitIds": ["b.py"], "rationale": "r"},
        ]
        unit_index = {uid: {"kind": "service", "confidence": 40, "evidenceRefs": []} for uid in ("a.py", "b.py")}
        cards = build_all_cards(residuals, unit_index, {})
        self.assertIn("its own Decision Record", cards["R-001"])


if __name__ == "__main__":
    unittest.main()
