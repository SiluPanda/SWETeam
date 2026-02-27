import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InterfaceAdapter, createInterface } from "./base.js";
import { CLIInterface } from "./cli.js";

describe("InterfaceAdapter", () => {
  it("CLIInterface extends InterfaceAdapter", () => {
    const callback = vi.fn();
    const cli = new CLIInterface(callback);
    expect(cli).toBeInstanceOf(InterfaceAdapter);
  });
});

describe("createInterface", () => {
  it("creates CLIInterface for 'cli'", async () => {
    const callback = vi.fn();
    const iface = await createInterface("cli", callback);
    expect(iface).toBeInstanceOf(CLIInterface);
  });

  it("throws for unknown interface type", async () => {
    await expect(createInterface("unknown", vi.fn())).rejects.toThrow("Unknown interface: unknown");
  });
});

describe("CLIInterface", () => {
  let cli: CLIInterface;
  let callback: ReturnType<typeof vi.fn>;
  const originalStdin = process.stdin;
  const originalStdout = process.stdout;

  beforeEach(() => {
    callback = vi.fn();
    cli = new CLIInterface(callback);
  });

  afterEach(async () => {
    await cli.stop();
  });

  it("sendMessage logs to console", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cli.sendMessage("chat1", "Hello World");
    expect(consoleSpy).toHaveBeenCalledWith("Hello World");
    consoleSpy.mockRestore();
  });

  it("has start, stop, sendMessage, waitForResponse methods", () => {
    expect(typeof cli.start).toBe("function");
    expect(typeof cli.stop).toBe("function");
    expect(typeof cli.sendMessage).toBe("function");
    expect(typeof cli.waitForResponse).toBe("function");
  });
});
