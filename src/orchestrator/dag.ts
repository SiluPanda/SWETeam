import type { TaskRecord } from './task-runner.js';

export interface DagNode {
  id: string;
  dependsOn: string[];
  dependents: string[];
}

export function buildDag(tasks: TaskRecord[]): Map<string, DagNode> {
  const dag = new Map<string, DagNode>();

  for (const task of tasks) {
    dag.set(task.id, {
      id: task.id,
      dependsOn: task.dependsOn ? JSON.parse(task.dependsOn) : [],
      dependents: [],
    });
  }

  // Build reverse edges (dependents)
  for (const [, node] of dag) {
    for (const depId of node.dependsOn) {
      const depNode = dag.get(depId);
      if (depNode) {
        depNode.dependents.push(node.id);
      }
    }
  }

  return dag;
}

export function topologicalSort(dag: Map<string, DagNode>): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(id: string): void {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      throw new Error(`Circular dependency detected involving task: ${id}`);
    }

    visiting.add(id);
    const node = dag.get(id);
    if (node) {
      for (const depId of node.dependsOn) {
        visit(depId);
      }
    }
    visiting.delete(id);
    visited.add(id);
    sorted.push(id);
  }

  for (const [id] of dag) {
    visit(id);
  }

  return sorted;
}

export function getReadyTasks(
  dag: Map<string, DagNode>,
  completedIds: Set<string>,
  runningIds: Set<string>,
  failedIds: Set<string>,
  blockedIds: Set<string>,
): string[] {
  const ready: string[] = [];

  for (const [id, node] of dag) {
    if (completedIds.has(id)) continue;
    if (runningIds.has(id)) continue;
    if (failedIds.has(id)) continue;
    if (blockedIds.has(id)) continue;

    const allDepsMet = node.dependsOn.every((depId) => completedIds.has(depId));
    const anyDepFailed = node.dependsOn.some(
      (depId) => failedIds.has(depId) || blockedIds.has(depId),
    );

    if (anyDepFailed) {
      blockedIds.add(id);
      continue;
    }

    if (allDepsMet) {
      ready.push(id);
    }
  }

  return ready;
}
