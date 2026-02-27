import { InterfaceAdapter, type MessageCallback } from "./base.js";
import { parseTaskCommand } from "../messaging.js";
import { getConfig } from "../config.js";

export class TelegramInterface extends InterfaceAdapter {
  private bot: any;
  private pendingResponses = new Map<string, (value: string) => void>();

  constructor(callback: MessageCallback) {
    super(callback);
  }

  async start(): Promise<void> {
    let TelegramBot: any;
    try {
      TelegramBot = (await import("node-telegram-bot-api")).default;
    } catch {
      throw new Error("node-telegram-bot-api not installed. Run: npm install node-telegram-bot-api");
    }
    const config = getConfig();
    this.bot = new TelegramBot(config.telegram.botToken, { polling: true });

    this.bot.on("message", (msg: any) => {
      const chatId = String(msg.chat.id);
      const text = (msg.text ?? "").trim();

      // Check for pending response first
      const pending = this.pendingResponses.get(chatId);
      if (pending) {
        this.pendingResponses.delete(chatId);
        pending(text);
        return;
      }

      if (text === "/start" || text === "/help") {
        this.bot.sendMessage(chatId, "SWE Team Bot\nUsage: /task <repo> <description>");
        return;
      }

      const taskMatch = text.match(/^\/task\s+([\s\S]+)/);
      if (taskMatch) {
        const parsed = parseTaskCommand(taskMatch[1]!);
        if (parsed) {
          this.messageCallback(parsed.repo, parsed.task, chatId);
        } else {
          this.bot.sendMessage(chatId, "Usage: /task <owner/repo> <task description>");
        }
        return;
      }

      if (text === "/list" || text === "/status") {
        this.messageCallback("__cmd__", text, chatId);
        return;
      }
    });
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    await this.bot.sendMessage(chatId, text);
  }

  async waitForResponse(chatId: string, timeout = 300_000): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingResponses.delete(chatId);
        reject(new Error("Response timeout"));
      }, timeout);
      this.pendingResponses.set(chatId, (value: string) => {
        clearTimeout(timer);
        resolve(value);
      });
    });
  }

  async stop(): Promise<void> {
    await this.bot?.stopPolling();
  }
}
