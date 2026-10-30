# Builds the admin web and the customer web app, then serves both (and proxies the API) with Caddy.
# Build context: repository root.   API_URL: public https URL of the backend, e.g. https://api.example.com
# Base images come from Docker Hub by default; set BASE_REGISTRY=mirror.gcr.io/library to use Google's mirror
ARG BASE_REGISTRY=docker.io/library

FROM ${BASE_REGISTRY}/node:22-bookworm-slim AS admin
WORKDIR /app
COPY admin-web/package.json admin-web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY admin-web/ ./
ARG API_URL
ENV VITE_API_BASE_URL=${API_URL}
RUN npm run build

FROM ${BASE_REGISTRY}/node:22-bookworm-slim AS shop
WORKDIR /app
COPY customer-app/package.json customer-app/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY customer-app/ ./
ARG API_URL
ENV EXPO_PUBLIC_API_BASE_URL=${API_URL} APP_ENV=production CI=1
RUN npx expo export --platform web --output-dir dist

FROM ${BASE_REGISTRY}/caddy:2.10-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=admin /app/dist /srv/admin
COPY --from=shop /app/dist /srv/shop
