# Task 11: Messaging & Formatting

> Pure formatting functions for progress messages. Stateless, no intelligence.

**Spec**: [11-messaging-formatting.md](../spec/11-messaging-formatting.md)
**File**: `src/messaging.ts`
**LOC target**: ~46

## Checklist

- [ ] **Implement `parseTaskCommand(text)`**
  - Split first word as repo, rest as task
  - Handle multi-line input
  - Return `{ repo, task }` or `null`

- [ ] **Implement format functions**
  - `formatTaskReceived(repo, task)` -- `"[repo] Task Received\nTask: ..."`
  - `formatPlanning(repo)` -- `"[repo] Planning..."`
  - `formatPlanCreated(repo, tasks, agentCount)` -- `"[repo] Plan: N tasks, M agents\n1. ..."`
  - `formatProgress(repo, current, total, task)` -- `"[repo] [████    ] 60% Task 3/5: ..."`
  - `formatReview(repo, task, iteration)` -- `"[repo] Review iteration N"`
  - `formatError(repo, task, error)` -- `"[repo] Error: ..."`
  - `formatCompleted(repo, prUrl)` -- `"[repo] PR: url"`
  - `formatStatus(runs)` -- summary of active runs
  - `formatList(runs)` -- numbered list with stop hint

- [ ] **Implement `formatClarifying(repo)`**
  - Returns `"[{repo}] Analyzing your requirement..."` -- sent before the clarification loop begins

- [ ] **Implement `isAffirmative(text)`**
  - Check if lowercased, trimmed input matches `yes|y|yeah|sure|proceed|confirm|done`
  - Returns boolean
  - ~3 LOC

- [ ] **Implement `formatProgressBar(done, total, width?)`**
  - `"[██████    ] 60%"`
  - Handle total=0 (show 0%)

- [ ] **Verify**: All functions return expected string formats
