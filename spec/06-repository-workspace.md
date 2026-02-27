# Repository & Workspace

> Git operations and worktree management (~150 LOC). Creates isolated worktrees for N parallel agents. Pure git CLI wrapper via `execFile` -- no intelligence.

## Overview

- **`GitOps`** (~80 LOC): Wraps `git` and `gh` CLI commands via `child_process.execFile`
- **`Workspace`** (~50 LOC): Manages isolated git worktrees (one per agent)
- **Repo resolution** (~20 LOC): Resolves `owner/repo`, bare names, URLs to clone paths

## GitOps Class

Thin wrapper around `git` and `gh` subprocess calls:

```typescript
class GitOps {
  constructor(private repoPath: string) {}

  private async run(...args: string[]): Promise<string> {
    return execFileAsync("git", args, { cwd: this.repoPath });
  }

  private async runGh(...args: string[]): Promise<string> {
    const env = { ...process.env, GITHUB_TOKEN: config.git.githubToken };
    return execFileAsync("gh", args, { cwd: this.repoPath, env });
  }

  async status(): Promise<string> { return this.run("status", "--porcelain"); }
  async currentBranch(): Promise<string> { return this.run("rev-parse", "--abbrev-ref", "HEAD"); }
  async diffHead(base: string): Promise<string> { return this.run("diff", `${base}..HEAD`); }
  async push(remote: string, branch: string): Promise<string> { ... }
  async createPr(title: string, body: string, base: string, head: string): Promise<string> { ... }
  async merge(branch: string): Promise<string> { return this.run("merge", "--no-ff", branch); }
  // clone, checkout, add, commit, fetch, pull, reset, stash, etc.
}
```

PR URL extracted via regex from `gh pr create` output.

## Workspace Class

Manages git worktrees for agent isolation:

```typescript
class Workspace {
  static async create(originPath: string, base: string, runId: string,
                      branch: string, baseRef: string): Promise<Workspace>
  // git worktree add -b {branch} {path} {baseRef}

  static async fromExisting(originPath: string, wsPath: string,
                            branch: string): Promise<Workspace>

  async harvestUncommitted(): Promise<boolean>
  // git add -A && git commit -m "chore: harvest uncommitted"

  async cleanup(): Promise<void>
  // git worktree remove --force
}
```

A module-level mutex (via `async-mutex` or simple promise chain) serializes worktree add/remove.

## Repo Resolution

```typescript
async function getOrCreateRepo(repoName: string, basePath: string): Promise<RepoSyncResult>
```

Handles `owner/repo`, bare names (infers owner via `gh api user`), HTTPS/SSH URLs.

```typescript
interface RepoSyncResult {
  git: GitOps;
  repoPath: string;
  repoUrl: string;
  repoSpec: string;
  baseBranch: string;
  cloned: boolean;
}
```

## Estimated LOC: ~150

| Component | Lines |
|-----------|-------|
| `GitOps` | ~80 |
| `Workspace` | ~50 |
| Repo resolution | ~20 |
| **Total** | **~150** |

## Source Files

- `src/git-ops.ts` -- `GitOps`, `GitError`, `RepoSyncResult`, repo helpers
- `src/workspace.ts` -- `Workspace`
