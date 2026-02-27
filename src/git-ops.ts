import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import { getConfig } from "./config.js";

const execFileP = promisify(execFile);

export class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitError";
  }
}

async function gitExec(args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): Promise<string> {
  try {
    const { stdout } = await execFileP("git", args, { cwd: opts.cwd, env: opts.env ?? process.env, maxBuffer: 50 * 1024 * 1024 });
    return stdout.trim();
  } catch (err: unknown) {
    const e = err as { stderr?: string; message?: string };
    throw new GitError(`git ${args[0]} failed: ${e.stderr || e.message || "unknown"}`);
  }
}

async function ghExec(args: string[], opts: { cwd?: string } = {}): Promise<string> {
  const env = { ...process.env, GITHUB_TOKEN: getConfig().git.githubToken };
  try {
    const { stdout } = await execFileP("gh", args, { cwd: opts.cwd, env, maxBuffer: 50 * 1024 * 1024 });
    return stdout.trim();
  } catch (err: unknown) {
    const e = err as { stderr?: string; message?: string };
    throw new GitError(`gh ${args[0]} failed: ${e.stderr || e.message || "unknown"}`);
  }
}

export class GitOps {
  constructor(public repoPath: string) {}

  private run(...args: string[]) { return gitExec(args, { cwd: this.repoPath }); }
  private runGh(...args: string[]) { return ghExec(args, { cwd: this.repoPath }); }

  async status() { return this.run("status", "--porcelain"); }
  async currentBranch() { return this.run("rev-parse", "--abbrev-ref", "HEAD"); }
  async branchExists(name: string): Promise<boolean> {
    try { await this.run("rev-parse", "--verify", name); return true; } catch { return false; }
  }
  async createBranch(name: string) { return this.run("branch", name); }
  async checkout(name: string) { return this.run("checkout", name); }
  async checkoutNewBranch(name: string) { return this.run("checkout", "-b", name); }
  async add(files?: string[]) { return this.run("add", ...(files ?? ["-A"])); }
  async commit(message: string) { return this.run("commit", "-m", message); }
  async diff() { return this.run("diff"); }
  async diffHead(base: string) { return this.run("diff", `${base}..HEAD`); }
  async fetch() { return this.run("fetch", "--all"); }
  async pull() { return this.run("pull", "--rebase"); }
  async push(remote: string, branch: string) { return this.run("push", remote, branch); }
  async merge(branch: string) { return this.run("merge", "--no-ff", branch); }
  async resetHard(ref: string) { return this.run("reset", "--hard", ref); }
  async stash() { return this.run("stash"); }
  async stashPop() { return this.run("stash", "pop"); }
  async getCommitCount(from: string, to: string) {
    const result = await this.run("rev-list", "--count", `${from}..${to}`);
    return parseInt(result, 10);
  }

  async clone(url: string) {
    const parentDir = path.dirname(this.repoPath);
    fs.mkdirSync(parentDir, { recursive: true });
    return gitExec(["clone", url, this.repoPath]);
  }

  async ghClone(repoSpec: string) {
    const parentDir = path.dirname(this.repoPath);
    fs.mkdirSync(parentDir, { recursive: true });
    return ghExec(["repo", "clone", repoSpec, this.repoPath]);
  }

  async configureGitUser() {
    const config = getConfig();
    await this.run("config", "user.name", config.git.authorName);
    await this.run("config", "user.email", config.git.authorEmail);
  }

  async createPr(title: string, body: string, base: string, head: string, repoSpec?: string): Promise<string> {
    const args = ["pr", "create", "--title", title, "--body", body, "--base", base, "--head", head];
    if (repoSpec) args.push("--repo", repoSpec);
    const output = await this.runGh(...args);
    const urlMatch = output.match(/https:\/\/github\.com\/[^\s]+/);
    return urlMatch ? urlMatch[0] : output;
  }

  async worktreeAdd(wsPath: string, branch: string, baseRef: string) {
    return this.run("worktree", "add", "-b", branch, wsPath, baseRef);
  }

  async worktreeRemove(wsPath: string) {
    return this.run("worktree", "remove", "--force", wsPath);
  }

  async worktreePrune() {
    return this.run("worktree", "prune");
  }
}

export interface RepoSyncResult {
  git: GitOps;
  repoPath: string;
  repoUrl: string;
  repoSpec: string;
  baseBranch: string;
  cloned: boolean;
}

export function inferGithubRepoSpec(ref: string): string {
  // Handle HTTPS URLs
  const httpsMatch = ref.match(/github\.com\/([^/]+\/[^/.]+)/);
  if (httpsMatch) return httpsMatch[1]!;
  // Handle SSH URLs
  const sshMatch = ref.match(/git@github\.com:([^/]+\/[^/.]+)/);
  if (sshMatch) return sshMatch[1]!;
  // Already owner/repo format
  if (ref.includes("/")) return ref;
  return ref;
}

export async function getOrCreateRepo(repoName: string, basePath: string): Promise<RepoSyncResult> {
  const repoSpec = inferGithubRepoSpec(repoName);
  const safeName = repoSpec.replace(/\//g, "-");
  const repoPath = path.join(basePath, safeName);
  const git = new GitOps(repoPath);
  let cloned = false;

  if (fs.existsSync(path.join(repoPath, ".git"))) {
    await git.fetch();
    const config = getConfig();
    const branch = config.git.defaultBranch;
    await git.checkout(branch);
    await git.pull();
  } else {
    await git.ghClone(repoSpec);
    cloned = true;
  }

  await git.configureGitUser();
  const baseBranch = await git.currentBranch();

  return {
    git,
    repoPath,
    repoUrl: `https://github.com/${repoSpec}`,
    repoSpec,
    baseBranch,
    cloned,
  };
}
