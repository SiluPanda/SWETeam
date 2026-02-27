# Task 06: Repository & Workspace

> Git CLI wrapper and worktree management for N parallel agents.

**Spec**: [06-repository-workspace.md](../spec/06-repository-workspace.md)
**File**: `src/git-ops.ts`, `src/workspace.ts`
**LOC target**: ~150

## Checklist

### GitOps (`src/git-ops.ts`, ~80 LOC)

- [ ] **Define `GitError` class** extending `Error`

- [ ] **Implement `GitOps` class**
  - Constructor: takes `repoPath: string`
  - `_run(...args)`: `execFileAsync("git", args, { cwd: this.repoPath })`, throw `GitError` on failure
  - `_runGh(...args)`: `execFileAsync("gh", args, { cwd, env: { GITHUB_TOKEN } })`

- [ ] **Implement basic git operations**
  - `status()`, `currentBranch()`, `branchExists(name)`, `resolveBranch(preferred)`

- [ ] **Implement branch operations**
  - `createBranch(name)`, `checkout(name)`, `checkoutNewBranch(name)`

- [ ] **Implement staging and diff**
  - `add(files?)`, `commit(message)`, `diff()`, `diffHead(base)`

- [ ] **Implement remote operations**
  - `clone(url)`, `ghClone(repoSpec)`, `fetch()`, `pull()`, `push(remote, branch)`

- [ ] **Implement PR creation**
  - `createPr(title, body, base, head, repoSpec?)` -- extract URL via regex
  - Handle "already exists" and "no commits" errors

- [ ] **Implement `configureGitUser()`**

- [ ] **Implement merge/reset/stash**
  - `merge(branch)`, `resetHard(ref)`, `stash()`, `stashPop()`, `getCommitCount(from, to)`

### Repo Resolution (~20 LOC in `git-ops.ts`)

- [ ] **Define `RepoSyncResult` interface**

- [ ] **Implement `getOrCreateRepo(repoName, basePath)`**
  - Parse owner/repo, bare names, URLs
  - Clone if missing, pull if existing
  - Return `RepoSyncResult`

- [ ] **Implement `inferGithubRepoSpec(ref)`** and `getAuthenticatedGhUser()`

### Workspace (`src/workspace.ts`, ~50 LOC)

- [ ] **Implement `Workspace` class**
  - `static create(originPath, base, runId, branch, baseRef)` -- `git worktree add`
  - `static fromExisting(originPath, wsPath, branch)` -- reconnect after crash
  - `harvestUncommitted()` -- `git add -A && git commit` if changes
  - `verifyBranch()` -- check branch matches expected
  - `cleanup()` -- `git worktree remove --force`, fallback to `rm -rf` + `git worktree prune`

- [ ] **Module-level mutex** for worktree add/remove serialization

- [ ] **Verify**: Clone repo, create worktree, make changes, harvest, cleanup
