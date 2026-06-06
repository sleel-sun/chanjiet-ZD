import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildIndexFromExtractDir, validateIndexStats } from "../../src/parser/build-index.js";
import { DictionaryError } from "../../src/shared/errors.js";

const databaseHtml = `
<html><head><title>UFTData</title></head><body>
<table class="projectnametable"><tr><td></td><td>UFTData</td><td></td></tr></table>
<h4>Database Summarize</h4>
<table><tr><td>Table Count</td><td>1</td></tr><tr><td>View Count</td><td>1</td></tr><tr><td>Procedure Count</td><td>1</td></tr><tr><td>Function Count</td><td>1</td></tr></table>
</body></html>`;

const tableHtml = `
<html><head><title>AA_BrandIndustry Table</title></head><body>
<table class="projectnametable"><tr><td></td><td>UFTData</td><td></td></tr></table>
<h1>AA_BrandIndustry Table (AA 基础设置) [T+17.0]</h1>
<h4>Columns</h4><table><tr><th>&nbsp;</th><th>Column Name</th><th>Description</th><th>Datatype</th><th>Length</th><th>Allow Nulls</th></tr>
<tr><td></td><td>Updated (T+17.0)</td><td>更新时间</td><td>datetime</td><td>8</td><td>True</td></tr></table>
</body></html>`;

const viewHtml = `
<html><head><title>V_Test View</title></head><body>
<table class="projectnametable"><tr><td></td><td>UFTData</td><td></td></tr></table>
<h1>V_Test View (ST 库存核算) [T+12.2]</h1>
<h4>Columns</h4><table><tr><th>Column Name</th><th>Description</th><th>Datatype</th><th>Length</th></tr>
<tr><td>voucherID (T+12.2)</td><td>单据ID</td><td>int</td><td>4</td></tr></table>
</body></html>`;

const procedureHtml = `
<html><head><title>usp_update_state Stored Procedure</title></head><body>
<table class="projectnametable"><tr><td></td><td>UFTData</td><td></td></tr></table>
<h1>usp_update_state Stored Procedure [T+12.2]</h1>
<h4>Parameters</h4><table><tr><th>Parameter</th><th>Description</th><th>Datatype</th><th>Length</th><th>Allow Nulls</th></tr>
<tr><td>@id (T+12.2)</td><td></td><td>int</td><td>4</td><td><img src=images/tick.png></td></tr></table>
</body></html>`;

const functionHtml = `
<html><head><title>AA_FN_CalcuGPSDistance Function</title></head><body>
<table class="projectnametable"><tr><td></td><td>UFTData</td><td></td></tr></table>
<h1>AA_FN_CalcuGPSDistance Function [T+170]</h1>
<h4>Parameters</h4><table><tr><th>Parameter</th><th>Description</th><th>Datatype</th><th>Length</th><th>Allow Nulls</th></tr>
<tr><td>@lonlat1 (T+170)</td><td></td><td>nvarchar</td><td>200</td><td><img src=images/tick.png></td></tr></table>
</body></html>`;

describe("buildIndexFromExtractDir", () => {
  it("builds a schema index from extracted HTML files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tplus-index-"));
    try {
      await writeFile(join(dir, "database.html"), databaseHtml);
      await writeFile(join(dir, "table.html"), tableHtml);
      await writeFile(join(dir, "view.html"), viewHtml);
      await writeFile(join(dir, "procedure.html"), procedureHtml);
      await writeFile(join(dir, "function.html"), functionHtml);

      const index = await buildIndexFromExtractDir({
        chmFile: "T+19.0数据字典.chm",
        extractDir: dir,
      });

      expect(index.stats).toEqual({
        databases: 1,
        tables: 1,
        views: 1,
        procedures: 1,
        functions: 1,
      });
      expect(index.objects.map((object) => object.name).sort()).toEqual([
        "AA_BrandIndustry",
        "AA_FN_CalcuGPSDistance",
        "V_Test",
        "usp_update_state",
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("throws a structured validation error for count mismatch", () => {
    const error = () =>
      validateIndexStats(
        { databases: 1, tables: 1, views: 0, procedures: 0, functions: 0 },
        { databases: 1, tables: 2, views: 0, procedures: 0, functions: 0 },
      );

    expect(error).toThrow(DictionaryError);
    expect(error).toThrow("Schema count validation failed");
  });
});
