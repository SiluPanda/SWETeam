# Concurrency & Recovery

> Main orchestrator entry point (~80 LOC). Async task management, per-repo locking, crash recovery, graceful shutdown. Pure coordination -- no intelligence.

## Overview

The `SWETeam` class initializes all components, dispatches workflows as async tasks, recovers incomplete runs on startup, and handles graceful shutdown via signal handlers.

## SWETeam Class

```typescript
class SWETeam {
  private config = getConfig();
  private state = StateManager.getInstance();
  private repoLocks = new RepoLockManager();
  private activeTasks = new Map<number, AbortController>();
  private running = false;

  async setup(): Promise<void> { /* init DB, create dirs, configure logging */ }
  async handleMessage(repoName: string, task: string, chatId: string): Promise<void> { /* create run, start workflow */ }
  private async executeWorkflow(runId: number, repoName: string): Promise<void> { /* acquire lock, run workflow */ }
  private async recoverIncompleteRuns(): Promise<void> { /* timeout old, resume recent */ }
  async run(): Promise<void> { /* setup -> interface -> recover -> wait for shutdown */ }
  async shutdown(): Promise<void> { /* abort tasks, cleanup */ }
}
```

## Concurrency Model

Node.js is single-threaded, so concurrency uses async/await + `Promise.allSettled`:
- N workflows can run concurrently (each awaiting CLI subprocesses)
- Per-repo locking via `async-mutex` ensures one workflow per repo
- Within a workflow, N SWE agent CLI calls run via `Promise.allSettled`
- `AbortController` enables cancellation of running workflows

## RepoLockManager (~10 LOC)

```typescript
class RepoLockManager {
  private locks = new Map<string, Mutex>();
  get(repoName: string): Mutex {
    if (!this.locks.has(repoName)) this.locks.set(repoName, new Mutex());
    return this.locks.get(repoName)!;
  }
}
```

Uses `async-mutex` package for async-friendly locking.

## Signal Handling

```typescript
process.on("SIGINT", () => team.shutdown());
process.on("SIGTERM", () => team.shutdown());
```

## Estimated LOC: ~80

| Component | Lines |
|-----------|-------|
| `SWETeam` class | ~70 |
| `RepoLockManager` | ~10 |
| **Total** | **~80** |

## Source Files

- `src/main.ts` -- `SWETeam`
- `src/index.ts` -- `main()` entry point
- `src/repo-locks.ts` -- `RepoLockManager`
