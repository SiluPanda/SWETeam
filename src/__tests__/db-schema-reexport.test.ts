import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { resolve } from "path";

describe("db/schema.ts re-export", () => {
  it("should exist at db/schema.ts", () => {
    const schemaPath = resolve(import.meta.dirname, "../../db/schema.ts");
    expect(existsSync(schemaPath)).toBe(true);
  });

  it("should re-export all tables from src/db/schema", async () => {
    const reExport = await import("../../db/schema.js");
    const original = await import("../db/schema.js");
    expect(reExport.sessions).toBe(original.sessions);
    expect(reExport.messages).toBe(original.messages);
    expect(reExport.tasks).toBe(original.tasks);
    expect(reExport.iterations).toBe(original.iterations);
  });
});
