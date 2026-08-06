"""Lab fixture — call-based JWT verification (Bank of Anthos–shaped).

Platform may only partially detect this until call-based control catalogue lands.
"""
from flask import Flask, jsonify, request

app = Flask(__name__)


def _verify(token: str) -> dict:
    # Call-based auth signal (not a decorator)
    import jwt

    return jwt.decode(token, options={"verify_signature": False})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/secure/ping", methods=["GET"])
def secure_ping():
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "") if auth.startswith("Bearer ") else ""
    claims = _verify(token) if token else {}
    return jsonify({"ok": True, "sub": claims.get("sub")})
