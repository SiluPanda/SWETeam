import { Mutex } from "async-mutex";
import fs from "node:fs";
import path from "node:path";
import { GitOps } from "./git-ops.js";

const worktreeMutex = new Mutex();

export class Workspace {
  private _git?: GitOps;

  private constructor(
    public originPath: string,
    public wsPath: string,
    public branch: string,
  ) {}

  static async create(
    originPath: string, basePath: string, runId: string, branch: string, baseRef: string,
  ): Promise<Workspace> {
    const wsPath = path.join(basePath, `${runId}-${branch.replace(/\//g, "-")}`);
    const git = new GitOps(originPath);
    await worktreeMutex.runExclusive(async () => {
      fs.mkdirSync(path.dirname(wsPath), { recursive: true });
      await git.worktreeAdd(wsPath, branch, baseRef);
    });
    return new Workspace(originPath, wsPath, branch);
  }

  static fromExisting(originPath: string, wsPath: string, branch: string): Workspace {
    return new Workspace(originPath, wsPath, branch);
  }

  get git(): GitOps {
    return this._git ??= new GitOps(this.wsPath);
  }

  async harvestUncommitted(): Promise<boolean> {
    const status = await this.git.status();
    if (!status) return false;
    await this.git.add();
    await this.git.commit("chore: harvest uncommitted changes");
    return true;
  }

  async verifyBranch(): Promise<boolean> {
    const current = await this.git.currentBranch();
    return current === this.branch;
  }

  async cleanup(): Promise<void> {
    const git = new GitOps(this.originPath);
    await worktreeMutex.runExclusive(async () => {
      try {
        await git.worktreeRemove(this.wsPath);
      } catch {
        // Fallback: remove directory and prune
        fs.rmSync(this.wsPath, { recursive: true, force: true });
        await git.worktreePrune();
      }
    });
  }
}
