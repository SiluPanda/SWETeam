import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, getConfig, reloadConfig, DEFAULT_CONFIG } from "./config.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("config", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "swe-team-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    // Reset singleton
    reloadConfig(path.join(tmpDir, "nonexistent.yaml"));
  });

  it("returns defaults when no config file exists", () => {
    const config = loadConfig(path.join(tmpDir, "nonexistent.yaml"));
    expect(config.interface).toBe("cli");
    expect(config.agents.architect.provider).toBe("claude");
    expect(config.agents.swe.model).toBe("claude-sonnet-4-6");
    expect(config.agentPool.maxAgents).toBe(4);
    expect(config.agent.maxReviewIterations).toBe(3);
    expect(config.agent.approvalThreshold).toBe("good");
  });

  it("loads and merges YAML config", () => {
    const configPath = path.join(tmpDir, "test-config.yaml");
    fs.writeFileSync(configPath, `
interface: "telegram"
agent_pool:
  max_agents: 8
agents:
  architect:
    model: "gpt-4"
`);
    const config = loadConfig(configPath);
    expect(config.interface).toBe("telegram");
    expect(config.agentPool.maxAgents).toBe(8);
    expect(config.agents.architect.model).toBe("gpt-4");
    // Defaults preserved for unspecified fields
    expect(config.agents.architect.provider).toBe("claude");
    expect(config.agents.swe.model).toBe("claude-sonnet-4-6");
  });

  it("applies env var overrides", () => {
    const origTg = process.env["TELEGRAM_BOT_TOKEN"];
    const origGh = process.env["GITHUB_TOKEN"];
    process.env["TELEGRAM_BOT_TOKEN"] = "test-tg-token";
    process.env["GITHUB_TOKEN"] = "test-gh-token";
    try {
      const config = loadConfig(path.join(tmpDir, "nonexistent.yaml"));
      expect(config.telegram.botToken).toBe("test-tg-token");
      expect(config.git.githubToken).toBe("test-gh-token");
    } finally {
      if (origTg !== undefined) process.env["TELEGRAM_BOT_TOKEN"] = origTg;
      else delete process.env["TELEGRAM_BOT_TOKEN"];
      if (origGh !== undefined) process.env["GITHUB_TOKEN"] = origGh;
      else delete process.env["GITHUB_TOKEN"];
    }
  });

  it("resolves relative paths", () => {
    const config = loadConfig(path.join(tmpDir, "nonexistent.yaml"));
    expect(path.isAbsolute(config.repos.basePath)).toBe(true);
    expect(path.isAbsolute(config.repos.workspacesPath)).toBe(true);
    expect(path.isAbsolute(config.database.path)).toBe(true);
    expect(path.isAbsolute(config.logging.file)).toBe(true);
  });

  it("singleton getConfig returns same instance", () => {
    const c1 = getConfig(path.join(tmpDir, "nonexistent.yaml"));
    const c2 = getConfig();
    expect(c1).toBe(c2);
  });

  it("reloadConfig replaces singleton", () => {
    const c1 = getConfig(path.join(tmpDir, "nonexistent.yaml"));
    const c2 = reloadConfig(path.join(tmpDir, "nonexistent.yaml"));
    expect(c1).not.toBe(c2);
  });

  it("DEFAULT_CONFIG has all expected sections", () => {
    expect(DEFAULT_CONFIG.interface).toBeDefined();
    expect(DEFAULT_CONFIG.telegram).toBeDefined();
    expect(DEFAULT_CONFIG.agents).toBeDefined();
    expect(DEFAULT_CONFIG.agentPool).toBeDefined();
    expect(DEFAULT_CONFIG.git).toBeDefined();
    expect(DEFAULT_CONFIG.repos).toBeDefined();
    expect(DEFAULT_CONFIG.database).toBeDefined();
    expect(DEFAULT_CONFIG.processing).toBeDefined();
    expect(DEFAULT_CONFIG.agent).toBeDefined();
    expect(DEFAULT_CONFIG.logging).toBeDefined();
  });

  it("converts snake_case YAML keys to camelCase", () => {
    const configPath = path.join(tmpDir, "test-config.yaml");
    fs.writeFileSync(configPath, `
agent:
  max_review_iterations: 5
  on_subtask_failure: "continue"
  skip_clarification: true
`);
    const config = loadConfig(configPath);
    expect(config.agent.maxReviewIterations).toBe(5);
    expect(config.agent.onSubtaskFailure).toBe("continue");
    expect(config.agent.skipClarification).toBe(true);
  });
});
