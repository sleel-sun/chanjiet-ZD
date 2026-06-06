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
