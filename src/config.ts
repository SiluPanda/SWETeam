import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import "dotenv/config";

export interface AgentLLMConfig {
  provider: string;
  model: string;
  extraFlags: string;
  timeout: number;
}

export interface AgentPoolConfig {
  maxAgents: number;
}

export interface AgentConfig {
  maxReviewIterations: number;
  maxClarificationRounds: number;
  skipClarification: boolean;
  approvalThreshold: string;
  onSubtaskFailure: string;
  prompts: Record<string, string>;
}

export interface TelegramConfig {
  botToken: string;
  allowedUsers: number[];
}

export interface GitConfig {
  defaultBranch: string;
  authorName: string;
  authorEmail: string;
  githubToken: string;
}

export interface RepoConfig {
  basePath: string;
  workspacesPath: string;
  cloneTimeout: number;
}

export interface DatabaseConfig {
  path: string;
}

export interface ProcessingConfig {
  maxConcurrentTasks: number;
  workflowTimeout: number;
}

export interface LoggingConfig {
  level: string;
  file: string;
}

export interface Config {
  interface: "cli" | "telegram" | "api";
  telegram: TelegramConfig;
  agents: { architect: AgentLLMConfig; swe: AgentLLMConfig };
  agentPool: AgentPoolConfig;
  git: GitConfig;
  repos: RepoConfig;
  database: DatabaseConfig;
  processing: ProcessingConfig;
  agent: AgentConfig;
  logging: LoggingConfig;
}

export const DEFAULT_CONFIG: Config = {
  interface: "cli",
  telegram: { botToken: "", allowedUsers: [] },
  agents: {
    architect: { provider: "claude", model: "claude-opus-4-6", extraFlags: "--dangerously-skip-permissions", timeout: 900 },
    swe: { provider: "claude", model: "claude-sonnet-4-6", extraFlags: "--dangerously-skip-permissions", timeout: 900 },
  },
  agentPool: { maxAgents: 4 },
  git: { defaultBranch: "main", authorName: "SWE Team Bot", authorEmail: "bot@swe-team.local", githubToken: "" },
  repos: { basePath: "./repos", workspacesPath: "./workspaces", cloneTimeout: 300 },
  database: { path: "./state/swe-team.db" },
  processing: { maxConcurrentTasks: 4, workflowTimeout: 7200 },
  agent: {
    maxReviewIterations: 3,
    maxClarificationRounds: 10,
    skipClarification: false,
    approvalThreshold: "good",
    onSubtaskFailure: "retry",
    prompts: {
      architect: "src/prompts/architect-system.md",
      architect_clarify: "src/prompts/architect-clarify.md",
      architect_review: "src/prompts/architect-review.md",
      swe: "src/prompts/swe-system.md",
    },
  },
  logging: { level: "info", file: "./logs/swe-team.log" },
};

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) &&
        target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) {
      result[key] = deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function camelCaseKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    result[camelKey] = value && typeof value === "object" && !Array.isArray(value)
      ? camelCaseKeys(value as Record<string, unknown>)
      : value;
  }
  return result;
}

export function loadConfig(configPath = "config.yaml"): Config {
  let raw: Record<string, unknown> = {};
  const resolved = path.resolve(process.cwd(), configPath);
  if (fs.existsSync(resolved)) {
    raw = camelCaseKeys((yaml.load(fs.readFileSync(resolved, "utf8")) as Record<string, unknown>) ?? {});
  }
  const merged = deepMerge(DEFAULT_CONFIG as unknown as Record<string, unknown>, raw) as unknown as Config;

  // Env var overrides
  if (process.env["TELEGRAM_BOT_TOKEN"]) merged.telegram.botToken = process.env["TELEGRAM_BOT_TOKEN"];
  if (process.env["GITHUB_TOKEN"]) merged.git.githubToken = process.env["GITHUB_TOKEN"];

  // Resolve relative paths
  merged.repos.basePath = path.resolve(process.cwd(), merged.repos.basePath);
  merged.repos.workspacesPath = path.resolve(process.cwd(), merged.repos.workspacesPath);
  merged.database.path = path.resolve(process.cwd(), merged.database.path);
  merged.logging.file = path.resolve(process.cwd(), merged.logging.file);

  return merged;
}

let _config: Config | null = null;

export function getConfig(configPath?: string): Config {
  if (!_config) _config = loadConfig(configPath);
  return _config;
}

export function reloadConfig(configPath?: string): Config {
  _config = loadConfig(configPath);
  return _config;
}
