import { describe, it, expect } from 'vitest';
import { buildDag, topologicalSort, getReadyTasks } from '../orchestrator/dag.js';
import type { TaskRecord } from '../orchestrator/task-runner.js';

function makeTask(id: string, deps: string[] = []): TaskRecord {
  return {
    id,
    sessionId: 's_test',
    title: `Task ${id}`,
    description: `Desc ${id}`,
    filesLikelyTouched: null,
    acceptanceCriteria: null,
    dependsOn: deps.length > 0 ? JSON.stringify(deps) : null,
    branchName: null,
    status: 'queued',
  };
}

describe('dag — buildDag', () => {
  it('should create nodes for all tasks', () => {
    const tasks = [makeTask('t-1'), makeTask('t-2'), makeTask('t-3')];
    const dag = buildDag(tasks);
    expect(dag.size).toBe(3);
  });

  it('should track dependencies', () => {
    const tasks = [makeTask('t-1'), makeTask('t-2', ['t-1']), makeTask('t-3', ['t-1', 't-2'])];
    const dag = buildDag(tasks);

    expect(dag.get('t-2')!.dependsOn).toEqual(['t-1']);
    expect(dag.get('t-3')!.dependsOn).toEqual(['t-1', 't-2']);
  });

  it('should build reverse edges (dependents)', () => {
    const tasks = [makeTask('t-1'), makeTask('t-2', ['t-1']), makeTask('t-3', ['t-1'])];
    const dag = buildDag(tasks);

    expect(dag.get('t-1')!.dependents).toContain('t-2');
    expect(dag.get('t-1')!.dependents).toContain('t-3');
  });
});

describe('dag — topologicalSort', () => {
  it('should sort tasks in dependency order', () => {
    const tasks = [makeTask('t-3', ['t-2']), makeTask('t-2', ['t-1']), makeTask('t-1')];
    const dag = buildDag(tasks);
    const sorted = topologicalSort(dag);

    expect(sorted.indexOf('t-1')).toBeLessThan(sorted.indexOf('t-2'));
    expect(sorted.indexOf('t-2')).toBeLessThan(sorted.indexOf('t-3'));
  });

  it('should handle independent tasks', () => {
    const tasks = [makeTask('t-1'), makeTask('t-2'), makeTask('t-3')];
    const dag = buildDag(tasks);
    const sorted = topologicalSort(dag);

    expect(sorted.length).toBe(3);
  });

  it('should detect circular dependencies', () => {
    const tasks = [makeTask('t-1', ['t-2']), makeTask('t-2', ['t-1'])];
    const dag = buildDag(tasks);

    expect(() => topologicalSort(dag)).toThrow('Circular dependency');
  });
});

describe('dag — getReadyTasks', () => {
  it('should return tasks with no unmet dependencies', () => {
    const tasks = [makeTask('t-1'), makeTask('t-2', ['t-1']), makeTask('t-3')];
    const dag = buildDag(tasks);

    const ready = getReadyTasks(dag, new Set(), new Set(), new Set(), new Set());

    expect(ready).toContain('t-1');
    expect(ready).toContain('t-3');
    expect(ready).not.toContain('t-2');
  });

  it('should return newly ready tasks after completion', () => {
    const tasks = [makeTask('t-1'), makeTask('t-2', ['t-1'])];
    const dag = buildDag(tasks);

    const ready = getReadyTasks(dag, new Set(['t-1']), new Set(), new Set(), new Set());

    expect(ready).toContain('t-2');
  });

  it('should not include running or completed tasks', () => {
    const tasks = [makeTask('t-1'), makeTask('t-2')];
    const dag = buildDag(tasks);

    const ready = getReadyTasks(dag, new Set(['t-1']), new Set(['t-2']), new Set(), new Set());

    expect(ready).toEqual([]);
  });

  it('should block tasks whose deps failed', () => {
    const tasks = [makeTask('t-1'), makeTask('t-2', ['t-1'])];
    const dag = buildDag(tasks);
    const blocked = new Set<string>();

    const ready = getReadyTasks(dag, new Set(), new Set(), new Set(['t-1']), blocked);

    expect(ready).toEqual([]);
    expect(blocked.has('t-2')).toBe(true);
  });
});
