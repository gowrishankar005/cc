"""Unit tests for triage.py's trigger -> tier/class mapping — synthetic
review-queue input, no real repo needed (S7: no sample hardcodes)."""

import unittest

from triage import build_residuals


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


if __name__ == "__main__":
    unittest.main()
