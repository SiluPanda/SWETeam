# Task 05: Workflow Orchestration

> Pure state machine that drives the checkpoint workflow. Invokes agents, manages state, coordinates parallel execution.

**Spec**: [05-workflow-orchestration.md](../spec/05-workflow-orchestration.md)
**File**: `src/workflow.ts`
**LOC target**: ~230

## Checklist

- [ ] **Define `STEP_ORDER` map** for all 19 workflow steps (including CLARIFYING and CLARIFIED)

- [ ] **Implement `WorkflowRunner` class**
  - Constructor: takes `StateManager`, `Config`, `ArchitectAgent`, SWE config, `InterfaceAdapter`
  - `async run(runId: number)`: main entry point with try/catch -> FAILED

- [ ] **Implement `_doRepoSync(runId, repoName)`**
  - Advance to REPO_SYNC, send "Task Received" message
  - Call `getOrCreateRepo()` from git-ops
  - Store repo info in DB

- [ ] **Implement `_doCreateWorkspace(runId, repoName)`**
  - Build branch name: `swe-team/{slug}-{uuid8}`
  - Create worktree via `Workspace.create()`
  - Store workspace_path, working_branch on run

- [ ] **Implement `_doCreateBranch(runId)`**
  - Verify branch, stash leftovers
  - Advance to BRANCH_CREATED

- [ ] **Implement `_doClarifying(runId, repoName)`**
  - Check `config.agent.skipClarification` — if true, skip to CLARIFIED
  - Advance to CLARIFYING, send `formatClarifying()` message
  - Load `clarificationLog` from DB for crash recovery
  - Loop up to `config.agent.maxClarificationRounds`:
    - Invoke `architect.clarifyRequirements(workspacePath, userRequest, history)`
    - Relay `result.message` to user via `_send()`
    - If `result.status === "ready"`: ask user for confirmation via `interface.waitForResponse()`
      - If affirmative: advance to CLARIFIED with refined `userRequest`, return
      - If not: append exchange to history, continue loop
    - If `result.status === "questions"`: wait for user answer via `interface.waitForResponse()`
    - Persist `clarificationLog` to DB after each round
  - On max rounds: advance to CLARIFIED with current state

- [ ] **Implement `_doClarified(runId)`**
  - Advance to CLARIFIED step (no-op if already there from `_doClarifying`)

- [ ] **Implement `_doPlanning(runId, repoName)`**
  - Advance to PLANNING, send "Planning" message
  - Call `architect.planAndQueueTasks()`
  - If empty plan: mark FAILED
  - Store plan JSON + create subtasks in DB
  - Advance to PLANNED, send plan summary

- [ ] **Implement `_doSpawnAgents(runId)`**
  - Read `recommendedAgents` from plan, cap at `agentPool.maxAgents`
  - Create N agent worktrees via `AgentPoolManager.spawn()`
  - Advance to AGENTS_SPAWNED

- [ ] **Implement `_doSubtasks(runId, repoName)`**
  - Loop through parallel groups (waves)
  - For each wave: `Promise.allSettled` of `_executeSubtask` calls
  - Handle failure per policy (retry/continue/stop)
  - Advance `currentParallelGroup` after each wave

- [ ] **Implement `_executeSubtask(agent, subtask, runId)`**
  - Call `swe.implementTask()`
  - `workspace.harvestUncommitted()`
  - Call `swe.runTests()`, if fail -> `swe.applyFeedback()` with errors
  - Call `architect.reviewCode()` with diff
  - Review loop: up to `maxReviewIterations`

- [ ] **Implement `_doMergeAgents(runId)`**
  - Merge each agent branch into primary workspace via `git merge --no-ff`
  - Handle merge conflicts

- [ ] **Implement `_doCreatePr(runId, repoName)`**
  - Check commit count, skip if 0
  - `git push --set-upstream`
  - `gh pr create` with title + body
  - Store PR URL, send to user

- [ ] **Implement `_isCancelled(runId)` and `_send(runId, text)` helpers**

- [ ] **Verify**: State machine progresses through all steps correctly
