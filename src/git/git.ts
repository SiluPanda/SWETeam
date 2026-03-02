import { execSync } from "child_process";

export function git(args: string, cwd: string): string {
  return execSync(`git ${args}`, {
    cwd,
    encoding: "utf-8",
    timeout: 30000,
  }).trim();
}

export function gh(args: string, cwd: string): string {
  return execSync(`gh ${args}`, {
    cwd,
    encoding: "utf-8",
    timeout: 30000,
  }).trim();
}
