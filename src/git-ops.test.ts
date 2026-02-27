import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GitOps, GitError, inferGithubRepoSpec } from "./git-ops.js";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("inferGithubRepoSpec", () => {
  it("handles owner/repo format", async () => {
    expect(await inferGithubRepoSpec("owner/repo")).toBe("owner/repo");
  });

  it("handles HTTPS URL", async () => {
    expect(await inferGithubRepoSpec("https://github.com/owner/repo")).toBe("owner/repo");
  });

  it("handles HTTPS URL with .git suffix", async () => {
    expect(await inferGithubRepoSpec("https://github.com/owner/repo.git")).toBe("owner/repo");
  });

  it("handles SSH URL", async () => {
    expect(await inferGithubRepoSpec("git@github.com:owner/repo")).toBe("owner/repo");
  });

  it("handles bare name", async () => {
    // Without gh auth, falls back to returning bare name
    const result = await inferGithubRepoSpec("myrepo");
    expect(result).toContain("myrepo");
  });
});

describe("GitOps", () => {
  let tmpDir: string;
  let git: GitOps;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "swe-team-git-test-"));
    execSync("git init", { cwd: tmpDir });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir });
    execSync('git config user.name "Test"', { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, "README.md"), "# Test");
    execSync("git add -A && git commit -m 'init'", { cwd: tmpDir });
    git = new GitOps(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("gets current branch", async () => {
    const branch = await git.currentBranch();
    expect(["main", "master"]).toContain(branch);
  });

  it("checks branch exists", async () => {
    const branch = await git.currentBranch();
    expect(await git.branchExists(branch)).toBe(true);
    expect(await git.branchExists("nonexistent-branch")).toBe(false);
  });

  it("creates and checks out a branch", async () => {
    await git.checkoutNewBranch("feature-test");
    const branch = await git.currentBranch();
    expect(branch).toBe("feature-test");
  });

  it("gets status", async () => {
    const status = await git.status();
    expect(status).toBe("");

    fs.writeFileSync(path.join(tmpDir, "new.txt"), "content");
    const status2 = await git.status();
    expect(status2).toContain("new.txt");
  });

  it("stages, commits, and diffs", async () => {
    fs.writeFileSync(path.join(tmpDir, "file.txt"), "hello");
    await git.add();
    await git.commit("add file");
    const branch = await git.currentBranch();
    const diff = await git.diffHead(`${branch}~1`);
    expect(diff).toContain("file.txt");
  });

  it("handles merge", async () => {
    const mainBranch = await git.currentBranch();
    await git.checkoutNewBranch("feat");
    fs.writeFileSync(path.join(tmpDir, "feat.txt"), "feature");
    await git.add();
    await git.commit("add feature");
    await git.checkout(mainBranch);
    await git.merge("feat");
    expect(fs.existsSync(path.join(tmpDir, "feat.txt"))).toBe(true);
  });

  it("gets commit count", async () => {
    const branch = await git.currentBranch();
    fs.writeFileSync(path.join(tmpDir, "a.txt"), "a");
    await git.add();
    await git.commit("commit a");
    fs.writeFileSync(path.join(tmpDir, "b.txt"), "b");
    await git.add();
    await git.commit("commit b");
    const count = await git.getCommitCount(`${branch}~2`, branch);
    expect(count).toBe(2);
  });

  it("creates worktree and removes it", async () => {
    const wsPath = path.join(tmpDir, "worktree-test");
    const branch = await git.currentBranch();
    await git.worktreeAdd(wsPath, "wt-branch", branch);
    expect(fs.existsSync(wsPath)).toBe(true);
    await git.worktreeRemove(wsPath);
    expect(fs.existsSync(wsPath)).toBe(false);
  });

  it("throws GitError on failure", async () => {
    const badGit = new GitOps("/nonexistent-path");
    await expect(badGit.status()).rejects.toThrow(GitError);
  });
});
