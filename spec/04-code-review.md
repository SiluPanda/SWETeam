# Code Review

> The orchestrator invokes the Architect CLI with a diff, parses the JSON review verdict, and routes feedback back to the SWE CLI. All review intelligence lives in the CLI.

## Overview

Code review is handled by the same `ArchitectAgent` class that performs planning. The orchestrator builds a review prompt (task description + diff + previous feedback), invokes the Architect CLI, and parses the structured JSON response. If the review says "not approved", the orchestrator passes the feedback string to the SWE CLI via `applyFeedback()`. The orchestrator understands zero code semantics -- it only checks `approved: true/false`.

## Behavior

### Code Review Method

```typescript
async reviewCode(repoPath: string, taskDescription: string, diff: string,
                 previousFeedback?: string[]): Promise<ReviewResult>
```

1. Builds a review prompt template with task description, diff, accumulated feedback
2. Invokes the CLI backend
3. Parses JSON from output using `extractJson()`
4. Returns the review object

On parse failure, returns:
```typescript
{ approved: false, quality: "needs_work", feedback: "Review parse failed", issues: [] }
```

### Approval Decision

```typescript
shouldApprove(review: ReviewResult): boolean
```

Pure field check -- no intelligence:

| Threshold | Logic |
|-----------|-------|
| `"excellent"` | `quality === "excellent" && approved` |
| `"good"` (default) | `approved === true` |

### Review Loop (orchestrated by WorkflowRunner)

```typescript
let review = await architect.reviewCode(path, desc, diff);
let iters = 0;
while (!architect.shouldApprove(review) && iters < maxIters) {
  await swe.applyFeedback(path, desc, review.feedback, diff);
  await workspace.harvestUncommitted();
  diff = await git.diffHead(baseBranch);
  review = await architect.reviewCode(path, desc, diff, history);
  iters++;
}
```

The orchestrator just shuffles strings between two CLI sessions.

## Data Formats

### ReviewResult (expected from CLI output)

```typescript
interface ReviewResult {
  approved: boolean;
  quality: "excellent" | "good" | "needs_work";
  feedback: string;
  issues: Array<{ severity: string; description: string }>;
}
```

## Estimated LOC: ~25 (methods on ArchitectAgent)

## Source Files

- `src/agents/architect.ts` -- `reviewCode()`, `shouldApprove()`
- `src/prompts/architect-review.md` -- Review prompt template
