# Task 02: Task Planning (Architect Agent)

> Thin wrapper that invokes Architect CLI and parses JSON plan. Includes topological sort + parallel group computation.

**Spec**: [02-task-planning.md](../spec/02-task-planning.md)
**File**: `src/agents/architect.ts`, `src/agents/base.ts`
**LOC target**: ~90 (architect.ts) + ~30 (base.ts)

## Checklist

- [ ] **Implement `BaseAgent` abstract class** in `src/agents/base.ts`
  - Constructor: takes `agentType`, creates `CLIBackend` via `createCliBackend()`
  - `getSystemPrompt()`: reads prompt file from `config.agent.prompts[agentType]`
  - `run(prompt, cwd)`: prepends system prompt, calls `this.cli.invoke(fullPrompt, cwd)`
  - ~30 LOC

- [ ] **Implement `extractJson(text)`** helper in `src/agents/architect.ts`
  - Strip markdown code fences (`` ```json...``` ``)
  - Try `JSON.parse(text)`
  - Scan for first `[` or `{`, try `JSON.parse(text.slice(start))`
  - Throw if no JSON found
  - ~20 LOC

- [ ] **Implement `ArchitectAgent.analyzeCodebase(repoPath)`**
  - Build prompt template asking CLI to explore and summarize
  - Call `this.run(prompt, repoPath)`
  - Return raw string; catch errors, return error string
  - ~8 LOC

- [ ] **Implement `ArchitectAgent.createPlan(repoPath, task, analysis)`**
  - Build prompt with task + analysis, instruct CLI to return JSON array
  - Parse with `extractJson()`, validate with `validatePlan()`
  - Fallback to `createDefaultPlan()` on error
  - ~12 LOC

- [ ] **Implement `validatePlan(tasks)`**
  - Assign IDs to tasks without them
  - Remove invalid dependency refs + self-refs
  - Topological sort (Kahn's algorithm)
  - Strip all deps on cycle, return original order
  - ~30 LOC

- [ ] **Implement `computeParallelGroups(tasks)`**
  - Group tasks into waves by dependency depth
  - Return `string[][]`
  - ~15 LOC

- [ ] **Implement `planAndQueueTasks()`**
  - Call `analyzeCodebase` -> `createPlan` -> `computeParallelGroups`
  - Return `PlanResult { tasks, parallelGroups, recommendedAgents }`

- [ ] **Implement `ArchitectAgent.clarifyRequirements(repoPath, taskDescription, conversationHistory)`**
  - Build prompt from `architect-clarify.md` template + task + conversation history
  - Call `this.run(prompt, repoPath)` (one-shot invocation)
  - Parse JSON output with `extractJson()`
  - Return `ClarificationResult { status: "questions" | "ready", message: string }`
  - ~10 LOC

- [ ] **Define `ClarificationResult` interface**
  - `status: "questions" | "ready"`
  - `message: string`

- [ ] **Define `PlanTask` and `PlanResult` interfaces**

- [ ] **Verify**: Given mock CLI output with JSON plan, validates and groups correctly
