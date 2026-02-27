import { eq, inArray } from "drizzle-orm";
import crypto from "node:crypto";
import { initDb, type AppDatabase } from "./db/index.js";
import { repos, workflowRuns, subtasks, TaskStatus, WorkflowStep } from "./db/schema.js";

export interface PlanTask {
  id: string;
  title: string;
  description: string;
  dependencies: string[];
  files: string[];
}

export class StateManager {
  private static instance: StateManager;
  private db: AppDatabase;

  constructor(db: AppDatabase) {
    this.db = db;
  }

  static init(dbPath: string): StateManager {
    StateManager.instance = new StateManager(initDb(dbPath));
    return StateManager.instance;
  }

  static getInstance(): StateManager {
    if (!StateManager.instance) throw new Error("StateManager not initialized. Call StateManager.init() first.");
    return StateManager.instance;
  }

  getOrCreateRepo(name: string, repoPath = "", url = "", repoSpec = "", defaultBranch = "main") {
    const existing = this.db.select().from(repos).where(eq(repos.name, name)).get();
    if (existing) return existing;
    this.db.insert(repos).values({ name, path: repoPath, url, repoSpec, defaultBranch }).run();
    return this.db.select().from(repos).where(eq(repos.name, name)).get()!;
  }

  getRepoById(id: number) {
    return this.db.select().from(repos).where(eq(repos.id, id)).get();
  }

  createWorkflowRun(repoId: number, request: string, chatId: string) {
    const externalId = crypto.randomUUID().slice(0, 8);
    this.db.insert(workflowRuns).values({
      externalId,
      repoId,
      userRequest: request,
      chatId,
      status: TaskStatus.PENDING,
      workflowStep: WorkflowStep.QUEUED,
    }).run();
    return this.db.select().from(workflowRuns).where(eq(workflowRuns.externalId, externalId)).get()!;
  }

  advanceWorkflow(runId: number, step: WorkflowStep, updates: Record<string, unknown> = {}) {
    let status: string | undefined;
    if (step === WorkflowStep.COMPLETED) status = TaskStatus.COMPLETED;
    else if (step === WorkflowStep.FAILED) status = TaskStatus.FAILED;
    else status = TaskStatus.IN_PROGRESS;

    this.db.update(workflowRuns)
      .set({ workflowStep: step, status, updatedAt: new Date().toISOString(), ...updates })
      .where(eq(workflowRuns.id, runId))
      .run();
  }

  getWorkflowRun(runId: number) {
    return this.db.select().from(workflowRuns).where(eq(workflowRuns.id, runId)).get();
  }

  getActiveRuns() {
    return this.db.select().from(workflowRuns)
      .where(inArray(workflowRuns.status, [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]))
      .all();
  }

  getIncompleteRuns() {
    return this.db.select().from(workflowRuns)
      .where(eq(workflowRuns.status, TaskStatus.IN_PROGRESS))
      .all();
  }

  cancelRun(runId: number) {
    this.db.update(workflowRuns)
      .set({ status: TaskStatus.CANCELLED, updatedAt: new Date().toISOString() })
      .where(eq(workflowRuns.id, runId))
      .run();
  }

  createSubtasks(runId: number, tasks: PlanTask[]) {
    // Delete existing subtasks for idempotency
    this.db.delete(subtasks).where(eq(subtasks.workflowRunId, runId)).run();
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i]!;
      this.db.insert(subtasks).values({
        externalId: t.id,
        workflowRunId: runId,
        description: t.description,
        filesToModify: JSON.stringify(t.files),
        dependsOn: JSON.stringify(t.dependencies),
        orderIndex: i,
        status: TaskStatus.PENDING,
      }).run();
    }
  }

  updateSubtask(id: number, updates: Record<string, unknown>) {
    this.db.update(subtasks).set(updates).where(eq(subtasks.id, id)).run();
  }

  getSubtasks(runId: number) {
    return this.db.select().from(subtasks)
      .where(eq(subtasks.workflowRunId, runId))
      .orderBy(subtasks.orderIndex)
      .all();
  }
}
