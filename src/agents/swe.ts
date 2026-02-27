import { BaseAgent } from "./base.js";
import { extractJson } from "./architect.js";

export class SWEAgent extends BaseAgent {
  lastError?: string;

  constructor(public readonly agentId: string = "swe-0") {
    super("swe");
  }

  async implementTask(
    repoPath: string,
    taskDescription: string,
    opts?: { filesToModify?: string[]; overallGoal?: string; context?: string },
  ): Promise<boolean> {
    const parts = [`Implement the following task:\n${taskDescription}`];
    if (opts?.overallGoal) parts.push(`\nOverall goal: ${opts.overallGoal}`);
    if (opts?.filesToModify?.length) parts.push(`\nFiles to modify: ${opts.filesToModify.join(", ")}`);
    if (opts?.context) parts.push(`\nContext: ${opts.context}`);
    parts.push("\nImplement, write tests, and commit your changes.");

    try {
      await this.run(parts.join(""), repoPath);
      this.lastError = undefined;
      return true;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      return false;
    }
  }

  async applyFeedback(
    repoPath: string, taskDescription: string, feedback: string, diff?: string,
  ): Promise<boolean> {
    const truncDiff = diff && diff.length > 5000 ? diff.slice(0, 5000) + "\n... (truncated)" : diff;
    const prompt = [
      `Task: ${taskDescription}`,
      `\nReview feedback:\n${feedback}`,
      truncDiff ? `\nCurrent diff:\n${truncDiff}` : "",
      "\nApply the feedback, fix the issues, and commit.",
    ].join("");

    try {
      await this.run(prompt, repoPath);
      this.lastError = undefined;
      return true;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      return false;
    }
  }

  async runTests(repoPath: string): Promise<{ passed: boolean; summary: string }> {
    const prompt = 'Run the test suite. Return JSON: {"passed": true/false, "summary": "brief summary"}';
    try {
      const output = await this.run(prompt, repoPath);
      try {
        const parsed = extractJson(output) as { passed?: boolean; summary?: string };
        return { passed: !!parsed.passed, summary: parsed.summary ?? output.slice(0, 200) };
      } catch {
        const lower = output.toLowerCase();
        const passed = !lower.includes("fail") && !lower.includes("error");
        return { passed, summary: output.slice(0, 200) };
      }
    } catch (err) {
      return { passed: false, summary: err instanceof Error ? err.message : String(err) };
    }
  }
}
