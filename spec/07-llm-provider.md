# CLI Backend

> Thin `execFile` wrappers (~100 LOC) for invoking external coding CLIs (Claude Code, Codex, Aider). The orchestrator has zero intelligence -- all cognitive work is delegated to these CLIs.

## Overview

The CLI backend is a minimal abstraction layer. It defines an abstract `CLIBackend` class and three thin implementations that invoke coding CLIs via Node.js `child_process.execFile()`. The orchestrator builds a prompt string, passes it to the configured CLI, and parses the text/JSON output. That's it -- just subprocess invocation with timeout handling.

## Architecture

```
Orchestrator (BaseAgent)
    |
    v
CLIBackend.invoke(prompt, cwd) -> Promise<string>
    |
    +---> ClaudeCodeBackend  --> execFile: claude -p ...
    +---> CodexBackend       --> execFile: codex exec ...
    +---> AiderBackend       --> execFile: aider --message ...
```

## Behavior

### Base Class

```typescript
abstract class CLIBackend {
  constructor(
    protected model: string = "",
    protected extraFlags: string[] = [],
    protected timeout: number = 900_000, // ms
  ) {}

  protected abstract buildCommand(prompt: string): { bin: string; args: string[] };

  async invoke(prompt: string, cwd: string): Promise<string> {
    const { bin, args } = this.buildCommand(prompt);
    const stdout = await execFileAsync(bin, args, { cwd, timeout: this.timeout });
    return this.parseOutput(stdout);
  }

  protected parseOutput(stdout: string): string {
    return stdout;
  }

  async checkAvailable(): Promise<boolean> {
    try {
      await execFileAsync(this.binaryName(), ["--version"], { timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }

  protected abstract binaryName(): string;
}
```

`execFileAsync` is a `promisify(child_process.execFile)` wrapper. **~25 lines**.

### ClaudeCodeBackend

```typescript
class ClaudeCodeBackend extends CLIBackend {
  binaryName() { return "claude"; }

  buildCommand(prompt: string) {
    const args = ["-p", "--output-format", "json"];
    if (this.model) args.push("--model", this.model);
    args.push(...this.extraFlags, prompt);
    return { bin: "claude", args };
  }

  async invoke(prompt: string, cwd: string): Promise<string> {
    const { bin, args } = this.buildCommand(prompt);
    // Remove CLAUDECODE env var to allow nested sessions
    const env = { ...process.env };
    delete env.CLAUDECODE;
    const stdout = await execFileAsync(bin, args, { cwd, timeout: this.timeout, env });
    return this.parseOutput(stdout);
  }

  parseOutput(stdout: string): string {
    return extractTextFromJson(stdout);
  }
}
```

**~18 lines**.

### CodexBackend

```typescript
class CodexBackend extends CLIBackend {
  binaryName() { return "codex"; }

  buildCommand(prompt: string) {
    const args = ["exec", "--json"];
    if (this.model) args.push("--model", this.model);
    args.push(...this.extraFlags, prompt);
    return { bin: "codex", args };
  }

  parseOutput(stdout: string): string {
    return extractTextFromJson(stdout);
  }
}
```

**~12 lines**.

### AiderBackend

```typescript
class AiderBackend extends CLIBackend {
  binaryName() { return "aider"; }

  buildCommand(prompt: string) {
    const args = ["--yes-always", "--no-git", "--message", prompt];
    if (this.model) args.push("--model", this.model);
    args.push(...this.extraFlags);
    return { bin: "aider", args };
  }
}
```

**~10 lines**. `--yes-always` for autonomous mode, `--no-git` so the orchestrator controls git.

### JSON Text Extraction Helper

```typescript
function extractTextFromJson(stdout: string): string {
  let data: unknown;
  try { data = JSON.parse(stdout); } catch { return stdout; }

  if (typeof data === "string") return data;
  if (Array.isArray(data))
    return data.map(item => extractTextFromJson(JSON.stringify(item))).join("\n");
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["result", "message", "text", "output"])
      if (typeof obj[key] === "string") return obj[key] as string;
    if (Array.isArray(obj.content))
      return obj.content
        .filter((c: any) => c?.type === "text" && typeof c.text === "string")
        .map((c: any) => c.text)
        .join("\n");
  }
  return JSON.stringify(data);
}
```

**~18 lines**.

### Factory Function

```typescript
function createCliBackend(
  provider = "claude", model = "", extraFlags: string[] = [], timeout = 900_000
): CLIBackend {
  const backends: Record<string, new (...a: any[]) => CLIBackend> = {
    claude: ClaudeCodeBackend,
    codex: CodexBackend,
    aider: AiderBackend,
  };
  const Cls = backends[provider];
  if (!Cls) throw new Error(`Unknown CLI backend: ${provider}`);
  return new Cls(model, extraFlags, timeout);
}
```

**~10 lines**.

## Total LOC: ~100

| Component | Lines |
|-----------|-------|
| `CLIBackend` base | ~25 |
| `ClaudeCodeBackend` | ~18 |
| `CodexBackend` | ~12 |
| `AiderBackend` | ~10 |
| `extractTextFromJson` | ~18 |
| `createCliBackend` factory | ~10 |
| Imports + types + `CLIError` | ~10 |
| **Total** | **~100** |

## Error Handling

- Timeout -> `CLIError("{backend} timed out after {timeout}ms")`
- Binary not found -> `CLIError("{backend} not found. Install it first.")`
- Non-zero exit -> `CLIError("{backend} failed: {stderr}")`
- No retries -- callers handle retry policy at the subtask level

## Source Files

- `src/cli-backend.ts` -- `CLIBackend`, `ClaudeCodeBackend`, `CodexBackend`, `AiderBackend`, `CLIError`, `createCliBackend()`, `extractTextFromJson()`
