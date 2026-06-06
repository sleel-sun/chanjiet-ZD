import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadIndex } from "../../src/mcp/server.js";
import type { SchemaIndex } from "../../src/shared/types.js";

const index: SchemaIndex = {
  generatedAt: "2026-06-06T00:00:00.000Z",
  source: { chmFile: "T+19.0数据字典.chm", extractDir: "chm_extract" },
  stats: { databases: 1, tables: 1, views: 0, procedures: 0, functions: 0 },
  databases: [
    {
      id: "UFTData",
      name: "UFTData",
      tableCount: 1,
      viewCount: 0,
      procedureCount: 0,
      functionCount: 0,
      sourceFile: "database.html",
    },
  ],
  objects: [],
};

describe("MCP server helpers", () => {
  it("loads schema index JSON from disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tplus-server-"));
    const indexFile = join(dir, "schema-index.json");
    try {
      await writeFile(indexFile, `${JSON.stringify(index)}\n`, "utf8");
      await expect(loadIndex(indexFile)).resolves.toEqual(index);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
