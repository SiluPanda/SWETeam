# Infrastructure & Deployment

> Docker containerization and TypeScript/Node.js packaging. The orchestrator is a thin Node.js process -- all heavy lifting delegated to external CLIs.

## Dockerfile

```dockerfile
FROM node:22-slim

RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*
RUN useradd -m -s /bin/bash appuser

WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src/ src/
COPY config.yaml .
RUN npm run build
RUN mkdir -p /app/repos /app/state /app/logs

USER appuser
CMD ["node", "dist/index.js"]
```

Note: Docker image does **not** include `gh`, `claude`, `codex`, or `aider` CLIs. These must be volume-mounted or installed in a derived image.

## docker-compose.yml

```yaml
services:
  swe-team:
    build: .
    volumes:
      - ./config.yaml:/app/config.yaml:ro
      - ./state:/app/state
      - ./repos:/app/repos
      - ./logs:/app/logs
    environment:
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - GITHUB_TOKEN=${GITHUB_TOKEN}
    restart: unless-stopped
    stdin_open: true
    tty: true
```

## package.json

```json
{
  "name": "swe-team",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "drizzle-orm": "^0.35.0",
    "js-yaml": "^4.1.0",
    "dotenv": "^16.4.0",
    "async-mutex": "^0.5.0"
  },
  "optionalDependencies": {
    "node-telegram-bot-api": "^0.66.0",
    "express": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tsx": "^4.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/js-yaml": "^4.0.0",
    "@types/node": "^22.0.0",
    "drizzle-kit": "^0.28.0"
  }
}
```

| Package | Purpose |
|---------|---------|
| `better-sqlite3` | Sync SQLite driver |
| `drizzle-orm` | Type-safe ORM |
| `js-yaml` | YAML config parsing |
| `dotenv` | `.env` file loading |
| `async-mutex` | Per-repo async locking |
| `node-telegram-bot-api` | Optional Telegram interface |
| `express` | Optional HTTP API interface |

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"]
}
```

## External Tool Requirements

| Tool | Required | Purpose |
|------|----------|---------|
| `git` | Yes | All git operations |
| `gh` | Yes | Clone repos, create PRs |
| `claude` | If provider=claude | Claude Code CLI (all intelligent work) |
| `codex` | If provider=codex | Codex CLI (all intelligent work) |
| `aider` | If provider=aider | Aider CLI (all intelligent work) |

## Local Development

```bash
git clone <repo-url> swe-team && cd swe-team
npm install
cp config.yaml.example config.yaml  # edit as needed
echo "GITHUB_TOKEN=ghp_..." > .env
npm run dev
```

## Source Files

- `Dockerfile`
- `docker-compose.yml`
- `package.json`
- `tsconfig.json`
- `.env.example`
