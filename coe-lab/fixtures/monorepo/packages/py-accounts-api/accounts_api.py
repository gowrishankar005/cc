"""Accounts API — Flask + SQLAlchemy (lab fixture)."""
from flask import Flask, jsonify, request
from account_db import AccountDb

app = Flask(__name__)
db = AccountDb()


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/accounts", methods=["GET"])
def list_accounts():
    return jsonify(db.list_all())


@app.route("/accounts/<id>", methods=["GET"])
def get_account(id):
    return jsonify(db.get(id))


@app.route("/accounts", methods=["POST"])
def create_account():
    body = request.get_json(force=True, silent=True) or {}
    return jsonify(db.create(body)), 201


if __name__ == "__main__":
    app.run(port=8080)
