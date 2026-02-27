# Workflow Orchestration

> A pure state machine (~230 LOC) that coordinates the Architect CLI, N SWE CLI sessions, git operations, and parallel execution. Zero intelligence -- just workflow, state, and coordination.

## Overview

The `WorkflowRunner` progresses through checkpoint steps, invoking external CLIs at each phase and persisting state to SQLite for crash recovery. The `AgentPoolManager` (~50 LOC) spawns N SWE agent instances with isolated worktrees. The orchestrator's job is sequencing, parallelism, and state -- not thinking.

## Clarification Phase

Before planning, the orchestrator runs a multi-turn clarification loop. Each turn:
1. Orchestrator builds prompt with task + conversation history so far
2. Architect CLI reasons about requirement clarity, outputs JSON response
3. Orchestrator relays CLI output to user via interface (dumb pipe)
4. Orchestrator waits for user's free-text response
5. Appends exchange to conversation history, repeats

The CLI outputs `{ "status": "questions" | "ready", "message": "..." }`. The orchestrator checks the `status` field -- no intelligence, same pattern as plan/review JSON parsing.

When `status === "ready"`, the orchestrator sends the CLI's summary to the user and asks for final confirmation. On affirmative response, it proceeds to PLANNING with the refined requirement. The conversation history is persisted in `clarification_log` for crash recovery.

Configurable via `agent.max_clarification_rounds` (default 10) and `agent.skip_clarification` (default false).

```typescript
async _doClarifying(runId: number, repoName: string): Promise<void> {
  if (this.config.agent.skipClarification) return;

  this.state.advanceWorkflow(runId, WorkflowStep.CLARIFYING);
  this._send(runId, formatClarifying(repoName));

  const run = this.state.getWorkflowRun(runId);
  let history: { role: string; text: string }[] = JSON.parse(run.clarificationLog || "[]");
  let rounds = 0;

  while (rounds < this.config.agent.maxClarificationRounds) {
    if (this._isCancelled(runId)) return;

    const result = await this.architect.clarifyRequirements(
      run.workspacePath, run.userRequest, history
    );

    this._send(runId, result.message);

    if (result.status === "ready") {
      this._send(runId, "Are you satisfied with the requirement? (yes to proceed)");
      const confirmation = await this.interface.waitForResponse(run.chatId);

      if (isAffirmative(confirmation)) {
        this.state.advanceWorkflow(runId, WorkflowStep.CLARIFIED, {
          userRequest: result.message,
          clarificationLog: JSON.stringify(history),
        });
        return;
      }
      history.push({ role: "assistant", text: result.message });
      history.push({ role: "user", text: confirmation });
    } else {
      const answer = await this.interface.waitForResponse(run.chatId);
      history.push({ role: "assistant", text: result.message });
      history.push({ role: "user", text: answer });
    }

    this.state.advanceWorkflow(runId, WorkflowStep.CLARIFYING, {
      clarificationLog: JSON.stringify(history),
    });
    rounds++;
  }

  this.state.advanceWorkflow(runId, WorkflowStep.CLARIFIED);
}
```

## Checkpoint Steps

| # | Step | Phase | What the orchestrator does |
|---|------|-------|---------------------------|
| 0 | QUEUED | Init | Record run in DB |
| 1 | REPO_SYNC | Setup | `git clone` / `git pull` via GitOps |
| 2 | WORKSPACE_CREATED | Setup | Create git worktree |
| 3 | BRANCH_CREATED | Setup | Verify branch, stash leftovers |
| 4 | CLARIFYING | Clarify | Relay CLI questions ↔ user free-text responses (loop) |
| 5 | CLARIFIED | Clarify | User confirmed requirement is complete |
| 6 | PLANNING | Plan | Invoke Architect CLI, parse JSON plan |
| 7 | PLANNED | Plan | Store subtasks in DB, compute parallel groups |
| 8 | AGENTS_SPAWNED | Pool | Create N worktrees + N CLIBackend instances |
| 9 | SUBTASK_IMPLEMENTING | Exec | Invoke SWE CLIs in parallel (per wave) |
| 10 | SUBTASK_COMMITTING | Exec | Harvest uncommitted changes in each worktree |
| 11 | SUBTASK_TESTING | Exec | Invoke SWE CLIs to run tests, parse JSON results |
| 12 | SUBTASK_REVIEWING | Exec | Invoke Architect CLI with diff, parse JSON review |
| 13 | SUBTASK_FEEDBACK | Exec | Pass feedback string to SWE CLI |
| 14 | SUBTASK_DONE | Exec | Advance to next wave of parallel group |
| 15 | MERGING_AGENTS | Finalize | `git merge --no-ff` agent branches into main branch |
| 16 | CREATING_PR | Finalize | `git push` + `gh pr create` |
| 17 | COMPLETED | Terminal | Send PR link to user |
| 18 | FAILED | Terminal | Send error to user |

## Parallel Execution

Subtasks execute in **waves** based on dependency groups from the plan:

```typescript
for (const group of parallelGroups) {
  const results = await Promise.allSettled(
    group.map(taskId => {
      const agent = pool.getAvailableAgent();
      return executeSubtask(agent, subtasks[taskId]);
    })
  );
  // Handle results per failure policy
}
```

Independent subtasks within a wave run concurrently via `Promise.allSettled`. Waves execute sequentially.

## AgentPoolManager (~50 LOC)

```typescript
class AgentPoolManager {
  async spawn(count: number, originPath: string, workspacesBase: string,
              runId: number, branch: string, baseRef: string): Promise<void>
  assignTasks(taskIds: string[], subtasks: Map<string, SubTask>): [SWEAgent, SubTask][]
  async cleanup(): Promise<void>
}
```

## Single Subtask Execution

For each subtask:
1. Invoke `swe.implementTask()` (CLI does the work)
2. `workspace.harvestUncommitted()` (git operation)
3. Invoke `swe.runTests()` (CLI runs tests, returns JSON)
4. If tests fail: invoke `swe.applyFeedback()` with test errors
5. Invoke `architect.reviewCode()` with diff (CLI reviews, returns JSON)
6. If not approved: loop back with feedback (up to max iterations)

The orchestrator just shuttles prompts and parses JSON.

## Resume Logic

On restart, `STEP_ORDER` determines which phases to skip. The DB tracks `currentSubtaskIndex` and `currentParallelGroup` for mid-execution resume. The `clarification_log` field is reloaded on resume to continue the clarification conversation from where it left off.

## Branch Naming

`swe-team/{slug}-{uuid8}` for primary branch.
`swe-team/{slug}-{uuid8}-agent-{N}` for agent branches.

## Failure Policies

| Policy | Behavior |
|--------|----------|
| `"retry"` | Retry once with error context, then continue |
| `"continue"` | Skip failed subtask |
| `"stop"` | Mark entire workflow as FAILED |

## Estimated LOC

| Component | Lines |
|-----------|-------|
| `WorkflowRunner` | ~230 |
| `AgentPoolManager` | ~50 |
| **Total** | **~280** |

## Source Files

- `src/workflow.ts` -- `WorkflowRunner`, `STEP_ORDER`
- `src/agent-pool.ts` -- `AgentPoolManager`
- `src/db/schema.ts` -- `WorkflowStep` enum
