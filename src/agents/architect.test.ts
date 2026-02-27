import { describe, it, expect } from "vitest";
import { extractJson, validatePlan, computeParallelGroups } from "./architect.js";

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
