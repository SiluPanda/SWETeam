# Configuration

> YAML-based config (~60 LOC) with env var overrides. Configures CLI backends, agent pool size, and interface selection.

## Overview

Configuration is defined as TypeScript interfaces, loaded from `config.yaml` via `js-yaml`. The orchestrator passes model/provider config to CLI backends as flags -- it has no opinion about which model is best.

## Config Structure

```yaml
interface: "cli"                   # "cli", "telegram", "api"

telegram:
  bot_token: ""                    # or TELEGRAM_BOT_TOKEN env var
  allowed_users: []

agents:
  architect:
    provider: "claude"             # "claude", "codex", "aider"
    model: "claude-opus-4-6"       # passed as --model flag to CLI
    extra_flags: "--dangerously-skip-permissions"
    timeout: 900
  swe:
    provider: "claude"
    model: "claude-sonnet-4-6"
    extra_flags: "--dangerously-skip-permissions"
    timeout: 900

agent_pool:
  max_agents: 4

git:
  default_branch: "main"
  author_name: "SWE Team Bot"
  author_email: "bot@swe-team.local"
  github_token: ""                 # or GITHUB_TOKEN env var

repos:
  base_path: "./repos"
  workspaces_path: "./workspaces"
  clone_timeout: 300

database:
  path: "./state/swe-team.db"

processing:
  max_concurrent_tasks: 4
  workflow_timeout: 7200

agent:
  max_review_iterations: 3
  max_clarification_rounds: 10
  skip_clarification: false
  approval_threshold: "good"
  on_subtask_failure: "retry"
  prompts:
    architect: "src/prompts/architect-system.md"
    architect_clarify: "src/prompts/architect-clarify.md"
    architect_review: "src/prompts/architect-review.md"
    swe: "src/prompts/swe-system.md"

logging:
  level: "info"
  file: "./logs/swe-team.log"
```

## TypeScript Types

```typescript
interface AgentLLMConfig {
  provider: string;   // "claude" | "codex" | "aider"
  model: string;      // --model flag value
  extraFlags: string; // extra CLI flags
  timeout: number;    // subprocess timeout in seconds
}

interface Config {
  interface: "cli" | "telegram" | "api";
  telegram: { botToken: string; allowedUsers: number[] };
  agents: { architect: AgentLLMConfig; swe: AgentLLMConfig };
  agentPool: { maxAgents: number };
  git: { defaultBranch: string; authorName: string; authorEmail: string; githubToken: string };
  repos: { basePath: string; workspacesPath: string; cloneTimeout: number };
  database: { path: string };
  processing: { maxConcurrentTasks: number; workflowTimeout: number };
  agent: { maxReviewIterations: number; maxClarificationRounds: number; skipClarification: boolean; approvalThreshold: string; onSubtaskFailure: string; prompts: Record<string, string> };
  logging: { level: string; file: string };
}
```

## Loading

```typescript
function loadConfig(path = "config.yaml"): Config {
  const raw = fs.existsSync(path) ? yaml.load(fs.readFileSync(path, "utf8")) : {};
  // Merge with defaults, apply env var overrides
  return { ...defaults, ...raw };
}

let _config: Config | null = null;
function getConfig(path?: string): Config {
  if (!_config) _config = loadConfig(path);
  return _config;
}
```

## Env Var Overrides

| Env Var | Config Field |
|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | `telegram.botToken` |
| `GITHUB_TOKEN` | `git.githubToken` |

## Estimated LOC: ~60

## Source Files

- `src/config.ts` -- Types, `loadConfig()`, `getConfig()`
- `config.yaml` -- Default configuration
