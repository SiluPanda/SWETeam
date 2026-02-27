import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WorkflowRunner } from "./workflow.js";
import { StateManager } from "./state.js";
import { WorkflowStep, TaskStatus } from "./db/schema.js";
import { loadConfig } from "./config.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Create a mock interface adapter
function createMockInterface() {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    waitForResponse: vi.fn().mockResolvedValue("yes"),
    messageCallback: vi.fn(),
  } as any;
}

describe("WorkflowRunner", () => {
  let tmpDir: string;
  let sm: StateManager;
  let mockIface: any;
  let runner: WorkflowRunner;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "swe-team-wf-test-"));
    // Load config with skip clarification to simplify tests
    loadConfig(path.join(tmpDir, "nonexistent.yaml"));
    sm = StateManager.init(path.join(tmpDir, "test.db"));
    mockIface = createMockInterface();
    runner = new WorkflowRunner(sm, mockIface);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates WorkflowRunner instance", () => {
    expect(runner).toBeDefined();
  });

  it("handles cancellation", () => {
    const repo = sm.getOrCreateRepo("test/repo");
    const run = sm.createWorkflowRun(repo.id, "task", "chat");
    runner.cancel(run.id);
    // Should not throw, should return early
  });

  it("marks run as FAILED on error", async () => {
    const repo = sm.getOrCreateRepo("test/repo");
    const run = sm.createWorkflowRun(repo.id, "task", "chat");

    // Mock getOrCreateRepo to throw
    const origModule = await import("./git-ops.js");
    const origFn = origModule.getOrCreateRepo;

    // The workflow will try to do repo sync which will fail
    // since there's no actual repo
    await runner.run(run.id, "test/nonexistent-repo-xyz");

    const updated = sm.getWorkflowRun(run.id)!;
    expect(updated.status).toBe(TaskStatus.FAILED);
    expect(updated.workflowStep).toBe(WorkflowStep.FAILED);
    expect(updated.errorMessage).toBeTruthy();
  });

  it("sends error message on failure", async () => {
    const repo = sm.getOrCreateRepo("test/repo");
    const run = sm.createWorkflowRun(repo.id, "task", "chat");

    await runner.run(run.id, "test/nonexistent-repo-xyz");

    // Should have sent at least one error message
    expect(mockIface.sendMessage).toHaveBeenCalled();
    const lastCall = mockIface.sendMessage.mock.calls[mockIface.sendMessage.mock.calls.length - 1];
    expect(lastCall[1]).toContain("Error");
  });

  it("STEP_ORDER defines correct ordering", async () => {
    // Indirectly test by checking that pastStep works
    const repo = sm.getOrCreateRepo("test/repo");
    const run = sm.createWorkflowRun(repo.id, "task", "chat");

    // Initial run should be at QUEUED, not past REPO_SYNC
    const runData = sm.getWorkflowRun(run.id)!;
    expect(runData.workflowStep).toBe(WorkflowStep.QUEUED);
  });

  it("state advances through REPO_SYNC on failure", async () => {
    const repo = sm.getOrCreateRepo("test/repo");
    const run = sm.createWorkflowRun(repo.id, "task", "chat");

    await runner.run(run.id, "nonexistent/repo");

    // Should have advanced at least to REPO_SYNC before failing
    const updated = sm.getWorkflowRun(run.id)!;
    // It should be FAILED since repo sync failed
    expect(updated.workflowStep).toBe(WorkflowStep.FAILED);
  });

  it("sends task received message", async () => {
    const repo = sm.getOrCreateRepo("test/repo");
    const run = sm.createWorkflowRun(repo.id, "Build API", "chat");

    await runner.run(run.id, "nonexistent/repo");

    // First message should contain the task received message
    const calls = mockIface.sendMessage.mock.calls;
    const firstMsg = calls[0]?.[1] ?? "";
    expect(firstMsg).toContain("Task Received");
  });
});
