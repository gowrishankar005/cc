"""SQLAlchemy ledger store (lab fixture)."""
from sqlalchemy import create_engine


class LedgerDb:
    def __init__(self):
        self.engine = create_engine("sqlite:///:memory:")
        self._rows = []

    def append(self, body):
        self._rows.append(body)
        return body

    def list_all(self):
        return list(self._rows)
