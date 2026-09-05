# syntax=docker/dockerfile:1.7
# Reproducible production image for the Gruia single-daemon deployment.
# Build from the repository root, not this directory.
ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS build

ENV CI=true \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      git \
      python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Copying the full source intentionally keeps this recipe robust as workspace
# packages and runtime assets change. The frozen lockfile remains authoritative.
COPY . ./

RUN corepack enable \
    && corepack prepare pnpm@10.33.2 --activate \
    && pnpm install --frozen-lockfile \
    && pnpm --filter @open-design/daemon exec npm rebuild node-pty \
    && pnpm --filter @open-design/daemon build \
    && NEXT_PUBLIC_GRUIA_MANAGED=1 pnpm --filter @open-design/web build \
    && pnpm --filter @open-design/daemon deploy --legacy --prod /opt/open-design/daemon

FROM ${NODE_IMAGE} AS runtime

ARG CLAUDE_CODE_VERSION=2.1.261

# chromium and its Debian runtime dependencies are installed from Bookworm so
# Claude/browser-backed design workflows use glibc-compatible native binaries.
RUN apt-get update && apt-get install -y --no-install-recommends \
      bash \
      ca-certificates \
      chromium \
      dumb-init \
      fonts-noto-core \
      fonts-noto-color-emoji \
      git \
      poppler-utils \
    && npm install --global --omit=dev "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
    && groupadd --gid 1001 open-design \
    && useradd --uid 1001 --gid 1001 --create-home --home-dir /var/lib/open-design/home --shell /usr/sbin/nologin open-design \
    && rm -rf /var/lib/apt/lists/* /root/.npm

WORKDIR /app

# The deployed daemon's dist and production dependency closure.
COPY --from=build --chown=1001:1001 /opt/open-design/daemon ./apps/daemon
# The daemon derives PROJECT_ROOT as /app and serves this static export itself.
COPY --from=build --chown=1001:1001 /workspace/apps/web/out ./apps/web/out

# Resource-root contents consumed by skills, templates, static routes, and the
# bundled first-party/registry plugin catalog. Do not replace these with host
# home mounts: the image is self-contained and immutable.
COPY --from=build --chown=1001:1001 /workspace/skills ./skills
COPY --from=build --chown=1001:1001 /workspace/design-templates ./design-templates
COPY --from=build --chown=1001:1001 /workspace/design-systems ./design-systems
COPY --from=build --chown=1001:1001 /workspace/craft ./craft
COPY --from=build --chown=1001:1001 /workspace/prompt-templates ./prompt-templates
COPY --from=build --chown=1001:1001 /workspace/assets ./assets
COPY --from=build --chown=1001:1001 /workspace/data ./data
COPY --from=build --chown=1001:1001 /workspace/plugins/_official ./plugins/_official
COPY --from=build --chown=1001:1001 /workspace/plugins/registry ./plugins/registry
COPY --chown=1001:1001 deploy/gruia/open-design-entrypoint.sh /usr/local/bin/open-design-entrypoint

RUN chmod 0755 /usr/local/bin/open-design-entrypoint \
    && mkdir -p /var/lib/open-design/claude \
    && chown -R 1001:1001 /app /var/lib/open-design

ENV NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=384 \
    OD_BIND_HOST=0.0.0.0 \
    OD_PORT=7456 \
    OD_RESOURCE_ROOT=/app \
    OD_DATA_DIR=/var/lib/open-design \
    HOME=/var/lib/open-design/home \
    CLAUDE_CONFIG_DIR=/var/lib/open-design/claude \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 7456
USER 1001:1001
ENTRYPOINT ["dumb-init", "--", "/usr/local/bin/open-design-entrypoint"]
CMD ["node", "apps/daemon/dist/cli.js", "--no-open"]
