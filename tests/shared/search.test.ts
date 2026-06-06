import { describe, expect, it } from "vitest";
import { DictionaryError } from "../../src/shared/errors.js";
import { findObject, getDatabaseSummary, listObjects, readRawHtml, searchObjects } from "../../src/shared/search.js";
import type { SchemaIndex } from "../../src/shared/types.js";

const index: SchemaIndex = {
  generatedAt: "2026-06-06T00:00:00.000Z",
  source: { chmFile: "T+19.0数据字典.chm", extractDir: "chm_extract" },
  stats: { databases: 2, tables: 1, views: 1, procedures: 1, functions: 2 },
  databases: [
    {
      id: "UFTData",
      name: "UFTData",
      tableCount: 1,
      viewCount: 1,
      procedureCount: 1,
      functionCount: 1,
      sourceFile: "uftdata.html",
    },
    {
      id: "UFTSystem",
      name: "UFTSystem",
      tableCount: 0,
      viewCount: 0,
      procedureCount: 0,
      functionCount: 1,
      sourceFile: "uftsystem.html",
    },
  ],
  objects: [
    {
      id: "UFTData.table.AA_BrandIndustry",
      database: "UFTData",
      type: "table",
      name: "AA_BrandIndustry",
      displayName: "AA_BrandIndustry",
      module: "AA 基础设置",
      version: "T+17.0",
      sourceFile: "aa.html",
      columns: [
        {
          name: "Updated",
          description: "更新时间",
          dataType: "datetime",
          length: "8",
          allowNulls: true,
          version: "T+17.0",
        },
      ],
    },
    {
      id: "UFTData.view.V_Test",
      database: "UFTData",
      type: "view",
      name: "V_Test",
      displayName: "V_Test",
      summary: "库存视图",
      sourceFile: "view.html",
      columns: [{ name: "voucherID", description: "单据ID", dataType: "int", length: "4" }],
    },
    {
      id: "UFTData.procedure.usp_update_state",
      database: "UFTData",
      type: "procedure",
      name: "usp_update_state",
      displayName: "usp_update_state",
      sourceFile: "procedure.html",
      parameters: [{ name: "@id", dataType: "int", length: "4", allowNulls: true }],
    },
    {
      id: "UFTData.function.getdate",
      database: "UFTData",
      type: "function",
      name: "getdate",
      displayName: "getdate",
      sourceFile: "getdate-data.html",
      parameters: [],
    },
    {
      id: "UFTSystem.function.getdate",
      database: "UFTSystem",
      type: "function",
      name: "getdate",
      displayName: "getdate",
      sourceFile: "getdate-system.html",
      parameters: [],
    },
  ],
};

describe("search helpers", () => {
  it("returns global and per-database summaries", () => {
    expect(getDatabaseSummary(index)).toEqual(index.stats);
    expect(getDatabaseSummary(index, "UFTData")).toMatchObject({
      name: "UFTData",
      tableCount: 1,
      viewCount: 1,
    });
  });

  it("lists objects with type filtering and pagination", () => {
    expect(listObjects(index, { type: "function", limit: 1, offset: 1 })).toMatchObject({
      total: 2,
      limit: 1,
      offset: 1,
      items: [{ name: "getdate", database: "UFTSystem" }],
    });
  });

  it("searches object names, modules, and Chinese descriptions", () => {
    expect(searchObjects(index, { query: "基础", limit: 10 }).items[0].name).toBe("AA_BrandIndustry");
    expect(searchObjects(index, { query: "更新时间", limit: 10 }).items[0].name).toBe("AA_BrandIndustry");
    expect(searchObjects(index, { query: "voucher", limit: 10 }).items[0].name).toBe("V_Test");
  });

  it("finds by id or constrained object name", () => {
    expect(findObject(index, { id: "UFTData.table.AA_BrandIndustry" }).name).toBe("AA_BrandIndustry");
    expect(findObject(index, { name: "getdate", database: "UFTSystem" }).database).toBe("UFTSystem");
  });

  it("throws for ambiguous object names", () => {
    expect(() => findObject(index, { name: "getdate" })).toThrow(DictionaryError);
  });

  it("rejects raw HTML source paths outside the extraction directory", async () => {
    await expect(readRawHtml(index, { sourceFile: "../package.json" })).rejects.toMatchObject({
      code: "INVALID_SOURCE_FILE",
    });
  });
});
