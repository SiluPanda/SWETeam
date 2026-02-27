# Task 05b: Agent Pool Manager

> Manages N SWE agent instances with isolated worktrees for parallel execution.

**Spec**: [05-workflow-orchestration.md](../spec/05-workflow-orchestration.md#agentpoolmanager)
**File**: `src/agent-pool.ts`
**LOC target**: ~50

## Checklist

- [ ] **Implement `AgentPoolManager` class**
  - Constructor: takes `maxAgents`, `sweConfig` (AgentLLMConfig)
  - Private maps: `agents: Map<string, SWEAgent>`, `workspaces: Map<string, Workspace>`

- [ ] **Implement `spawn(count, originPath, workspacesBase, runId, branch, baseRef)`**
  - Create `count` worktrees: `Workspace.create(origin, base, "{runId}-swe-{i}", agentBranch, baseRef)`
  - Create `count` SWEAgent instances with unique `agentId`
  - Store in maps

- [ ] **Implement `assignTasks(taskIds, subtasks)`**
  - Round-robin assignment of tasks to agents
  - Return `[SWEAgent, SubTask][]` pairs

- [ ] **Implement `getAgent(agentId)` and `getWorkspace(agentId)` accessors**

- [ ] **Implement `cleanup()`**
  - Call `workspace.cleanup()` for each agent workspace
  - Clear maps

- [ ] **Verify**: Creates N worktrees, assigns tasks, cleans up
