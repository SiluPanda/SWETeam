import { InterfaceAdapter, type MessageCallback } from "./base.js";
import { parseTaskCommand } from "../messaging.js";

export class APIInterface extends InterfaceAdapter {
  private server: any;
  private pendingResponses = new Map<string, (value: string) => void>();

  constructor(callback: MessageCallback) {
    super(callback);
  }

  async start(): Promise<void> {
    let express: any;
    try {
      express = (await import("express")).default;
    } catch {
      throw new Error("express not installed. Run: npm install express");
    }
    const app = express();
    app.use(express.json());

    app.post("/task", (req: any, res: any) => {
      const { repo, task } = req.body ?? {};
      if (!repo || !task) return res.status(400).json({ error: "repo and task required" });
      const chatId = `api-${Date.now()}`;
      this.messageCallback(repo, task, chatId);
      res.json({ chatId, status: "queued" });
    });

    app.get("/status", (_req: any, res: any) => {
      this.messageCallback("__cmd__", "/status", "__api__");
      res.json({ status: "ok" });
    });

    app.post("/stop", (req: any, res: any) => {
      const { runId } = req.body ?? {};
      this.messageCallback("__cmd__", `/stop ${runId}`, "__api__");
      res.json({ status: "stopping" });
    });

    app.post("/respond/:chatId", (req: any, res: any) => {
      const pending = this.pendingResponses.get(req.params.chatId);
      if (pending) {
        this.pendingResponses.delete(req.params.chatId);
        pending(req.body?.text ?? "");
        res.json({ status: "ok" });
      } else {
        res.status(404).json({ error: "No pending response for this chat" });
      }
    });

    this.server = app.listen(3000, () => console.log("API server on port 3000"));
  }

  async sendMessage(_chatId: string, _text: string): Promise<void> {
    // API responses are fire-and-forget; clients poll /status
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
    this.server?.close();
  }
}
