import crypto from "node:crypto";
import { type Config, getConfig } from "./config.js";
import { StateManager } from "./state.js";
import { WorkflowStep, TaskStatus } from "./db/schema.js";
import { ArchitectAgent, computeParallelGroups } from "./agents/architect.js";
import { type InterfaceAdapter } from "./interfaces/base.js";
import { getOrCreateRepo, GitOps } from "./git-ops.js";
import { Workspace } from "./workspace.js";
import { AgentPoolManager } from "./agent-pool.js";
import {
  formatTaskReceived, formatPlanning, formatPlanCreated, formatProgress,
  formatReview, formatError, formatCompleted, formatClarifying, isAffirmative,
} from "./messaging.js";

const STEP_ORDER: Record<string, number> = {
  [WorkflowStep.QUEUED]: 0,
  [WorkflowStep.REPO_SYNC]: 1,
  [WorkflowStep.WORKSPACE_CREATED]: 2,
  [WorkflowStep.BRANCH_CREATED]: 3,
  [WorkflowStep.CLARIFYING]: 4,
  [WorkflowStep.CLARIFIED]: 5,
  [WorkflowStep.PLANNING]: 6,
  [WorkflowStep.PLANNED]: 7,
  [WorkflowStep.AGENTS_SPAWNED]: 8,
  [WorkflowStep.SUBTASK_IMPLEMENTING]: 9,
  [WorkflowStep.SUBTASK_COMMITTING]: 10,
  [WorkflowStep.SUBTASK_TESTING]: 11,
  [WorkflowStep.SUBTASK_REVIEWING]: 12,
  [WorkflowStep.SUBTASK_FEEDBACK]: 13,
  [WorkflowStep.SUBTASK_DONE]: 14,
  [WorkflowStep.MERGING_AGENTS]: 15,
  [WorkflowStep.CREATING_PR]: 16,
  [WorkflowStep.COMPLETED]: 17,
  [WorkflowStep.FAILED]: 18,
};

export class WorkflowRunner {
  private state: StateManager;
  private config: Config;
  private architect: ArchitectAgent;
  private iface: InterfaceAdapter;
  private cancelled = new Set<number>();

  constructor(state: StateManager, iface: InterfaceAdapter) {
    this.state = state;
    this.config = getConfig();
    this.architect = new ArchitectAgent();
    this.iface = iface;
  }

  private _send(runId: number, text: string) {
    const run = this.state.getWorkflowRun(runId);
    if (run?.chatId) this.iface.sendMessage(run.chatId, text);
  }

  private _isCancelled(runId: number): boolean {
    if (this.cancelled.has(runId)) return true;
    const run = this.state.getWorkflowRun(runId);
    return run?.status === TaskStatus.CANCELLED;
  }

  cancel(runId: number) {
    this.cancelled.add(runId);
  }

  private _pastStep(run: { workflowStep?: string | null }, step: WorkflowStep): boolean {
    const current = STEP_ORDER[run.workflowStep ?? WorkflowStep.QUEUED] ?? 0;
    return current >= (STEP_ORDER[step] ?? 0);
  }

  async run(runId: number, repoName: string): Promise<void> {
    try {
      const run = this.state.getWorkflowRun(runId);
      if (!run) throw new Error(`Run ${runId} not found`);

      if (!this._pastStep(run, WorkflowStep.REPO_SYNC)) await this._doRepoSync(runId, repoName);
      if (this._isCancelled(runId)) return;

      if (!this._pastStep(run, WorkflowStep.WORKSPACE_CREATED)) await this._doCreateWorkspace(runId, repoName);
      if (this._isCancelled(runId)) return;

      if (!this._pastStep(run, WorkflowStep.BRANCH_CREATED)) await this._doCreateBranch(runId);
      if (this._isCancelled(runId)) return;

      if (!this._pastStep(run, WorkflowStep.CLARIFIED)) await this._doClarifying(runId, repoName);
      if (this._isCancelled(runId)) return;

      if (!this._pastStep(run, WorkflowStep.PLANNED)) await this._doPlanning(runId, repoName);
      if (this._isCancelled(runId)) return;

      if (!this._pastStep(run, WorkflowStep.AGENTS_SPAWNED)) await this._doSpawnAgents(runId);
      if (this._isCancelled(runId)) return;

      if (!this._pastStep(run, WorkflowStep.SUBTASK_DONE)) await this._doSubtasks(runId, repoName);
      if (this._isCancelled(runId)) return;

      if (!this._pastStep(run, WorkflowStep.MERGING_AGENTS)) await this._doMergeAgents(runId);
      if (this._isCancelled(runId)) return;

      if (!this._pastStep(run, WorkflowStep.CREATING_PR)) await this._doCreatePr(runId, repoName);

      this.state.advanceWorkflow(runId, WorkflowStep.COMPLETED);
      const finalRun = this.state.getWorkflowRun(runId)!;
      this._send(runId, formatCompleted(repoName, finalRun.prUrl ?? ""));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.state.advanceWorkflow(runId, WorkflowStep.FAILED, { errorMessage: errMsg });
      this._send(runId, formatError(repoName, "workflow", errMsg));
    }
  }

  private async _doRepoSync(runId: number, repoName: string) {
    this.state.advanceWorkflow(runId, WorkflowStep.REPO_SYNC);
    const run = this.state.getWorkflowRun(runId)!;
    this._send(runId, formatTaskReceived(repoName, run.userRequest ?? ""));

    const result = await getOrCreateRepo(repoName, this.config.repos.basePath);

    // Store repo info in state DB
    const repo = this.state.getOrCreateRepo(
      repoName, result.repoPath, result.repoUrl, result.repoSpec, result.baseBranch,
    );
    this.state.advanceWorkflow(runId, WorkflowStep.REPO_SYNC, {
      baseBranch: result.baseBranch,
    });
  }

  private async _doCreateWorkspace(runId: number, repoName: string) {
    const run = this.state.getWorkflowRun(runId)!;
    const slug = repoName.replace(/[^a-z0-9]/gi, "-").slice(0, 30);
    const uuid8 = crypto.randomUUID().slice(0, 8);
    const branch = `swe-team/${slug}-${uuid8}`;

    const repoPath = this.state.getOrCreateRepo(repoName).path ?? "";
    const ws = await Workspace.create(
      repoPath, this.config.repos.workspacesPath, String(runId), branch, run.baseBranch ?? "main",
    );

    this.state.advanceWorkflow(runId, WorkflowStep.WORKSPACE_CREATED, {
      workspacePath: ws.wsPath,
      workingBranch: branch,
    });
  }

  private async _doCreateBranch(runId: number) {
    const run = this.state.getWorkflowRun(runId)!;
    const originPath = run.repoId ? (this.state.getRepoById(run.repoId)?.path ?? "") : "";
    const ws = Workspace.fromExisting(originPath, run.workspacePath ?? "", run.workingBranch ?? "");
    const branchOk = await ws.verifyBranch();
    if (!branchOk) {
      throw new Error(`Branch mismatch in workspace ${run.workspacePath}: expected ${run.workingBranch}`);
    }
    this.state.advanceWorkflow(runId, WorkflowStep.BRANCH_CREATED);
  }

  private async _doClarifying(runId: number, repoName: string) {
    if (this.config.agent.skipClarification) {
      this.state.advanceWorkflow(runId, WorkflowStep.CLARIFIED);
      return;
    }

    this.state.advanceWorkflow(runId, WorkflowStep.CLARIFYING);
    this._send(runId, formatClarifying(repoName));

    const run = this.state.getWorkflowRun(runId)!;
    let history: Array<{ role: string; text: string }> = [];
    try { history = JSON.parse(run.clarificationLog ?? "[]"); } catch { /* empty */ }
    let rounds = 0;

    while (rounds < this.config.agent.maxClarificationRounds) {
      if (this._isCancelled(runId)) return;

      const result = await this.architect.clarifyRequirements(
        run.workspacePath ?? "", run.userRequest ?? "",
        history as Array<{ role: "assistant" | "user"; text: string }>,
      );

      this._send(runId, result.message);

      if (result.status === "ready") {
        this._send(runId, "Are you satisfied with the requirement? (yes to proceed)");
        const confirmation = await this.iface.waitForResponse(run.chatId ?? "");

        if (isAffirmative(confirmation)) {
          this.state.advanceWorkflow(runId, WorkflowStep.CLARIFIED, {
            userRequest: result.message,
            clarificationLog: JSON.stringify(history),
          });
          return;
        }
        history.push({ role: "assistant", text: result.message });
        history.push({ role: "user", text: confirmation });
      } else {
        const answer = await this.iface.waitForResponse(run.chatId ?? "");
        history.push({ role: "assistant", text: result.message });
        history.push({ role: "user", text: answer });
      }

      this.state.advanceWorkflow(runId, WorkflowStep.CLARIFYING, {
        clarificationLog: JSON.stringify(history),
      });
      rounds++;
    }

    this.state.advanceWorkflow(runId, WorkflowStep.CLARIFIED);
  }

  private async _doPlanning(runId: number, repoName: string) {
    this.state.advanceWorkflow(runId, WorkflowStep.PLANNING);
    this._send(runId, formatPlanning(repoName));

    const run = this.state.getWorkflowRun(runId)!;
    const planResult = await this.architect.planAndQueueTasks(
      run.workspacePath ?? "", run.userRequest ?? "",
    );

    if (planResult.tasks.length === 0) {
      throw new Error("Empty plan generated");
    }

    this.state.createSubtasks(runId, planResult.tasks);
    this.state.advanceWorkflow(runId, WorkflowStep.PLANNED, {
      planJson: JSON.stringify(planResult),
      agentCount: planResult.recommendedAgents,
    });

    this._send(runId, formatPlanCreated(
      repoName,
      planResult.tasks.map(t => t.description || t.title || t.id),
      planResult.recommendedAgents,
    ));
  }

  private pool: AgentPoolManager | null = null;

  private async _doSpawnAgents(runId: number) {
    const run = this.state.getWorkflowRun(runId)!;
    const agentCount = Math.min(
      run.agentCount ?? 1,
      this.config.agentPool.maxAgents,
    );

    this.pool = new AgentPoolManager(this.config.agentPool.maxAgents);

    // Look up the origin repo path by ID, not by passing repoId as name
    const repo = run.repoId ? this.state.getRepoById(run.repoId) : null;
    const originPath = repo?.path ?? run.workspacePath ?? "";

    await this.pool.spawn(
      agentCount,
      originPath,
      this.config.repos.workspacesPath,
      String(runId),
      run.workingBranch ?? "",
      run.baseBranch ?? "main",
    );

    this.state.advanceWorkflow(runId, WorkflowStep.AGENTS_SPAWNED, {
      agentCount,
    });
  }

  private async _doSubtasks(runId: number, repoName: string) {
    const run = this.state.getWorkflowRun(runId)!;
    let planResult: { parallelGroups?: string[][] };
    try { planResult = JSON.parse(run.planJson ?? "{}"); } catch { planResult = {}; }

    const subtasks = this.state.getSubtasks(runId);
    const subtaskMap = new Map(subtasks.map(s => [s.externalId, s]));
    const groups = planResult.parallelGroups ?? [subtasks.map(s => s.externalId!)];
    const startGroup = run.currentParallelGroup ?? 0;

    for (let g = startGroup; g < groups.length; g++) {
      if (this._isCancelled(runId)) return;
      const group = groups[g]!;

      const results = await Promise.allSettled(
        group.map(taskId => {
          const subtask = subtaskMap.get(taskId);
          if (!subtask || subtask.status === TaskStatus.COMPLETED) return Promise.resolve();
          return this._executeSubtask(runId, subtask, repoName);
        }),
      );

      // Handle failures per policy
      for (let ri = 0; ri < results.length; ri++) {
        const result = results[ri]!;
        if (result.status === "rejected") {
          const policy = this.config.agent.onSubtaskFailure;
          if (policy === "stop") throw new Error(`Subtask failed: ${result.reason}`);
          if (policy === "retry") {
            // Retry once with error context
            const taskId = group[ri]!;
            const subtask = subtaskMap.get(taskId);
            if (subtask && subtask.status !== TaskStatus.COMPLETED) {
              try {
                await this._executeSubtask(runId, subtask, repoName);
              } catch {
                // Retry failed, continue to next subtask
              }
            }
          }
          // "continue" just moves on
        }
      }

      this.state.advanceWorkflow(runId, WorkflowStep.SUBTASK_DONE, {
        currentParallelGroup: g + 1,
      });
    }
  }

  private async _executeSubtask(
    runId: number,
    subtask: { id: number; externalId?: string | null; description?: string | null; filesToModify?: string | null },
    repoName: string,
  ) {
    if (!this.pool) return;
    const agentIds = this.pool.getAgentIds();
    if (agentIds.length === 0) return;

    const agentId = agentIds[subtask.id % agentIds.length]!;
    const agent = this.pool.getAgent(agentId)!;
    const ws = this.pool.getWorkspace(agentId)!;
    const run = this.state.getWorkflowRun(runId)!;

    const taskDesc = subtask.description ?? "";
    let files: string[] = [];
    try { files = JSON.parse(subtask.filesToModify ?? "[]"); } catch { /* empty */ }

    // 1. Implement
    this.state.advanceWorkflow(runId, WorkflowStep.SUBTASK_IMPLEMENTING);
    this.state.updateSubtask(subtask.id, { status: TaskStatus.IN_PROGRESS, assignedAgent: agentId });

    const total = this.state.getSubtasks(runId).length;
    const done = this.state.getSubtasks(runId).filter(s => s.status === TaskStatus.COMPLETED).length;
    this._send(runId, formatProgress(repoName, done + 1, total, taskDesc.slice(0, 60)));

    const implOk = await agent.implementTask(ws.wsPath, taskDesc, {
      filesToModify: files,
      overallGoal: run.userRequest ?? "",
    });

    // 2. Harvest
    this.state.advanceWorkflow(runId, WorkflowStep.SUBTASK_COMMITTING);
    await ws.harvestUncommitted();

    // 3. Test
    this.state.advanceWorkflow(runId, WorkflowStep.SUBTASK_TESTING);
    const testResult = await agent.runTests(ws.wsPath);
    if (!testResult.passed) {
      await agent.applyFeedback(ws.wsPath, taskDesc, `Tests failed: ${testResult.summary}`);
      await ws.harvestUncommitted();
    }

    // 4. Review loop
    const baseBranch = run.baseBranch ?? "main";
    let reviewIter = 0;
    const feedbackHistory: string[] = [];

    while (reviewIter < this.config.agent.maxReviewIterations) {
      this.state.advanceWorkflow(runId, WorkflowStep.SUBTASK_REVIEWING);
      let diff: string;
      try {
        diff = await ws.git.diffHead(baseBranch);
      } catch {
        diff = "";
      }

      const review = await this.architect.reviewCode(ws.wsPath, taskDesc, diff, feedbackHistory);
      this._send(runId, formatReview(repoName, taskDesc.slice(0, 40), reviewIter + 1));

      if (this.architect.shouldApprove(review)) break;

      feedbackHistory.push(review.feedback);
      this.state.advanceWorkflow(runId, WorkflowStep.SUBTASK_FEEDBACK);
      await agent.applyFeedback(ws.wsPath, taskDesc, review.feedback, diff);
      await ws.harvestUncommitted();
      reviewIter++;
    }

    this.state.updateSubtask(subtask.id, { status: TaskStatus.COMPLETED });
  }

  private async _doMergeAgents(runId: number) {
    this.state.advanceWorkflow(runId, WorkflowStep.MERGING_AGENTS);
    if (!this.pool) return;

    const run = this.state.getWorkflowRun(runId)!;
    const wsGit = new GitOps(run.workspacePath ?? "");

    for (const agentId of this.pool.getAgentIds()) {
      const agentWs = this.pool.getWorkspace(agentId);
      if (!agentWs) continue;

      try {
        await wsGit.merge(agentWs.branch);
      } catch (err) {
        // On merge conflict, try reset and continue
        console.error(`Merge conflict for ${agentId}: ${err instanceof Error ? err.message : err}`);
        try { await wsGit.resetHard("HEAD"); } catch { /* ignore */ }
      }
    }

    await this.pool.cleanup();
    this.pool = null;
  }

  private async _doCreatePr(runId: number, repoName: string) {
    this.state.advanceWorkflow(runId, WorkflowStep.CREATING_PR);
    const run = this.state.getWorkflowRun(runId)!;
    const wsGit = new GitOps(run.workspacePath ?? "");

    // Push branch
    try {
      await wsGit.push("origin", run.workingBranch ?? "");
    } catch (err) {
      console.error(`Push failed: ${err instanceof Error ? err.message : err}`);
    }

    // Create PR
    try {
      const prUrl = await wsGit.createPr(
        `[SWE Team] ${(run.userRequest ?? "").slice(0, 60)}`,
        `Automated PR by SWE Team\n\nTask: ${run.userRequest ?? ""}\n\nGenerated by SWE Team orchestrator.`,
        run.baseBranch ?? "main",
        run.workingBranch ?? "",
        repoName,
      );
      this.state.advanceWorkflow(runId, WorkflowStep.CREATING_PR, { prUrl });
    } catch (err) {
      console.error(`PR creation failed: ${err instanceof Error ? err.message : err}`);
    }
  }
}
