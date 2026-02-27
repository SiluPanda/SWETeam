import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getConfig, type Config } from "./config.js";
import { StateManager } from "./state.js";
import { RepoLockManager } from "./repo-locks.js";
import { WorkflowRunner } from "./workflow.js";
import { createInterface, type InterfaceAdapter } from "./interfaces/base.js";
import { createCliBackend } from "./cli-backend.js";
import { TaskStatus } from "./db/schema.js";

const execFileP = promisify(execFile);

export class SWETeam {
  private config: Config;
  private state!: StateManager;
  private repoLocks = new RepoLockManager();
  private activeTasks = new Map<number, AbortController>();
  private iface!: InterfaceAdapter;
  private runners = new Map<number, WorkflowRunner>();
  private running = false;
  private shutdownResolve?: () => void;

  constructor() {
    this.config = getConfig();
  }

  async setup(): Promise<void> {
    // Create directories
    for (const dir of [this.config.repos.basePath, this.config.repos.workspacesPath]) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.mkdirSync(path.dirname(this.config.database.path), { recursive: true });
    fs.mkdirSync(path.dirname(this.config.logging.file), { recursive: true });

    // Init database
    this.state = StateManager.init(this.config.database.path);

    // Validate external tools
    await this.validateTools();
  }

  private async validateTools(): Promise<void> {
    const check = async (cmd: string, args: string[]) => {
      try {
        await execFileP(cmd, args, { timeout: 10_000 });
        return true;
      } catch { return false; }
    };

    if (!await check("git", ["--version"])) console.warn("Warning: git not found");
    if (!await check("gh", ["--version"])) console.warn("Warning: gh (GitHub CLI) not found");

    // Check configured CLI backend
    const provider = this.config.agents.architect.provider;
    const backend = createCliBackend(provider);
    if (!await backend.checkAvailable()) {
      console.warn(`Warning: ${provider} CLI not found`);
    }
  }

  async handleMessage(repoName: string, task: string, chatId: string): Promise<void> {
    const repo = this.state.getOrCreateRepo(repoName);
    const run = this.state.createWorkflowRun(repo.id, task, chatId);

    const controller = new AbortController();
    this.activeTasks.set(run.id, controller);

    // Start workflow asynchronously
    this.executeWorkflow(run.id, repoName).catch(err => {
      console.error(`Workflow ${run.id} failed:`, err);
    });
  }

  private async executeWorkflow(runId: number, repoName: string): Promise<void> {
    const lock = this.repoLocks.get(repoName);
    await lock.runExclusive(async () => {
      const runner = new WorkflowRunner(this.state, this.iface);
      this.runners.set(runId, runner);
      try {
        await runner.run(runId, repoName);
      } finally {
        this.runners.delete(runId);
        this.activeTasks.delete(runId);
      }
    });
  }

  private async recoverIncompleteRuns(): Promise<void> {
    const incomplete = this.state.getIncompleteRuns();
    const now = Date.now();

    for (const run of incomplete) {
      const createdAt = run.createdAt ? new Date(run.createdAt).getTime() : now;
      const age = (now - createdAt) / 1000;

      if (age > this.config.processing.workflowTimeout) {
        this.state.cancelRun(run.id);
        console.log(`Timed out stale run #${run.id}`);
      } else {
        // Resolve repo name from repoId to resume the workflow
        const repo = this.state.getRepoById(run.repoId);
        if (!repo) {
          console.log(`Cannot resume run #${run.id}: repo not found`);
          this.state.cancelRun(run.id);
          continue;
        }
        console.log(`Resuming incomplete run #${run.id} for ${repo.name}`);
        this.executeWorkflow(run.id, repo.name).catch(err => {
          console.error(`Resume of run #${run.id} failed:`, err);
        });
      }
    }
  }

  async run(): Promise<void> {
    await this.setup();
    this.running = true;

    this.iface = await createInterface(this.config.interface, (repo, task, chatId) => {
      if (repo === "__cmd__") return; // Handle command routing later
      this.handleMessage(repo, task, chatId);
    });

    await this.iface.start();
    await this.recoverIncompleteRuns();

    // Keep the process alive until shutdown is called
    await new Promise<void>(resolve => {
      this.shutdownResolve = resolve;
    });
  }

  async shutdown(): Promise<void> {
    this.running = false;
    console.log("\nShutting down...");

    // Cancel active workflows and signal abort
    for (const [runId, runner] of this.runners) {
      runner.cancel(runId);
    }
    for (const [, controller] of this.activeTasks) {
      controller.abort();
    }

    // Stop interface
    try { await this.iface?.stop(); } catch { /* ignore */ }

    // Resolve the keep-alive promise to let run() exit
    this.shutdownResolve?.();

    console.log("Shutdown complete.");
  }
}
