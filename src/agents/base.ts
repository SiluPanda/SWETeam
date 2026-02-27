import fs from "node:fs";
import path from "node:path";
import { createCliBackend, type CLIBackend } from "../cli-backend.js";
import { getConfig, type AgentLLMConfig } from "../config.js";

export abstract class BaseAgent {
  protected cli: CLIBackend;
  protected agentType: string;

  constructor(agentType: string, configOverride?: AgentLLMConfig) {
    this.agentType = agentType;
    const config = getConfig();
    const llmConfig: AgentLLMConfig = configOverride
      ?? (config.agents as Record<string, AgentLLMConfig>)[agentType]
      ?? config.agents.swe;
    const flags = llmConfig.extraFlags ? llmConfig.extraFlags.split(/\s+/).filter(Boolean) : [];
    this.cli = createCliBackend(llmConfig.provider, llmConfig.model, flags, llmConfig.timeout * 1000);
  }

  protected getSystemPrompt(): string {
    const config = getConfig();
    const promptPath = config.agent.prompts[this.agentType]
      ?? config.agent.prompts["swe"];
    if (!promptPath) return "";
    const resolved = path.resolve(process.cwd(), promptPath);
    try { return fs.readFileSync(resolved, "utf8"); } catch { return ""; }
  }

  protected loadPrompt(promptKey: string): string {
    const config = getConfig();
    const promptPath = config.agent.prompts[promptKey];
    if (!promptPath) return "";
    const resolved = path.resolve(process.cwd(), promptPath);
    try { return fs.readFileSync(resolved, "utf8"); } catch { return ""; }
  }

  async run(prompt: string, cwd: string): Promise<string> {
    const systemPrompt = this.getSystemPrompt();
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    return this.cli.invoke(fullPrompt, cwd);
  }
}
