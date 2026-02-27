# Task 08: State & Database

> SQLite persistence via better-sqlite3 + Drizzle ORM. Pure CRUD, no intelligence.

**Spec**: [08-state-database.md](../spec/08-state-database.md)
**File**: `src/db/schema.ts`, `src/db/index.ts`, `src/state.ts`
**LOC target**: ~100

## Checklist

### Schema (`src/db/schema.ts`, ~30 LOC)

- [ ] **Define `TaskStatus` enum** -- pending, in_progress, completed, failed, cancelled

- [ ] **Define `WorkflowStep` enum** -- all 19 steps (queued through failed, including CLARIFYING and CLARIFIED)

- [ ] **Define `repos` table** -- id, name (unique), path, url, repoSpec, defaultBranch, createdAt

- [ ] **Define `workflowRuns` table** -- id, externalId, repoId (FK), userRequest, chatId, status, workflowStep, workingBranch, baseBranch, workspacePath, planJson, currentSubtaskIndex, currentParallelGroup, agentCount, errorMessage, clarificationLog (JSON, default "[]"), prUrl, createdAt, updatedAt

- [ ] **Define `subtasks` table** -- id, externalId, workflowRunId (FK), description, filesToModify (JSON), dependsOn (JSON), orderIndex, status, assignedAgent, retryCount, errorMessage, createdAt

### DB Init (`src/db/index.ts`, ~15 LOC)

- [ ] **Implement `initDb(dbPath)`**
  - Create `better-sqlite3` connection
  - `PRAGMA journal_mode = WAL`
  - Run Drizzle migrations or `CREATE TABLE IF NOT EXISTS`
  - Return db instance

### StateManager (`src/state.ts`, ~70 LOC)

- [ ] **Implement `StateManager` singleton**
  - `static getInstance(): StateManager`

- [ ] **Implement repo CRUD**
  - `getOrCreateRepo(name, path?, url?, repoSpec?, defaultBranch?)`: upsert

- [ ] **Implement workflow run CRUD**
  - `createWorkflowRun(repoId, request, chatId)`: insert with PENDING/QUEUED
  - `advanceWorkflow(runId, step, updates?)`: update step + status + fields + updatedAt
  - `getWorkflowRun(runId)`: select by id
  - `getActiveRuns()`: where status in (pending, in_progress)
  - `getIncompleteRuns()`: where status = in_progress
  - `cancelRun(runId)`: set cancelled if pending/in_progress

- [ ] **Implement subtask CRUD**
  - `createSubtasks(runId, tasks)`: delete existing + insert new (idempotent)
  - `updateSubtask(id, updates)`: partial update
  - `getSubtasks(runId)`: select ordered by orderIndex

- [ ] **Status mapping in `advanceWorkflow`**
  - COMPLETED step -> status COMPLETED
  - FAILED step -> status FAILED
  - Otherwise if PENDING -> status IN_PROGRESS

- [ ] **Verify**: Create run, advance through steps, create subtasks, query active runs
