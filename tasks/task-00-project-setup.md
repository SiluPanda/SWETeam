# Task 00: Project Setup & Structure

> Initialize TypeScript project, configure build tooling, create default config and prompt templates.

**Spec**: [00-index.md](../spec/00-index.md)
**LOC target**: N/A (scaffolding)

## Checklist

- [ ] **Initialize npm project**
  - `package.json` with name `swe-team`, type `module`
  - Dependencies: `better-sqlite3`, `drizzle-orm`, `js-yaml`, `dotenv`, `async-mutex`
  - Optional deps: `node-telegram-bot-api`, `express`
  - Dev deps: `typescript`, `tsx`, `@types/*`, `drizzle-kit`
  - Scripts: `build` (tsc), `start` (node dist/index.js), `dev` (tsx src/index.ts)

- [ ] **Create `tsconfig.json`**
  - Target: ES2022, module: NodeNext, strict: true
  - outDir: `dist`, rootDir: `src`

- [ ] **Create directory structure**
  ```
  src/
    index.ts
    main.ts
    workflow.ts
    config.ts
    state.ts
    repo-locks.ts
    git-ops.ts
    workspace.ts
    agent-pool.ts
    cli-backend.ts
    messaging.ts
    interfaces/
      base.ts
      cli.ts
      telegram.ts
      api.ts
    agents/
      base.ts
      architect.ts
      swe.ts
    db/
      schema.ts
      index.ts
    prompts/
      architect-system.md
      architect-clarify.md
      architect-review.md
      swe-system.md
  ```

- [ ] **Create `config.yaml`** with all default values per [spec/09](../spec/09-configuration.md)

- [ ] **Create `.env.example`**
  ```
  TELEGRAM_BOT_TOKEN=
  GITHUB_TOKEN=
  ```

- [ ] **Create prompt template files**
  - `src/prompts/architect-system.md` -- system prompt for Architect CLI sessions
  - `src/prompts/architect-clarify.md` -- clarification prompt for Architect CLI sessions
  - `src/prompts/architect-review.md` -- review prompt for Architect CLI sessions
  - `src/prompts/swe-system.md` -- system prompt for SWE CLI sessions

- [ ] **Create `.gitignore`**
  - `node_modules/`, `dist/`, `.env`, `state/`, `repos/`, `workspaces/`, `logs/`

- [ ] **Verify**: `npm install && npm run build` succeeds with empty source files
