import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { getDb, closeDb } from "../db/client.js";
import { sessions, tasks } from "../db/schema.js";
import {
  buildCoderPrompt,
  getDependencyDiffs,
  type TaskRecord,
} from "../orchestrator/task-runner.js";
import { eq } from "drizzle-orm";

describe("orchestrator/task-runner — buildCoderPrompt", () => {
  const task: TaskRecord = {
    id: "task-001",
    sessionId: "s_test",
    title: "Add ThemeConfig",
    description: "Create a theme configuration module",
    filesLikelyTouched: JSON.stringify(["src/theme/config.ts"]),
    acceptanceCriteria: JSON.stringify([
      "ThemeConfig type is exported",
      "Dark and light presets exist",
    ]),
    dependsOn: null,
    branchName: null,
    status: "queued",
  };

  it("should include task title and description", () => {
    const prompt = buildCoderPrompt(task, []);
    expect(prompt).toContain("Add ThemeConfig");
    expect(prompt).toContain("Create a theme configuration module");
  });

  it("should include acceptance criteria as bullet list", () => {
    const prompt = buildCoderPrompt(task, []);
    expect(prompt).toContain("- ThemeConfig type is exported");
    expect(prompt).toContain("- Dark and light presets exist");
  });

  it("should include files likely touched", () => {
    const prompt = buildCoderPrompt(task, []);
    expect(prompt).toContain("src/theme/config.ts");
  });

  it("should include dependency diffs", () => {
    const prompt = buildCoderPrompt(task, ["diff --git a/file.ts..."]);
    expect(prompt).toContain("diff --git a/file.ts...");
  });

  it("should handle null fields gracefully", () => {
    const nullTask: TaskRecord = {
      ...task,
      filesLikelyTouched: null,
      acceptanceCriteria: null,
    };
    const prompt = buildCoderPrompt(nullTask, []);
    expect(prompt).toContain("(not specified)");
    expect(prompt).toContain("(none specified)");
  });
});

describe("orchestrator/task-runner — getDependencyDiffs", () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    const dir = mkdtempSync(join(tmpdir(), "sweteam-runner-test-"));
    tempDirs.push(dir);
    const db = getDb(join(dir, "test.db"));

    // Insert parent session first (FK constraint)
    db.insert(sessions)
      .values({
        id: "s_test",
        repo: "owner/repo",
        goal: "test",
        status: "building",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    db.insert(tasks)
      .values({
        id: "dep-001",
        sessionId: "s_test",
        title: "Dep task",
        description: "A dependency",
        status: "done",
        diffPatch: "diff --git a/dep.ts\n+export const x = 1;",
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
  });

  afterEach(() => {
    closeDb();
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("should return diffs from dependency tasks", () => {
    const task: TaskRecord = {
      id: "task-002",
      sessionId: "s_test",
      title: "Next task",
      description: "Depends on dep-001",
      filesLikelyTouched: null,
      acceptanceCriteria: null,
      dependsOn: JSON.stringify(["dep-001"]),
      branchName: null,
      status: "queued",
    };

    const diffs = getDependencyDiffs(task);
    expect(diffs.length).toBe(1);
    expect(diffs[0]).toContain("export const x = 1;");
  });

  it("should return empty array for no dependencies", () => {
    const task: TaskRecord = {
      id: "task-002",
      sessionId: "s_test",
      title: "No deps",
      description: "Independent task",
      filesLikelyTouched: null,
      acceptanceCriteria: null,
      dependsOn: null,
      branchName: null,
      status: "queued",
    };

    const diffs = getDependencyDiffs(task);
    expect(diffs).toEqual([]);
  });
});
