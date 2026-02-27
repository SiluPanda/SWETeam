# Task Planning (Architect Agent)

> The orchestrator invokes an Architect CLI session to clarify requirements, analyze codebases, and create structured plans. All intelligence lives in the CLI -- the orchestrator only builds prompt templates and parses JSON output.

## Overview

The `ArchitectAgent` class is a thin wrapper (~90 LOC) that builds prompt templates and invokes the configured CLI backend (Claude Code, Codex, or Aider). It sends prompts asking the CLI to analyze a codebase and produce a JSON plan. The orchestrator then parses the JSON, validates the dependency graph via topological sort, and computes parallel execution groups. The orchestrator has zero understanding of the code -- it only understands the JSON structure.

## Behavior

### Requirement Clarification

```typescript
async clarifyRequirements(
  repoPath: string,
  taskDescription: string,
  conversationHistory: Array<{ role: "assistant" | "user"; text: string }>,
): Promise<{ status: "questions" | "ready"; message: string }>
```

Builds a prompt from template (`architect-clarify.md`) + task + conversation history, invokes the CLI via `this.run(prompt, repoPath)` (one-shot, same as existing pattern), and parses the JSON output with `extractJson()`. Returns a `ClarificationResult` with `status` ("questions" or "ready") and `message` (the CLI's questions or refined requirement summary).

```typescript
interface ClarificationResult {
  status: "questions" | "ready";
  message: string;
}
```

### Codebase Analysis

```typescript
async analyzCodebase(repoPath: string): Promise<string>
```

Builds a prompt template and invokes the CLI:
- Prompt asks the CLI to explore the codebase and summarize project structure, tech stack, test infrastructure, and conventions
- Returns the raw CLI output as a string
- On CLI failure, returns `"Codebase analysis failed: {error}"`

### Plan Creation

```typescript
async createPlan(repoPath: string, taskDescription: string, analysis = ""): Promise<PlanTask[]>
```

1. Builds a prompt template with the task description and codebase analysis
2. Prompt instructs the CLI to return a JSON array of subtask objects
3. Invokes the CLI backend
4. Parses the JSON output using `extractJson()` (handles markdown fences, surrounding prose)
5. Validates the plan via `validatePlan()`
6. On parse failure, falls back to `createDefaultPlan()`

### JSON Extraction

`extractJson(text: string)` -- a pure string-parsing utility (~20 LOC):

1. Strips markdown code fences
2. Tries `JSON.parse(text)`
3. Scans for first `[` or `{`, tries `JSON.parse(text.slice(start))`
4. Throws if no JSON found

### Plan Validation

`validatePlan(tasks)` -- pure data validation (~30 LOC):

1. Assigns IDs to tasks missing them
2. Removes invalid dependency references
3. Topological sort (Kahn's algorithm) to detect cycles
4. On cycle: strips all dependencies, returns original order
5. Returns tasks in topological order

### Parallel Group Computation

`computeParallelGroups(tasks)` -- pure graph algorithm (~15 LOC):

Groups tasks by dependency wave:
```
Group 1: [task-1, task-2, task-3]   # No dependencies
Group 2: [task-4, task-5]           # Depend only on group 1
Group 3: [task-6]                   # Depends on group 2
```

The largest group size determines the recommended agent count.

### Combined Entry Point

```typescript
async planAndQueueTasks(repoName: string, repoPath: string, task: string): Promise<PlanResult>
```

1. `analyzeCodebase(repoPath)`
2. `createPlan(repoPath, task, analysis)`
3. `computeParallelGroups(plan)`
4. Returns `{ tasks, parallelGroups, recommendedAgents }`

## Data Formats

### PlanTask (expected from CLI output)

```typescript
interface PlanTask {
  id: string;
  description: string;
  files: string[];
  dependencies: string[];
}
```

### PlanResult

```typescript
interface PlanResult {
  tasks: PlanTask[];
  parallelGroups: string[][];
  recommendedAgents: number;
}
```

## Estimated LOC: ~90

| Component | Lines |
|-----------|-------|
| `clarifyRequirements` | ~10 |
| `analyzeCodebase` | ~8 |
| `createPlan` | ~12 |
| `extractJson` | ~20 |
| `validatePlan` | ~30 |
| `computeParallelGroups` | ~15 |
| **Total (architect.ts)** | **~90** |

## Source Files

- `src/agents/architect.ts` -- `ArchitectAgent`, `extractJson()`, `PlanResult`
- `src/agents/base.ts` -- `BaseAgent` base class
- `src/prompts/architect-system.md` -- System prompt template
- `src/prompts/architect-clarify.md` -- Clarification prompt template
