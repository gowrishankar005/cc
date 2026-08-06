"""Ledger worker API — Flask + SQLAlchemy (lab fixture)."""
from flask import Flask, jsonify, request
from ledger_db import LedgerDb

app = Flask(__name__)
db = LedgerDb()


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/entries", methods=["POST"])
def post_entry():
    body = request.get_json(force=True, silent=True) or {}
    return jsonify(db.append(body)), 201


@app.route("/entries", methods=["GET"])
def list_entries():
    return jsonify(db.list_all())
