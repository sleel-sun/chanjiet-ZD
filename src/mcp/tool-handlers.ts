import { toErrorResponse } from "../shared/errors.js";
import { findObject, getDatabaseSummary, listObjects, readRawHtml, searchObjects } from "../shared/search.js";
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
    getDatabaseSummary: (input: { database?: string }) => safeResult(() => getDatabaseSummary(index, input.database)),

    listObjects: (input: ObjectFilter) => safeResult(() => listObjects(index, input)),

    searchObjects: (input: SearchInput) => safeResult(() => searchObjects(index, input)),

    getObject: (input: ObjectLookupInput) => safeResult(() => findObject(index, input)),

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
              [parameter.name, parameter.description, parameter.dataType]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(query),
            )
          : parameters;
      }),

    getRawHtml: (input: RawHtmlLookupInput) => safeResult(() => readRawHtml(index, input)),
  };
}

async function safeResult<T>(operation: () => T | Promise<T>): Promise<McpTextResult> {
  try {
    return jsonToolResult(await operation());
  } catch (error) {
    return jsonToolResult(toErrorResponse(error));
  }
}
