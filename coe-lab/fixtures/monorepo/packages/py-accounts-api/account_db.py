"""SQLAlchemy-backed account store (lab fixture)."""
from sqlalchemy import create_engine, text


class AccountDb:
    def __init__(self):
        self.engine = create_engine("sqlite:///:memory:")

    def list_all(self):
        return []

    def get(self, account_id):
        return {"id": account_id}

    def create(self, body):
        return {"id": "new", **body}
