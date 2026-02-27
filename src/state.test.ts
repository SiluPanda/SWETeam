import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { StateManager } from "./state.js";
import { TaskStatus, WorkflowStep } from "./db/schema.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("StateManager", () => {
  let tmpDir: string;
  let sm: StateManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "swe-team-db-test-"));
    sm = StateManager.init(path.join(tmpDir, "test.db"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("repos", () => {
    it("creates a new repo", () => {
      const repo = sm.getOrCreateRepo("owner/repo", "/path", "https://github.com/owner/repo", "owner/repo", "main");
      expect(repo.name).toBe("owner/repo");
      expect(repo.path).toBe("/path");
      expect(repo.url).toBe("https://github.com/owner/repo");
    });

    it("returns existing repo on duplicate", () => {
      const r1 = sm.getOrCreateRepo("owner/repo");
      const r2 = sm.getOrCreateRepo("owner/repo");
      expect(r1.id).toBe(r2.id);
    });
  });

  describe("workflow runs", () => {
    it("creates a workflow run", () => {
      const repo = sm.getOrCreateRepo("test/repo");
      const run = sm.createWorkflowRun(repo.id, "Add feature X", "chat-123");
      expect(run.userRequest).toBe("Add feature X");
      expect(run.chatId).toBe("chat-123");
      expect(run.status).toBe(TaskStatus.PENDING);
      expect(run.workflowStep).toBe(WorkflowStep.QUEUED);
    });

    it("advances workflow step and updates status", () => {
      const repo = sm.getOrCreateRepo("test/repo");
      const run = sm.createWorkflowRun(repo.id, "task", "chat");

      sm.advanceWorkflow(run.id, WorkflowStep.REPO_SYNC);
      let updated = sm.getWorkflowRun(run.id)!;
      expect(updated.workflowStep).toBe(WorkflowStep.REPO_SYNC);
      expect(updated.status).toBe(TaskStatus.IN_PROGRESS);

      sm.advanceWorkflow(run.id, WorkflowStep.COMPLETED);
      updated = sm.getWorkflowRun(run.id)!;
      expect(updated.status).toBe(TaskStatus.COMPLETED);
    });

    it("advances to failed status", () => {
      const repo = sm.getOrCreateRepo("test/repo");
      const run = sm.createWorkflowRun(repo.id, "task", "chat");
      sm.advanceWorkflow(run.id, WorkflowStep.FAILED, { errorMessage: "something broke" });
      const updated = sm.getWorkflowRun(run.id)!;
      expect(updated.status).toBe(TaskStatus.FAILED);
      expect(updated.errorMessage).toBe("something broke");
    });

    it("passes additional updates in advanceWorkflow", () => {
      const repo = sm.getOrCreateRepo("test/repo");
      const run = sm.createWorkflowRun(repo.id, "task", "chat");
      sm.advanceWorkflow(run.id, WorkflowStep.WORKSPACE_CREATED, {
        workingBranch: "swe-team/feat-abc12345",
        workspacePath: "/tmp/ws",
      });
      const updated = sm.getWorkflowRun(run.id)!;
      expect(updated.workingBranch).toBe("swe-team/feat-abc12345");
      expect(updated.workspacePath).toBe("/tmp/ws");
    });

    it("gets active runs", () => {
      const repo = sm.getOrCreateRepo("test/repo");
      sm.createWorkflowRun(repo.id, "task1", "c1");
      const r2 = sm.createWorkflowRun(repo.id, "task2", "c2");
      sm.advanceWorkflow(r2.id, WorkflowStep.COMPLETED);
      const active = sm.getActiveRuns();
      expect(active).toHaveLength(1);
      expect(active[0]!.userRequest).toBe("task1");
    });

    it("gets incomplete runs", () => {
      const repo = sm.getOrCreateRepo("test/repo");
      const r1 = sm.createWorkflowRun(repo.id, "task1", "c1");
      sm.advanceWorkflow(r1.id, WorkflowStep.PLANNING);
      sm.createWorkflowRun(repo.id, "task2", "c2"); // still pending
      const incomplete = sm.getIncompleteRuns();
      expect(incomplete).toHaveLength(1);
      expect(incomplete[0]!.userRequest).toBe("task1");
    });

    it("cancels a run", () => {
      const repo = sm.getOrCreateRepo("test/repo");
      const run = sm.createWorkflowRun(repo.id, "task", "chat");
      sm.cancelRun(run.id);
      const updated = sm.getWorkflowRun(run.id)!;
      expect(updated.status).toBe(TaskStatus.CANCELLED);
    });
  });

  describe("subtasks", () => {
    it("creates subtasks from plan", () => {
      const repo = sm.getOrCreateRepo("test/repo");
      const run = sm.createWorkflowRun(repo.id, "task", "chat");
      const tasks = [
        { id: "task-1", title: "Setup", description: "Setup project", dependencies: [], files: ["src/index.ts"] },
        { id: "task-2", title: "Feature", description: "Add feature", dependencies: ["task-1"], files: ["src/feature.ts"] },
      ];
      sm.createSubtasks(run.id, tasks);
      const subs = sm.getSubtasks(run.id);
      expect(subs).toHaveLength(2);
      expect(subs[0]!.externalId).toBe("task-1");
      expect(subs[0]!.orderIndex).toBe(0);
      expect(subs[1]!.externalId).toBe("task-2");
      expect(JSON.parse(subs[1]!.dependsOn!)).toEqual(["task-1"]);
    });

    it("createSubtasks is idempotent (replaces existing)", () => {
      const repo = sm.getOrCreateRepo("test/repo");
      const run = sm.createWorkflowRun(repo.id, "task", "chat");
      sm.createSubtasks(run.id, [{ id: "t1", title: "A", description: "desc", dependencies: [], files: [] }]);
      sm.createSubtasks(run.id, [{ id: "t2", title: "B", description: "desc2", dependencies: [], files: [] }]);
      const subs = sm.getSubtasks(run.id);
      expect(subs).toHaveLength(1);
      expect(subs[0]!.externalId).toBe("t2");
    });

    it("updates a subtask", () => {
      const repo = sm.getOrCreateRepo("test/repo");
      const run = sm.createWorkflowRun(repo.id, "task", "chat");
      sm.createSubtasks(run.id, [{ id: "t1", title: "A", description: "desc", dependencies: [], files: [] }]);
      const subs = sm.getSubtasks(run.id);
      sm.updateSubtask(subs[0]!.id, { status: TaskStatus.IN_PROGRESS, assignedAgent: "agent-0" });
      const updated = sm.getSubtasks(run.id);
      expect(updated[0]!.status).toBe(TaskStatus.IN_PROGRESS);
      expect(updated[0]!.assignedAgent).toBe("agent-0");
    });
  });

  describe("singleton", () => {
    it("getInstance returns the initialized instance", () => {
      expect(StateManager.getInstance()).toBe(sm);
    });
  });
});
