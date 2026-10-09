# The self-hosted stack, in one image
# (docs/specs/016-platform/blueprints/self-hosted-runtime.md, "Delivery").
#
#   docker build --target runtime .    # app + the five built sites
#   docker build --target app .        # the api, the rooms and the identity provider
#
# The app process serves the sites itself, so Caddy terminates TLS and forwards;
# it does not need a volume of build output.

# --- build: the workspace, bundled -------------------------------------------
FROM node:22-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
# The lockfile decides everything, so manifests come before sources: editing a
# source file does not reinstall the workspace.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
# The workspace's root prepare hook installs git hooks; a container has no .git and no
# use for them, but the script has to be there for `pnpm install` to get that far.
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile
# The app process: the api worker bundled with the Node runtime, migrations beside it.
RUN pnpm --filter @livediagram/server build
# The MCP process: the same worker source on Node, with its OAuth state in SQLite
# and the resvg wasm inside the bundle.
RUN pnpm --filter @livediagram/mcp build:node

# --- sites: the five static exports ------------------------------------------
FROM build AS sites
RUN pnpm build

# --- app: what a minimal deployment runs -------------------------------------
FROM node:22-slim AS app
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/apps/server/dist ./dist
# The MCP process's bundle; the `mcp` service runs it (docker-compose.yml).
COPY --from=build /app/apps/mcp/dist ./mcp-dist
# The database and the object store want a volume; a deployment that mounts
# nothing still starts, it just keeps them in the container.
ENV DATABASE_PATH=/data/livediagram.sqlite
ENV OBJECTS_DIR=/data/objects
ENV PORT=8787
ENV HOST=0.0.0.0
VOLUME /data
EXPOSE 8787
CMD ["node", "dist/main.mjs"]

# --- runtime: app + the built sites -----------------------------------------
FROM app AS runtime
COPY --from=sites /app/apps/marketing/out ./static/marketing
COPY --from=sites /app/apps/live/out ./static/live
COPY --from=sites /app/apps/telemetry/out ./static/telemetry
COPY --from=sites /app/apps/help/out ./static/help
COPY --from=sites /app/apps/community/out ./static/community
ENV STATIC_ROOT=/app/static