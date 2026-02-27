# Task 12: Infrastructure & Deployment

> Docker setup, finalize package.json, create .env.example. Validate end-to-end build.

**Spec**: [12-infrastructure-deployment.md](../spec/12-infrastructure-deployment.md)
**LOC target**: N/A (config files)

## Checklist

- [ ] **Create `Dockerfile`**
  - Base: `node:22-slim`
  - Install `git`, `curl`
  - Create non-root user `appuser`
  - `COPY` package files, `npm ci`, copy source, `npm run build`
  - Pre-create dirs: repos, state, logs
  - `USER appuser`, `CMD ["node", "dist/index.js"]`

- [ ] **Create `docker-compose.yml`**
  - Service `swe-team` with build context
  - Volumes: config.yaml (ro), state, repos, logs
  - Environment: TELEGRAM_BOT_TOKEN, GITHUB_TOKEN from host
  - restart: unless-stopped, stdin_open: true, tty: true

- [ ] **Finalize `package.json`**
  - All dependencies with correct versions
  - Scripts: build, start, dev
  - Bin entry for `swe-team` command (optional)

- [ ] **Create `.env.example`**
  ```
  # Required
  GITHUB_TOKEN=ghp_your_token_here

  # Optional (if using Telegram interface)
  TELEGRAM_BOT_TOKEN=your_bot_token_here
  ```

- [ ] **Validate external tools**
  - Add startup check in `main.ts setup()`: verify `git --version`, `gh --version` succeed
  - Verify configured CLI backend is available: `cli.checkAvailable()`
  - Log warnings for missing optional tools

- [ ] **Verify**: `docker build .` succeeds, `docker compose up` starts the orchestrator
