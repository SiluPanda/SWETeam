# Task 04: Code Review

> Review methods on ArchitectAgent: invoke CLI with diff, parse JSON verdict, check approval.

**Spec**: [04-code-review.md](../spec/04-code-review.md)
**File**: `src/agents/architect.ts` (additional methods)
**LOC target**: ~25

## Checklist

- [ ] **Implement `ArchitectAgent.reviewCode(repoPath, task, diff, previousFeedback?)`**
  - Build review prompt with task description, full diff, accumulated feedback
  - Call `this.run(prompt, repoPath)`
  - Parse JSON via `extractJson()`, return `ReviewResult`
  - On parse failure: return `{ approved: false, quality: "needs_work", feedback: "Parse failed", issues: [] }`
  - ~15 LOC

- [ ] **Implement `ArchitectAgent.shouldApprove(review)`**
  - If threshold is `"excellent"`: `review.quality === "excellent" && review.approved`
  - If threshold is `"good"`: `review.approved === true`
  - ~5 LOC

- [ ] **Define `ReviewResult` interface**
  - `approved: boolean`, `quality: string`, `feedback: string`, `issues: Array<{severity, description}>`

- [ ] **Create `src/prompts/architect-review.md`** template
  - Instruct CLI to evaluate: correctness, security, tests, best practices
  - Return JSON with `approved`, `quality`, `feedback`, `issues`

- [ ] **Verify**: Given mock review JSON output, correctly parses and applies threshold
