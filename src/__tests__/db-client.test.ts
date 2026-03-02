import { describe, it, expect, afterEach } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.js";
import { getDb, closeDb } from "../db/client.js";

describe("db/client", () => {
  const tempDirs: string[] = [];

  function createTestDb() {
    const dir = mkdtempSync(join(tmpdir(), "sweteam-test-"));
    tempDirs.push(dir);
    const dbPath = join(dir, "test.db");
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    const db = drizzle(sqlite, { schema });
    return { db, sqlite, dbPath, dir };
  }

  afterEach(() => {
    closeDb();
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("should create a SQLite database file", () => {
    const { dbPath, sqlite } = createTestDb();
    expect(existsSync(dbPath)).toBe(true);
    sqlite.close();
  });

  it("should set WAL journal mode", () => {
    const { sqlite } = createTestDb();
    const mode = sqlite.pragma("journal_mode", { simple: true });
    expect(mode).toBe("wal");
    sqlite.close();
  });

  it("should enable foreign keys", () => {
    const { sqlite } = createTestDb();
    const fk = sqlite.pragma("foreign_keys", { simple: true });
    expect(fk).toBe(1);
    sqlite.close();
  });

  it("should create a working Drizzle instance", () => {
    const { db, sqlite } = createTestDb();
    expect(db).toBeDefined();
    expect(typeof db.select).toBe("function");
    sqlite.close();
  });

  it("should be closeable without error", () => {
    const { sqlite } = createTestDb();
    expect(() => sqlite.close()).not.toThrow();
  });

  it("should auto-run migrations on getDb()", () => {
    const dir = mkdtempSync(join(tmpdir(), "sweteam-test-"));
    tempDirs.push(dir);
    const dbPath = join(dir, "test.db");
    const db = getDb(dbPath);

    // Verify tables were created by migrations
    const now = new Date();
    db.insert(schema.sessions).values({
      id: "s_test123",
      repo: "test/repo",
      goal: "test goal",
      status: "planning",
      createdAt: now,
      updatedAt: now,
    }).run();

    const rows = db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, "s_test123"))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0].repo).toBe("test/repo");
  });

  it("should not re-run already applied migrations", () => {
    const dir = mkdtempSync(join(tmpdir(), "sweteam-test-"));
    tempDirs.push(dir);
    const dbPath = join(dir, "test.db");

    // First connection runs migrations
    const db1 = getDb(dbPath);
    const now = new Date();
    db1.insert(schema.sessions).values({
      id: "s_persist",
      repo: "test/repo",
      goal: "persist test",
      status: "planning",
      createdAt: now,
      updatedAt: now,
    }).run();
    closeDb();

    // Second connection should not fail or duplicate
    const db2 = getDb(dbPath);
    const rows = db2
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, "s_persist"))
      .all();
    expect(rows).toHaveLength(1);
  });
});
