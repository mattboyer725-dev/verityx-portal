# VerityX on Google Cloud Run (Nitro node-server).
# Bind 0.0.0.0:$PORT. Secrets come from Secret Manager at deploy time — never bake them in.

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NODE_ENV=development \
    CI=true \
    NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Auth flag is inlined at build time. Cloud Run runtime env cannot change it.
ENV NITRO_PRESET=node-server \
    VITE_AUTH_ENABLED=true
RUN npm run build:gcp

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    NITRO_HOST=0.0.0.0 \
    PORT=8080 \
    NITRO_PORT=8080 \
    GCP_RUNTIME=1 \
    VITE_AUTH_ENABLED=true
RUN groupadd --system --gid 1001 verityx \
  && useradd --system --uid 1001 --gid verityx --home /app --shell /usr/sbin/nologin verityx
COPY --from=build --chown=verityx:verityx /app/.output ./.output
COPY --from=build --chown=verityx:verityx /app/package.json ./
USER verityx
EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
