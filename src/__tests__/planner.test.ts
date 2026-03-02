import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";
import {
  getFilteredFileTree,
  getManifestContents,
  getRecentCommits,
  buildPlannerPrompt,
} from "../planner/planner.js";

describe("planner — getFilteredFileTree", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "sweteam-planner-test-"));
    mkdirSync(join(tmpDir, "src"));
    writeFileSync(join(tmpDir, "src", "index.ts"), "");
    writeFileSync(join(tmpDir, "package.json"), "{}");
    mkdirSync(join(tmpDir, "node_modules"));
    writeFileSync(join(tmpDir, "node_modules", "dep.js"), "");
    mkdirSync(join(tmpDir, ".git"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should list files and directories", () => {
    const tree = getFilteredFileTree(tmpDir);
    expect(tree).toContain("src/");
    expect(tree).toContain("  index.ts");
    expect(tree).toContain("package.json");
  });

  it("should exclude node_modules and .git", () => {
    const tree = getFilteredFileTree(tmpDir);
    expect(tree.some((l) => l.includes("node_modules"))).toBe(false);
    expect(tree.some((l) => l.includes(".git"))).toBe(false);
  });

  it("should respect maxDepth", () => {
    mkdirSync(join(tmpDir, "a", "b", "c", "d", "e"), { recursive: true });
    writeFileSync(join(tmpDir, "a", "b", "c", "d", "e", "deep.txt"), "");

    const tree = getFilteredFileTree(tmpDir, "", 2);
    expect(tree.some((l) => l.includes("deep.txt"))).toBe(false);
  });
});

describe("planner — getManifestContents", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "sweteam-manifest-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return package.json contents", () => {
    writeFileSync(join(tmpDir, "package.json"), '{"name":"test"}');
    const result = getManifestContents(tmpDir);
    expect(result).toBe('{"name":"test"}');
  });

  it("should return null when no manifest found", () => {
    expect(getManifestContents(tmpDir)).toBeNull();
  });

  it("should prefer first found manifest", () => {
    writeFileSync(join(tmpDir, "package.json"), '{"type":"node"}');
    writeFileSync(join(tmpDir, "Cargo.toml"), "[package]");
    const result = getManifestContents(tmpDir);
    expect(result).toBe('{"type":"node"}');
  });
});

describe("planner — getRecentCommits", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "sweteam-commits-test-"));
    execSync("git init", { cwd: tmpDir });
    execSync("git config user.email test@test.com", { cwd: tmpDir });
    execSync("git config user.name Test", { cwd: tmpDir });
    writeFileSync(join(tmpDir, "file.txt"), "hello");
    execSync("git add -A && git commit -m 'Initial commit'", { cwd: tmpDir });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return commit history", () => {
    const commits = getRecentCommits(tmpDir, 5);
    expect(commits).toContain("Initial commit");
  });
});

describe("planner — buildPlannerPrompt", () => {
  it("should include repo, goal, and chat history", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "sweteam-prompt-test-"));
    writeFileSync(join(tmpDir, "file.ts"), "");

    const prompt = buildPlannerPrompt(
      "owner/repo",
      "Add dark theme",
      tmpDir,
      [{ role: "user", content: "Hello" }],
    );

    expect(prompt).toContain("owner/repo");
    expect(prompt).toContain("Add dark theme");
    expect(prompt).toContain("[user] Hello");
    expect(prompt).toContain("@build");

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
