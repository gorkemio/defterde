FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS build
WORKDIR /app
ENV ASTRO_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY astro.config.mjs tsconfig.json tsconfig.server.json ./
COPY config ./config
COPY games ./games
COPY docs/imports ./docs/imports
COPY scripts ./scripts
COPY content ./content
COPY src ./src
COPY public ./public
RUN npm run build
RUN npm prune --omit=dev --ignore-scripts

FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321 SNAPSHOT_DIR=/app/var ASTRO_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/build/server ./build/server
COPY --from=build --chown=node:node /app/build/lib ./build/lib
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node config ./config
COPY --chown=node:node deploy/migrations ./deploy/migrations
RUN mkdir /app/var && chown node:node /app/var
USER node
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:4321/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","build/server/index.js"]
