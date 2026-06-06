#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createToolHandlers } from "./tool-handlers.js";
import { toErrorResponse } from "../shared/errors.js";
import { findObject } from "../shared/search.js";
import type { ObjectType, SchemaIndex } from "../shared/types.js";

const objectTypeSchema = z.enum(["table", "view", "procedure", "function"]);

export async function loadIndex(indexFile = process.env.TPLUS_INDEX_FILE ?? "data/schema-index.json"): Promise<SchemaIndex> {
  const raw = await readFile(indexFile, "utf8");
  return JSON.parse(raw) as SchemaIndex;
}

export function createDictionaryServer(index: SchemaIndex): McpServer {
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

  return server;
}

export async function main(): Promise<void> {
  const index = await loadIndex();
  const server = createDictionaryServer(index);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  main().catch((error) => {
    console.error(JSON.stringify(toErrorResponse(error), null, 2));
    process.exit(1);
  });
}
