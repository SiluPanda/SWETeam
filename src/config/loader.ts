import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { parse as parseTOML, stringify as stringifyTOML } from "@iarna/toml";

const CONFIG_PATH = join(homedir(), ".sweteam", "config.toml");

export interface AgentConfig {
  command: string;
  args?: string[];
  prompt_via?: "stdin" | "arg" | "file";
  output_from?: "stdout" | "file";
}

export interface SweteamConfig {
  roles: {
    planner: string;
    coder: string;
    reviewer: string;
  };
  execution: {
    max_parallel: number;
    max_review_cycles: number;
    branch_prefix: string;
  };
  git: {
    commit_style: "conventional" | "simple";
    squash_on_merge: boolean;
  };
  agents: Record<string, AgentConfig>;
}

const DEFAULT_CONFIG: SweteamConfig = {
  roles: {
    planner: "claude-code",
    coder: "claude-code",
    reviewer: "claude-code",
  },
  execution: {
    max_parallel: 3,
    max_review_cycles: 3,
    branch_prefix: "sw/",
  },
  git: {
    commit_style: "conventional",
    squash_on_merge: true,
  },
  agents: {
    "claude-code": {
      command: "claude",
      args: ["-p"],
    },
  },
};

export function loadConfig(configPath: string = CONFIG_PATH): SweteamConfig {
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  const raw = readFileSync(configPath, "utf-8");
  const parsed = parseTOML(raw) as unknown as Partial<SweteamConfig>;

  return {
    roles: { ...DEFAULT_CONFIG.roles, ...parsed.roles },
    execution: { ...DEFAULT_CONFIG.execution, ...parsed.execution },
    git: { ...DEFAULT_CONFIG.git, ...parsed.git },
    agents: { ...DEFAULT_CONFIG.agents, ...parsed.agents },
  };
}

export { CONFIG_PATH, DEFAULT_CONFIG, stringifyTOML };
