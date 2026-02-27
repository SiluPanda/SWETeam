FROM node:22-slim AS build

WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src/ src/
RUN npm run build

FROM node:22-slim

RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*
RUN useradd -m -s /bin/bash appuser

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist dist/
COPY config.yaml .
COPY src/prompts/ src/prompts/
RUN mkdir -p /app/repos /app/state /app/logs && chown -R appuser:appuser /app

USER appuser
CMD ["node", "dist/index.js"]
