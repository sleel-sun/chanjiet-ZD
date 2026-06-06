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
    objects: objects.sort((a, b) =>
      `${a.database}.${a.type}.${a.name}`.localeCompare(`${b.database}.${b.type}.${b.name}`),
    ),
  };
}

export function validateIndexStats(actual: SchemaStats, expected: SchemaStats): void {
  const mismatches = Object.entries(expected).flatMap(([key, expectedValue]) => {
    const actualValue = actual[key as keyof SchemaStats];
    return actualValue === expectedValue ? [] : [{ key, actual: actualValue, expected: expectedValue }];
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
