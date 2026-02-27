# Task 03: Code Implementation (SWE Agent)

> Thin wrapper that invokes SWE CLI for implementation, feedback, and test execution.

**Spec**: [03-code-implementation.md](../spec/03-code-implementation.md)
**File**: `src/agents/swe.ts`
**LOC target**: ~50

## Checklist

- [ ] **Implement `SWEAgent` class** extending `BaseAgent`
  - Constructor: takes `agentId` (e.g., `"swe-0"`), optional `AgentLLMConfig`
  - `lastError?: string` property

- [ ] **Implement `implementTask(repoPath, taskDescription, opts?)`**
  - Build prompt template with: task, overall goal, files to modify, context
  - Call `this.run(prompt, repoPath)`
  - Return `true` on success, `false` on error (set `lastError`)
  - ~15 LOC

- [ ] **Implement `applyFeedback(repoPath, taskDescription, feedback, diff?)`**
  - Build prompt with: task, feedback, truncated diff (5000 chars max)
  - Call `this.run(prompt, repoPath)`
  - Return `true`/`false`
  - ~12 LOC

- [ ] **Implement `runTests(repoPath)`**
  - Build prompt asking CLI to find and run tests, return JSON `{passed, summary}`
  - Parse CLI output: try `JSON.parse`, fallback to string check (`"fail" not in output`)
  - Return `{ passed: boolean, summary: string }`
  - ~15 LOC

- [ ] **Verify**: Mock CLI invocations return expected structure
