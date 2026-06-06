import { describe, expect, it } from "vitest";
import { createToolHandlers, jsonToolResult } from "../../src/mcp/tool-handlers.js";
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
  objects: [
    {
      id: "UFTData.table.AA_BrandIndustry",
      database: "UFTData",
      type: "table",
      name: "AA_BrandIndustry",
      displayName: "AA_BrandIndustry",
      sourceFile: "aa.html",
      columns: [{ name: "Updated", description: "更新时间", dataType: "datetime", length: "8", allowNulls: true }],
    },
  ],
};

describe("tool handlers", () => {
  it("formats JSON MCP tool results", () => {
    expect(jsonToolResult({ ok: true })).toEqual({
      content: [{ type: "text", text: "{\n  \"ok\": true\n}" }],
    });
  });

  it("returns object lookup results", async () => {
    const handlers = createToolHandlers(index);
    const result = await handlers.getObject({ name: "AA_BrandIndustry" });
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      name: "AA_BrandIndustry",
      columns: [{ name: "Updated", description: "更新时间" }],
    });
  });

  it("returns structured errors instead of throwing", async () => {
    const handlers = createToolHandlers(index);
    const result = await handlers.getObject({ name: "Missing" });
    expect(JSON.parse(result.content[0].text)).toEqual({
      ok: false,
      error: {
        code: "OBJECT_NOT_FOUND",
        message: "Object not found",
        details: { name: "Missing" },
      },
    });
  });
});
