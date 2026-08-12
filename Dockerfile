# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 – deps: install only production dependencies
# ---------------------------------------------------------------------------
FROM node:26-bookworm-slim AS deps

# canvas native module requires these build tools at install time
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 \
      make \
      g++ \
      pkg-config \
      libcairo2-dev \
      libpango1.0-dev \
      libjpeg-dev \
      libgif-dev \
      librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY package.json package-lock.json* ./

RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
# Stage 2 – runtime: minimal image, rootless
# ---------------------------------------------------------------------------
FROM node:26-bookworm-slim AS runtime

# Runtime libraries needed by node-canvas (no build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
      libcairo2 \
      libpango-1.0-0 \
      libpangocairo-1.0-0 \
      libjpeg62-turbo \
      libgif7 \
      librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*

# ---------- Rootless setup ----------
# node:20 images already contain a "node" user (uid=1000)
# We just make sure our app directory is owned by it.
WORKDIR /app

COPY --from=deps --chown=node:node /build/node_modules ./node_modules
COPY --chown=node:node src/ ./src/
COPY --chown=node:node package.json ./

# Drop to non-root user
USER node

# ---- Security hardening ----
# Read-only filesystem is enforced at the Kubernetes level (readOnlyRootFilesystem: true)
# No new privileges
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    LOG_LEVEL=info

EXPOSE 3000

# Use tini-less Node signal handling (node handles SIGTERM natively)
ENTRYPOINT ["node", "src/index.js"]
