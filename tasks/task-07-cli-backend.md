# Task 07: CLI Backend

> Thin `execFile` wrappers for Claude Code, Codex, and Aider CLIs. Zero intelligence.

**Spec**: [07-llm-provider.md](../spec/07-llm-provider.md)
**File**: `src/cli-backend.ts`
**LOC target**: ~100

## Checklist

- [ ] **Define `CLIError` class** extending `Error`

- [ ] **Create `execFileAsync` helper** -- `promisify(child_process.execFile)` with stdout extraction

- [ ] **Implement abstract `CLIBackend` class**
  - Constructor: `model`, `extraFlags: string[]`, `timeout` (ms)
  - Abstract: `buildCommand(prompt)`, `binaryName()`
  - `invoke(prompt, cwd)`: build command, execFile, parse output
  - `parseOutput(stdout)`: default returns stdout, subclasses override
  - `checkAvailable()`: run `--version`, return `true`/`false`
  - ~25 LOC

- [ ] **Implement `ClaudeCodeBackend`**
  - Command: `claude -p --output-format json [--model X] ...flags prompt`
  - Override `invoke()` to strip `CLAUDECODE` from env
  - Override `parseOutput()` to use `extractTextFromJson()`
  - ~18 LOC

- [ ] **Implement `CodexBackend`**
  - Command: `codex exec --json [--model X] ...flags prompt`
  - Override `parseOutput()` to use `extractTextFromJson()`
  - ~12 LOC

- [ ] **Implement `AiderBackend`**
  - Command: `aider --yes-always --no-git --message prompt [--model X] ...flags`
  - Raw stdout output (no JSON parsing)
  - ~10 LOC

- [ ] **Implement `extractTextFromJson(stdout)` helper**
  - Handle: string, dict with result/message/text/output keys, content array, list
  - Fallback to `JSON.stringify(data)`
  - ~18 LOC

- [ ] **Implement `createCliBackend(provider, model, extraFlags, timeout)` factory**
  - Map `"claude"` -> `ClaudeCodeBackend`, `"codex"` -> `CodexBackend`, `"aider"` -> `AiderBackend`
  - Throw on unknown provider
  - ~10 LOC

- [ ] **Verify**: Each backend builds correct command array, factory creates right type
