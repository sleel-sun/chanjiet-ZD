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
