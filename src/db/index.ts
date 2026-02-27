import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema.js";

export function initDb(dbPath: string) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");

  // Create tables if not exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      path TEXT DEFAULT '',
      url TEXT DEFAULT '',
      repo_spec TEXT DEFAULT '',
      default_branch TEXT DEFAULT 'main',
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT NOT NULL,
      repo_id INTEGER NOT NULL REFERENCES repos(id),
      user_request TEXT DEFAULT '',
      chat_id TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      workflow_step TEXT DEFAULT 'queued',
      working_branch TEXT DEFAULT '',
      base_branch TEXT DEFAULT 'main',
      workspace_path TEXT DEFAULT '',
      plan_json TEXT DEFAULT '',
      current_subtask_index INTEGER DEFAULT 0,
      current_parallel_group INTEGER DEFAULT 0,
      agent_count INTEGER DEFAULT 0,
      error_message TEXT DEFAULT '',
      clarification_log TEXT DEFAULT '[]',
      pr_url TEXT DEFAULT '',
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT NOT NULL,
      workflow_run_id INTEGER NOT NULL REFERENCES workflow_runs(id),
      description TEXT DEFAULT '',
      files_to_modify TEXT DEFAULT '[]',
      depends_on TEXT DEFAULT '[]',
      order_index INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      assigned_agent TEXT DEFAULT '',
      retry_count INTEGER DEFAULT 0,
      error_message TEXT DEFAULT '',
      created_at TEXT
    );
  `);

  return drizzle(sqlite, { schema });
}

export type AppDatabase = ReturnType<typeof initDb>;
