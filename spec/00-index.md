# SWE Team - System Overview

> A pure orchestrator that coordinates an autonomous agent swarm (1 Architect + N SWE agents) to translate any requirement into production-level, well-tested code. All intelligent work is delegated to external coding CLIs (Claude Code, Codex, Aider) -- the orchestrator owns only workflow, state, git, and coordination.

## Overview

SWE Team is a **workflow orchestrator**, not an AI system. It has zero intelligence of its own. It manages git operations, state persistence, agent lifecycle, workspace isolation, and parallel coordination -- then delegates every cognitive task (code analysis, planning, implementation, testing, review) to external AI coding CLIs via `child_process.execFile`.

Users submit tasks through a pluggable interface (CLI, Telegram, or programmatic API). The orchestrator clones or syncs the target repository, invokes the Architect CLI session to analyze and plan, spawns N parallel SWE CLI sessions in isolated worktrees, collects and parses their structured output, coordinates the review loop, and opens a GitHub Pull Request.

Each CLI session can be **Claude Code**, **Codex**, or **Aider** -- each of which can independently use any model they support (Claude, GPT, DeepSeek, Gemini, etc. via OpenRouter). The orchestrator doesn't care which model runs -- it only cares about the structured output.

## Design Philosophy

**The orchestrator does NOT:**
- Call any LLM API directly
- Make any intelligent decisions about code
- Parse or understand code semantics
- Generate prompts beyond templated instructions
- Route models or optimize costs (that's the CLI's job)

**The orchestrator DOES:**
- Manage git repositories (clone, branch, worktree, merge, push, PR)
- Persist workflow state (SQLite checkpoints for crash recovery)
- Spawn and manage N CLI child processes
- Parse structured output (JSON) from CLI responses
- Coordinate parallel execution and dependency ordering
- Handle the Architect ↔ SWE feedback loop
- Provide a user interface (CLI, Telegram, API)

## End-to-End User Flow

```
User submits task (via CLI / Telegram / API)
         |
         v
  Interface Layer receives request
         |
         v
  WorkflowRunner starts (async task)
         |
         v
  Repo Sync: clone or pull latest via gh CLI
         |
         v
  Create Workspaces: N git worktrees for isolation
         |
         v
  Clarification Loop: relay CLI questions ↔ user answers
  (orchestrator is a dumb pipe, CLI reasons about clarity)
         |
         v
  Architect CLI session: analyze codebase + create plan
  (orchestrator passes prompt, CLI does all thinking)
         |
         v
  Orchestrator parses JSON plan, computes parallel groups
         |
         v
  Agent Pool Manager: spawn N SWE CLI sessions
         |
         v
  For each subtask (parallel where dependencies allow):
    Orchestrator invokes SWE CLI -> CLI implements + tests ->
    harvest commits -> invoke Architect CLI for review ->
    pass feedback back to SWE CLI if needed
         |
         v
  Merge agent worktrees, push branch, create GitHub PR via gh CLI
         |
         v
  Send PR link to user via configured interface
```

## Architecture Diagram

```
 User Interface (pluggable)
    |
    +--> CLI Interface (default)
    +--> Telegram Bot (optional)
    +--> HTTP API (optional)
    |
    v
+---------------------+      +--------------------+
| InterfaceAdapter    |----->| SWETeam (main)     |
| (abstract)          |      | Pure Orchestrator  |
+---------------------+      +--------+-----------+
                                       |
                                  async tasks
                                       |
                              +--------v---------+
                              | WorkflowRunner   |
                              | (state machine,  |
                              |  no intelligence) |
                              +---+---------+----+
                                  |         |
                     +------------+    +----+--------+
                     |                 |             |
              +------v------+  +------v------+  +---v--------+
              | Architect   |  | Agent Pool  |  | GitOps     |
              | Invoker     |  | Manager     |  | Workspace  |
              | (delegates  |  | (spawns N   |  | (worktrees)|
              |  to CLI)    |  |  CLI procs) |  +---+--------+
              +------+------+  +------+------+      |
                     |           |  |  |  |         |
                     |    +------+  |  |  +-----+   |
                     |    |    +----+  +---+    |   |
                     |  +-v--+ +-v--+ +-v--+ +-v--+ |
                     |  |CLI | |CLI | |CLI | |CLI | |
                     |  |Proc| |Proc| |Proc| |Proc| |
                     |  |SWE1| |SWE2| |SWE3| |SWEN| |
                     |  +----+ +----+ +----+ +----+ |
                     |    |      |      |      |    |
                     +----+------+------+------+    |
                          |                    +----v------+
                   +------v------+             |  GitHub    |
                   | CLI Backend |             |  (gh CLI)  |
                   | (execFile)  |             +------------+
                   +------+------+
                          |
             +------------+------------+
             |            |            |
      +------v------+  +--v---+  +----v-----+
      | claude CLI  |  |codex |  | aider    |
      +-------------+  +------+  +----------+

            +-------------------------------+
            |  StateManager (SQLite + WAL)  |
            |  better-sqlite3 (sync)        |
            +-------------------------------+
```

## Component Map

| Spec | Component | Description |
|------|-----------|-------------|
| [01](01-telegram-bot.md) | Interface Layer | Pluggable user interface: CLI (default), Telegram, HTTP API |
| [02](02-task-planning.md) | Task Planning | Orchestrator invokes Architect CLI, parses JSON plan |
| [03](03-code-implementation.md) | Code Implementation | Orchestrator invokes N SWE CLI sessions in parallel |
| [04](04-code-review.md) | Code Review | Orchestrator invokes Architect CLI for review, routes feedback |
| [05](05-workflow-orchestration.md) | Workflow Orchestration | Pure state machine: checkpoints + agent pool coordination |
| [06](06-repository-workspace.md) | Repository & Workspace | Git ops, gh CLI, N worktrees, PR creation |
| [07](07-llm-provider.md) | CLI Backend | Thin `execFile` wrapper for claude / codex / aider |
| [08](08-state-database.md) | State & Database | SQLite via better-sqlite3, Drizzle ORM |
| [09](09-configuration.md) | Configuration | YAML config, env vars, agent pool sizing |
| [10](10-concurrency-recovery.md) | Concurrency & Recovery | Async task management, repo locks, crash recovery |
| [11](11-messaging-formatting.md) | Messaging & Formatting | Interface-agnostic message templates |
| [12](12-infrastructure-deployment.md) | Infrastructure | Docker, docker-compose, npm packaging |

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | **TypeScript** (strict mode) |
| Runtime | **Node.js 22+** |
| Role | Pure orchestrator -- zero AI intelligence |
| Interface | CLI (default), node-telegram-bot-api (optional), Express/Fastify (optional) |
| Database | SQLite via **better-sqlite3** (synchronous, fast) |
| ORM | **Drizzle ORM** (type-safe, lightweight) |
| Config | **yaml** (js-yaml), dotenv |
| Git | git CLI, GitHub CLI (`gh`) via `child_process` |
| AI Backends (external) | Claude Code CLI, Codex CLI, Aider CLI |
| Packaging | npm / pnpm |
| Container | Docker, docker-compose |

## Project Structure

```
swe-team/
  src/
    index.ts                 # Entry point
    main.ts                  # SWETeam orchestrator
    workflow.ts              # WorkflowRunner (state machine)
    config.ts                # Config types + YAML loader
    state.ts                 # StateManager (SQLite CRUD)
    repo-locks.ts            # RepoLockManager
    git-ops.ts               # GitOps, RepoSyncResult, PR creation
    workspace.ts             # Workspace (git worktree), WorkspacePool
    agent-pool.ts            # AgentPoolManager
    cli-backend.ts           # CLIBackend wrappers (claude, codex, aider)
    interfaces/
      base.ts                # InterfaceAdapter (abstract)
      cli.ts                 # CLIInterface (default)
      telegram.ts            # TelegramInterface (optional)
      api.ts                 # APIInterface (optional)
    agents/
      base.ts                # BaseAgent (abstract) -- prompt builder + CLI invoker
      architect.ts           # ArchitectAgent -- builds prompts, invokes CLI, parses JSON
      swe.ts                 # SWEAgent -- builds prompts, invokes CLI, parses output
    db/
      schema.ts              # Drizzle table definitions
      index.ts               # DB connection + migrations
    messaging.ts             # Interface-agnostic message formatting
    prompts/
      architect-system.md    # System prompt template for Architect CLI sessions
      architect-clarify.md   # Clarification prompt template for Architect CLI sessions
      architect-review.md    # Review prompt template for Architect CLI sessions
      swe-system.md          # System prompt template for SWE CLI sessions
  config.yaml                # Default configuration
  package.json
  tsconfig.json
  Dockerfile
  docker-compose.yml
```

## Data Flow

1. **Inbound**: User input -> `InterfaceAdapter` -> `SWETeam.handleMessage()`
2. **Dispatch**: `handleMessage` creates a `WorkflowRun` in DB, starts async task
3. **Clarification**: Orchestrator relays CLI questions to user, collects free-text answers until requirement is clear
4. **Planning**: Orchestrator builds prompt template, invokes Architect CLI, parses JSON plan
4. **Agent Spawning**: `AgentPoolManager` creates N CLI child processes, each with its own worktree
5. **Parallel Execution**: Independent subtasks execute concurrently via `Promise.all`
6. **Testing**: Each SWE CLI session runs tests as part of its implementation (the CLI handles it)
7. **Review**: Orchestrator invokes Architect CLI with diff, parses review JSON, routes feedback
8. **Merging**: Agent worktrees merged into main branch (pure git ops)
9. **Outbound**: PR created via `gh` CLI, link sent to user

## Orchestrator vs CLI Responsibility Split

| Concern | Orchestrator (this system) | CLI Backend (claude/codex/aider) |
|---------|---------------------------|----------------------------------|
| Code understanding | No | Yes |
| Code generation | No | Yes |
| Test writing & running | No | Yes |
| Code review intelligence | No | Yes |
| Model selection | No (just passes `--model` flag) | Yes |
| Git operations | Yes (clone, branch, merge, push, PR) | Limited (add, commit within worktree) |
| State persistence | Yes (SQLite checkpoints) | No |
| Parallel coordination | Yes (Promise.all, dependency ordering) | No |
| Crash recovery | Yes (resume from checkpoint) | No (new session on restart) |
| User interface | Yes (CLI, Telegram, API) | No |
| Workspace isolation | Yes (git worktrees) | No (operates in given directory) |

## LOC Budget: < 1000 total

| File | Estimated LOC |
|------|---------------|
| `cli-backend.ts` | ~100 |
| `agents/architect.ts` | ~90 |
| `agents/swe.ts` | ~50 |
| `agents/base.ts` | ~30 |
| `workflow.ts` | ~230 |
| `agent-pool.ts` | ~50 |
| `git-ops.ts` + `workspace.ts` | ~150 |
| `state.ts` + `db/schema.ts` | ~100 |
| `config.ts` | ~60 |
| `main.ts` + `index.ts` | ~80 |
| `interfaces/*` | ~80 |
| `messaging.ts` | ~46 |
| **Total** | **~1066** |

## Source Files

All source code lives under `src/` in the `swe-team` repository. See individual spec files for specific file mappings.
