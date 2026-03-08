import { describe, it, expect } from 'vitest';
import { CustomAdapter } from '../adapters/custom.js';
import type { AgentAdapter } from '../adapters/adapter.js';

describe('adapters/custom — CustomAdapter', () => {
  it('should implement AgentAdapter interface', () => {
    const adapter: AgentAdapter = new CustomAdapter('my-agent', {
      command: 'echo',
      args: ['hello'],
    });
    expect(adapter.name).toBe('my-agent');
    expect(typeof adapter.isAvailable).toBe('function');
    expect(typeof adapter.execute).toBe('function');
  });

  it('isAvailable should return true for existing commands', async () => {
    const adapter = new CustomAdapter('echo-agent', {
      command: 'echo',
    });
    const result = await adapter.isAvailable();
    expect(result).toBe(true);
  });

  it('isAvailable should return false for non-existent commands', async () => {
    const adapter = new CustomAdapter('fake-agent', {
      command: 'nonexistent-binary-xyz',
    });
    const result = await adapter.isAvailable();
    expect(result).toBe(false);
  });

  it('execute with stdin prompt_via should pipe prompt to stdin', async () => {
    const adapter = new CustomAdapter('cat-agent', {
      command: 'cat',
      prompt_via: 'stdin',
      output_from: 'stdout',
    });

    const result = await adapter.execute({
      prompt: 'hello from stdin',
      cwd: '/tmp',
      timeout: 5000,
    });

    expect(result.output).toBe('hello from stdin');
    expect(result.exitCode).toBe(0);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it('execute with arg prompt_via should pass prompt as argument', async () => {
    const adapter = new CustomAdapter('echo-agent', {
      command: 'echo',
      prompt_via: 'arg',
      output_from: 'stdout',
    });

    const result = await adapter.execute({
      prompt: 'hello from arg',
      cwd: '/tmp',
      timeout: 5000,
    });

    expect(result.output.trim()).toBe('hello from arg');
    expect(result.exitCode).toBe(0);
  });

  it('execute should support onOutput callback', async () => {
    const chunks: string[] = [];
    const adapter = new CustomAdapter('echo-agent', {
      command: 'echo',
      prompt_via: 'arg',
    });

    await adapter.execute({
      prompt: 'streaming test',
      cwd: '/tmp',
      timeout: 5000,
      onOutput: (chunk) => chunks.push(chunk),
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join('').trim()).toBe('streaming test');
  });

  it('execute should handle timeout', async () => {
    const adapter = new CustomAdapter('sleep-agent', {
      command: 'sleep',
      prompt_via: 'arg',
    });

    await expect(
      adapter.execute({
        prompt: '10',
        cwd: '/tmp',
        timeout: 100,
      }),
    ).rejects.toThrow('timed out');
  });
});
