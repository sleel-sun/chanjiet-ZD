import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";
import { decodeHtml, parseHtmlPage } from "../../src/parser/parse-html.js";

const tableHtml = `
<html><head><title>AA_BrandIndustry Table</title></head>
<body>
<table class="projectnametable"><tr><td></td><td>UFTData</td><td></td></tr></table>
<H1 class="dxH1">AA_BrandIndustry Table &nbsp;(AA 基础设置)&nbsp;[T+17.0]</H1>
<h4 class=dxh4>Columns</h4>
<table class="columnlisttable">
<tr><th>&nbsp;</th><th>Column Name</th><th>Description</th><th>Datatype</th><th>Length</th><th>Allow Nulls</th></tr>
<tr><td>&nbsp;</td><td><strong>Updated (T+17.0)</strong></td><td>更新时间&nbsp;</td><td>datetime</td><td>8&nbsp;</td><td>True&nbsp;</td></tr>
<tr><td>&nbsp;</td><td><strong>id (T+17.0)</strong></td><td>id&nbsp;</td><td>int</td><td>4&nbsp;</td><td>False&nbsp;</td></tr>
</table>
</body></html>`;

const viewHtml = `
<html><head><title>V_ST_SubsidiaryBook_VoucherQuery View</title></head>
<body>
<table class="projectnametable"><tr><td></td><td>UFTData</td><td></td></tr></table>
<H1 class="dxH1">V_ST_SubsidiaryBook_VoucherQuery View &nbsp;(ST 库存核算)&nbsp;[T+12.2]</H1>
<h4 class=dxh4>Summary</h4><p>红蓝回冲单，单据查凭证</p>
<h4 class=dxh4>Remark</h4><p>字段明细同ST_SubsidiaryBook</p>
<h4 class=dxh4>Columns</h4>
<table class="FilteredItemListTable">
<tr><th>Column Name</th><th>Description</th><th>Datatype</th><th>Length</th></tr>
<tr><td>individualID (T+12.2)</td><td>出库对应的入库明细ID&nbsp;</td><td>int&nbsp;</td><td>4&nbsp;</td></tr>
</table>
</body></html>`;

const procedureHtml = `
<html><head><title>usp_update_state Stored Procedure</title></head>
<body>
<table class="projectnametable"><tr><td></td><td>UFTData</td><td></td></tr></table>
<H1 class="dxH1">usp_update_state Stored Procedure &nbsp;[T+12.2]</H1>
<h4 class=dxh4>Parameters</h4>
<table class="FilteredItemListTable">
<tr><th>Parameter</th><th>Description</th><th>Datatype</th><th>Length</th><th>Allow Nulls</th></tr>
<tr><td>@doc_type_seq_factor (T+170)</td><td>&nbsp;</td><td>bigint&nbsp;</td><td>8&nbsp;</td><td><img src=images/tick.png>&nbsp;</td></tr>
</table>
</body></html>`;

const databaseHtml = `
<html><head><title>UFTData</title></head>
<body>
<table class="projectnametable"><tr><td></td><td>UFTData</td><td></td></tr></table>
<H1 class="dxH1">UFTData</H1>
<h4 class=dxh4>Database Summarize</h4>
<table class="FilteredItemListTable">
<tr><td>Table Count</td><td>1766</td></tr>
<tr><td>View Count</td><td>130</td></tr>
<tr><td>Procedure Count</td><td>818</td></tr>
<tr><td>Function Count</td><td>79</td></tr>
</table>
</body></html>`;

describe("parseHtmlPage", () => {
  it("decodes GBK HTML to UTF-8 text", () => {
    const gbk = iconv.encode("更新时间", "gbk");
    expect(decodeHtml(gbk)).toBe("更新时间");
  });

  it("parses table columns with Chinese descriptions and nullability", () => {
    const result = parseHtmlPage(tableHtml, "AA_BrandIndustry.html");
    expect(result.kind).toBe("object");
    if (result.kind !== "object") throw new Error("Expected object");

    expect(result.object).toMatchObject({
      database: "UFTData",
      type: "table",
      name: "AA_BrandIndustry",
      module: "AA 基础设置",
      version: "T+17.0",
    });
    expect(result.object.columns).toEqual([
      {
        name: "Updated",
        description: "更新时间",
        dataType: "datetime",
        length: "8",
        allowNulls: true,
        version: "T+17.0",
      },
      {
        name: "id",
        description: "id",
        dataType: "int",
        length: "4",
        allowNulls: false,
        version: "T+17.0",
      },
    ]);
  });

  it("parses view summary, remark, and columns without allowNulls", () => {
    const result = parseHtmlPage(viewHtml, "view.html");
    expect(result.kind).toBe("object");
    if (result.kind !== "object") throw new Error("Expected object");

    expect(result.object.summary).toBe("红蓝回冲单，单据查凭证");
    expect(result.object.remark).toBe("字段明细同ST_SubsidiaryBook");
    expect(result.object.columns?.[0]).toEqual({
      name: "individualID",
      description: "出库对应的入库明细ID",
      dataType: "int",
      length: "4",
      version: "T+12.2",
    });
  });

  it("parses procedure parameters", () => {
    const result = parseHtmlPage(procedureHtml, "procedure.html");
    expect(result.kind).toBe("object");
    if (result.kind !== "object") throw new Error("Expected object");

    expect(result.object.type).toBe("procedure");
    expect(result.object.parameters).toEqual([
      {
        name: "@doc_type_seq_factor",
        dataType: "bigint",
        length: "8",
        allowNulls: true,
        version: "T+170",
      },
    ]);
  });

  it("parses database summary pages", () => {
    const result = parseHtmlPage(databaseHtml, "uftdata.html");
    expect(result.kind).toBe("database");
    if (result.kind !== "database") throw new Error("Expected database");

    expect(result.database).toEqual({
      id: "UFTData",
      name: "UFTData",
      tableCount: 1766,
      viewCount: 130,
      procedureCount: 818,
      functionCount: 79,
      sourceFile: "uftdata.html",
    });
  });
});
