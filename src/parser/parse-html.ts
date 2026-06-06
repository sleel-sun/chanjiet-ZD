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
  const $ = cheerio.load(html);
  const title = cleanText($("title").first().text());
  const heading = cleanText($("h1").first().text());
  const database = cleanText($(".projectnametable td").eq(1).text());

  const objectTitle = parseObjectTitle(title);
  if (objectTitle) {
    const object: SchemaObject = pruneUndefined({
      id: `${database}.${objectTitle.type}.${objectTitle.name}`,
      database,
      type: objectTitle.type,
      name: objectTitle.name,
      displayName: objectTitle.name,
      module: extractModule(heading),
      summary: readSectionText($, "Summary"),
      remark: readSectionText($, "Remark"),
      version: extractPageVersion(heading),
      sourceFile,
    });

    if (objectTitle.type === "table" || objectTitle.type === "view") {
      object.columns = parseColumns($);
    } else {
      object.parameters = parseParameters($);
    }

    return { kind: "object", object };
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

  return optionalText(heading.nextAll("p").first().text());
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

function parseRows(
  $: cheerio.CheerioAPI,
  table: CheerioSelection,
): Array<{
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
