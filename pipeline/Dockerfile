# Weaver pipeline runtime image — Node.js orchestration + Python (Graphify).
#
# Built and smoke-tested via .github/workflows/pipeline-test.yml's
# docker-build job on every push — not just written against known-correct
# requirements and assumed to work.

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

# The CLI entrypoint (package.json's "bin" field, confirmed to actually work
# when installed globally). Callers pass package roots + --out as CMD args, e.g.:
#   docker run --rm -v "$(pwd):/repo" weaver-pipeline /repo/some-service --out /repo/out
ENTRYPOINT ["node", "dist/orchestration/run-slice.js"]
