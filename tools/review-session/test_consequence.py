"""Unit tests for consequence.py (T-RT-2) — synthetic facts only (S7: no
sample hardcodes), exercising each named proxy signal independently and in
combination."""

import unittest

from consequence import annotate_residuals, compute_consequence


def _residual(rid, cls, unit_ids):
    return {"id": rid, "tier": "A", "class": cls, "unitIds": unit_ids}


class TestComputeConsequence(unittest.TestCase):
    def test_no_signals_for_plain_service_unit(self):
        residual = _residual("R-001", "multi-candidate-bridge", ["svc.py"])
        unit_index = {"svc.py": {"kind": "service"}}
        result = compute_consequence(residual, unit_index, [])
        self.assertEqual(result, {"signals": [], "score": 0})

    def test_database_unit_gets_pii_proxy_signal(self):
        residual = _residual("R-001", "ontology-judgment", ["db.py"])
        unit_index = {"db.py": {"kind": "database"}}
        result = compute_consequence(residual, unit_index, [])
        self.assertEqual(result["signals"], ["pii-proxy"])
        self.assertEqual(result["score"], 1)

    def test_unresolved_unit_gets_external_system_identity_signal(self):
        residual = _residual("R-001", "multi-candidate-bridge", ["x.py"])
        unit_index = {"x.py": {"kind": "unresolved"}}
        result = compute_consequence(residual, unit_index, [])
        self.assertEqual(result["signals"], ["external-system-identity"])

    def test_security_authority_policy_class_gets_external_system_identity_signal(self):
        """S2 http-without-security-control: no store/unresolved unit
        needed — the class itself is identity-adjacent."""
        residual = _residual("R-001", "security-authority-policy", ["svc.py"])
        unit_index = {"svc.py": {"kind": "service"}}
        result = compute_consequence(residual, unit_index, [])
        self.assertEqual(result["signals"], ["external-system-identity"])

    def test_shares_secret_relationship_touching_residual_unit_gets_trust_boundary_signal(self):
        residual = _residual("R-001", "multi-candidate-bridge", ["svc-a"])
        unit_index = {"svc-a": {"kind": "service"}}
        relationships = [{"from": "svc-a", "to": "svc-b", "kind": "shares-secret"}]
        result = compute_consequence(residual, unit_index, relationships)
        self.assertEqual(result["signals"], ["trust-boundary-edge"])

    def test_unrelated_shares_secret_relationship_not_counted(self):
        residual = _residual("R-001", "multi-candidate-bridge", ["svc-a"])
        unit_index = {"svc-a": {"kind": "service"}}
        relationships = [{"from": "svc-x", "to": "svc-y", "kind": "shares-secret"}]
        result = compute_consequence(residual, unit_index, relationships)
        self.assertEqual(result["signals"], [])

    def test_calls_relationship_never_counted_as_trust_boundary(self):
        residual = _residual("R-001", "multi-candidate-bridge", ["svc-a"])
        unit_index = {"svc-a": {"kind": "service"}}
        relationships = [{"from": "svc-a", "to": "svc-b", "kind": "calls"}]
        result = compute_consequence(residual, unit_index, relationships)
        self.assertEqual(result["signals"], [])

    def test_signals_combine_and_dedupe(self):
        residual = _residual("R-001", "security-authority-policy", ["db.py"])
        unit_index = {"db.py": {"kind": "database"}}
        relationships = [{"from": "db.py", "to": "svc-b", "kind": "shares-secret"}]
        result = compute_consequence(residual, unit_index, relationships)
        self.assertEqual(result["signals"], ["external-system-identity", "pii-proxy", "trust-boundary-edge"])
        self.assertEqual(result["score"], 3)

    def test_run_level_residual_with_no_unit_ids_scores_zero(self):
        residual = _residual("R-001", "missing-intermediates-not-in-scan", [])
        result = compute_consequence(residual, {}, [])
        self.assertEqual(result, {"signals": [], "score": 0})

    def test_deterministic_same_input_same_output(self):
        residual = _residual("R-001", "ontology-judgment", ["db.py"])
        unit_index = {"db.py": {"kind": "database"}}
        self.assertEqual(compute_consequence(residual, unit_index, []), compute_consequence(residual, unit_index, []))


class TestAnnotateResiduals(unittest.TestCase):
    def test_attaches_consequence_field_to_every_residual(self):
        residuals = [_residual("R-001", "ontology-judgment", ["db.py"]), _residual("R-002", "multi-candidate-bridge", ["svc.py"])]
        unit_index = {"db.py": {"kind": "database"}, "svc.py": {"kind": "service"}}
        out = annotate_residuals(residuals, unit_index, [])
        self.assertEqual(out[0]["consequence"]["signals"], ["pii-proxy"])
        self.assertEqual(out[1]["consequence"]["signals"], [])


if __name__ == "__main__":
    unittest.main()
