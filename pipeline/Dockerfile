# Loom pipeline runtime image — Node.js orchestration + Python (Graphify).
#
# HONEST STATUS: written against known, verified requirements (Node 22 —
# confirmed via `node --version` this session; the real `graphifyy` pip
# package and its console-script PATH quirk, confirmed this session;
# package.json's real build steps) but never actually run through
# `docker build` — no Docker daemon is available in this development
# sandbox. Verify with a real build before relying on this in CI/production,
# per this project's own "specified vs proven" discipline — don't treat
# this comment as equivalent to a passing build.

FROM node:22-bookworm-slim

# Python + pip for Graphify (the cross-package structural backbone,
# scanner/graphify-provider.ts). A venv avoids Debian 12's PEP 668
# externally-managed-environment restriction without needing
# --break-system-packages.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/graphify-venv \
    && /opt/graphify-venv/bin/pip install --no-cache-dir graphifyy
ENV PATH="/opt/graphify-venv/bin:${PATH}"

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

# The CLI entrypoint (package.json's "bin" field, confirmed this session to
# actually work when installed globally — a real, tested finding, not an
# assumption). Callers pass package roots + --out as CMD args, e.g.:
#   docker run --rm -v "$(pwd):/repo" loom /repo/some-service --out /repo/out
ENTRYPOINT ["node", "dist/orchestration/run-slice.js"]
