<div align="center">
<pre>
╔══════════════════════════════╗
║                              ║
║         ●          ●         ║
║                              ║
║          ──────────          ║
║                              ║
╚══════════════════════════════╝
        ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
┌──────────────────────────────┐
└──────────────────────────────┘
            SWE Team
</pre>
</div>

# SWE Team

**Autonomous agent swarm orchestrator for AI-powered software engineering.**

SWE Team translates natural language requirements into production-level, well-tested code by coordinating an autonomous swarm of AI agents — 1 Architect + N SWE agents — working in parallel across isolated git worktrees.

[![Node.js 22+](https://img.shields.io/badge/node-22%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Table of Contents

- [Key Features](#key-features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Interfaces](#interfaces)
- [CLI Backends](#cli-backends)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Docker](#docker)
- [How It Works](#how-it-works)
- [Contributing](#contributing)
- [License](#license)

---

## Key Features

- **Zero-intelligence orchestrator** — all reasoning delegated to external AI CLIs; the orchestrator owns only coordination, state, and git ops
- **Parallel agent execution** — up to N SWE agents working concurrently on subtasks with dependency-aware scheduling
- **Workspace isolation** — each agent operates in its own git worktree, eliminating merge conflicts during development
- **Crash recovery** — 19-step checkpointed workflow with SQLite WAL mode ensures no work is lost on failure
- **Multi-backend support** — pluggable CLI backends (Claude Code, Codex, Aider) with a unified interface
- **Automated code review** — Architect agent reviews all SWE output with configurable iteration limits
- **Multiple interfaces** — interactive CLI, Telegram bot, or HTTP API
- **Repository locking** — mutex-based concurrency control prevents conflicting operations on shared repos

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      User Interface                     │
│              (CLI  /  Telegram  /  HTTP API)             │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                   SWE Team Orchestrator                  │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  State    │  │  Workflow    │  │  Agent Pool       │  │
│  │  Manager  │  │  Runner      │  │  Manager          │  │
│  │ (SQLite)  │  │ (19 steps)  │  │ (1..N agents)     │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Git Ops │  │  Workspace   │  │  Repo Locks       │  │
│  │          │  │  (worktrees) │  │  (mutex)          │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    CLI Backends                          │
│         Claude Code  |  Codex  |  Aider                 │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                  Target Repository                      │
│              (cloned & managed via git)                  │
└─────────────────────────────────────────────────────────┘
```

**Agent Roles:**

| Agent | Model (default) | Responsibility |
|-------|----------------|----------------|
| **Architect** | `claude-opus-4-6` | Analyzes codebase, creates implementation plans, reviews code |
| **SWE** (x N) | `claude-sonnet-4-6` | Implements subtasks, writes tests, applies review feedback |

---

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| **Node.js** | 22+ | Runtime |
| **npm** | 10+ | Package manager |
| **git** | 2.20+ | Repository operations & worktrees |
| **gh** | 2.0+ | GitHub CLI for PR creation |
| **claude** | latest | Claude Code CLI (primary backend) |

Optional: `codex` or `aider` CLIs if using alternative backends.

---

## Installation

```bash
# Clone the repository
git clone https://github.com/SiluPanda/SWETeam.git
cd SWETeam

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Build
npm run build
```

---

## Configuration

### Environment Variables

Edit `.env` with your credentials:

```bash
# Required — GitHub token for git operations and PR creation
GITHUB_TOKEN=ghp_your_token_here

# Optional — only if using the Telegram interface
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

### config.yaml

The main configuration file controls all orchestrator behavior:

```yaml
# User interface: "cli" | "telegram" | "api"
interface: "cli"

# Agent configuration
agents:
  architect:
    provider: "claude"           # claude | codex | aider
    model: "claude-opus-4-6"
    timeout: 900                 # seconds
  swe:
    provider: "claude"
    model: "claude-sonnet-4-6"
    timeout: 900

# Parallel agent pool
agent_pool:
  max_agents: 4

# Workflow behavior
agent:
  max_review_iterations: 3       # code review rounds before accepting
  max_clarification_rounds: 10   # requirement clarification rounds
  skip_clarification: false      # skip requirement clarification step
  approval_threshold: "good"     # minimum review quality to merge
  on_subtask_failure: "retry"    # retry | skip | abort

# Paths
repos:
  base_path: "./repos"
  workspaces_path: "./workspaces"
database:
  path: "./state/swe-team.db"
logging:
  level: "info"
  file: "./logs/swe-team.log"
```

See [`config.yaml`](config.yaml) for the full configuration reference.

---

## Usage

### Start the orchestrator

```bash
# Development mode (with hot reload)
npm run dev

# Production
npm run build && npm start
```

### Submit a task

In the CLI interface, provide a GitHub repository and a task description:

```
swe-team> owner/repo Implement user authentication with JWT and refresh tokens

swe-team> myorg/api Add rate limiting middleware with Redis backend
```

### Commands

| Command | Description |
|---------|-------------|
| `owner/repo <task>` | Submit a new task |
| `/list` | Show all active workflow runs |
| `/status` | Show detailed status of current run |
| `/stop <run_id>` | Cancel a running workflow |
| `quit` | Exit the orchestrator |

---

## Interfaces

SWE Team supports three user interface modes, configured via `config.yaml`:

### CLI (default)

Interactive terminal interface using readline. Best for local development.

```yaml
interface: "cli"
```

### Telegram Bot

Control SWE Team remotely via Telegram. Requires a bot token.

```yaml
interface: "telegram"
telegram:
  bot_token: "your_bot_token"
  allowed_users: [123456789]    # restrict access by user ID
```

### HTTP API

RESTful API for programmatic integration.

```yaml
interface: "api"
```

---

## CLI Backends

The orchestrator delegates all code intelligence to external CLI tools. Three backends are supported:

| Backend | CLI | Config Value | Notes |
|---------|-----|-------------|-------|
| **Claude Code** | `claude` | `"claude"` | Default. Best quality. |
| **Codex** | `codex` | `"codex"` | OpenAI Codex CLI |
| **Aider** | `aider` | `"aider"` | Open-source alternative |

Configure per-agent in `config.yaml`:

```yaml
agents:
  architect:
    provider: "claude"
  swe:
    provider: "codex"    # mix backends per role
```

---

## Project Structure

```
swe-team/
├── src/
│   ├── index.ts               # Entry point
│   ├── main.ts                # SWETeam orchestrator class
│   ├── workflow.ts            # 19-step state machine
│   ├── config.ts              # YAML config loader
│   ├── state.ts               # SQLite state manager
│   ├── cli-backend.ts         # CLI backend abstraction
│   ├── git-ops.ts             # Git/GitHub operations
│   ├── workspace.ts           # Worktree management
│   ├── agent-pool.ts          # Parallel agent pool
│   ├── repo-locks.ts          # Repository mutex locks
│   ├── messaging.ts           # Output formatting
│   ├── agents/
│   │   ├── base.ts            # BaseAgent abstract class
│   │   ├── architect.ts       # Planning & review agent
│   │   └── swe.ts             # Implementation agent
│   ├── interfaces/
│   │   ├── base.ts            # InterfaceAdapter abstract
│   │   ├── cli.ts             # Terminal interface
│   │   ├── telegram.ts        # Telegram bot interface
│   │   └── api.ts             # HTTP API interface
│   ├── db/
│   │   ├── schema.ts          # Drizzle ORM schema
│   │   └── index.ts           # Database initialization
│   └── prompts/               # Agent system prompts
├── spec/                      # System specifications
├── tasks/                     # Implementation task docs
├── config.yaml                # Main configuration
├── .env.example               # Environment template
├── Dockerfile                 # Multi-stage container build
├── docker-compose.yml         # Local container orchestration
├── tsconfig.json              # TypeScript config
└── vitest.config.ts           # Test runner config
```

---

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

Test suites cover all core modules:

| Module | Test File |
|--------|-----------|
| Configuration | `src/config.test.ts` |
| State Manager | `src/state.test.ts` |
| Workflow Runner | `src/workflow.test.ts` |
| Git Operations | `src/git-ops.test.ts` |
| Workspace | `src/workspace.test.ts` |
| Agent Pool | `src/agent-pool.test.ts` |
| Orchestrator | `src/main.test.ts` |
| CLI Backends | `src/cli-backend.test.ts` |
| Messaging | `src/messaging.test.ts` |
| Architect Agent | `src/agents/architect.test.ts` |
| SWE Agent | `src/agents/swe.test.ts` |
| Interfaces | `src/interfaces/interfaces.test.ts` |

---

## Docker

### Build and run with Docker Compose

```bash
docker-compose up
```

### Manual Docker build

```bash
# Build the image
docker build -t swe-team .

# Run with required environment variables
docker run -it \
  -e GITHUB_TOKEN=ghp_your_token \
  -v $(pwd)/config.yaml:/app/config.yaml:ro \
  -v $(pwd)/state:/app/state \
  -v $(pwd)/repos:/app/repos \
  -v $(pwd)/logs:/app/logs \
  swe-team
```

The Docker image uses a multi-stage build with `node:22-slim`, runs as a non-root user (`appuser`), and includes `git` and `curl` in the runtime image.

---

## How It Works

SWE Team executes a **19-step checkpointed workflow** for each task:

```
 1. REPO_SYNC          Clone or pull the target repository
 2. WORKSPACE_CREATED  Create isolated git worktree
 3. BRANCH_CREATED     Create feature branch
 4. CLARIFYING         Architect clarifies requirements with user
 5. PLAN_CREATED       Architect analyzes codebase and produces plan
 6. PLAN_APPROVED      User approves the implementation plan
 7. AGENTS_SPAWNED     SWE agent pool initialized
 8. SUBTASKS_ASSIGNED   Subtasks distributed to agents
 9. IN_PROGRESS        Agents implement subtasks in parallel
10. SUBTASK_COMPLETE   Individual subtask finished
11. CODE_REVIEW        Architect reviews implementation
12. REVIEW_APPROVED    Code passes quality review
13. CHANGES_MERGED     Feature branch merged to main
14. PR_CREATED         Pull request opened on GitHub
15. COMPLETED          Workflow finished successfully
16. FAILED             Workflow terminated with error
17. CANCELLED          Workflow cancelled by user
18. RECOVERY           Crash recovery in progress
19. STALE              Workflow timed out
```

Each step is persisted to SQLite. On crash or restart, the workflow resumes from the last completed checkpoint.

**Workflow lifecycle:**

1. **User submits** `owner/repo <task>` via any interface
2. **Repo sync** — clone or fast-forward the repository
3. **Workspace isolation** — create a git worktree for the task
4. **Clarification** — Architect asks clarifying questions (skippable)
5. **Planning** — Architect analyzes codebase, produces a dependency-ordered subtask plan
6. **Parallel execution** — SWE agents implement subtasks concurrently, respecting dependencies
7. **Code review** — Architect reviews each subtask's output, requests changes if needed (up to 3 iterations)
8. **Merge & PR** — changes merged to target branch, pull request created on GitHub

---

## Contributing

Contributions are welcome. Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Write tests for new functionality
4. Ensure all tests pass (`npm test`)
5. Commit with conventional messages (`feat:`, `fix:`, `refactor:`, etc.)
6. Open a pull request

---

## License

[MIT](LICENSE)
