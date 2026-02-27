# Task 09: Configuration

> YAML config loading with env var overrides and TypeScript types.

**Spec**: [09-configuration.md](../spec/09-configuration.md)
**File**: `src/config.ts`
**LOC target**: ~60

## Checklist

- [ ] **Define TypeScript interfaces**
  - `AgentLLMConfig`: provider, model, extraFlags, timeout
  - `AgentPoolConfig`: maxAgents
  - `AgentConfig`: maxReviewIterations, maxClarificationRounds, skipClarification, approvalThreshold, onSubtaskFailure, prompts
  - `TelegramConfig`: botToken, allowedUsers
  - `GitConfig`: defaultBranch, authorName, authorEmail, githubToken
  - `RepoConfig`: basePath, workspacesPath, cloneTimeout
  - `DatabaseConfig`: path
  - `ProcessingConfig`: maxConcurrentTasks, workflowTimeout
  - `LoggingConfig`: level, file
  - `Config`: top-level combining all sections

- [ ] **Define `DEFAULT_CONFIG` constant** with all default values

- [ ] **Implement `loadConfig(path?)`**
  - Read `config.yaml` via `js-yaml` if exists, otherwise use defaults
  - Deep merge with defaults
  - Apply env var overrides: `TELEGRAM_BOT_TOKEN`, `GITHUB_TOKEN`
  - Resolve relative paths against `process.cwd()`

- [ ] **Implement singleton**
  - `getConfig(path?)`: lazy init
  - `reloadConfig(path?)`: replace singleton

- [ ] **Verify**: Loads config.yaml, applies env overrides, returns typed Config
