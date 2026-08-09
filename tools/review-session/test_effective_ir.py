"""T-RS2-3 exit: real post-apply CALM produces a non-empty effective IR;
never touches intelligence-ir.md."""

import unittest

from effective_ir import build_effective_ir


class TestEffectiveIR(unittest.TestCase):
    def test_non_empty_for_real_shaped_calm(self):
        calm = {
            "nodes": [
                {"unique-id": "svc-orders", "node-type": "service", "name": "OrdersService"},
                {"unique-id": "db-orders", "node-type": "database", "name": "OrdersDb"},
            ],
            "relationships": [
                {
                    "unique-id": "rel-1",
                    "description": "connects",
                    "relationship-type": {"connects": {"source": {"node": "svc-orders"}, "destination": {"node": "db-orders"}}},
                    "metadata": [{"key": "x-aac-relationship-grade", "value": "architecture"}],
                }
            ],
        }
        md = build_effective_ir(calm, [], [], {"generatedAt": "2026-08-09T00:00:00Z"})
        self.assertGreater(len(md), 0)
        self.assertIn("svc-orders", md)
        self.assertIn("db-orders", md)
        self.assertIn("architecture", md)  # grade shows up in section 2

    def test_open_residuals_listed(self):
        residual = {"id": "R-001", "tier": "A", "class": "security-authority-policy", "rationale": "real rationale text"}
        md = build_effective_ir({"nodes": [], "relationships": []}, [residual], [], {"generatedAt": "2026-08-09T00:00:00Z"})
        self.assertIn("R-001", md)
        self.assertIn("real rationale text", md)

    def test_decision_log_rendered(self):
        decision = {"decision_id": "D-001", "target_ref": "svc-orders", "final_decision": {"action": "overridden"}, "reviewer": "architect:x", "rationale": "why"}
        md = build_effective_ir({"nodes": [], "relationships": []}, [], [decision], {"generatedAt": "2026-08-09T00:00:00Z"})
        self.assertIn("D-001", md)
        self.assertIn("overridden", md)
        self.assertIn("architect:x", md)

    def test_empty_calm_still_produces_valid_markdown(self):
        md = build_effective_ir({"nodes": [], "relationships": []}, [], [], {"generatedAt": "2026-08-09T00:00:00Z"})
        self.assertIn("# Effective architecture", md)
        self.assertIn("No relationships", md)
        self.assertIn("None — no S1/S2/S5/low-architecture-coverage residuals", md)

    def test_overridden_node_annotated(self):
        calm = {"nodes": [{"unique-id": "svc-x", "node-type": "database", "name": "X", "metadata": [{"key": "x-aac-override-provenance", "value": "D-001"}]}], "relationships": []}
        md = build_effective_ir(calm, [], [], {"generatedAt": "2026-08-09T00:00:00Z"})
        self.assertIn("overridden", md)

    def test_mvp_scope_note_present(self):
        """Must never silently claim to be the full §7.1 8-section template."""
        md = build_effective_ir({"nodes": [], "relationships": []}, [], [], {"generatedAt": "2026-08-09T00:00:00Z"})
        self.assertIn("B-calm-portable-ir", md)


if __name__ == "__main__":
    unittest.main()
