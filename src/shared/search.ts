import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { decodeHtml } from "../parser/parse-html.js";
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
    const id = input.id;
    const found = index.objects.find((object) => equalsFold(object.id, id));
    if (!found) throw new DictionaryError("OBJECT_NOT_FOUND", "Object not found", input);
    return found;
  }

  if (!input.name) {
    throw new DictionaryError("INVALID_LOOKUP", "Either id or name is required", input);
  }
  const name = input.name;

  const matches = index.objects.filter((object) => {
    if (!equalsFold(object.name, name)) return false;
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
      matches: matches.map((object) => ({
        id: object.id,
        database: object.database,
        type: object.type,
        name: object.name,
      })),
    });
  }
  return matches[0];
}

export async function readRawHtml(
  index: SchemaIndex,
  input: RawHtmlLookupInput,
): Promise<{ sourceFile: string; html: string }> {
  const sourceFile = input.sourceFile ?? findObject(index, input).sourceFile;
  const absolutePath = resolveSourceFile(index.source.extractDir, sourceFile);

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

function resolveSourceFile(extractDir: string, sourceFile: string): string {
  const extractRoot = resolve(extractDir);
  const absolutePath = resolve(extractRoot, sourceFile);
  const relativePath = relative(extractRoot, absolutePath);

  if (relativePath === "" || relativePath.startsWith("..") || relativePath.startsWith("/")) {
    throw new DictionaryError("INVALID_SOURCE_FILE", "Raw HTML source file must stay inside extraction directory", {
      extractDir,
      sourceFile,
    });
  }

  return absolutePath;
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
      ...(object.parameters ?? []).flatMap((parameter) => [
        parameter.name,
        parameter.description,
        parameter.dataType,
        parameter.version,
      ]),
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
