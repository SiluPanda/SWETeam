import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runInit, formatInitOutput } from "../commands/init.js";

describe("commands/init", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("should discover CLIs and generate config", () => {
    const dir = mkdtempSync(join(tmpdir(), "sweteam-init-"));
    tempDirs.push(dir);
    const configPath = join(dir, ".sweteam", "config.toml");

    const result = runInit(configPath);
    expect(result.configWritten).toBe(true);
    expect(result.clis.length).toBeGreaterThanOrEqual(5);
    expect(existsSync(configPath)).toBe(true);

    const content = readFileSync(configPath, "utf-8");
    expect(content).toContain("[roles]");
  });

  it("should not overwrite existing config without force", () => {
    const dir = mkdtempSync(join(tmpdir(), "sweteam-init-"));
    tempDirs.push(dir);
    const configPath = join(dir, ".sweteam", "config.toml");

    // First run creates it
    runInit(configPath);
    const firstContent = readFileSync(configPath, "utf-8");

    // Second run should not overwrite
    const result = runInit(configPath);
    expect(result.configWritten).toBe(false);
    const secondContent = readFileSync(configPath, "utf-8");
    expect(secondContent).toBe(firstContent);
  });

  it("should overwrite existing config with force flag", () => {
    const dir = mkdtempSync(join(tmpdir(), "sweteam-init-"));
    tempDirs.push(dir);
    const configPath = join(dir, ".sweteam", "config.toml");

    runInit(configPath);
    const result = runInit(configPath, { force: true });
    expect(result.configWritten).toBe(true);
  });

  it("should format output with checkmarks and crosses", () => {
    const result = {
      configPath: "/tmp/config.toml",
      configWritten: true,
      clis: [
        { name: "claude", available: true, version: "1.0.0" },
        { name: "codex", available: false },
        { name: "git", available: true, version: "2.43.0" },
      ],
    };

    const output = formatInitOutput(result);
    expect(output).toContain("\u2713 Found claude (1.0.0)");
    expect(output).toContain("\u2717 codex not found");
    expect(output).toContain("\u2713 Found git (2.43.0)");
    expect(output).toContain("Generated /tmp/config.toml");
  });

  it("should show 'already exists' when config not written", () => {
    const result = {
      configPath: "/tmp/config.toml",
      configWritten: false,
      clis: [],
    };

    const output = formatInitOutput(result);
    expect(output).toContain("Config already exists");
  });
});
