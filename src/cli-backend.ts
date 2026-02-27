import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

export class CLIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CLIError";
  }
}

async function execFileAsync(
  bin: string, args: string[], opts: { cwd?: string; timeout?: number; env?: NodeJS.ProcessEnv } = {},
): Promise<string> {
  try {
    const { stdout } = await execFileP(bin, args, {
      cwd: opts.cwd,
      timeout: opts.timeout,
      env: opts.env ?? process.env,
      maxBuffer: 50 * 1024 * 1024,
    });
    return stdout;
  } catch (err: unknown) {
    const e = err as { code?: string; killed?: boolean; stderr?: string; message?: string };
    if (e.killed) throw new CLIError(`${bin} timed out after ${opts.timeout}ms`);
    if (e.code === "ENOENT") throw new CLIError(`${bin} not found. Install it first.`);
    throw new CLIError(`${bin} failed: ${e.stderr || e.message || "unknown error"}`);
  }
}

export abstract class CLIBackend {
  constructor(
    protected model: string = "",
    protected extraFlags: string[] = [],
    protected timeout: number = 900_000,
  ) {}

  protected abstract buildCommand(prompt: string): { bin: string; args: string[] };
  protected abstract binaryName(): string;

  async invoke(prompt: string, cwd: string): Promise<string> {
    const { bin, args } = this.buildCommand(prompt);
    const stdout = await execFileAsync(bin, args, { cwd, timeout: this.timeout });
    return this.parseOutput(stdout);
  }

  protected parseOutput(stdout: string): string {
    return stdout;
  }

  async classifyAffirmative(userResponse: string): Promise<boolean> {
    const prompt = `Does the following user response express agreement, approval, or confirmation? Answer with ONLY "true" or "false".\n\nUser response: "${userResponse}"`;
    const { bin, args } = this.buildCommand(prompt);
    try {
      const stdout = await execFileAsync(bin, args, { timeout: 30_000 });
      return /true/i.test(this.parseOutput(stdout).trim());
    } catch {
      return false;
    }
  }

  async checkAvailable(): Promise<boolean> {
    try {
      await execFileAsync(this.binaryName(), ["--version"], { timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }
}

export function extractTextFromJson(stdout: string): string {
  let data: unknown;
  try { data = JSON.parse(stdout); } catch { return stdout; }

  if (typeof data === "string") return data;
  if (Array.isArray(data))
    return data.map(item => extractTextFromJson(JSON.stringify(item))).join("\n");
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["result", "message", "text", "output"])
      if (typeof obj[key] === "string") return obj[key] as string;
    if (Array.isArray(obj["content"]))
      return (obj["content"] as Array<Record<string, unknown>>)
        .filter(c => c?.type === "text" && typeof c.text === "string")
        .map(c => c.text as string)
        .join("\n");
  }
  return JSON.stringify(data);
}

export class ClaudeCodeBackend extends CLIBackend {
  protected binaryName() { return "claude"; }

  protected buildCommand(prompt: string) {
    const args = ["-p", "--output-format", "json"];
    if (this.model) args.push("--model", this.model);
    args.push(...this.extraFlags, prompt);
    return { bin: "claude", args };
  }

  async invoke(prompt: string, cwd: string): Promise<string> {
    const { bin, args } = this.buildCommand(prompt);
    const env = { ...process.env };
    delete env["CLAUDECODE"];
    const stdout = await execFileAsync(bin, args, { cwd, timeout: this.timeout, env });
    return this.parseOutput(stdout);
  }

  protected parseOutput(stdout: string): string {
    return extractTextFromJson(stdout);
  }
}

export class CodexBackend extends CLIBackend {
  protected binaryName() { return "codex"; }

  protected buildCommand(prompt: string) {
    const args = ["exec", "--json"];
    if (this.model) args.push("--model", this.model);
    args.push(...this.extraFlags, prompt);
    return { bin: "codex", args };
  }

  protected parseOutput(stdout: string): string {
    return extractTextFromJson(stdout);
  }
}

export class AiderBackend extends CLIBackend {
  protected binaryName() { return "aider"; }

  protected buildCommand(prompt: string) {
    const args = ["--yes-always", "--no-git", "--message", prompt];
    if (this.model) args.push("--model", this.model);
    args.push(...this.extraFlags);
    return { bin: "aider", args };
  }
}

export function createCliBackend(
  provider = "claude", model = "", extraFlags: string[] = [], timeout = 900_000,
): CLIBackend {
  const backends: Record<string, new (m: string, f: string[], t: number) => CLIBackend> = {
    claude: ClaudeCodeBackend,
    codex: CodexBackend,
    aider: AiderBackend,
  };
  const Cls = backends[provider];
  if (!Cls) throw new Error(`Unknown CLI backend: ${provider}`);
  return new Cls(model, extraFlags, timeout);
}
