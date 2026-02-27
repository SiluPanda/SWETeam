import { describe, it, expect } from "vitest";
import {
  parseTaskCommand, formatTaskReceived, formatPlanning, formatClarifying,
  formatPlanCreated, formatProgress, formatReview, formatError,
  formatCompleted, isAffirmative, formatProgressBar, formatStatus, formatList,
} from "./messaging.js";

describe("messaging", () => {
  describe("parseTaskCommand", () => {
    it("parses repo and task", () => {
      const result = parseTaskCommand("owner/repo Build a REST API");
      expect(result).toEqual({ repo: "owner/repo", task: "Build a REST API" });
    });

    it("handles multi-line task", () => {
      const result = parseTaskCommand("org/project Add feature\nwith details");
      expect(result).toEqual({ repo: "org/project", task: "Add feature\nwith details" });
    });

    it("returns null for empty input", () => {
      expect(parseTaskCommand("")).toBeNull();
    });

    it("returns null for single word", () => {
      expect(parseTaskCommand("repo")).toBeNull();
    });

    it("trims whitespace", () => {
      const result = parseTaskCommand("  owner/repo  some task  ");
      expect(result).toEqual({ repo: "owner/repo", task: "some task" });
    });
  });

  describe("format functions", () => {
    it("formatTaskReceived", () => {
      expect(formatTaskReceived("o/r", "task")).toBe("[o/r] Task Received\nTask: task");
    });

    it("formatPlanning", () => {
      expect(formatPlanning("o/r")).toBe("[o/r] Planning...");
    });

    it("formatClarifying", () => {
      expect(formatClarifying("o/r")).toBe("[o/r] Analyzing your requirement...");
    });

    it("formatPlanCreated", () => {
      const result = formatPlanCreated("o/r", ["Setup", "Feature"], 2);
      expect(result).toBe("[o/r] Plan: 2 tasks, 2 agents\n1. Setup\n2. Feature");
    });

    it("formatProgress", () => {
      const result = formatProgress("o/r", 3, 5, "Add API");
      expect(result).toContain("[o/r]");
      expect(result).toContain("Task 3/5: Add API");
      expect(result).toContain("60%");
    });

    it("formatReview", () => {
      expect(formatReview("o/r", "task", 2)).toBe("[o/r] Review iteration 2: task");
    });

    it("formatError", () => {
      expect(formatError("o/r", "task", "boom")).toBe('[o/r] Error in "task": boom');
    });

    it("formatCompleted", () => {
      expect(formatCompleted("o/r", "https://gh.com/pr/1")).toBe("[o/r] Done! PR: https://gh.com/pr/1");
    });
  });

  describe("isAffirmative", () => {
    it.each(["yes", "y", "Yeah", "SURE", "proceed", "confirm", "done"])(
      "returns true for %s", (input) => {
        expect(isAffirmative(input)).toBe(true);
      }
    );

    it.each(["no", "nope", "hello", "maybe", ""])(
      "returns false for %s", (input) => {
        expect(isAffirmative(input)).toBe(false);
      }
    );

    it("trims whitespace", () => {
      expect(isAffirmative("  yes  ")).toBe(true);
    });
  });

  describe("formatProgressBar", () => {
    it("shows 0% for zero total", () => {
      expect(formatProgressBar(0, 0)).toBe("[          ] 0%");
    });

    it("shows 50%", () => {
      expect(formatProgressBar(5, 10)).toBe("[█████     ] 50%");
    });

    it("shows 100%", () => {
      expect(formatProgressBar(10, 10)).toBe("[██████████] 100%");
    });

    it("uses custom width", () => {
      expect(formatProgressBar(1, 2, 4)).toBe("[██  ] 50%");
    });
  });

  describe("formatStatus", () => {
    it("shows no active runs", () => {
      expect(formatStatus([])).toBe("No active runs.");
    });

    it("shows active runs", () => {
      const runs = [{ userRequest: "Add API", workflowStep: "planning", status: "in_progress" }];
      expect(formatStatus(runs)).toBe("1. Add API — planning (in_progress)");
    });
  });

  describe("formatList", () => {
    it("shows no runs found", () => {
      expect(formatList([])).toBe("No runs found.");
    });

    it("shows runs with stop hint", () => {
      const runs = [{ id: 1, userRequest: "task", status: "pending" }];
      const result = formatList(runs);
      expect(result).toContain("#1 task [pending]");
      expect(result).toContain("/stop");
    });
  });
});
