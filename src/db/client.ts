import { mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

const SWETEAM_DIR = join(homedir(), ".sweteam");
const DB_PATH = join(SWETEAM_DIR, "sweteam.db");

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function createConnection(dbPath: string = DB_PATH): Database.Database {
  ensureDir(SWETEAM_DIR);
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database.Database | null = null;

export function getDb(dbPath?: string) {
  if (!_db) {
    _sqlite = createConnection(dbPath);
    _db = drizzle(_sqlite, { schema });
  }
  return _db;
}

export function closeDb(): void {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    _db = null;
  }
}

export { SWETEAM_DIR, DB_PATH };
