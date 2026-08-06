# Deliberately no pyproject.toml/manifest here — this fixture exists purely
# to exercise detect-gate-smoketest.ts's suspectedSilentFailure path for
# T-X1-2's --strict-detect regression test: grep finds a route decorator,
# but CodeGraph's framework resolver never fires without a real package
# manifest, so nativeRouteCount stays 0. That mismatch IS the scenario
# --strict-detect exists to catch.
@app.route("/ping")
def ping():
    return "pong"
