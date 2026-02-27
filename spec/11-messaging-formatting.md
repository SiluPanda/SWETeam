# Messaging & Formatting

> Pure formatting functions (~40 LOC). Builds text messages for any interface. No intelligence, no state.

## Overview

Stateless functions that format progress messages. Used by `WorkflowRunner` and interface adapters. All functions take plain types and return strings.

## Functions

```typescript
function parseTaskCommand(text: string): { repo: string; task: string } | null
function formatTaskReceived(repo: string, task: string): string
function formatPlanning(repo: string): string
function formatPlanCreated(repo: string, tasks: string[], agents: number): string
function formatProgress(repo: string, current: number, total: number, task: string): string
function formatReview(repo: string, task: string, iteration: number): string
function formatError(repo: string, task: string, error: string): string
function formatCompleted(repo: string, prUrl: string): string
function formatClarifying(repo: string): string
function isAffirmative(text: string): boolean
function formatStatus(runs: WorkflowRun[]): string
function formatProgressBar(done: number, total: number, width?: number): string
```

### parseTaskCommand

Splits `"owner/repo Build a REST API"` into `{ repo: "owner/repo", task: "Build a REST API" }`.

### formatClarifying

Returns `"[{repo}] Analyzing your requirement..."` -- sent before the clarification loop begins.

### isAffirmative

Checks if lowercased input matches `yes|y|yeah|sure|proceed|confirm|done`. Returns boolean.

```typescript
function isAffirmative(text: string): boolean {
  return /^(yes|y|yeah|sure|proceed|confirm|done)$/i.test(text.trim());
}
```

### formatProgressBar

```typescript
function formatProgressBar(done: number, total: number, width = 10): string {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const filled = Math.round((done / total) * width) || 0;
  return `[${"█".repeat(filled)}${" ".repeat(width - filled)}] ${pct}%`;
}
```

## Estimated LOC: ~46

## Source Files

- `src/messaging.ts`
