# Interface Layer

> Pluggable user interface (~100 LOC total). CLI is the default. Telegram and HTTP API are optional adapters. The interface just accepts text and emits text -- zero intelligence.

## Overview

The interface layer defines an abstract `InterfaceAdapter` and concrete implementations. Each adapter translates user input into `{ repo, task, chatId }` and sends text messages back. The orchestrator doesn't care which interface is active.

## InterfaceAdapter (Abstract)

```typescript
abstract class InterfaceAdapter {
  constructor(protected messageCallback: (repo: string, task: string, chatId: string) => void) {}
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract sendMessage(chatId: string, text: string): Promise<void>;
  abstract waitForResponse(chatId: string, timeout?: number): Promise<string>;
}
```

**~9 lines**.

## CLIInterface (Default)

Interactive terminal interface using Node.js `readline`:

```
$ npx swe-team
SWE Team Ready. Type: <repo> <task description>
> owner/repo Build a REST API for users
[owner/repo] Task queued...
[owner/repo] Planning...
[owner/repo] PR created: https://github.com/owner/repo/pull/42
>
```

```typescript
class CLIInterface extends InterfaceAdapter {
  private rl: readline.Interface;

  async start() {
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log("SWE Team Ready. Type: <repo> <task description>");
    this.rl.on("line", (line) => this.handleLine(line.trim()));
  }

  async sendMessage(_chatId: string, text: string) {
    console.log(text);
  }

  async waitForResponse(_chatId: string): Promise<string> {
    return new Promise((resolve) => this.rl.question("", resolve));
  }

  async stop() {
    this.rl.close();
  }
}
```

**~28 lines**.

## TelegramInterface (Optional)

Uses `node-telegram-bot-api` for polling-based Telegram bot:

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/help` | Usage instructions |
| `/task <repo> <desc>` | Submit task |
| `/list` | Active runs |
| `/status` | Run details |
| `/stop [n\|repo]` | Cancel |

**TelegramInterface.waitForResponse**: Sets up a one-time message listener for the chat. Resolves the promise on the next user message in that chat. ~8 LOC.

**~58 lines** (slim -- just parse and forward to callback).

## APIInterface (Optional)

Minimal Express/Fastify HTTP server:

```
POST /task   { "repo": "owner/repo", "task": "Build a REST API" }
GET  /status
POST /stop   { "runId": 123 }
```

**APIInterface.waitForResponse**: Stores a pending resolver keyed by chatId/runId. Exposes `POST /respond/{runId}` endpoint that resolves the promise with the request body text. ~10 LOC.

**~35 lines**.

## Factory

```typescript
function createInterface(type: string, callback: MessageCallback): InterfaceAdapter {
  switch (type) {
    case "cli": return new CLIInterface(callback);
    case "telegram": return new TelegramInterface(callback);
    case "api": return new APIInterface(callback);
    default: throw new Error(`Unknown interface: ${type}`);
  }
}
```

## Estimated LOC

| Component | Lines |
|-----------|-------|
| `InterfaceAdapter` | ~9 |
| `CLIInterface` | ~28 |
| `TelegramInterface` | ~58 |
| `APIInterface` | ~35 |
| Factory | ~8 |
| **Total** | **~138** |

Only CLIInterface is required. Telegram and API are optional.

## Source Files

- `src/interfaces/base.ts` -- `InterfaceAdapter`
- `src/interfaces/cli.ts` -- `CLIInterface`
- `src/interfaces/telegram.ts` -- `TelegramInterface`
- `src/interfaces/api.ts` -- `APIInterface`
