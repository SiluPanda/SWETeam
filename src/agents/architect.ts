import { BaseAgent } from "./base.js";
import type { PlanTask } from "../state.js";

export interface ClarificationResult {
  status: "questions" | "ready";
  message: string;
}

export interface PlanResult {
  tasks: PlanTask[];
  parallelGroups: string[][];
  recommendedAgents: number;
}

export function extractJson(text: string): unknown {
  // Strip markdown code fences
  const stripped = text.replace(/```(?:json)?\s*\n?([\s\S]*?)```/g, "$1").trim();
  try { return JSON.parse(stripped); } catch { /* fall through */ }

  // Scan for first [ or { and find matching close
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "[" || ch === "{") {
      // Try full slice first
      try { return JSON.parse(text.slice(i)); } catch { /* try bracket matching */ }
      // Find matching bracket
      const close = ch === "[" ? "]" : "}";
      let depth = 0;
      let inStr = false;
      let escape = false;
      for (let j = i; j < text.length; j++) {
        const c = text[j]!;
        if (escape) { escape = false; continue; }
        if (c === "\\") { escape = true; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (c === ch) depth++;
        else if (c === close) { depth--; if (depth === 0) {
          try { return JSON.parse(text.slice(i, j + 1)); } catch { break; }
        }}
      }
    }
  }

  throw new Error("No JSON found in text");
}

export function validatePlan(tasks: PlanTask[]): PlanTask[] {
  // Assign IDs to tasks missing them
  for (let i = 0; i < tasks.length; i++) {
    if (!tasks[i]!.id) tasks[i]!.id = `task-${i + 1}`;
    if (!tasks[i]!.dependencies) tasks[i]!.dependencies = [];
    if (!tasks[i]!.files) tasks[i]!.files = [];
  }

  const ids = new Set(tasks.map(t => t.id));

  // Remove invalid dependency references and self-refs
  for (const t of tasks) {
    t.dependencies = t.dependencies.filter(d => d !== t.id && ids.has(d));
  }

  // Topological sort (Kahn's algorithm)
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const t of tasks) {
    inDegree.set(t.id, 0);
    adj.set(t.id, []);
  }
  for (const t of tasks) {
    for (const dep of t.dependencies) {
      adj.get(dep)?.push(t.id);
      inDegree.set(t.id, (inDegree.get(t.id) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of adj.get(current) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  // Cycle detected: strip all dependencies
  if (sorted.length !== tasks.length) {
    for (const t of tasks) t.dependencies = [];
    return tasks;
  }

  // Return in topological order
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  return sorted.map(id => taskMap.get(id)!);
}

export function computeParallelGroups(tasks: PlanTask[]): string[][] {
  const groups: string[][] = [];
  const completed = new Set<string>();
  const remaining = new Map(tasks.map(t => [t.id, t]));

  while (remaining.size > 0) {
    const group: string[] = [];
    for (const [id, task] of remaining) {
      if (task.dependencies.every(d => completed.has(d))) {
        group.push(id);
      }
    }
    if (group.length === 0) {
      // Deadlock: add all remaining
      groups.push([...remaining.keys()]);
      break;
    }
    for (const id of group) {
      remaining.delete(id);
      completed.add(id);
    }
    groups.push(group);
  }

  return groups;
}

function createDefaultPlan(task: string): PlanTask[] {
  return [{
    id: "task-1",
    title: "Implement task",
    description: task,
    dependencies: [],
    files: [],
  }];
}

export class ArchitectAgent extends BaseAgent {
  constructor() {
    super("architect");
  }

  async analyzeCodebase(repoPath: string): Promise<string> {
    try {
      return await this.run(
        "Analyze this codebase. Summarize: project structure, tech stack, test infrastructure, coding conventions. Be concise.",
        repoPath,
      );
    } catch (err) {
      return `Codebase analysis failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  async createPlan(repoPath: string, taskDescription: string, analysis = ""): Promise<PlanTask[]> {
    const prompt = [
      `Task: ${taskDescription}`,
      analysis ? `\nCodebase analysis:\n${analysis}` : "",
      '\nCreate a plan as a JSON array of tasks. Each task: { "id": "task-N", "title": "...", "description": "...", "dependencies": [...], "files": [...] }',
      "Return ONLY the JSON array.",
    ].join("");

    try {
      const output = await this.run(prompt, repoPath);
      const parsed = extractJson(output);
      const rawTasks = (Array.isArray(parsed) ? parsed : (parsed as { tasks?: unknown[] }).tasks ?? [parsed]) as PlanTask[];
      return validatePlan(rawTasks);
    } catch {
      return createDefaultPlan(taskDescription);
    }
  }

  async clarifyRequirements(
    repoPath: string,
    taskDescription: string,
    conversationHistory: Array<{ role: "assistant" | "user"; text: string }>,
  ): Promise<ClarificationResult> {
    const historyStr = conversationHistory.map(m => `${m.role}: ${m.text}`).join("\n");
    const prompt = [
      `Requirement: ${taskDescription}`,
      historyStr ? `\nPrevious conversation:\n${historyStr}` : "",
      '\nIs the requirement clear enough to create a plan? Respond with JSON: {"status": "clear"} or {"status": "unclear", "message": "your question"}',
    ].join("");

    try {
      const output = await this.run(prompt, repoPath);
      const parsed = extractJson(output) as { status?: string; message?: string };
      if (parsed.status === "clear" || parsed.status === "ready") {
        return { status: "ready", message: parsed.message ?? "Requirements are clear." };
      }
      return { status: "questions", message: parsed.message ?? "Could you provide more details?" };
    } catch {
      return { status: "ready", message: "Proceeding with available information." };
    }
  }

  async planAndQueueTasks(repoPath: string, task: string): Promise<PlanResult> {
    const analysis = await this.analyzeCodebase(repoPath);
    const tasks = await this.createPlan(repoPath, task, analysis);
    const parallelGroups = computeParallelGroups(tasks);
    const recommendedAgents = Math.max(1, ...parallelGroups.map(g => g.length));
    return { tasks, parallelGroups, recommendedAgents };
  }
}
