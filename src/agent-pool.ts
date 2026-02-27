import { SWEAgent } from "./agents/swe.js";
import { Workspace } from "./workspace.js";

export class AgentPoolManager {
  private agents = new Map<string, SWEAgent>();
  private workspaces = new Map<string, Workspace>();

  constructor(private maxAgents: number) {}

  async spawn(
    count: number, originPath: string, workspacesBase: string,
    runId: number, branch: string, baseRef: string,
  ): Promise<void> {
    const n = Math.min(count, this.maxAgents);
    for (let i = 0; i < n; i++) {
      const agentId = `agent-${i}`;
      const agentBranch = `${branch}-${agentId}`;
      const ws = await Workspace.create(originPath, workspacesBase, `${runId}-${agentId}`, agentBranch, baseRef);
      const agent = new SWEAgent(agentId);
      this.agents.set(agentId, agent);
      this.workspaces.set(agentId, ws);
    }
  }

  assignTasks<T extends { id?: number; externalId?: string | null }>(subtasks: T[]): Array<[SWEAgent, Workspace, T]> {
    const agentList = [...this.agents.entries()];
    if (agentList.length === 0) return [];

    return subtasks.map((task, i) => {
      const [agentId] = agentList[i % agentList.length]!;
      return [this.agents.get(agentId)!, this.workspaces.get(agentId)!, task];
    });
  }

  getAgent(agentId: string): SWEAgent | undefined {
    return this.agents.get(agentId);
  }

  getWorkspace(agentId: string): Workspace | undefined {
    return this.workspaces.get(agentId);
  }

  getAgentIds(): string[] {
    return [...this.agents.keys()];
  }

  async cleanup(): Promise<void> {
    for (const ws of this.workspaces.values()) {
      try { await ws.cleanup(); } catch { /* ignore cleanup errors */ }
    }
    this.agents.clear();
    this.workspaces.clear();
  }
}
