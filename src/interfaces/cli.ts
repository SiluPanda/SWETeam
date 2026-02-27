import readline from "node:readline";
import { InterfaceAdapter, type MessageCallback } from "./base.js";
import { parseTaskCommand } from "../messaging.js";

export class CLIInterface extends InterfaceAdapter {
  private rl!: readline.Interface;
  private pendingResolve: ((value: string) => void) | null = null;

  constructor(callback: MessageCallback) {
    super(callback);
  }

  async start(): Promise<void> {
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log("SWE Team Ready. Type: <repo> <task description>");
    console.log("Commands: quit, list, status, stop <id>");
    this.rl.on("line", (line) => this.handleLine(line.trim()));
  }

  private handleLine(line: string): void {
    if (!line) return;

    if (this.pendingResolve) {
      const resolve = this.pendingResolve;
      this.pendingResolve = null;
      resolve(line);
      return;
    }

    if (line === "quit" || line === "exit") {
      this.stop();
      process.exit(0);
    }

    const parsed = parseTaskCommand(line);
    if (parsed) {
      this.messageCallback(parsed.repo, parsed.task, "cli");
    } else {
      console.log("Usage: <owner/repo> <task description>");
    }
  }

  async sendMessage(_chatId: string, text: string): Promise<void> {
    console.log(text);
  }

  async waitForResponse(_chatId: string, timeout = 300_000): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingResolve = null;
        reject(new Error("Response timeout"));
      }, timeout);
      this.pendingResolve = (value: string) => {
        clearTimeout(timer);
        resolve(value);
      };
    });
  }

  async stop(): Promise<void> {
    this.rl?.close();
  }
}
