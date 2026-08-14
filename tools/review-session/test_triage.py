"""Unit tests for triage.py's trigger -> tier/class mapping — synthetic
review-queue input, no real repo needed (S7: no sample hardcodes)."""

import unittest

from triage import build_residuals, apply_baseline


class TestBuildResiduals(unittest.TestCase):
    def test_s1_maps_to_tier_a_bridge(self):
        rq = {"items": [{"trigger": "S1-zero-service-touching-relationships", "unitId": "svc.py", "unitKind": "service", "confidence": 40, "rationale": "r"}]}
        residuals = build_residuals(rq)
        self.assertEqual(len(residuals), 1)
        self.assertEqual(residuals[0]["tier"], "A")
        self.assertEqual(residuals[0]["class"], "multi-candidate-bridge")
        self.assertEqual(residuals[0]["unitIds"], ["svc.py"])

    def test_s2_maps_to_tier_a_security(self):
        rq = {"items": [{"trigger": "S2-http-without-security-control", "unitId": "svc.py", "unitKind": "service", "confidence": 60, "rationale": "r"}]}
        residuals = build_residuals(rq)
        self.assertEqual(residuals[0]["tier"], "A")
        self.assertEqual(residuals[0]["class"], "security-authority-policy")

    def test_s5_store_maps_to_tier_a_ontology(self):
        rq = {"items": [{"trigger": "S5-zero-service-units-with-store-present", "unitId": "Store.java", "unitKind": "database", "confidence": 40, "rationale": "r"}]}
        residuals = build_residuals(rq)
        self.assertEqual(residuals[0]["tier"], "A")
        self.assertEqual(residuals[0]["class"], "ontology-judgment")

    def test_s5_cfn_maps_to_tier_c_run_level(self):
        rq = {"items": [{"trigger": "S5-cfn-routes-found-but-unbound", "rationale": "r"}]}
        residuals = build_residuals(rq)
        self.assertEqual(residuals[0]["tier"], "C")
        self.assertEqual(residuals[0]["class"], "missing-intermediates-not-in-scan")
        self.assertEqual(residuals[0]["unitIds"], [])  # run-level, no unit

    def test_tier_b_trigger_maps_to_tier_b_single_candidate(self):
        """T-FS-1 (BACKLOG.md "Tier-B residual detection") — the first real
        trigger that maps to Tier B, not Tier A/C. Real, distinguishable
        input: multi-hop-bridge-detector.ts found exactly one real store
        candidate among a bridge's several syntactic implementers."""
        rq = {
            "items": [
                {
                    "trigger": "multi-hop-single-candidate-below-threshold",
                    "unitId": "WidgetApiResource.java",
                    "unitKind": "service",
                    "confidence": 40,
                    "rationale": 'tier-b-single-candidate: "WidgetApiResource.java" references bridge "..." exactly 1 ("WidgetReadServiceImpl.java") is itself a real database/topic unit...',
                }
            ]
        }
        residuals = build_residuals(rq)
        self.assertEqual(len(residuals), 1)
        self.assertEqual(residuals[0]["tier"], "B")
        self.assertEqual(residuals[0]["class"], "single-candidate-below-threshold")
        self.assertEqual(residuals[0]["unitIds"], ["WidgetApiResource.java"])

    def test_contradiction_trigger_maps_to_tier_a_contradicting_evidence(self):
        """T-FS-3 (BACKLOG.md "Contradiction detection between evidence
        sources") — deliberately Tier A, not B: a genuine value-level
        contradiction between two equally-real sources is never draftable
        (draft_tier_b.py's own hard rule 4 refuses to pick between equally-
        evidenced candidates)."""
        rq = {
            "items": [
                {
                    "trigger": "contradicting-evidence-force-review",
                    "unitId": "application.yml::spring-datasource",
                    "unitKind": "database",
                    "confidence": 40,
                    "rationale": 'contradiction: "application.yml::spring-datasource"\'s spring-config evidence names datastore engine "postgresql", but deployment manifest "orders-db" names a DIFFERENT engine "mysql"...',
                }
            ]
        }
        residuals = build_residuals(rq)
        self.assertEqual(len(residuals), 1)
        self.assertEqual(residuals[0]["tier"], "A")
        self.assertEqual(residuals[0]["class"], "contradicting-evidence")
        self.assertEqual(residuals[0]["unitIds"], ["application.yml::spring-datasource"])

    def test_empty_queue_produces_empty_residuals(self):
        self.assertEqual(build_residuals({"items": []}), [])

    def test_ids_are_stable_and_sequential(self):
        rq = {
            "items": [
                {"trigger": "S1-zero-service-touching-relationships", "unitId": "a.py", "unitKind": "service", "confidence": 40, "rationale": "r"},
                {"trigger": "S2-http-without-security-control", "unitId": "b.py", "unitKind": "service", "confidence": 40, "rationale": "r"},
            ]
        }
        residuals = build_residuals(rq)
        self.assertEqual([r["id"] for r in residuals], ["R-001", "R-002"])


class TestApplyBaseline(unittest.TestCase):
    def test_matching_residual_with_active_decision_carried_forward(self):
        residuals = [{"id": "R-001", "tier": "A", "class": "ontology-judgment", "trigger": "S5-zero-service-units-with-store-present", "unitIds": ["db.py"], "evidenceRefs": [], "rationale": "r", "status": "open"}]
        baseline_residuals = [{"id": "R-old-001", "tier": "A", "class": "ontology-judgment", "trigger": "S5-zero-service-units-with-store-present", "unitIds": ["db.py"], "evidenceRefs": [], "rationale": "old r", "status": "open"}]
        baseline_decisions = [{"decision_id": "D-001", "target_ref": "db.py", "status": "active"}]
        out = apply_baseline(residuals, baseline_residuals, baseline_decisions)
        self.assertEqual(out[0]["status"], "carried_forward")
        self.assertIn("R-old-001", out[0]["rationale"])

    def test_no_baseline_match_stays_open(self):
        residuals = [{"id": "R-001", "tier": "A", "class": "ontology-judgment", "trigger": "S5-zero-service-units-with-store-present", "unitIds": ["db.py"], "evidenceRefs": [], "rationale": "r", "status": "open"}]
        out = apply_baseline(residuals, [], [])
        self.assertEqual(out[0]["status"], "open")
        self.assertNotIn("reconfirm", out[0])

    def test_matching_unit_but_inactive_decision_not_carried_forward(self):
        residuals = [{"id": "R-001", "tier": "A", "class": "ontology-judgment", "trigger": "S5-zero-service-units-with-store-present", "unitIds": ["db.py"], "evidenceRefs": [], "rationale": "r", "status": "open"}]
        baseline_residuals = [{"id": "R-old-001", "tier": "A", "class": "ontology-judgment", "trigger": "S5-zero-service-units-with-store-present", "unitIds": ["db.py"], "evidenceRefs": [], "rationale": "old r", "status": "open"}]
        baseline_decisions = [{"decision_id": "D-001", "target_ref": "db.py", "status": "superseded"}]  # not active
        out = apply_baseline(residuals, baseline_residuals, baseline_decisions)
        self.assertEqual(out[0]["status"], "open", "an inactive/superseded decision must not silently carry forward")

    def test_changed_trigger_class_flagged_reconfirm_not_silently_carried_or_overwritten(self):
        """Design §7.2 (P7 applied to drift): a real contradiction between
        the baseline's recorded decision and this run's fresh evidence must
        surface as a new residual, never silently carried forward and never
        silently discarded."""
        residuals = [{"id": "R-001", "tier": "A", "class": "security-authority-policy", "trigger": "S2-http-without-security-control", "unitIds": ["svc.py"], "evidenceRefs": [], "rationale": "now has http-without-control", "status": "open"}]
        baseline_residuals = [{"id": "R-old-001", "tier": "A", "class": "ontology-judgment", "trigger": "S5-zero-service-units-with-store-present", "unitIds": ["svc.py"], "evidenceRefs": [], "rationale": "was ontology", "status": "open"}]
        baseline_decisions = [{"decision_id": "D-001", "target_ref": "svc.py", "status": "active"}]
        out = apply_baseline(residuals, baseline_residuals, baseline_decisions)
        self.assertEqual(out[0]["status"], "open", "must still be asked, not silently carried forward")
        self.assertTrue(out[0].get("reconfirm"))
        self.assertIn("R-old-001", out[0]["rationale"])
        self.assertEqual(out[0]["class"], "security-authority-policy", "real current class must be preserved, not overwritten with a sentinel")

    def test_carry_forward_preserves_real_tier_and_class(self):
        residuals = [{"id": "R-001", "tier": "C", "class": "missing-intermediates-not-in-scan", "trigger": "S5-cfn-routes-found-but-unbound", "unitIds": [], "evidenceRefs": [], "rationale": "r", "status": "open"}]
        # run-level residual, no unitIds -- baseline matching by unit can never fire; stays open.
        out = apply_baseline(residuals, [], [])
        self.assertEqual(out[0]["tier"], "C")
        self.assertEqual(out[0]["class"], "missing-intermediates-not-in-scan")


if __name__ == "__main__":
    unittest.main()
