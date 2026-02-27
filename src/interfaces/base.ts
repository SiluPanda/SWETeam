export type MessageCallback = (repo: string, task: string, chatId: string) => void;

export abstract class InterfaceAdapter {
  constructor(protected messageCallback: MessageCallback) {}
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract sendMessage(chatId: string, text: string): Promise<void>;
  abstract waitForResponse(chatId: string, timeout?: number): Promise<string>;
}

export async function createInterface(type: string, callback: MessageCallback): Promise<InterfaceAdapter> {
  switch (type) {
    case "cli": {
      const { CLIInterface } = await import("./cli.js");
      return new CLIInterface(callback);
    }
    case "telegram": {
      const { TelegramInterface } = await import("./telegram.js");
      return new TelegramInterface(callback);
    }
    case "api": {
      const { APIInterface } = await import("./api.js");
      return new APIInterface(callback);
    }
    default:
      throw new Error(`Unknown interface: ${type}`);
  }
}
