# Code Implementation (SWE Agent)

> The orchestrator invokes N parallel SWE CLI sessions for code implementation and testing. All intelligence (code gen, test writing, test execution, debugging) lives in the CLI -- the orchestrator only builds prompt templates, manages worktrees, and parses output.

## Overview

The `SWEAgent` class is a thin wrapper (~50 LOC) that builds prompt templates and invokes the configured CLI backend. Multiple SWE agent instances can run in parallel, each operating in its own git worktree with its own CLI child process. The CLI handles everything: reading code, writing code, running tests, fixing failures. The orchestrator just passes the prompt, collects the output, and manages git state.

There are no separate testing agents. The SWE CLI session is instructed (via the prompt template) to implement, test, and verify its work.

## Behavior

### Agent Lifecycle

Each SWE agent is created by `AgentPoolManager` with:
1. A unique `agentId` (e.g., `"swe-1"`, `"swe-2"`)
2. Its own `Workspace` (git worktree)
3. A `CLIBackend` instance (claude, codex, or aider)

```typescript
class SWEAgent extends BaseAgent {
  constructor(
    public readonly agentId: string = "swe-0",
    config?: AgentLLMConfig,
  ) {
    super("swe", config);
  }
  lastError?: string;
}
```

### Task Implementation

```typescript
async implementTask(repoPath: string, taskDescription: string, opts?: {
  filesToModify?: string[];
  overallGoal?: string;
  context?: string;
}): Promise<boolean>
```

Builds a prompt template with task description, overall goal, files, context. Invokes the CLI. Returns `true` on success, `false` on failure.

The CLI does all the work. The orchestrator checks exit status.

### Feedback Application

```typescript
async applyFeedback(repoPath: string, taskDescription: string,
                    feedback: string, diff?: string): Promise<boolean>
```

Builds a prompt with task + feedback + diff. Invokes CLI. Returns `true`/`false`.

### Test Execution

```typescript
async runTests(repoPath: string): Promise<{ passed: boolean; summary: string }>
```

Builds a prompt asking the CLI to run the test suite and return JSON. Parses output. Falls back to naive string check if JSON parse fails.

### System Prompt Template

`src/prompts/swe-system.md` instructs the CLI to:
- Explore codebase before writing
- Implement changes
- Write and run tests (unit, integration, UI via Playwright, API via HTTP)
- Commit with conventional messages
- Stay within worktree (no push, no branch switch)

The orchestrator doesn't know or care what the CLI does internally.

## Estimated LOC: ~50

| Component | Lines |
|-----------|-------|
| `SWEAgent` class | ~50 |

## Source Files

- `src/agents/swe.ts` -- `SWEAgent`
- `src/agents/base.ts` -- `BaseAgent`
- `src/prompts/swe-system.md` -- System prompt template
