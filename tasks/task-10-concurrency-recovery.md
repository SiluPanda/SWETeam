# Task 10: Concurrency & Recovery

> Main orchestrator entry point: SWETeam class, per-repo locking, crash recovery, shutdown.

**Spec**: [10-concurrency-recovery.md](../spec/10-concurrency-recovery.md)
**File**: `src/main.ts`, `src/index.ts`, `src/repo-locks.ts`
**LOC target**: ~80

## Checklist

### RepoLockManager (`src/repo-locks.ts`, ~10 LOC)

- [ ] **Implement `RepoLockManager`**
  - Uses `async-mutex` package
  - `get(repoName)`: returns (or creates) a `Mutex` for the repo
  - Ensures one workflow per repo at a time

### SWETeam (`src/main.ts`, ~70 LOC)

- [ ] **Implement `SWETeam` class**
  - Constructor: init config, state, repoLocks, activeTasks map

- [ ] **Implement `setup()`**
  - Create directories (repos, workspaces, state, logs)
  - Init database
  - Configure logging (write to file + console)

- [ ] **Implement `handleMessage(repoName, task, chatId)`**
  - Get or create repo in DB
  - Create workflow run (PENDING/QUEUED)
  - Start `executeWorkflow()` as async task
  - Store AbortController in activeTasks map

- [ ] **Implement `executeWorkflow(runId, repoName)`**
  - Acquire repo lock (mutex)
  - Create WorkflowRunner with all dependencies
  - Call `runner.run(runId)` inside lock
  - Remove from activeTasks on completion

- [ ] **Implement `recoverIncompleteRuns()`**
  - Query incomplete runs
  - If age > workflowTimeout: mark FAILED, send timeout message
  - Otherwise: resume by calling executeWorkflow

- [ ] **Implement `run()`**
  - `setup()` -> `createInterface()` -> register signal handlers -> `interface.start()` -> `recoverIncompleteRuns()`

- [ ] **Implement `shutdown()`**
  - Set running = false
  - Abort active tasks
  - Stop interface
  - Close DB

### Entry Point (`src/index.ts`, ~5 LOC)

- [ ] **Implement `main()`**
  - Create `SWETeam`, call `run()`, catch errors

- [ ] **Register signal handlers**: `SIGINT`, `SIGTERM` -> `team.shutdown()`

- [ ] **Verify**: Starts up, accepts tasks, shuts down cleanly on Ctrl+C
