import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SWETeam } from "./main.js";
import { RepoLockManager } from "./repo-locks.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { reloadConfig } from "./config.js";

describe("RepoLockManager", () => {
  it("returns the same mutex for the same repo", () => {
    const mgr = new RepoLockManager();
    const m1 = mgr.get("owner/repo");
    const m2 = mgr.get("owner/repo");
    expect(m1).toBe(m2);
  });

  it("returns different mutexes for different repos", () => {
    const mgr = new RepoLockManager();
    const m1 = mgr.get("owner/repo1");
    const m2 = mgr.get("owner/repo2");
    expect(m1).not.toBe(m2);
  });

  it("ensures mutual exclusion", async () => {
    const mgr = new RepoLockManager();
    const mutex = mgr.get("test/repo");
    const order: number[] = [];

    const p1 = mutex.runExclusive(async () => {
      await new Promise(r => setTimeout(r, 50));
      order.push(1);
    });

    const p2 = mutex.runExclusive(async () => {
      order.push(2);
    });

    await Promise.all([p1, p2]);
    expect(order).toEqual([1, 2]);
  });
});

describe("SWETeam", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "swe-team-main-test-"));
    // Create a config that uses temp paths
    const configPath = path.join(tmpDir, "config.yaml");
    fs.writeFileSync(configPath, `
interface: "cli"
repos:
  base_path: "${path.join(tmpDir, "repos")}"
  workspaces_path: "${path.join(tmpDir, "workspaces")}"
database:
  path: "${path.join(tmpDir, "state", "test.db")}"
logging:
  file: "${path.join(tmpDir, "logs", "test.log")}"
agent:
  skip_clarification: true
`);
    reloadConfig(configPath);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates SWETeam instance", () => {
    const team = new SWETeam();
    expect(team).toBeDefined();
  });

  it("setup creates directories and initializes DB", async () => {
    const team = new SWETeam();
    await team.setup();

    expect(fs.existsSync(path.join(tmpDir, "repos"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "workspaces"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "state"))).toBe(true);
  });

  it("shutdown is callable", async () => {
    const team = new SWETeam();
    await team.setup();
    // shutdown should resolve gracefully without calling process.exit
    await team.shutdown();
  });
});
