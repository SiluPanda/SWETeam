import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Workspace } from "./workspace.js";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Workspace", () => {
  let tmpDir: string;
  let repoDir: string;
  let wsBase: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "swe-team-ws-test-"));
    repoDir = path.join(tmpDir, "repo");
    wsBase = path.join(tmpDir, "workspaces");
    fs.mkdirSync(repoDir);
    fs.mkdirSync(wsBase);
    execSync("git init", { cwd: repoDir });
    execSync('git config user.email "test@test.com"', { cwd: repoDir });
    execSync('git config user.name "Test"', { cwd: repoDir });
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Test");
    execSync("git add -A && git commit -m 'init'", { cwd: repoDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates a workspace with isolated worktree", async () => {
    const mainBranch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: repoDir }).toString().trim();
    const ws = await Workspace.create(repoDir, wsBase, "run1", "agent-0", mainBranch);
    expect(fs.existsSync(ws.wsPath)).toBe(true);
    expect(ws.branch).toBe("agent-0");
    await ws.cleanup();
  });

  it("verifies the correct branch", async () => {
    const mainBranch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: repoDir }).toString().trim();
    const ws = await Workspace.create(repoDir, wsBase, "run2", "test-branch", mainBranch);
    const verified = await ws.verifyBranch();
    expect(verified).toBe(true);
    await ws.cleanup();
  });

  it("harvests uncommitted changes", async () => {
    const mainBranch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: repoDir }).toString().trim();
    const ws = await Workspace.create(repoDir, wsBase, "run3", "harvest-branch", mainBranch);

    // No changes yet
    const noop = await ws.harvestUncommitted();
    expect(noop).toBe(false);

    // Make a change
    fs.writeFileSync(path.join(ws.wsPath, "new-file.txt"), "content");
    const harvested = await ws.harvestUncommitted();
    expect(harvested).toBe(true);

    // Verify committed
    const status = execSync("git status --porcelain", { cwd: ws.wsPath }).toString().trim();
    expect(status).toBe("");

    await ws.cleanup();
  });

  it("creates from existing worktree path", () => {
    const ws = Workspace.fromExisting("/origin", "/some/path", "my-branch");
    expect(ws.originPath).toBe("/origin");
    expect(ws.wsPath).toBe("/some/path");
    expect(ws.branch).toBe("my-branch");
  });

  it("cleans up the worktree", async () => {
    const mainBranch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: repoDir }).toString().trim();
    const ws = await Workspace.create(repoDir, wsBase, "run4", "cleanup-branch", mainBranch);
    expect(fs.existsSync(ws.wsPath)).toBe(true);
    await ws.cleanup();
    expect(fs.existsSync(ws.wsPath)).toBe(false);
  });
});
