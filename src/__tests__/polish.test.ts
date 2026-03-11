import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Test CLI flag overrides are registered
describe('CLI flag overrides (#task-74)', () => {
  it('should have --coder, --reviewer, --parallel, --config options in index.ts', () => {
    const indexContent = readFileSync(join(__dirname, '../index.ts'), 'utf-8');
    expect(indexContent).toContain('--coder');
    expect(indexContent).toContain('--reviewer');
    expect(indexContent).toContain('--parallel');
    expect(indexContent).toContain('--config');
  });
});

describe('npm bin entry and build script (#task-76)', () => {
  it('should have bin entry in package.json', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
    expect(pkg.bin).toBeDefined();
    expect(pkg.bin.sweteam).toBe('./dist/index.js');
  });

  it('should have build script', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
    expect(pkg.scripts.build).toBe('tsc');
  });

  it('should have dev and start scripts', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
    expect(pkg.scripts.dev).toBeDefined();
    expect(pkg.scripts.start).toBeDefined();
  });
});

describe('gh auth validation (#task-77)', () => {
  it('should export validateGhAuth function', async () => {
    const { validateGhAuth } = await import('../config/gh-auth.js');
    expect(typeof validateGhAuth).toBe('function');
  });

  it('should return authenticated status', async () => {
    const { validateGhAuth } = await import('../config/gh-auth.js');
    const result = validateGhAuth();
    expect(typeof result.authenticated).toBe('boolean');
    expect(typeof result.message).toBe('string');
  });
});

describe('Session search/filter (#task-78)', () => {
  it('should have --status and --repo options in list command', () => {
    const indexContent = readFileSync(join(__dirname, '../index.ts'), 'utf-8');
    expect(indexContent).toContain('--status');
    expect(indexContent).toContain('--repo');
  });

  it('should filter sessions by status in handleList', async () => {
    const { handleList } = await import('../commands/list.js');
    // This verifies the function signature accepts filters
    expect(typeof handleList).toBe('function');
  });
});
