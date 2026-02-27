import { describe, it, expect } from "vitest";
import {
  ClaudeCodeBackend,
  CodexBackend,
  AiderBackend,
  createCliBackend,
  extractTextFromJson,
} from "./cli-backend.js";

describe("cli-backend", () => {
  describe("extractTextFromJson", () => {
    it("returns plain text as-is when not JSON", () => {
      expect(extractTextFromJson("hello world")).toBe("hello world");
    });

    it("extracts string from JSON string", () => {
      expect(extractTextFromJson('"hello"')).toBe("hello");
    });

    it("extracts result field from object", () => {
      expect(extractTextFromJson('{"result": "done"}')).toBe("done");
    });

    it("extracts message field from object", () => {
      expect(extractTextFromJson('{"message": "hi"}')).toBe("hi");
    });

    it("extracts text field from object", () => {
      expect(extractTextFromJson('{"text": "content"}')).toBe("content");
    });

    it("extracts output field from object", () => {
      expect(extractTextFromJson('{"output": "data"}')).toBe("data");
    });

    it("extracts from content array (Claude format)", () => {
      const input = JSON.stringify({
        content: [
          { type: "text", text: "Hello " },
          { type: "text", text: "World" },
        ],
      });
      expect(extractTextFromJson(input)).toBe("Hello \nWorld");
    });

    it("filters non-text content items", () => {
      const input = JSON.stringify({
        content: [
          { type: "tool_use", text: "ignored" },
          { type: "text", text: "kept" },
        ],
      });
      expect(extractTextFromJson(input)).toBe("kept");
    });

    it("handles array of objects", () => {
      const input = JSON.stringify([
        { result: "one" },
        { result: "two" },
      ]);
      expect(extractTextFromJson(input)).toBe("one\ntwo");
    });

    it("falls back to JSON.stringify for unknown objects", () => {
      const input = JSON.stringify({ foo: 42 });
      expect(extractTextFromJson(input)).toBe('{"foo":42}');
    });
  });

  describe("ClaudeCodeBackend", () => {
    it("builds correct command without model", () => {
      const backend = new ClaudeCodeBackend("", [], 60_000);
      const cmd = (backend as any).buildCommand("test prompt");
      expect(cmd.bin).toBe("claude");
      expect(cmd.args).toContain("-p");
      expect(cmd.args).toContain("--output-format");
      expect(cmd.args).toContain("json");
      expect(cmd.args[cmd.args.length - 1]).toBe("test prompt");
    });

    it("builds correct command with model", () => {
      const backend = new ClaudeCodeBackend("claude-opus-4-6", [], 60_000);
      const cmd = (backend as any).buildCommand("prompt");
      expect(cmd.args).toContain("--model");
      expect(cmd.args).toContain("claude-opus-4-6");
    });

    it("includes extra flags", () => {
      const backend = new ClaudeCodeBackend("", ["--dangerously-skip-permissions"], 60_000);
      const cmd = (backend as any).buildCommand("prompt");
      expect(cmd.args).toContain("--dangerously-skip-permissions");
    });
  });

  describe("CodexBackend", () => {
    it("builds correct command", () => {
      const backend = new CodexBackend("gpt-4", [], 60_000);
      const cmd = (backend as any).buildCommand("test prompt");
      expect(cmd.bin).toBe("codex");
      expect(cmd.args).toContain("exec");
      expect(cmd.args).toContain("--json");
      expect(cmd.args).toContain("--model");
      expect(cmd.args).toContain("gpt-4");
    });
  });

  describe("AiderBackend", () => {
    it("builds correct command", () => {
      const backend = new AiderBackend("deepseek", [], 60_000);
      const cmd = (backend as any).buildCommand("test prompt");
      expect(cmd.bin).toBe("aider");
      expect(cmd.args).toContain("--yes-always");
      expect(cmd.args).toContain("--no-git");
      expect(cmd.args).toContain("--message");
      expect(cmd.args).toContain("test prompt");
      expect(cmd.args).toContain("--model");
      expect(cmd.args).toContain("deepseek");
    });
  });

  describe("createCliBackend", () => {
    it("creates ClaudeCodeBackend for 'claude'", () => {
      const backend = createCliBackend("claude", "model", [], 60_000);
      expect(backend).toBeInstanceOf(ClaudeCodeBackend);
    });

    it("creates CodexBackend for 'codex'", () => {
      const backend = createCliBackend("codex");
      expect(backend).toBeInstanceOf(CodexBackend);
    });

    it("creates AiderBackend for 'aider'", () => {
      const backend = createCliBackend("aider");
      expect(backend).toBeInstanceOf(AiderBackend);
    });

    it("throws on unknown provider", () => {
      expect(() => createCliBackend("unknown")).toThrow("Unknown CLI backend: unknown");
    });
  });
});
