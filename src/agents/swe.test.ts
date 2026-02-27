import { describe, it, expect, vi } from "vitest";
import { SWEAgent } from "./swe.js";

// We can test the structure and error handling without actual CLI calls
describe("SWEAgent", () => {
  it("creates with default agent ID", () => {
    const agent = new SWEAgent();
    expect(agent.agentId).toBe("swe-0");
  });

  it("creates with custom agent ID", () => {
    const agent = new SWEAgent("swe-3");
    expect(agent.agentId).toBe("swe-3");
  });

  it("has implementTask method", () => {
    const agent = new SWEAgent();
    expect(typeof agent.implementTask).toBe("function");
  });

  it("has applyFeedback method", () => {
    const agent = new SWEAgent();
    expect(typeof agent.applyFeedback).toBe("function");
  });

  it("has runTests method", () => {
    const agent = new SWEAgent();
    expect(typeof agent.runTests).toBe("function");
  });

  it("implementTask returns false and sets lastError on CLI failure", async () => {
    const agent = new SWEAgent();
    // Mock the run method to throw
    vi.spyOn(agent as any, "run").mockRejectedValueOnce(new Error("CLI not found"));
    const result = await agent.implementTask("/fake", "do stuff");
    expect(result).toBe(false);
    expect(agent.lastError).toBe("CLI not found");
  });

  it("implementTask returns true on success", async () => {
    const agent = new SWEAgent();
    vi.spyOn(agent as any, "run").mockResolvedValueOnce("Done");
    const result = await agent.implementTask("/fake", "do stuff");
    expect(result).toBe(true);
    expect(agent.lastError).toBeUndefined();
  });

  it("applyFeedback returns true on success", async () => {
    const agent = new SWEAgent();
    vi.spyOn(agent as any, "run").mockResolvedValueOnce("Fixed");
    const result = await agent.applyFeedback("/fake", "task", "fix the bug");
    expect(result).toBe(true);
  });

  it("applyFeedback truncates long diffs", async () => {
    const agent = new SWEAgent();
    const runSpy = vi.spyOn(agent as any, "run").mockResolvedValueOnce("Fixed");
    const longDiff = "x".repeat(6000);
    await agent.applyFeedback("/fake", "task", "feedback", longDiff);
    const prompt = runSpy.mock.calls[0]![0] as string;
    expect(prompt).toContain("(truncated)");
  });

  it("runTests parses JSON output", async () => {
    const agent = new SWEAgent();
    vi.spyOn(agent as any, "run").mockResolvedValueOnce('{"passed": true, "summary": "All 5 tests passed"}');
    const result = await agent.runTests("/fake");
    expect(result.passed).toBe(true);
    expect(result.summary).toBe("All 5 tests passed");
  });

  it("runTests falls back to string check on non-JSON output", async () => {
    const agent = new SWEAgent();
    vi.spyOn(agent as any, "run").mockResolvedValueOnce("All tests passed successfully!");
    const result = await agent.runTests("/fake");
    expect(result.passed).toBe(true);
  });

  it("runTests detects failure in string output", async () => {
    const agent = new SWEAgent();
    vi.spyOn(agent as any, "run").mockResolvedValueOnce("3 tests failed out of 10");
    const result = await agent.runTests("/fake");
    expect(result.passed).toBe(false);
  });

  it("runTests handles CLI error", async () => {
    const agent = new SWEAgent();
    vi.spyOn(agent as any, "run").mockRejectedValueOnce(new Error("timeout"));
    const result = await agent.runTests("/fake");
    expect(result.passed).toBe(false);
    expect(result.summary).toBe("timeout");
  });
});
