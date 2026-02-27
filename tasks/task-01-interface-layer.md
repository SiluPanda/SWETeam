# Task 01: Interface Layer

> Pluggable user interface: abstract adapter + CLI implementation (default). Telegram and API optional.

**Spec**: [01-telegram-bot.md](../spec/01-telegram-bot.md)
**File**: `src/interfaces/*.ts`
**LOC target**: ~60 (CLI only), ~138 (all three)

## Checklist

- [ ] **Define `InterfaceAdapter` abstract class** in `src/interfaces/base.ts`
  - Constructor takes `messageCallback: (repo, task, chatId) => void`
  - Abstract methods: `start()`, `stop()`, `sendMessage(chatId, text)`, `waitForResponse(chatId, timeout?)`

- [ ] **Implement `CLIInterface`** in `src/interfaces/cli.ts`
  - Uses `readline.createInterface` for interactive input
  - `start()`: print welcome, listen for lines
  - Parse input as `<repo> <task description>`, call `messageCallback`
  - Handle `quit`, `list`, `status`, `stop` commands
  - `sendMessage()`: `console.log(text)`
  - `waitForResponse()`: `rl.question("")` — prompts stdin, returns promise (~3 LOC)
  - `stop()`: close readline

- [ ] **Implement `TelegramInterface`** in `src/interfaces/telegram.ts` (optional)
  - Uses `node-telegram-bot-api` for polling
  - Commands: `/start`, `/help`, `/task`, `/list`, `/status`, `/stop`
  - `sendMessage()`: `bot.sendMessage(chatId, text)`
  - `waitForResponse()`: one-time message listener for the chat, resolve promise on next user message (~8 LOC)
  - Guard import with try/catch for optional dependency

- [ ] **Implement `APIInterface`** in `src/interfaces/api.ts` (optional)
  - Minimal Express server
  - `POST /task`, `GET /status`, `POST /stop`, `POST /respond/{runId}`
  - `waitForResponse()`: store pending resolver keyed by runId, resolve on `POST /respond/{runId}` (~10 LOC)
  - Guard import with try/catch for optional dependency

- [ ] **Create `createInterface()` factory function**

- [ ] **Verify**: CLI interface starts, accepts `owner/repo some task`, prints output
