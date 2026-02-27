import { describe, it, expect, vi } from "vitest";
import { extractJson, validatePlan, computeParallelGroups, ArchitectAgent } from "./architect.js";

describe("extractJson", () => {
  it("parses plain JSON object", () => {
    expect(extractJson('{"key": "value"}')).toEqual({ key: "value" });
  });

  it("parses plain JSON array", () => {
    expect(extractJson('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it("strips markdown code fences", () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(extractJson(input)).toEqual({ key: "value" });
  });

  it("finds JSON embedded in text", () => {
    const input = 'Here is the plan:\n[{"id": "task-1", "title": "A"}]\nDone.';
    expect(extractJson(input)).toEqual([{ id: "task-1", title: "A" }]);
  });

  it("finds JSON object in text", () => {
    const input = 'Response:\n{"status": "clear"}\nEnd.';
    expect(extractJson(input)).toEqual({ status: "clear" });
  });

  it("throws when no JSON found", () => {
    expect(() => extractJson("no json here")).toThrow("No JSON found");
  });

  it("handles nested markdown fences", () => {
    const input = '```\n[{"id": "t1"}]\n```';
    expect(extractJson(input)).toEqual([{ id: "t1" }]);
  });
});

describe("validatePlan", () => {
  it("assigns IDs to tasks without them", () => {
    const tasks = [
      { id: "", title: "A", description: "a", dependencies: [], files: [] },
      { id: "", title: "B", description: "b", dependencies: [], files: [] },
    ];
    const result = validatePlan(tasks);
    expect(result[0]!.id).toBe("task-1");
    expect(result[1]!.id).toBe("task-2");
  });

  it("removes invalid dependency references", () => {
    const tasks = [
      { id: "t1", title: "A", description: "a", dependencies: ["nonexistent"], files: [] },
    ];
    const result = validatePlan(tasks);
    expect(result[0]!.dependencies).toEqual([]);
  });

  it("removes self-references", () => {
    const tasks = [
      { id: "t1", title: "A", description: "a", dependencies: ["t1"], files: [] },
    ];
    const result = validatePlan(tasks);
    expect(result[0]!.dependencies).toEqual([]);
  });

  it("returns topological order", () => {
    const tasks = [
      { id: "t2", title: "B", description: "b", dependencies: ["t1"], files: [] },
      { id: "t1", title: "A", description: "a", dependencies: [], files: [] },
    ];
    const result = validatePlan(tasks);
    expect(result[0]!.id).toBe("t1");
    expect(result[1]!.id).toBe("t2");
  });

  it("handles cycle by stripping dependencies", () => {
    const tasks = [
      { id: "t1", title: "A", description: "a", dependencies: ["t2"], files: [] },
      { id: "t2", title: "B", description: "b", dependencies: ["t1"], files: [] },
    ];
    const result = validatePlan(tasks);
    expect(result).toHaveLength(2);
    expect(result[0]!.dependencies).toEqual([]);
    expect(result[1]!.dependencies).toEqual([]);
  });

  it("handles complex valid DAG", () => {
    const tasks = [
      { id: "t3", title: "C", description: "c", dependencies: ["t1", "t2"], files: [] },
      { id: "t1", title: "A", description: "a", dependencies: [], files: [] },
      { id: "t2", title: "B", description: "b", dependencies: ["t1"], files: [] },
    ];
    const result = validatePlan(tasks);
    const ids = result.map(t => t.id);
    expect(ids.indexOf("t1")).toBeLessThan(ids.indexOf("t2"));
    expect(ids.indexOf("t1")).toBeLessThan(ids.indexOf("t3"));
    expect(ids.indexOf("t2")).toBeLessThan(ids.indexOf("t3"));
  });
});

describe("computeParallelGroups", () => {
  it("groups independent tasks together", () => {
    const tasks = [
      { id: "t1", title: "A", description: "a", dependencies: [], files: [] },
      { id: "t2", title: "B", description: "b", dependencies: [], files: [] },
      { id: "t3", title: "C", description: "c", dependencies: [], files: [] },
    ];
    const groups = computeParallelGroups(tasks);
    expect(groups).toEqual([["t1", "t2", "t3"]]);
  });

  it("creates sequential groups for linear dependencies", () => {
    const tasks = [
      { id: "t1", title: "A", description: "a", dependencies: [], files: [] },
      { id: "t2", title: "B", description: "b", dependencies: ["t1"], files: [] },
      { id: "t3", title: "C", description: "c", dependencies: ["t2"], files: [] },
    ];
    const groups = computeParallelGroups(tasks);
    expect(groups).toEqual([["t1"], ["t2"], ["t3"]]);
  });

  it("creates mixed groups for diamond dependencies", () => {
    const tasks = [
      { id: "t1", title: "A", description: "a", dependencies: [], files: [] },
      { id: "t2", title: "B", description: "b", dependencies: ["t1"], files: [] },
      { id: "t3", title: "C", description: "c", dependencies: ["t1"], files: [] },
      { id: "t4", title: "D", description: "d", dependencies: ["t2", "t3"], files: [] },
    ];
    const groups = computeParallelGroups(tasks);
    expect(groups).toEqual([["t1"], ["t2", "t3"], ["t4"]]);
  });

  it("handles empty tasks list", () => {
    expect(computeParallelGroups([])).toEqual([]);
  });
});

describe("ArchitectAgent review", () => {
  it("reviewCode returns ReviewResult on success", async () => {
    const agent = new ArchitectAgent();
    vi.spyOn(agent as any, "run").mockResolvedValueOnce(
      '{"approved": true, "quality": "good", "feedback": "Looks great", "issues": []}'
    );
    const result = await agent.reviewCode("/fake", "task", "diff content");
    expect(result.approved).toBe(true);
    expect(result.quality).toBe("good");
    expect(result.feedback).toBe("Looks great");
  });

  it("reviewCode returns fallback on parse failure", async () => {
    const agent = new ArchitectAgent();
    vi.spyOn(agent as any, "run").mockRejectedValueOnce(new Error("CLI error"));
    const result = await agent.reviewCode("/fake", "task", "diff");
    expect(result.approved).toBe(false);
    expect(result.quality).toBe("needs_work");
    expect(result.feedback).toBe("Review parse failed");
  });

  it("reviewCode includes previous feedback in prompt", async () => {
    const agent = new ArchitectAgent();
    const runSpy = vi.spyOn(agent as any, "run").mockResolvedValueOnce(
      '{"approved": true, "quality": "excellent", "feedback": "", "issues": []}'
    );
    await agent.reviewCode("/fake", "task", "diff", ["Fix the types", "Add tests"]);
    const prompt = runSpy.mock.calls[0]![0] as string;
    expect(prompt).toContain("Fix the types");
    expect(prompt).toContain("Add tests");
  });

  it("shouldApprove returns true when approved and threshold is good", () => {
    const agent = new ArchitectAgent();
    expect(agent.shouldApprove({ approved: true, quality: "good", feedback: "", issues: [] })).toBe(true);
  });

  it("shouldApprove returns false when not approved", () => {
    const agent = new ArchitectAgent();
    expect(agent.shouldApprove({ approved: false, quality: "needs_work", feedback: "fix", issues: ["a"] })).toBe(false);
  });
});
