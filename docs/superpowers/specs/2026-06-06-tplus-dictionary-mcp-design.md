# T+ 19.0 Database Dictionary MCP Design

## Context

The workspace contains a single source database dictionary file:

- `T+19.0数据字典.chm`

The CHM can be extracted locally with `extract_chmLib`. The extracted content contains HTML schema pages encoded as `gb2312/gbk`, plus CHM index files.

Observed source counts:

- Databases: 2
- Tables: 1766
- Views: 130
- Stored procedures: 818
- Functions: 80

The main database is `UFTData`; `UFTSystem` contains one function entry in this dictionary.

## Goal

Build a generic local MCP service over the full database dictionary.

The service must expose all dictionary information available in the CHM:

- Databases
- Tables
- Views
- Stored procedures
- Functions
- Table/view columns
- Procedure/function parameters
- Object summaries, remarks, module names, versions, and source page references when present
- Raw HTML for source verification

The service is read-only. It does not connect to a real database and does not execute SQL.

## Recommended Approach

Use a Node.js + TypeScript MCP server over `stdio`.

Rationale:

- The official MCP SDK and client integrations fit Node.js well.
- `stdio` works across Cursor, Claude Desktop, Codex, and other MCP clients.
- A generated local JSON index keeps runtime startup simple and avoids database dependencies.

Rejected alternatives:

- Python MCP service: HTML parsing and encoding support are good, but MCP packaging and common client setup are less direct than Node.js.
- JSON-only output: too small in scope because the user requested an MCP service, not only a data package.

## Architecture

The project will have two layers.

### Parser Layer

The parser reads the CHM extraction output and builds a normalized schema index.

Responsibilities:

- Extract the CHM if `chm_extract` is missing and `extract_chmLib` is available.
- Decode all HTML pages from `gb2312/gbk` to UTF-8.
- Parse object identity from HTML `<title>` values.
- Parse database summaries.
- Parse table and view columns.
- Parse procedure and function parameters.
- Preserve source file references for traceability.
- Emit `data/schema-index.json`.
- Validate object counts against observed CHM counts.

### MCP Server Layer

The MCP server loads `data/schema-index.json` at startup and serves dictionary lookups through tools and resources.

Responsibilities:

- Provide stable query tools for common agent workflows.
- Provide object-level resources using schema URIs.
- Return structured errors for missing data or invalid input.
- Avoid network access and external database access.

## Directory Shape

Planned structure:

```text
src/
  parser/
    extract.ts
    parse-html.ts
    build-index.ts
  mcp/
    server.ts
    tools.ts
    resources.ts
  shared/
    types.ts
    search.ts
data/
  schema-index.json
docs/
  superpowers/
    specs/
package.json
tsconfig.json
README.md
```

The existing `chm_extract` directory is treated as generated source extraction output. The canonical runtime data is `data/schema-index.json`.

## Data Model

`data/schema-index.json` will contain:

```ts
type SchemaIndex = {
  generatedAt: string;
  source: {
    chmFile: string;
    extractDir: string;
  };
  stats: {
    databases: number;
    tables: number;
    views: number;
    procedures: number;
    functions: number;
  };
  databases: DatabaseInfo[];
  objects: SchemaObject[];
};
```

Database entries:

```ts
type DatabaseInfo = {
  id: string;
  name: string;
  tableCount: number;
  viewCount: number;
  procedureCount: number;
  functionCount: number;
  sourceFile: string;
};
```

Object entries:

```ts
type SchemaObject = {
  id: string;
  database: string;
  type: "table" | "view" | "procedure" | "function";
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
```

Column entries:

```ts
type ColumnInfo = {
  name: string;
  description?: string;
  dataType?: string;
  length?: string;
  allowNulls?: boolean;
  version?: string;
};
```

Parameter entries:

```ts
type ParameterInfo = {
  name: string;
  description?: string;
  dataType?: string;
  length?: string;
  allowNulls?: boolean;
  version?: string;
};
```

## MCP Tools

### `get_database_summary`

Returns database and object counts.

Inputs:

- Optional `database`

Output:

- Global counts if no database is specified.
- Per-database summary if `database` is specified.

### `list_objects`

Lists objects with pagination.

Inputs:

- Optional `database`
- Optional `type`: `table`, `view`, `procedure`, `function`
- Optional `prefix`
- Optional `limit`
- Optional `offset`

Output:

- Object summaries with `id`, `database`, `type`, `name`, `module`, `version`, and `sourceFile`
- `total`, `limit`, and `offset`

### `search_objects`

Searches object and child metadata.

Inputs:

- Required `query`
- Optional `type`
- Optional `database`
- Optional `limit`
- Optional `offset`

Search targets:

- Object name
- Object module
- Object summary
- Object remark
- Column names
- Column descriptions
- Parameter names
- Parameter descriptions

Matching is case-insensitive for ASCII names and direct substring based for Chinese text.

### `get_object`

Returns one full dictionary object.

Inputs:

- `name` or `id`
- Optional `database`
- Optional `type`

Output:

- Complete object metadata
- Columns for table/view objects
- Parameters for procedure/function objects

### `get_columns`

Returns columns for a table or view.

Inputs:

- Required `object`
- Optional `database`
- Optional `query`

Output:

- Filtered or complete column list

### `get_parameters`

Returns parameters for a stored procedure or function.

Inputs:

- Required `object`
- Optional `database`
- Optional `query`

Output:

- Filtered or complete parameter list

### `get_raw_html`

Returns UTF-8 decoded source HTML for verification.

Inputs:

- `name`, `id`, or `sourceFile`
- Optional `database`
- Optional `type`

Output:

- Source file path
- Decoded HTML text

## MCP Resources

The service will expose object resources with schema URIs:

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

Resource reads return the same structured data as `get_object`.

## Parsing Rules

Object type source of truth:

- HTML `<title>` ending with `Table`
- HTML `<title>` ending with `View`
- HTML `<title>` ending with `Stored Procedure`
- HTML `<title>` ending with `Function`
- Database pages identified by database summary sections

Metadata rules:

- Database name comes from the project name banner.
- Module comes from the parenthesized value in the page heading when present.
- Version comes from bracketed values like `[T+17.0]` when present.
- Summary and remark come from `Summary` and `Remark` sections when present.
- Table pages use the `Columns` table with `Allow Nulls`.
- View pages use the `Columns` table, which may omit `Allow Nulls`.
- Procedure/function pages use the `Parameters` table.

Encoding rules:

- Source HTML is decoded from `gb2312/gbk`.
- Runtime JSON and raw HTML outputs are UTF-8.

## Validation

The parser must validate the generated index against observed counts:

- Databases: 2
- Tables: 1766
- Views: 130
- Stored procedures: 818
- Functions: 80

Validation must also include sample checks:

- `AA_BrandIndustry` table includes Chinese column descriptions such as `更新时间`.
- `V_ST_SubsidiaryBook_VoucherQuery` view includes summary and remark text.
- `usp_update_state` stored procedure includes parameter metadata.
- `AA_FN_CalcuGPSDistance` function includes parameter metadata.

## Error Handling

Parser errors:

- Source CHM missing.
- Extraction directory missing and `extract_chmLib` unavailable.
- HTML decode failure.
- Object count validation mismatch.
- Malformed object page.

MCP runtime errors:

- Index file missing.
- Invalid tool input.
- Object not found.
- Ambiguous object name without type/database.
- Raw HTML source file missing.

Errors returned through MCP tools must be structured and actionable.

## Testing

Planned tests:

- Parser unit tests for table, view, procedure, and function sample pages.
- Encoding test for Chinese text.
- Search tests across object name, column name, and Chinese descriptions.
- Pagination tests for `list_objects`.
- Tool tests for object found, object missing, and ambiguous object name.
- Startup test when `data/schema-index.json` is missing.

## Client Setup

The README will include a generic MCP client configuration pattern:

```json
{
  "mcpServers": {
    "tplus-dictionary": {
      "command": "node",
      "args": ["/absolute/path/to/dist/mcp/server.js"]
    }
  }
}
```

It will also include local commands:

```bash
npm install
npm run build:index
npm run build
npm run start
```

## Out Of Scope

- Connecting to a live SQL Server database.
- Executing SQL, procedures, or functions.
- Inferring foreign keys not present in the source dictionary.
- Building a web UI.
- Publishing the package to npm.

