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
