# State & Database

> SQLite-backed state persistence (~100 LOC). Tracks repos, workflow runs, subtasks. Pure CRUD -- no intelligence. Uses better-sqlite3 (sync) + Drizzle ORM.

## Overview

- **Schema** (~30 LOC): Drizzle table definitions
- **StateManager** (~70 LOC): Singleton CRUD class

## Technology Choice

**better-sqlite3** (synchronous) over async alternatives because:
- The orchestrator is I/O-bound on CLI subprocesses, not DB
- Sync DB calls simplify the state machine enormously
- WAL mode gives concurrent read access
- Zero connection pool overhead

**Drizzle ORM** for type-safe queries with minimal overhead.

## Schema (Drizzle)

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const repos = sqliteTable("repos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").unique().notNull(),
  path: text("path").default(""),
  url: text("url").default(""),
  repoSpec: text("repo_spec").default(""),
  defaultBranch: text("default_branch").default("main"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

export const workflowRuns = sqliteTable("workflow_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  externalId: text("external_id").notNull(),
  repoId: integer("repo_id").references(() => repos.id).notNull(),
  userRequest: text("user_request").default(""),
  chatId: text("chat_id").default(""),
  status: text("status").default("pending"),
  workflowStep: text("workflow_step").default("queued"),
  workingBranch: text("working_branch").default(""),
  baseBranch: text("base_branch").default("main"),
  workspacePath: text("workspace_path").default(""),
  planJson: text("plan_json").default(""),
  currentSubtaskIndex: integer("current_subtask_index").default(0),
  currentParallelGroup: integer("current_parallel_group").default(0),
  agentCount: integer("agent_count").default(0),
  errorMessage: text("error_message").default(""),
  clarificationLog: text("clarification_log").default("[]"),
  prUrl: text("pr_url").default(""),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const subtasks = sqliteTable("subtasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  externalId: text("external_id").notNull(),
  workflowRunId: integer("workflow_run_id").references(() => workflowRuns.id).notNull(),
  description: text("description").default(""),
  filesToModify: text("files_to_modify").default("[]"), // JSON
  dependsOn: text("depends_on").default("[]"),          // JSON
  orderIndex: integer("order_index").default(0),
  status: text("status").default("pending"),
  assignedAgent: text("assigned_agent").default(""),
  retryCount: integer("retry_count").default(0),
  errorMessage: text("error_message").default(""),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});
```

## Enums

```typescript
enum TaskStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

enum WorkflowStep {
  QUEUED = "queued",
  REPO_SYNC = "repo_sync",
  WORKSPACE_CREATED = "workspace_created",
  BRANCH_CREATED = "branch_created",
  CLARIFYING = "clarifying",
  CLARIFIED = "clarified",
  PLANNING = "planning",
  PLANNED = "planned",
  AGENTS_SPAWNED = "agents_spawned",
  SUBTASK_IMPLEMENTING = "subtask_implementing",
  SUBTASK_COMMITTING = "subtask_committing",
  SUBTASK_TESTING = "subtask_testing",
  SUBTASK_REVIEWING = "subtask_reviewing",
  SUBTASK_FEEDBACK = "subtask_feedback",
  SUBTASK_DONE = "subtask_done",
  MERGING_AGENTS = "merging_agents",
  CREATING_PR = "creating_pr",
  COMPLETED = "completed",
  FAILED = "failed",
}
```

## StateManager (~70 LOC)

```typescript
class StateManager {
  private static instance: StateManager;
  private db: BetterSqlite3.Database;

  static getInstance(): StateManager { ... }

  getOrCreateRepo(name: string, ...): Repo { ... }
  createWorkflowRun(repoId: number, request: string, chatId: string): WorkflowRun { ... }
  advanceWorkflow(runId: number, step: WorkflowStep, updates?: Partial<WorkflowRun>): void { ... }
  createSubtasks(runId: number, tasks: PlanTask[]): void { ... }
  updateSubtask(id: number, updates: Partial<SubTask>): void { ... }
  getActiveRuns(): WorkflowRun[] { ... }
  getIncompleteRuns(): WorkflowRun[] { ... }
  cancelRun(runId: number): void { ... }
}
```

## DB Init

```typescript
function initDb(dbPath: string): BetterSqlite3.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  // Run Drizzle migrations or create tables
  return db;
}
```

## Estimated LOC: ~100

| Component | Lines |
|-----------|-------|
| Schema | ~30 |
| StateManager | ~70 |
| **Total** | **~100** |

## Source Files

- `src/db/schema.ts` -- Drizzle table definitions + enums
- `src/db/index.ts` -- DB init + connection
- `src/state.ts` -- `StateManager`
