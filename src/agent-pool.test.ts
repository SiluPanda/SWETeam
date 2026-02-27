import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AgentPoolManager } from "./agent-pool.js";
import { SWEAgent } from "./agents/swe.js";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("AgentPoolManager", () => {
  let tmpDir: string;
  let repoDir: string;
  let wsBase: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "swe-team-pool-test-"));
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

  it("spawns N agents with worktrees", async () => {
    const pool = new AgentPoolManager(4);
    const mainBranch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: repoDir }).toString().trim();
    await pool.spawn(2, repoDir, wsBase, "run1", "test-branch", mainBranch);

    expect(pool.getAgent("swe-0")).toBeInstanceOf(SWEAgent);
    expect(pool.getAgent("swe-1")).toBeInstanceOf(SWEAgent);
    expect(pool.getAgent("swe-2")).toBeUndefined();

    const ws0 = pool.getWorkspace("swe-0")!;
    const ws1 = pool.getWorkspace("swe-1")!;
    expect(fs.existsSync(ws0.wsPath)).toBe(true);
    expect(fs.existsSync(ws1.wsPath)).toBe(true);

    await pool.cleanup();
  });

  it("respects maxAgents limit", async () => {
    const pool = new AgentPoolManager(1);
    const mainBranch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: repoDir }).toString().trim();
    await pool.spawn(5, repoDir, wsBase, "run2", "test-branch", mainBranch);

    expect(pool.getAgentIds()).toHaveLength(1);
    await pool.cleanup();
  });

  it("assigns tasks round-robin", async () => {
    const pool = new AgentPoolManager(4);
    const mainBranch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: repoDir }).toString().trim();
    await pool.spawn(2, repoDir, wsBase, "run3", "test-branch", mainBranch);

    const tasks = [
      { id: 1, externalId: "t1" },
      { id: 2, externalId: "t2" },
      { id: 3, externalId: "t3" },
    ];

    const assignments = pool.assignTasks(tasks);
    expect(assignments).toHaveLength(3);
    // Round-robin: agent 0, 1, 0
    expect(assignments[0]![0].agentId).toBe("swe-0");
    expect(assignments[1]![0].agentId).toBe("swe-1");
    expect(assignments[2]![0].agentId).toBe("swe-0");

    await pool.cleanup();
  });

  it("cleans up all worktrees", async () => {
    const pool = new AgentPoolManager(4);
    const mainBranch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: repoDir }).toString().trim();
    await pool.spawn(2, repoDir, wsBase, "run4", "test-branch", mainBranch);

    const ws0Path = pool.getWorkspace("swe-0")!.wsPath;
    const ws1Path = pool.getWorkspace("swe-1")!.wsPath;
    expect(fs.existsSync(ws0Path)).toBe(true);
    expect(fs.existsSync(ws1Path)).toBe(true);

    await pool.cleanup();
    expect(fs.existsSync(ws0Path)).toBe(false);
    expect(fs.existsSync(ws1Path)).toBe(false);
    expect(pool.getAgentIds()).toHaveLength(0);
  });

  it("handles empty assignTasks", async () => {
    const pool = new AgentPoolManager(4);
    const assignments = pool.assignTasks([]);
    expect(assignments).toHaveLength(0);
  });
});
