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
