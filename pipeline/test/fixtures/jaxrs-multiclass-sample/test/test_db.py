import psycopg2


class FakeDbTestHelper:
    """T-TC1-3 (B-test-code-exclusion) — a real test-fixture class importing
    a real catalogued driver library. Must produce ZERO database units —
    excluded from Graphify-driven persistence detection as test code."""

    def __init__(self):
        self.conn = psycopg2.connect("dbname=test")
