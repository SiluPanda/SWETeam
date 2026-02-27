export function parseTaskCommand(text: string): { repo: string; task: string } | null {
  const trimmed = text.trim();
  const match = trimmed.match(/^(\S+)\s+([\s\S]+)/);
  if (!match) return null;
  return { repo: match[1]!, task: match[2]!.trim() };
}

export function formatTaskReceived(repo: string, task: string): string {
  return `[${repo}] Task Received\nTask: ${task}`;
}

export function formatPlanning(repo: string): string {
  return `[${repo}] Planning...`;
}

export function formatClarifying(repo: string): string {
  return `[${repo}] Analyzing your requirement...`;
}

export function formatPlanCreated(repo: string, tasks: string[], agents: number): string {
  const list = tasks.map((t, i) => `${i + 1}. ${t}`).join("\n");
  return `[${repo}] Plan: ${tasks.length} tasks, ${agents} agents\n${list}`;
}

export function formatProgress(repo: string, current: number, total: number, task: string): string {
  return `[${repo}] ${formatProgressBar(current, total)} Task ${current}/${total}: ${task}`;
}

export function formatReview(repo: string, task: string, iteration: number): string {
  return `[${repo}] Review iteration ${iteration}: ${task}`;
}

export function formatError(repo: string, task: string, error: string): string {
  return `[${repo}] Error in "${task}": ${error}`;
}

export function formatCompleted(repo: string, prUrl: string): string {
  return `[${repo}] Done! PR: ${prUrl}`;
}

export function formatProgressBar(done: number, total: number, width = 10): string {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const filled = total === 0 ? 0 : Math.round((done / total) * width);
  return `[${"█".repeat(filled)}${" ".repeat(width - filled)}] ${pct}%`;
}

export function formatStatus(runs: Array<{ userRequest?: string | null; workflowStep?: string | null; status?: string | null }>): string {
  if (runs.length === 0) return "No active runs.";
  return runs.map((r, i) =>
    `${i + 1}. ${r.userRequest ?? "unknown"} — ${r.workflowStep ?? "unknown"} (${r.status ?? "unknown"})`
  ).join("\n");
}

export function formatList(runs: Array<{ id: number; userRequest?: string | null; status?: string | null }>): string {
  if (runs.length === 0) return "No runs found.";
  const lines = runs.map(r => `#${r.id} ${r.userRequest ?? "unknown"} [${r.status ?? "unknown"}]`);
  lines.push("Use /stop <id> to cancel a run.");
  return lines.join("\n");
}
