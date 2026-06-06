# T+ Dictionary MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a generic read-only `stdio` MCP service for the full T+ 19.0 database dictionary.

**Architecture:** Parse the extracted CHM HTML into a UTF-8 JSON schema index, then serve that index through pure query functions and MCP tool/resource adapters. Runtime stays local and read-only; the MCP server never connects to SQL Server or executes SQL.

**Tech Stack:** Node.js, TypeScript, `@modelcontextprotocol/sdk`, `cheerio`, `iconv-lite`, `zod`, Vitest.

---

## Scope Check

The approved spec covers one subsystem: a local MCP service backed by a generated schema index. It can be implemented as one plan because parser, query layer, and MCP adapter are sequential dependencies of one deliverable.

## File Structure

- Create `package.json`: package metadata, scripts, runtime dependencies, dev dependencies.
- Create `tsconfig.json`: strict ESM TypeScript build config.
- Create `vitest.config.ts`: unit test config.
- Modify `.gitignore`: ignore generated build output and extracted CHM directory; keep `data/schema-index.json` trackable.
- Modify `README.md`: usage, build, index generation, and MCP client config.
- Create `src/shared/types.ts`: dictionary data model and tool input/output types.
- Create `src/shared/errors.ts`: structured `DictionaryError` class and error helpers.
- Create `src/parser/parse-html.ts`: GBK decoding helpers and single-page HTML parser.
- Create `src/parser/extract.ts`: CHM extraction helper using `extract_chmLib`.
- Create `src/parser/build-index.ts`: CLI to parse all HTML files, validate counts, and write `data/schema-index.json`.
- Create `src/shared/search.ts`: in-memory filtering, searching, lookup, pagination, and raw source resolution.
- Create `src/mcp/tool-handlers.ts`: pure functions backing MCP tools.
- Create `src/mcp/server.ts`: stdio MCP server registration for tools and resources.
- Create `tests/parser/parse-html.test.ts`: parser fixtures and sample object tests.
- Create `tests/parser/build-index.test.ts`: temporary directory index build tests.
- Create `tests/shared/search.test.ts`: lookup/search/pagination/ambiguity tests.
- Create `tests/mcp/tool-handlers.test.ts`: tool handler tests without starting stdio.

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create package manifest**

Replace `package.json` with:

```json
{
  "name": "chanjiet-zd",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "T+ 19.0 database dictionary MCP service",
  "bin": {
    "tplus-dictionary-mcp": "dist/mcp/server.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "build:index": "tsx src/parser/build-index.ts",
    "test": "vitest run",
    "start": "node dist/mcp/server.js",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.13.0",
    "cheerio": "^1.0.0",
    "iconv-lite": "^0.6.3",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.8.0",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"],
  "exclude": ["dist", "node_modules", "chm_extract"]
}
```

- [ ] **Step 3: Create Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Update ignore rules**

Ensure `.gitignore` contains exactly:

```gitignore
.DS_Store
node_modules/
dist/
chm_extract/
```

- [ ] **Step 5: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and install exits with code 0.

- [ ] **Step 6: Verify scaffold**

Run:

```bash
npm run typecheck
```

Expected: TypeScript exits with code 0 because there are no source files yet.

- [ ] **Step 7: Commit scaffold**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore
git commit -m "chore: scaffold TypeScript project"
```

## Task 2: Shared Types And Structured Errors

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/errors.ts`
- Test: `tests/shared/errors.test.ts`

- [ ] **Step 1: Write failing structured error test**

Create `tests/shared/errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DictionaryError, toErrorResponse } from "../../src/shared/errors.js";

describe("DictionaryError", () => {
  it("serializes a structured error response", () => {
    const error = new DictionaryError("OBJECT_NOT_FOUND", "Object not found", {
      name: "MissingTable",
    });

    expect(toErrorResponse(error)).toEqual({
      ok: false,
      error: {
        code: "OBJECT_NOT_FOUND",
        message: "Object not found",
        details: { name: "MissingTable" },
      },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/shared/errors.test.ts
```

Expected: FAIL with an import resolution error for `src/shared/errors.js`.

- [ ] **Step 3: Create shared types**

Create `src/shared/types.ts`:

```ts
export type ObjectType = "table" | "view" | "procedure" | "function";

export type SourceInfo = {
  chmFile: string;
  extractDir: string;
};

export type SchemaStats = {
  databases: number;
  tables: number;
  views: number;
  procedures: number;
  functions: number;
};

export type DatabaseInfo = {
  id: string;
  name: string;
  tableCount: number;
  viewCount: number;
  procedureCount: number;
  functionCount: number;
  sourceFile: string;
};

export type ColumnInfo = {
  name: string;
  description?: string;
  dataType?: string;
  length?: string;
  allowNulls?: boolean;
  version?: string;
};

export type ParameterInfo = {
  name: string;
  description?: string;
  dataType?: string;
  length?: string;
  allowNulls?: boolean;
  version?: string;
};

export type SchemaObject = {
  id: string;
  database: string;
  type: ObjectType;
  name: string;
  displayName: string;
  module?: string;
  summary?: string;
  remark?: string;
  version?: string;
  sourceFile: string;
  columns?: ColumnInfo[];
  parameters?: ParameterInfo[];
};

export type SchemaIndex = {
  generatedAt: string;
  source: SourceInfo;
  stats: SchemaStats;
  databases: DatabaseInfo[];
  objects: SchemaObject[];
};

export type PaginationInput = {
  limit?: number;
  offset?: number;
};

export type ObjectFilter = PaginationInput & {
  database?: string;
  type?: ObjectType;
  prefix?: string;
};

export type SearchInput = PaginationInput & {
  query: string;
  database?: string;
  type?: ObjectType;
};

export type ObjectLookupInput = {
  id?: string;
  name?: string;
  database?: string;
  type?: ObjectType;
};

export type RawHtmlLookupInput = ObjectLookupInput & {
  sourceFile?: string;
};

export type Page<T> = {
  total: number;
  limit: number;
  offset: number;
  items: T[];
};

export type ErrorResponse = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

- [ ] **Step 4: Create structured error implementation**

Create `src/shared/errors.ts`:

```ts
import type { ErrorResponse } from "./types.js";

export class DictionaryError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "DictionaryError";
    this.code = code;
    this.details = details;
  }
}

export function toErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof DictionaryError) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }

  if (error instanceof Error) {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error.message,
      },
    };
  }

  return {
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Unknown error",
      details: error,
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
npm test -- tests/shared/errors.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit shared foundation**

```bash
git add src/shared/types.ts src/shared/errors.ts tests/shared/errors.test.ts
git commit -m "feat: add dictionary shared types"
```

## Task 3: Parse Single HTML Pages

**Files:**
- Create: `src/parser/parse-html.ts`
- Test: `tests/parser/parse-html.test.ts`

- [ ] **Step 1: Write failing parser tests**

Create `tests/parser/parse-html.test.ts`:

```ts
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
        description: undefined,
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
```

- [ ] **Step 2: Run parser tests to verify failure**

Run:

```bash
npm test -- tests/parser/parse-html.test.ts
```

Expected: FAIL with an import resolution error for `src/parser/parse-html.js`.

- [ ] **Step 3: Implement single-page parser**

Create `src/parser/parse-html.ts`:

```ts
import * as cheerio from "cheerio";
import iconv from "iconv-lite";
import type {
  ColumnInfo,
  DatabaseInfo,
  ObjectType,
  ParameterInfo,
  SchemaObject,
} from "../shared/types.js";

type CheerioSelection = ReturnType<cheerio.CheerioAPI>;

export type ParsedPage =
  | { kind: "database"; database: DatabaseInfo }
  | { kind: "object"; object: SchemaObject }
  | { kind: "skip"; sourceFile: string; reason: string };

type NameVersion = {
  name: string;
  version?: string;
};

const OBJECT_TITLE_SUFFIXES: Array<[ObjectType, string]> = [
  ["procedure", " Stored Procedure"],
  ["function", " Function"],
  ["table", " Table"],
  ["view", " View"],
];

export function decodeHtml(buffer: Buffer): string {
  return iconv.decode(buffer, "gb18030");
}

export function cleanText(value: string | undefined): string {
  return (value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseHtmlPage(html: string, sourceFile: string): ParsedPage {
  const $ = cheerio.load(html, { decodeEntities: true });
  const title = cleanText($("title").first().text());
  const heading = cleanText($("h1").first().text());
  const database = cleanText($(".projectnametable td").eq(1).text());

  const objectTitle = parseObjectTitle(title);
  if (objectTitle) {
    const module = extractModule(heading);
    const version = extractPageVersion(heading);
    const summary = readSectionText($, "Summary");
    const remark = readSectionText($, "Remark");
    const object: SchemaObject = {
      id: `${database}.${objectTitle.type}.${objectTitle.name}`,
      database,
      type: objectTitle.type,
      name: objectTitle.name,
      displayName: objectTitle.name,
      module,
      summary,
      remark,
      version,
      sourceFile,
    };

    if (objectTitle.type === "table" || objectTitle.type === "view") {
      object.columns = parseColumns($);
    } else {
      object.parameters = parseParameters($);
    }

    return { kind: "object", object: pruneUndefined(object) };
  }

  if (hasDatabaseSummary($)) {
    const name = title || heading || database;
    return {
      kind: "database",
      database: {
        id: name,
        name,
        tableCount: readSummaryCount($, "Table Count"),
        viewCount: readSummaryCount($, "View Count"),
        procedureCount: readSummaryCount($, "Procedure Count"),
        functionCount: readSummaryCount($, "Function Count"),
        sourceFile,
      },
    };
  }

  return { kind: "skip", sourceFile, reason: "No schema object or database summary found" };
}

function parseObjectTitle(title: string): { name: string; type: ObjectType } | undefined {
  for (const [type, suffix] of OBJECT_TITLE_SUFFIXES) {
    if (title.endsWith(suffix)) {
      return { type, name: title.slice(0, -suffix.length).trim() };
    }
  }

  return undefined;
}

function extractModule(heading: string): string | undefined {
  const match = heading.match(/\(([^()]*)\)/);
  return match?.[1] ? cleanText(match[1]) : undefined;
}

function extractPageVersion(heading: string): string | undefined {
  const match = heading.match(/\[([^\]]+)\]/);
  return match?.[1] ? cleanText(match[1]) : undefined;
}

function splitNameVersion(text: string): NameVersion {
  const versionMatch = text.match(/\((T\+[^)]*)\)/i);
  return {
    name: cleanText(text.replace(/\((T\+[^)]*)\)/gi, "")),
    version: versionMatch?.[1] ? cleanText(versionMatch[1]) : undefined,
  };
}

function readSectionText($: cheerio.CheerioAPI, sectionName: string): string | undefined {
  const heading = $("h4")
    .filter((_, element) => cleanText($(element).text()).toLowerCase() === sectionName.toLowerCase())
    .first();
  if (!heading.length) return undefined;

  const text = cleanText(heading.nextAll("p").first().text());
  return text || undefined;
}

function findSectionTable($: cheerio.CheerioAPI, sectionName: string): CheerioSelection {
  const heading = $("h4")
    .filter((_, element) => cleanText($(element).text()).toLowerCase() === sectionName.toLowerCase())
    .first();
  return heading.nextAll("table").first();
}

function parseColumns($: cheerio.CheerioAPI): ColumnInfo[] {
  const table = findSectionTable($, "Columns");
  return parseRows($, table).map((row) => {
    const shifted = row.headers[0] === "" ? row.cells.slice(1) : row.cells;
    const nameVersion = splitNameVersion(shifted[0]?.text ?? "");
    const allowNullsCell = shifted[4];
    return pruneUndefined({
      name: nameVersion.name,
      description: optionalText(shifted[1]?.text),
      dataType: optionalText(shifted[2]?.text),
      length: optionalText(shifted[3]?.text),
      allowNulls: allowNullsCell ? parseAllowNulls(allowNullsCell.text, allowNullsCell.hasImage) : undefined,
      version: nameVersion.version,
    });
  });
}

function parseParameters($: cheerio.CheerioAPI): ParameterInfo[] {
  const table = findSectionTable($, "Parameters");
  return parseRows($, table).map((row) => {
    const nameVersion = splitNameVersion(row.cells[0]?.text ?? "");
    const allowNullsCell = row.cells[4];
    return pruneUndefined({
      name: nameVersion.name,
      description: optionalText(row.cells[1]?.text),
      dataType: optionalText(row.cells[2]?.text),
      length: optionalText(row.cells[3]?.text),
      allowNulls: allowNullsCell ? parseAllowNulls(allowNullsCell.text, allowNullsCell.hasImage) : undefined,
      version: nameVersion.version,
    });
  });
}

function parseRows($: cheerio.CheerioAPI, table: CheerioSelection): Array<{
  headers: string[];
  cells: Array<{ text: string; hasImage: boolean }>;
}> {
  const headers = table
    .find("tr")
    .first()
    .find("th")
    .toArray()
    .map((element) => cleanText($(element).text()));

  return table
    .find("tr")
    .slice(1)
    .toArray()
    .map((row) => {
      const cells = $(row)
        .find("td")
        .toArray()
        .map((cell) => ({
          text: cleanText($(cell).text()),
          hasImage: $(cell).find("img").length > 0,
        }));
      return { headers, cells };
    })
    .filter((row) => row.cells.length > 0 && cleanText(row.cells.map((cell) => cell.text).join(" ")));
}

function parseAllowNulls(text: string, hasImage: boolean): boolean | undefined {
  const normalized = cleanText(text).toLowerCase();
  if (normalized === "true" || hasImage) return true;
  if (normalized === "false") return false;
  return undefined;
}

function optionalText(text: string | undefined): string | undefined {
  const cleaned = cleanText(text);
  return cleaned ? cleaned : undefined;
}

function hasDatabaseSummary($: cheerio.CheerioAPI): boolean {
  return $("h4")
    .toArray()
    .some((element) => cleanText($(element).text()).toLowerCase() === "database summarize");
}

function readSummaryCount($: cheerio.CheerioAPI, label: string): number {
  const row = $("td")
    .filter((_, element) => cleanText($(element).text()).toLowerCase() === label.toLowerCase())
    .first()
    .parent();
  const raw = cleanText(row.find("td").eq(1).text());
  return Number.parseInt(raw, 10) || 0;
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) {
      delete value[key];
    }
  }
  return value;
}
```

- [ ] **Step 4: Run parser tests**

Run:

```bash
npm test -- tests/parser/parse-html.test.ts
```

Expected: PASS.

- [ ] **Step 5: Typecheck parser**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit parser**

```bash
git add src/parser/parse-html.ts tests/parser/parse-html.test.ts
git commit -m "feat: parse dictionary HTML pages"
```

## Task 4: Build And Validate Schema Index

**Files:**
- Create: `src/parser/extract.ts`
- Create: `src/parser/build-index.ts`
- Test: `tests/parser/build-index.test.ts`

- [ ] **Step 1: Write failing index builder tests**

Create `tests/parser/build-index.test.ts`:

```ts
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
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

const viewHtml = tableHtml.replace("AA_BrandIndustry Table", "V_Test View").replace("AA_BrandIndustry", "V_Test");
const procedureHtml = `
<html><head><title>usp_update_state Stored Procedure</title></head><body>
<table class="projectnametable"><tr><td></td><td>UFTData</td><td></td></tr></table>
<h1>usp_update_state Stored Procedure [T+12.2]</h1>
<h4>Parameters</h4><table><tr><th>Parameter</th><th>Description</th><th>Datatype</th><th>Length</th><th>Allow Nulls</th></tr>
<tr><td>@id (T+12.2)</td><td></td><td>int</td><td>4</td><td><img src=images/tick.png></td></tr></table>
</body></html>`;
const functionHtml = procedureHtml.replace("usp_update_state Stored Procedure", "AA_FN_CalcuGPSDistance Function").replace("usp_update_state", "AA_FN_CalcuGPSDistance");

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
```

- [ ] **Step 2: Run index builder tests to verify failure**

Run:

```bash
npm test -- tests/parser/build-index.test.ts
```

Expected: FAIL with an import resolution error for `src/parser/build-index.js`.

- [ ] **Step 3: Implement CHM extraction helper**

Create `src/parser/extract.ts`:

```ts
import { access, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { spawn } from "node:child_process";
import { DictionaryError } from "../shared/errors.js";

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function ensureExtracted(chmFile: string, extractDir: string): Promise<void> {
  if (await pathExists(extractDir)) return;
  if (!(await pathExists(chmFile))) {
    throw new DictionaryError("SOURCE_CHM_MISSING", "Source CHM file is missing", { chmFile });
  }

  await mkdir(dirname(extractDir), { recursive: true });
  await runExtractChmLib(chmFile, extractDir);
}

async function runExtractChmLib(chmFile: string, extractDir: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("extract_chmLib", [chmFile, extractDir], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      reject(
        new DictionaryError("EXTRACT_TOOL_MISSING", "extract_chmLib is not available", {
          cause: error.message,
        }),
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new DictionaryError("CHM_EXTRACT_FAILED", "Failed to extract CHM file", {
          chmFile,
          extractDir,
          exitCode: code,
          stderr,
        }),
      );
    });
  });
}
```

- [ ] **Step 4: Implement index builder and CLI**

Create `src/parser/build-index.ts`:

```ts
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { DictionaryError } from "../shared/errors.js";
import type { SchemaIndex, SchemaStats } from "../shared/types.js";
import { ensureExtracted } from "./extract.js";
import { decodeHtml, parseHtmlPage } from "./parse-html.js";

export const EXPECTED_TPLUS_190_STATS: SchemaStats = {
  databases: 2,
  tables: 1766,
  views: 130,
  procedures: 818,
  functions: 80,
};

export type BuildIndexOptions = {
  chmFile: string;
  extractDir: string;
};

export async function buildIndexFromExtractDir(options: BuildIndexOptions): Promise<SchemaIndex> {
  const files = await listHtmlFiles(options.extractDir);
  const databases = [];
  const objects = [];

  for (const file of files) {
    const buffer = await readFile(file);
    const html = decodeHtml(buffer);
    const sourceFile = relative(options.extractDir, file) || basename(file);
    const parsed = parseHtmlPage(html, sourceFile);

    if (parsed.kind === "database") {
      databases.push(parsed.database);
    }
    if (parsed.kind === "object") {
      objects.push(parsed.object);
    }
  }

  const stats: SchemaStats = {
    databases: databases.length,
    tables: objects.filter((object) => object.type === "table").length,
    views: objects.filter((object) => object.type === "view").length,
    procedures: objects.filter((object) => object.type === "procedure").length,
    functions: objects.filter((object) => object.type === "function").length,
  };

  return {
    generatedAt: new Date().toISOString(),
    source: {
      chmFile: options.chmFile,
      extractDir: options.extractDir,
    },
    stats,
    databases: databases.sort((a, b) => a.name.localeCompare(b.name)),
    objects: objects.sort((a, b) => `${a.database}.${a.type}.${a.name}`.localeCompare(`${b.database}.${b.type}.${b.name}`)),
  };
}

export function validateIndexStats(actual: SchemaStats, expected: SchemaStats): void {
  const mismatches = Object.entries(expected).flatMap(([key, expectedValue]) => {
    const actualValue = actual[key as keyof SchemaStats];
    return actualValue === expectedValue
      ? []
      : [{ key, actual: actualValue, expected: expectedValue }];
  });

  if (mismatches.length > 0) {
    throw new DictionaryError("SCHEMA_COUNT_MISMATCH", "Schema count validation failed", {
      mismatches,
    });
  }
}

async function listHtmlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return listHtmlFiles(path);
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) return [path];
      return [];
    }),
  );
  return nested.flat();
}

export async function buildIndexFile({
  chmFile,
  extractDir,
  outputFile,
  validate = true,
}: BuildIndexOptions & { outputFile: string; validate?: boolean }): Promise<SchemaIndex> {
  await ensureExtracted(chmFile, extractDir);
  const index = await buildIndexFromExtractDir({ chmFile, extractDir });
  if (validate) {
    validateIndexStats(index.stats, EXPECTED_TPLUS_190_STATS);
  }
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  return index;
}

async function main(): Promise<void> {
  const chmFile = process.env.TPLUS_CHM_FILE ?? "T+19.0数据字典.chm";
  const extractDir = process.env.TPLUS_EXTRACT_DIR ?? "chm_extract";
  const outputFile = process.env.TPLUS_INDEX_FILE ?? "data/schema-index.json";
  const index = await buildIndexFile({ chmFile, extractDir, outputFile });
  console.error(`Wrote ${outputFile}`);
  console.error(JSON.stringify(index.stats));
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
```

- [ ] **Step 5: Run index builder tests**

Run:

```bash
npm test -- tests/parser/build-index.test.ts
```

Expected: PASS.

- [ ] **Step 6: Generate real schema index**

Run:

```bash
npm run build:index
```

Expected: exits with code 0 and prints stats matching:

```json
{"databases":2,"tables":1766,"views":130,"procedures":818,"functions":80}
```

- [ ] **Step 7: Commit index builder and generated index**

```bash
git add src/parser/extract.ts src/parser/build-index.ts tests/parser/build-index.test.ts data/schema-index.json
git commit -m "feat: build dictionary schema index"
```

## Task 5: Search And Lookup Layer

**Files:**
- Create: `src/shared/search.ts`
- Test: `tests/shared/search.test.ts`

- [ ] **Step 1: Write failing search tests**

Create `tests/shared/search.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  findObject,
  getDatabaseSummary,
  listObjects,
  searchObjects,
} from "../../src/shared/search.js";
import { DictionaryError } from "../../src/shared/errors.js";
import type { SchemaIndex } from "../../src/shared/types.js";

const index: SchemaIndex = {
  generatedAt: "2026-06-06T00:00:00.000Z",
  source: { chmFile: "T+19.0数据字典.chm", extractDir: "chm_extract" },
  stats: { databases: 2, tables: 1, views: 1, procedures: 1, functions: 2 },
  databases: [
    { id: "UFTData", name: "UFTData", tableCount: 1, viewCount: 1, procedureCount: 1, functionCount: 1, sourceFile: "uftdata.html" },
    { id: "UFTSystem", name: "UFTSystem", tableCount: 0, viewCount: 0, procedureCount: 0, functionCount: 1, sourceFile: "uftsystem.html" },
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
      columns: [{ name: "Updated", description: "更新时间", dataType: "datetime", length: "8", allowNulls: true, version: "T+17.0" }],
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
    expect(searchObjects(index, { query: "品牌", limit: 10 }).items[0].name).toBe("AA_BrandIndustry");
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
});
```

- [ ] **Step 2: Run search tests to verify failure**

Run:

```bash
npm test -- tests/shared/search.test.ts
```

Expected: FAIL with an import resolution error for `src/shared/search.js`.

- [ ] **Step 3: Implement search helpers**

Create `src/shared/search.ts`:

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DictionaryError } from "./errors.js";
import type {
  DatabaseInfo,
  ObjectFilter,
  ObjectLookupInput,
  Page,
  RawHtmlLookupInput,
  SchemaIndex,
  SchemaObject,
  SearchInput,
} from "./types.js";
import { decodeHtml } from "../parser/parse-html.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function getDatabaseSummary(index: SchemaIndex, database?: string): SchemaIndex["stats"] | DatabaseInfo {
  if (!database) return index.stats;

  const found = index.databases.find((item) => equalsFold(item.name, database) || equalsFold(item.id, database));
  if (!found) {
    throw new DictionaryError("DATABASE_NOT_FOUND", "Database not found", { database });
  }
  return found;
}

export function listObjects(index: SchemaIndex, filter: ObjectFilter): Page<SchemaObject> {
  const filtered = index.objects.filter((object) => {
    if (filter.database && !equalsFold(object.database, filter.database)) return false;
    if (filter.type && object.type !== filter.type) return false;
    if (filter.prefix && !object.name.toLowerCase().startsWith(filter.prefix.toLowerCase())) return false;
    return true;
  });

  return paginate(filtered, filter.limit, filter.offset);
}

export function searchObjects(index: SchemaIndex, input: SearchInput): Page<SchemaObject> {
  const query = normalize(input.query);
  if (!query) {
    throw new DictionaryError("INVALID_QUERY", "Search query must not be empty");
  }

  const filtered = index.objects.filter((object) => {
    if (input.database && !equalsFold(object.database, input.database)) return false;
    if (input.type && object.type !== input.type) return false;
    return buildSearchText(object).includes(query);
  });

  return paginate(filtered, input.limit, input.offset);
}

export function findObject(index: SchemaIndex, input: ObjectLookupInput): SchemaObject {
  if (input.id) {
    const found = index.objects.find((object) => equalsFold(object.id, input.id));
    if (!found) throw new DictionaryError("OBJECT_NOT_FOUND", "Object not found", input);
    return found;
  }

  if (!input.name) {
    throw new DictionaryError("INVALID_LOOKUP", "Either id or name is required", input);
  }

  const matches = index.objects.filter((object) => {
    if (!equalsFold(object.name, input.name ?? "")) return false;
    if (input.database && !equalsFold(object.database, input.database)) return false;
    if (input.type && object.type !== input.type) return false;
    return true;
  });

  if (matches.length === 0) {
    throw new DictionaryError("OBJECT_NOT_FOUND", "Object not found", input);
  }
  if (matches.length > 1) {
    throw new DictionaryError("AMBIGUOUS_OBJECT", "Object name is ambiguous; provide database or type", {
      input,
      matches: matches.map((object) => ({ id: object.id, database: object.database, type: object.type, name: object.name })),
    });
  }
  return matches[0];
}

export async function readRawHtml(index: SchemaIndex, input: RawHtmlLookupInput): Promise<{ sourceFile: string; html: string }> {
  const sourceFile = input.sourceFile ?? findObject(index, input).sourceFile;
  const absolutePath = join(index.source.extractDir, sourceFile);

  try {
    const buffer = await readFile(absolutePath);
    return { sourceFile, html: decodeHtml(buffer) };
  } catch (error) {
    throw new DictionaryError("RAW_HTML_NOT_FOUND", "Raw HTML source file is missing", {
      sourceFile,
      absolutePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

function buildSearchText(object: SchemaObject): string {
  return normalize(
    [
      object.id,
      object.database,
      object.type,
      object.name,
      object.displayName,
      object.module,
      object.summary,
      object.remark,
      object.version,
      ...(object.columns ?? []).flatMap((column) => [column.name, column.description, column.dataType, column.version]),
      ...(object.parameters ?? []).flatMap((parameter) => [parameter.name, parameter.description, parameter.dataType, parameter.version]),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function paginate<T>(items: T[], limitInput?: number, offsetInput?: number): Page<T> {
  const limit = Math.min(Math.max(limitInput ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(offsetInput ?? 0, 0);
  return {
    total: items.length,
    limit,
    offset,
    items: items.slice(offset, offset + limit),
  };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function equalsFold(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}
```

- [ ] **Step 4: Run search tests**

Run:

```bash
npm test -- tests/shared/search.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit search layer**

```bash
git add src/shared/search.ts tests/shared/search.test.ts
git commit -m "feat: add dictionary search helpers"
```

## Task 6: MCP Tool Handlers

**Files:**
- Create: `src/mcp/tool-handlers.ts`
- Test: `tests/mcp/tool-handlers.test.ts`

- [ ] **Step 1: Write failing tool handler tests**

Create `tests/mcp/tool-handlers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  createToolHandlers,
  jsonToolResult,
} from "../../src/mcp/tool-handlers.js";
import type { SchemaIndex } from "../../src/shared/types.js";

const index: SchemaIndex = {
  generatedAt: "2026-06-06T00:00:00.000Z",
  source: { chmFile: "T+19.0数据字典.chm", extractDir: "chm_extract" },
  stats: { databases: 1, tables: 1, views: 0, procedures: 0, functions: 0 },
  databases: [{ id: "UFTData", name: "UFTData", tableCount: 1, viewCount: 0, procedureCount: 0, functionCount: 0, sourceFile: "database.html" }],
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
```

- [ ] **Step 2: Run tool handler tests to verify failure**

Run:

```bash
npm test -- tests/mcp/tool-handlers.test.ts
```

Expected: FAIL with an import resolution error for `src/mcp/tool-handlers.js`.

- [ ] **Step 3: Implement pure MCP tool handlers**

Create `src/mcp/tool-handlers.ts`:

```ts
import { toErrorResponse } from "../shared/errors.js";
import {
  findObject,
  getDatabaseSummary,
  listObjects,
  readRawHtml,
  searchObjects,
} from "../shared/search.js";
import type {
  ObjectFilter,
  ObjectLookupInput,
  RawHtmlLookupInput,
  SchemaIndex,
  SearchInput,
} from "../shared/types.js";

export type McpTextResult = {
  content: Array<{ type: "text"; text: string }>;
};

export function jsonToolResult(value: unknown): McpTextResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

export function createToolHandlers(index: SchemaIndex) {
  return {
    getDatabaseSummary: (input: { database?: string }) =>
      safeResult(() => getDatabaseSummary(index, input.database)),

    listObjects: (input: ObjectFilter) =>
      safeResult(() => listObjects(index, input)),

    searchObjects: (input: SearchInput) =>
      safeResult(() => searchObjects(index, input)),

    getObject: (input: ObjectLookupInput) =>
      safeResult(() => findObject(index, input)),

    getColumns: (input: ObjectLookupInput & { query?: string }) =>
      safeResult(() => {
        const object = findObject(index, input);
        const columns = object.columns ?? [];
        const query = input.query?.toLowerCase();
        return query
          ? columns.filter((column) =>
              [column.name, column.description, column.dataType].filter(Boolean).join(" ").toLowerCase().includes(query),
            )
          : columns;
      }),

    getParameters: (input: ObjectLookupInput & { query?: string }) =>
      safeResult(() => {
        const object = findObject(index, input);
        const parameters = object.parameters ?? [];
        const query = input.query?.toLowerCase();
        return query
          ? parameters.filter((parameter) =>
              [parameter.name, parameter.description, parameter.dataType].filter(Boolean).join(" ").toLowerCase().includes(query),
            )
          : parameters;
      }),

    getRawHtml: (input: RawHtmlLookupInput) =>
      safeResult(() => readRawHtml(index, input)),
  };
}

async function safeResult<T>(operation: () => T | Promise<T>): Promise<McpTextResult> {
  try {
    return jsonToolResult(await operation());
  } catch (error) {
    return jsonToolResult(toErrorResponse(error));
  }
}
```

- [ ] **Step 4: Run tool handler tests**

Run:

```bash
npm test -- tests/mcp/tool-handlers.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit tool handlers**

```bash
git add src/mcp/tool-handlers.ts tests/mcp/tool-handlers.test.ts
git commit -m "feat: add MCP tool handlers"
```

## Task 7: Stdio MCP Server And Resources

**Files:**
- Create: `src/mcp/server.ts`
- Test by command: `npm run build`

- [ ] **Step 1: Create MCP server entrypoint**

Create `src/mcp/server.ts`:

```ts
#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createToolHandlers } from "./tool-handlers.js";
import { findObject } from "../shared/search.js";
import type { ObjectType, SchemaIndex } from "../shared/types.js";
import { toErrorResponse } from "../shared/errors.js";

const objectTypeSchema = z.enum(["table", "view", "procedure", "function"]);

async function loadIndex(indexFile = process.env.TPLUS_INDEX_FILE ?? "data/schema-index.json"): Promise<SchemaIndex> {
  const raw = await readFile(indexFile, "utf8");
  return JSON.parse(raw) as SchemaIndex;
}

async function main(): Promise<void> {
  const index = await loadIndex();
  const handlers = createToolHandlers(index);
  const server = new McpServer({
    name: "tplus-dictionary",
    version: "0.1.0",
  });

  server.registerTool(
    "get_database_summary",
    {
      title: "Get database summary",
      description: "Return global or per-database dictionary counts.",
      inputSchema: { database: z.string().optional() },
    },
    handlers.getDatabaseSummary,
  );

  server.registerTool(
    "list_objects",
    {
      title: "List dictionary objects",
      description: "List tables, views, procedures, or functions with pagination.",
      inputSchema: {
        database: z.string().optional(),
        type: objectTypeSchema.optional(),
        prefix: z.string().optional(),
        limit: z.number().int().positive().optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    handlers.listObjects,
  );

  server.registerTool(
    "search_objects",
    {
      title: "Search dictionary objects",
      description: "Search object names, Chinese descriptions, columns, and parameters.",
      inputSchema: {
        query: z.string(),
        database: z.string().optional(),
        type: objectTypeSchema.optional(),
        limit: z.number().int().positive().optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    handlers.searchObjects,
  );

  server.registerTool(
    "get_object",
    {
      title: "Get dictionary object",
      description: "Return one complete table, view, procedure, or function dictionary object.",
      inputSchema: {
        id: z.string().optional(),
        name: z.string().optional(),
        database: z.string().optional(),
        type: objectTypeSchema.optional(),
      },
    },
    handlers.getObject,
  );

  server.registerTool(
    "get_columns",
    {
      title: "Get table or view columns",
      description: "Return columns for a table or view.",
      inputSchema: {
        id: z.string().optional(),
        name: z.string().optional(),
        database: z.string().optional(),
        type: objectTypeSchema.optional(),
        query: z.string().optional(),
      },
    },
    handlers.getColumns,
  );

  server.registerTool(
    "get_parameters",
    {
      title: "Get procedure or function parameters",
      description: "Return parameters for a stored procedure or function.",
      inputSchema: {
        id: z.string().optional(),
        name: z.string().optional(),
        database: z.string().optional(),
        type: objectTypeSchema.optional(),
        query: z.string().optional(),
      },
    },
    handlers.getParameters,
  );

  server.registerTool(
    "get_raw_html",
    {
      title: "Get raw HTML",
      description: "Return decoded source HTML for a dictionary object.",
      inputSchema: {
        id: z.string().optional(),
        name: z.string().optional(),
        database: z.string().optional(),
        type: objectTypeSchema.optional(),
        sourceFile: z.string().optional(),
      },
    },
    handlers.getRawHtml,
  );

  server.registerResource(
    "schema-object",
    new ResourceTemplate("schema://{database}/{type}/{name}", {
      list: async () => ({
        resources: index.objects.map((object) => ({
          uri: `schema://${object.database}/${object.type}/${encodeURIComponent(object.name)}`,
          name: `${object.database}.${object.type}.${object.name}`,
          mimeType: "application/json",
        })),
      }),
    }),
    {
      title: "Dictionary object",
      description: "Read one schema object by schema://{database}/{type}/{name}.",
    },
    async (uri, variables) => {
      try {
        const object = findObject(index, {
          database: String(variables.database),
          type: String(variables.type) as ObjectType,
          name: decodeURIComponent(String(variables.name)),
        });
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(object, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(toErrorResponse(error), null, 2),
            },
          ],
        };
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(JSON.stringify(toErrorResponse(error), null, 2));
  process.exit(1);
});
```

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Smoke test server startup without index**

Move the generated index temporarily:

```bash
mv data/schema-index.json data/schema-index.json.bak
npm run build
node dist/mcp/server.js
```

Expected: process exits non-zero and prints a structured `INTERNAL_ERROR` containing the missing `data/schema-index.json` message.

Restore the index:

```bash
mv data/schema-index.json.bak data/schema-index.json
```

- [ ] **Step 4: Smoke test server startup with index**

Run:

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0.0.0"}}}\n' | node dist/mcp/server.js
```

Expected: output includes a JSON-RPC response with `"serverInfo":{"name":"tplus-dictionary","version":"0.1.0"}`.

- [ ] **Step 5: Commit MCP server**

```bash
git add src/mcp/server.ts
git commit -m "feat: expose dictionary MCP server"
```

## Task 8: README, Final Verification, And Push

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Replace `README.md` with:

```md
# chanjiet-ZD

T+ 19.0 database dictionary MCP service.

## What It Provides

This project parses `T+19.0数据字典.chm` into a local schema index and exposes it through a read-only stdio MCP server.

Dictionary coverage:

- Databases
- Tables
- Views
- Stored procedures
- Functions
- Table/view columns
- Procedure/function parameters
- Chinese descriptions, modules, versions, summaries, remarks, and source file references when present

The service does not connect to SQL Server and does not execute SQL.

## Setup

```bash
npm install
npm run build:index
npm run build
```

`npm run build:index` reads `T+19.0数据字典.chm` or an existing `chm_extract/` directory and writes `data/schema-index.json`.

## Run

```bash
npm run start
```

## MCP Client Config

Use an absolute path to the built server:

```json
{
  "mcpServers": {
    "tplus-dictionary": {
      "command": "node",
      "args": ["/absolute/path/to/chanjiet-ZD/dist/mcp/server.js"]
    }
  }
}
```

## Tools

- `get_database_summary`
- `list_objects`
- `search_objects`
- `get_object`
- `get_columns`
- `get_parameters`
- `get_raw_html`

## Resources

Object resources use this URI shape:

```text
schema://{database}/{type}/{objectName}
```

Examples:

```text
schema://UFTData/table/AA_BrandIndustry
schema://UFTData/view/V_ST_SubsidiaryBook_VoucherQuery
schema://UFTData/procedure/usp_update_state
schema://UFTData/function/AA_FN_CalcuGPSDistance
```
```

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Build schema index**

Run:

```bash
npm run build:index
```

Expected: exits with code 0 and prints:

```json
{"databases":2,"tables":1766,"views":130,"procedures":818,"functions":80}
```

- [ ] **Step 5: Build production output**

Run:

```bash
npm run build
```

Expected: PASS and `dist/mcp/server.js` exists.

- [ ] **Step 6: Verify git status**

Run:

```bash
git status -sb
```

Expected: only intended implementation files are modified or added. The source CHM may remain untracked unless the user explicitly asks to commit it.

- [ ] **Step 7: Commit docs and final wiring**

```bash
git add README.md data/schema-index.json
git commit -m "docs: document MCP dictionary service"
```

- [ ] **Step 8: Push main**

```bash
git push
```

Expected: push exits with code 0.

## Self-Review

Spec coverage:

- Full object coverage is handled by Tasks 3 and 4.
- `stdio` MCP tools and resources are handled by Tasks 6 and 7.
- Search, pagination, object lookup, columns, parameters, and raw HTML are handled by Tasks 5 and 6.
- CHM extraction, GBK decoding, generated JSON, and count validation are handled by Tasks 3 and 4.
- README client configuration is handled by Task 8.

Placeholder scan:

- No forbidden placeholder terms or unspecified edge handling remains.
- Every test command and expected result is explicit.

Type consistency:

- `SchemaIndex`, `SchemaObject`, `ColumnInfo`, and `ParameterInfo` names match across parser, search, handlers, and server tasks.
- Object lookup uses consistent `id`, `name`, `database`, and `type` inputs across all layers.
